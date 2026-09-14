import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/utils/navigation_math.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  group('Floor Isolation and Blue Dot Navigation Tests', () {
    final floor1 = FloorPlan(
      id: 'fp-1',
      name: 'Ground Floor',
      floorNumber: 1,
      imageUrl: '/images/floor1.png',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.1,
    );

    final floor2 = FloorPlan(
      id: 'fp-2',
      name: 'Second Floor',
      floorNumber: 2,
      imageUrl: '/images/floor2.png',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.1,
    );

    final galleries = [
      Gallery(
        id: 101,
        museumId: 1,
        name: 'Floor 1 Room',
        floor: '1',
        boundaryPolygon: [
          {'x': 0.1, 'y': 0.1},
          {'x': 0.4, 'y': 0.1},
          {'x': 0.4, 'y': 0.4},
          {'x': 0.1, 'y': 0.4},
        ],
      ),
      Gallery(
        id: 201,
        museumId: 1,
        name: 'Floor 2 Room',
        floor: '2',
        boundaryPolygon: [
          {'x': 0.5, 'y': 0.5},
          {'x': 0.8, 'y': 0.5},
          {'x': 0.8, 'y': 0.8},
          {'x': 0.5, 'y': 0.8},
        ],
      ),
    ];

    final nodes = [
      MapNode(
        id: 'node-f1-entry',
        name: 'F1 Entrance',
        floor: 1,
        x: 0.2,
        y: 0.2,
        nodeType: 'entrance',
      ),
      MapNode(
        id: 'node-f1-dest',
        name: 'F1 Exhibit',
        floor: 1,
        x: 0.3,
        y: 0.3,
        nodeType: 'exhibit',
      ),
      MapNode(
        id: 'node-f2-dest',
        name: 'F2 Exhibit',
        floor: 2,
        x: 0.6,
        y: 0.6,
        nodeType: 'exhibit',
      ),
    ];

    test('isPointInNormalizedPolygon detects indoor (x, y) coordinates correctly', () {
      final poly = [
        {'x': 0.1, 'y': 0.1},
        {'x': 0.4, 'y': 0.1},
        {'x': 0.4, 'y': 0.4},
        {'x': 0.1, 'y': 0.4},
      ];

      expect(NavigationMath.isPointInNormalizedPolygon(0.2, 0.2, poly), isTrue);
      expect(NavigationMath.isPointInNormalizedPolygon(0.5, 0.5, poly), isFalse);
    });

    testWidgets('IndoorMapWidget renders on Floor 1 without crashing and accepts blue dot',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IndoorMapWidget(
              floorPlan: floor1,
              galleries: galleries,
              allNodes: nodes,
              currentPosition: PositionState(
                x: 0.2,
                y: 0.2,
                floor: 1,
                heading: 45.0,
                accuracy: 1.0,
                source: 'fused',
                timestamp: 1000,
              ),
              routePath: [nodes[0], nodes[1]],
              destinationNode: nodes[1],
              onNodeTap: (_) {},
            ),
          ),
        ),
      );

      expect(find.byType(IndoorMapWidget), findsOneWidget);
      expect(find.byType(CustomPaint), findsWidgets);
    });

    testWidgets('IndoorMapWidget renders on Floor 2 with blue dot on Floor 2',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IndoorMapWidget(
              floorPlan: floor2,
              galleries: galleries,
              allNodes: nodes,
              currentPosition: PositionState(
                x: 0.6,
                y: 0.6,
                floor: 2,
                heading: 90.0,
                accuracy: 1.0,
                source: 'fused',
                timestamp: 1000,
              ),
              routePath: [nodes[2]],
              destinationNode: nodes[2],
              onNodeTap: (_) {},
            ),
          ),
        ),
      );

      expect(find.byType(IndoorMapWidget), findsOneWidget);
    });
  });
}
