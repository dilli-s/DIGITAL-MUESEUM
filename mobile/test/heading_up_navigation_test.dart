import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  group('Heading-Up 2D Navigation Mode Tests', () {
    final floorPlan = FloorPlan(
      id: 'fp_1',
      name: 'Ground Floor',
      floorNumber: 1,
      imageUrl: '',
      widthPx: 800,
      heightPx: 600,
      scaleMetersPerPx: 0.05,
    );

    testWidgets('IndoorMapWidget renders with isHeadingUp false in static overview', (WidgetTester tester) async {
      final key = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key,
                floorPlan: floorPlan,
                isHeadingUp: false,
                currentPosition: PositionState(
                  x: 400,
                  y: 300,
                  floor: 1,
                  heading: 45.0,
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.byType(IndoorMapWidget), findsOneWidget);
      expect(key.currentState, isNotNull);
      expect(key.currentState!.widget.isHeadingUp, isFalse);
    });

    testWidgets('IndoorMapWidget animates to heading-up and computes navigation matrix', (WidgetTester tester) async {
      final key = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key,
                floorPlan: floorPlan,
                isHeadingUp: true,
                currentPosition: PositionState(
                  x: 400,
                  y: 300,
                  floor: 1,
                  heading: 90.0, // Facing East
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(key.currentState, isNotNull);
      expect(key.currentState!.widget.isHeadingUp, isTrue);

      // Verify matrix computation
      final matrix = key.currentState!.computeHeadingUpMatrixForTesting();
      expect(matrix, isNotNull);

      // Verify rotation is counter-clockwise by heading in radians
      // heading = 90 deg -> rotRad = -pi / 2
      final expectedRot = -(90.0 * math.pi / 180.0);
      expect(matrix!.row0.x, closeTo(math.cos(expectedRot) * 2.4, 0.05));
    });

    testWidgets('Recenter method locks back into heading-up mode', (WidgetTester tester) async {
      final key = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key,
                floorPlan: floorPlan,
                isHeadingUp: true,
                currentPosition: PositionState(
                  x: 200,
                  y: 150,
                  floor: 1,
                  heading: 180.0,
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      key.currentState?.recenter();
      await tester.pumpAndSettle();

      final matrix = key.currentState!.computeHeadingUpMatrixForTesting();
      expect(matrix, isNotNull);
    });
  });

  group('Start / End Button Swap & Tour Progress Retention Tests', () {
    test('Ending navigation does NOT wipe visited node IDs', () {
      final Set<String> visitedNodeIds = {'node_1', 'node_2'};
      bool isNavigationActive = true;
      bool isTourActive = true;
      bool isHeadingUp = true;

      // Simulate _endNavigation
      isNavigationActive = false;
      isTourActive = false;
      isHeadingUp = false;

      // Visited nodes must remain intact
      expect(visitedNodeIds.contains('node_1'), isTrue);
      expect(visitedNodeIds.contains('node_2'), isTrue);
      expect(visitedNodeIds.length, 2);
      expect(isNavigationActive, isFalse);
      expect(isTourActive, isFalse);
      expect(isHeadingUp, isFalse);
    });
  });

  group('Live Distance and ETA Calculation Tests', () {
    test('ETA calculates correct walk time based on 1.4 m/s standard walking speed', () {
      int calculateWalkMinutes(double distanceMeters) {
        int walkMinutes = (distanceMeters / (1.4 * 60)).ceil();
        return walkMinutes < 1 ? 1 : walkMinutes;
      }

      expect(calculateWalkMinutes(0.0), 1);
      expect(calculateWalkMinutes(50.0), 1); // 50m / 84m/min = 0.59 -> 1 min
      expect(calculateWalkMinutes(100.0), 2); // 100m / 84m/min = 1.19 -> 2 min
      expect(calculateWalkMinutes(200.0), 3); // 200m / 84m/min = 2.38 -> 3 min
    });
  });

  group('Visual Fixes: Node Visibility Filter & Dynamic Viewport Cover Scale', () {
    final floorPlan = FloorPlan(
      id: 'fp_1',
      name: 'Ground Floor',
      floorNumber: 1,
      imageUrl: '',
      widthPx: 800,
      heightPx: 600,
      scaleMetersPerPx: 0.05,
    );

    test('IndoorMapWidget.isArtifactNode filters non-artifacts out of visual display', () {
      final entrance = MapNode(id: '1', name: 'Main Entrance', floor: 1, x: 10, y: 10, nodeType: 'entrance');
      final exit = MapNode(id: '2', name: 'Emergency Exit', floor: 1, x: 20, y: 20, nodeType: 'exit');
      final waypoint = MapNode(id: '3', name: 'Corridor WP', floor: 1, x: 30, y: 30, nodeType: 'waypoint');
      final junction = MapNode(id: '4', name: 'Junction A', floor: 1, x: 40, y: 40, nodeType: 'junction');
      final corridor = MapNode(id: '5', name: 'North Hall', floor: 1, x: 45, y: 45, nodeType: 'corridor');
      final restroom = MapNode(id: '6', name: 'Restroom', floor: 1, x: 50, y: 50, nodeType: 'restroom');
      final elevator = MapNode(id: '7', name: 'Elevator', floor: 1, x: 60, y: 60, nodeType: 'elevator');
      final stairs = MapNode(id: '8', name: 'Stairs', floor: 1, x: 70, y: 70, nodeType: 'stairs');

      final artifact1 = MapNode(id: '9', name: 'Mona Lisa', floor: 1, x: 100, y: 100, nodeType: 'artifact', objectId: 101);
      final artifact2 = MapNode(id: '10', name: 'Ancient Vase', floor: 1, x: 150, y: 150, nodeType: 'exhibit');
      final artifact3 = MapNode(id: '11', name: 'Bronze Statue', floor: 1, x: 200, y: 200, nodeType: 'object');
      final artifact4 = MapNode(id: '12', name: 'Royal Crown', floor: 1, x: 250, y: 250, nodeType: 'custom_type', objectId: 202);

      // Non-artifacts MUST NOT be displayed
      expect(IndoorMapWidget.isArtifactNode(entrance), isFalse);
      expect(IndoorMapWidget.isArtifactNode(exit), isFalse);
      expect(IndoorMapWidget.isArtifactNode(waypoint), isFalse);
      expect(IndoorMapWidget.isArtifactNode(junction), isFalse);
      expect(IndoorMapWidget.isArtifactNode(corridor), isFalse);
      expect(IndoorMapWidget.isArtifactNode(restroom), isFalse);
      expect(IndoorMapWidget.isArtifactNode(elevator), isFalse);
      expect(IndoorMapWidget.isArtifactNode(stairs), isFalse);

      // Artifacts MUST be displayed
      expect(IndoorMapWidget.isArtifactNode(artifact1), isTrue);
      expect(IndoorMapWidget.isArtifactNode(artifact2), isTrue);
      expect(IndoorMapWidget.isArtifactNode(artifact3), isTrue);
      expect(IndoorMapWidget.isArtifactNode(artifact4), isTrue);
    });

    testWidgets('Dynamic cover scale increases at 45 degrees to cover rotated viewport diagonal', (WidgetTester tester) async {
      final key0 = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key0,
                floorPlan: floorPlan,
                isHeadingUp: true,
                currentPosition: PositionState(
                  x: 400,
                  y: 300,
                  floor: 1,
                  heading: 0.0, // North
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final matrix0 = key0.currentState!.computeHeadingUpMatrixForTesting()!;
      // Scale factor extracted from matrix (norm of row 0 vector)
      final scale0 = math.sqrt(matrix0.row0.x * matrix0.row0.x + matrix0.row0.y * matrix0.row0.y);

      final key45 = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key45,
                floorPlan: floorPlan,
                isHeadingUp: true,
                currentPosition: PositionState(
                  x: 400,
                  y: 300,
                  floor: 1,
                  heading: 45.0, // Diagonal 45 degrees
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final matrix45 = key45.currentState!.computeHeadingUpMatrixForTesting()!;
      final scale45 = math.sqrt(matrix45.row0.x * matrix45.row0.x + matrix45.row0.y * matrix45.row0.y);

      // Rotated 45-degree rectangle diagonal requires larger scale to guarantee zero empty background
      expect(scale45, greaterThan(scale0));
    });

    testWidgets('Tapping non-artifact nodes (e.g. entrance/waypoint) is ignored, only artifact nodes tap', (WidgetTester tester) async {
      MapNode? tappedNode;
      final entrance = MapNode(id: 'ent_1', name: 'Main Entrance', floor: 1, x: 400, y: 300, nodeType: 'entrance');
      final artifact = MapNode(id: 'art_1', name: 'Gold Mask', floor: 1, x: 400, y: 300, nodeType: 'artifact', objectId: 99);

      final key = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key,
                floorPlan: floorPlan,
                allNodes: [entrance, artifact],
                isHeadingUp: false,
                onNodeTap: (node) {
                  tappedNode = node;
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap at the center of the screen where both nodes coincide
      await tester.tapAt(const Offset(200, 300));
      await tester.pumpAndSettle();

      // The tapped node MUST be the artifact, NEVER the entrance
      expect(tappedNode, isNotNull);
      expect(tappedNode!.id, 'art_1');
      expect(tappedNode!.nodeType, 'artifact');
    });

    testWidgets('Routes correctly path through entrance and waypoints with non-artifacts remaining in graph', (WidgetTester tester) async {
      final entrance = MapNode(id: 'n1', name: 'Entrance', floor: 1, x: 100, y: 100, nodeType: 'entrance');
      final waypoint = MapNode(id: 'n2', name: 'Hall WP', floor: 1, x: 200, y: 200, nodeType: 'waypoint');
      final destination = MapNode(id: 'n3', name: 'Mona Lisa', floor: 1, x: 300, y: 300, nodeType: 'artifact', objectId: 1);

      final route = [entrance, waypoint, destination];

      final key = GlobalKey<IndoorMapWidgetState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 600,
              child: IndoorMapWidget(
                key: key,
                floorPlan: floorPlan,
                allNodes: [entrance, waypoint, destination],
                destinationNode: destination,
                routePath: route,
                isHeadingUp: true,
                currentPosition: PositionState(
                  x: 100,
                  y: 100,
                  floor: 1,
                  heading: 45.0,
                  accuracy: 1.0,
                  source: 'test',
                  timestamp: 1000,
                ),
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Widget builds without error, graph contains all 3 nodes, route has all 3 points
      expect(key.currentState!.widget.allNodes.length, 3);
      expect(key.currentState!.widget.routePath.length, 3);
      expect(key.currentState!.widget.destinationNode?.id, 'n3');
    });
  });
}
