import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/pathfinding.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3 — Pathfinding Multi-Floor Tour Tests', () {
    final floor0 = FloorPlan(
      id: '1',
      name: 'Ground Floor',
      floorNumber: 0,
      imageUrl: '',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
    );

    final floor1 = FloorPlan(
      id: '2',
      name: 'First Floor',
      floorNumber: 1,
      imageUrl: '',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
    );

    final nodes = [
      // Ground Floor
      MapNode(
        id: 'entrance-0',
        name: 'Main Entrance',
        floor: 0,
        x: 0,
        y: 0,
        nodeType: 'entrance',
        latitude: 13.06900,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'art-f0-1',
        name: 'Bronze Sculpture',
        floor: 0,
        x: 10,
        y: 0,
        nodeType: 'artifact',
        latitude: 13.06905,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'art-f0-2',
        name: 'Ancient Coins',
        floor: 0,
        x: 20,
        y: 0,
        nodeType: 'exhibit',
        latitude: 13.06910,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'stairs-0',
        name: 'Stairs GF',
        floor: 0,
        x: 30,
        y: 0,
        nodeType: 'stairs',
        latitude: 13.06915,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'exit-0',
        name: 'Main Exit',
        floor: 0,
        x: 0,
        y: 10,
        nodeType: 'exit',
        latitude: 13.06900,
        longitude: 80.25510,
      ),

      // First Floor
      MapNode(
        id: 'stairs-1',
        name: 'Stairs FF',
        floor: 1,
        x: 30,
        y: 0,
        nodeType: 'stairs',
        latitude: 13.06915,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'art-f1-1',
        name: 'Royal Paintings',
        floor: 1,
        x: 40,
        y: 0,
        nodeType: 'artifact',
        latitude: 13.06920,
        longitude: 80.25500,
      ),
      MapNode(
        id: 'art-f1-2',
        name: 'Gold Crown',
        floor: 1,
        x: 50,
        y: 0,
        nodeType: 'exhibit',
        latitude: 13.06925,
        longitude: 80.25500,
      ),
    ];

    final edges = [
      // GF Connections
      MapEdge(id: '1', fromNodeId: 'entrance-0', toNodeId: 'art-f0-1', distance: 5, edgeType: 'corridor', walkable: true),
      MapEdge(id: '2', fromNodeId: 'art-f0-1', toNodeId: 'art-f0-2', distance: 5, edgeType: 'corridor', walkable: true),
      MapEdge(id: '3', fromNodeId: 'art-f0-2', toNodeId: 'stairs-0', distance: 5, edgeType: 'corridor', walkable: true),
      MapEdge(id: '4', fromNodeId: 'entrance-0', toNodeId: 'exit-0', distance: 10, edgeType: 'corridor', walkable: true),
      // Inter-floor Connection
      MapEdge(id: '5', fromNodeId: 'stairs-0', toNodeId: 'stairs-1', distance: 10, edgeType: 'stairs', walkable: true),
      // FF Connections
      MapEdge(id: '6', fromNodeId: 'stairs-1', toNodeId: 'art-f1-1', distance: 5, edgeType: 'corridor', walkable: true),
      MapEdge(id: '7', fromNodeId: 'art-f1-1', toNodeId: 'art-f1-2', distance: 5, edgeType: 'corridor', walkable: true),
    ];

    test('planFullTour visits artifacts across multiple floors without zig-zagging', () {
      final pathfinding = PathfindingService(
        nodes: nodes,
        edges: edges,
        floorPlans: [floor0, floor1],
      );

      final artifacts = ['art-f0-1', 'art-f0-2', 'art-f1-1', 'art-f1-2'];
      final tour = pathfinding.planFullTour('entrance-0', 'exit-0', artifacts);

      expect(tour, isNotNull);
      final pathIds = tour!.path.map((n) => n.id).toList();

      // Ensure all artifacts are visited
      for (final artId in artifacts) {
        expect(pathIds.contains(artId), isTrue, reason: 'Tour should include $artId');
      }

      // Ground floor artifacts should be visited together before stairs
      final idxF0_1 = pathIds.indexOf('art-f0-1');
      final idxF0_2 = pathIds.indexOf('art-f0-2');
      final idxStairs0 = pathIds.indexOf('stairs-0');
      final idxF1_1 = pathIds.indexOf('art-f1-1');

      expect(idxF0_1 < idxStairs0, isTrue);
      expect(idxF0_2 < idxStairs0, isTrue);
      expect(idxStairs0 < idxF1_1, isTrue);

      // Tour should terminate at exit
      expect(pathIds.last, equals('exit-0'));
    });
  });

  group('Phase 3 — Amenity & Map Helper Tests', () {
    String getAmenityIcon(String nodeType) {
      final t = nodeType.toLowerCase();
      if (t.contains('restroom') || t.contains('toilet') || t.contains('washroom')) return '🚻';
      if (t.contains('elevator') || t.contains('lift')) return '🛗';
      if (t.contains('stairs') || t.contains('staircase')) return '🪜';
      if (t.contains('exit')) return '🚪';
      if (t.contains('entrance') || t.contains('entry')) return '🏛️';
      if (t.contains('cafe') || t.contains('cafeteria') || t.contains('canteen')) return '☕';
      if (t.contains('water') || t.contains('drinking')) return '💧';
      if (t.contains('info') || t.contains('help')) return 'ℹ️';
      return '';
    }

    test('Amenity icons map correctly for all amenity categories', () {
      expect(getAmenityIcon('restroom'), equals('🚻'));
      expect(getAmenityIcon('elevator'), equals('🛗'));
      expect(getAmenityIcon('stairs'), equals('🪜'));
      expect(getAmenityIcon('exit'), equals('🚪'));
      expect(getAmenityIcon('entrance'), equals('🏛️'));
      expect(getAmenityIcon('cafe'), equals('☕'));
      expect(getAmenityIcon('drinking_water'), equals('💧'));
      expect(getAmenityIcon('info_desk'), equals('ℹ️'));
    });
  });

  group('Phase 3 — Tour Suspend & Resume Logic Tests', () {
    test('Suspending tour preserves remaining stops and resume restores them', () {
      List<String> tourStops = ['art-1', 'art-2', 'art-3', 'exit-0'];
      bool isTourActive = true;
      List<String>? suspendedTourStops;
      bool isTourSuspended = false;

      // User selects selective navigation (e.g. amenity or specific artifact)
      void startSelectiveNavigation(String targetId) {
        if (isTourActive) {
          suspendedTourStops = List.from(tourStops);
          isTourSuspended = true;
          isTourActive = false;
        }
      }

      startSelectiveNavigation('restroom-node');

      expect(isTourActive, isFalse);
      expect(isTourSuspended, isTrue);
      expect(suspendedTourStops, equals(['art-1', 'art-2', 'art-3', 'exit-0']));

      // User resumes tour
      void resumeTour() {
        if (suspendedTourStops != null && suspendedTourStops!.isNotEmpty) {
          tourStops = List.from(suspendedTourStops!);
          suspendedTourStops = null;
          isTourSuspended = false;
          isTourActive = true;
        }
      }

      resumeTour();

      expect(isTourActive, isTrue);
      expect(isTourSuspended, isFalse);
      expect(suspendedTourStops, isNull);
      expect(tourStops, equals(['art-1', 'art-2', 'art-3', 'exit-0']));
    });

    test('Zero GPS floor plan navigation computes route and instructions without lat/long', () {
      final fp = FloorPlan(
        id: 'fp-zero-gps',
        name: 'First Floor',
        floorNumber: 1,
        imageUrl: '/uploads/floor.png',
        widthPx: 613,
        heightPx: 370,
        scaleMetersPerPx: 0.035,
      );

      final zeroGpsNodes = [
        MapNode(
          id: 'n-entry',
          name: 'Main Entrance',
          floor: 1,
          x: 175,
          y: 260,
          nodeType: 'entrance',
          floorPlanId: 'fp-zero-gps',
          latitude: null,
          longitude: null,
        ),
        MapNode(
          id: 'n-hall',
          name: 'Hallway Center',
          floor: 1,
          x: 320,
          y: 260,
          nodeType: 'junction',
          floorPlanId: 'fp-zero-gps',
          latitude: null,
          longitude: null,
        ),
        MapNode(
          id: 'n-bed1',
          name: 'Bedroom 1 (Master Bedroom)',
          floor: 1,
          x: 490,
          y: 140,
          nodeType: 'room',
          floorPlanId: 'fp-zero-gps',
          latitude: null,
          longitude: null,
        ),
      ];

      final zeroGpsEdges = [
        MapEdge(
          id: 'e1',
          fromNodeId: 'n-entry',
          toNodeId: 'n-hall',
          distance: 5.08,
          walkable: true,
        ),
        MapEdge(
          id: 'e2',
          fromNodeId: 'n-hall',
          toNodeId: 'n-bed1',
          distance: 7.28,
          walkable: true,
        ),
      ];

      final pathfinder = PathfindingService(
        nodes: zeroGpsNodes,
        edges: zeroGpsEdges,
        floorPlans: [fp],
      );

      final route = pathfinder.findShortestPath('n-entry', 'n-bed1');
      expect(route, isNotNull);
      expect(route!.path.length, equals(3));
      expect(route.path.map((n) => n.id).toList(), equals(['n-entry', 'n-hall', 'n-bed1']));
      expect(route.distance, closeTo(12.36, 0.1));
      expect(route.instructions.isNotEmpty, isTrue);
      expect(route.instructions.first, contains('Start at Main Entrance'));
      expect(route.instructions.last, contains('Bedroom 1 (Master Bedroom)'));
    });
  });
}
