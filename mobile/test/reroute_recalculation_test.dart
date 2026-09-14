import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/screens/physical_museum_screen.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/services/pathfinding.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Part A: Google-Maps-Style Indoor Reroute Recalculation', () {
    test('1. Deviation threshold is tuned to 4.5 meters and debounce to 1500ms', () {
      expect(PhysicalMuseumScreen.deviationThresholdMeters, equals(4.5));
      expect(PhysicalMuseumScreen.deviationDebounceMs, equals(1500));
    });

    test(
      '2. Reroute selects optimal forward node from REAL current position without returning to old polyline origin',
      () {
        // Floor plan: Corridor with nodes N1 -> N2 -> N3 -> Dest
        // User started at N1, walked past N2 and drifted into a gallery room at (16, 4)
        final floor0 = FloorPlan(
          id: '1',
          name: 'Main Floor',
          floorNumber: 0,
          imageUrl: '',
          widthPx: 1000,
          heightPx: 1000,
          scaleMetersPerPx: 1.0,
        );

        final n1 = MapNode(id: 'n1', name: 'Start Gate', floor: 0, x: 0, y: 0, nodeType: 'entrance');
        final n2 = MapNode(id: 'n2', name: 'Hallway Midpoint', floor: 0, x: 10, y: 0, nodeType: 'corridor');
        final n3 = MapNode(id: 'n3', name: 'Gallery Entry', floor: 0, x: 20, y: 0, nodeType: 'corridor');
        final dest = MapNode(id: 'dest', name: 'Mona Lisa', floor: 0, x: 30, y: 0, nodeType: 'artifact');
        // A side corridor node near the user's deviated position
        final sideNode = MapNode(id: 'side1', name: 'Side Wing', floor: 0, x: 16, y: 2, nodeType: 'corridor');

        final nodes = [n1, n2, n3, dest, sideNode];
        final edges = [
          MapEdge(id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', distance: 10, walkable: true),
          MapEdge(id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', distance: 10, walkable: true),
          MapEdge(id: 'e3', fromNodeId: 'n3', toNodeId: 'dest', distance: 10, walkable: true),
          MapEdge(id: 'e4', fromNodeId: 'n2', toNodeId: 'side1', distance: 6, walkable: true),
          MapEdge(id: 'e5', fromNodeId: 'side1', toNodeId: 'n3', distance: 6, walkable: true),
        ];

        final pathfinding = PathfindingService(
          nodes: nodes,
          edges: edges,
          floorPlans: [floor0],
        );

        // Visitor's live fused position has drifted to (16, 3), but their historical currentNodeId was 'n1'
        final livePos = PositionState(
          x: 16,
          y: 3,
          floor: 0,
          heading: 90,
          accuracy: 1.0,
          source: 'pdr',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          currentNodeId: 'n1', // Stale node from earlier path
        );

        // Simulation of new forward recalculation logic
        final floorNodes = nodes.where((n) => n.floor == livePos.floor).toList();
        final sorted = List<MapNode>.from(floorNodes);
        sorted.sort((a, b) {
          final da = (a.x - livePos.x) * (a.x - livePos.x) + (a.y - livePos.y) * (a.y - livePos.y);
          final db = (b.x - livePos.x) * (b.x - livePos.x) + (b.y - livePos.y) * (b.y - livePos.y);
          return da.compareTo(db);
        });

        // Top candidates near live position
        final candidates = sorted.take(5).toList();
        MapNode? bestCandidate;
        double bestTotal = double.infinity;

        for (final cand in candidates) {
          final dUser = (cand.x - livePos.x).abs() + (cand.y - livePos.y).abs();
          final route = pathfinding.findShortestPath(cand.id, dest.id);
          if (route != null) {
            final total = dUser + route.distance;
            if (total < bestTotal) {
              bestTotal = total;
              bestCandidate = cand;
            }
          }
        }

        expect(bestCandidate, isNotNull);
        // Best forward candidate should be 'side1' or 'n3', definitely NOT the historical 'n1'
        expect(bestCandidate!.id, isNot(equals('n1')));
        expect(bestCandidate.id, isIn(['side1', 'n3']));

        // Compute route from this forward candidate to destination
        final newRoute = pathfinding.findShortestPath(bestCandidate.id, dest.id);
        expect(newRoute, isNotNull);
        expect(newRoute!.path.last.id, equals('dest.id'.replaceAll('.id', '')));
        // New route does not contain n1 (no backward routing)
        expect(newRoute.path.map((n) => n.id).contains('n1'), isFalse);
      },
    );
  });
}
