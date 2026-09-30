import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  group('Fixed North-Up Map and Location Marker Tests', () {
    final floorPlan = FloorPlan(
      id: 'fp_1',
      name: 'Ground Floor',
      floorNumber: 1,
      imageUrl: '',
      widthPx: 800,
      heightPx: 600,
      scaleMetersPerPx: 0.05,
    );

    Matrix4 getViewerMatrix(WidgetTester tester) {
      final InteractiveViewer viewer = tester.widget(find.byType(InteractiveViewer));
      return viewer.transformationController!.value;
    }

    testWidgets('Map stays static North-Up when heading changes (0 rotation)', (WidgetTester tester) async {
      final key = GlobalKey<IndoorMapWidgetState>();
      final pos1 = PositionState(
        x: 400,
        y: 300,
        floor: 1,
        heading: 0.0, // Facing North
        accuracy: 1.0,
        source: 'test',
        timestamp: 1000,
      );

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
                currentPosition: pos1,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(key.currentState, isNotNull);

      // Verify initial matrix has 0 rotation
      var matrix = getViewerMatrix(tester);
      expect(matrix.row0.y, equals(0.0)); // No rotation
      expect(matrix.row1.x, equals(0.0)); // No rotation

      // Turn 90 degrees East
      final pos2 = pos1.copyWith(
        heading: 90.0,
        timestamp: 2000,
      );

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
                currentPosition: pos2,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Map layer MUST remain completely static with 0 rotation
      matrix = getViewerMatrix(tester);
      expect(matrix.row0.y, equals(0.0));
      expect(matrix.row1.x, equals(0.0));

      // Turn 180 degrees South
      final pos3 = pos2.copyWith(
        heading: 180.0,
        timestamp: 3000,
      );

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
                currentPosition: pos3,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Map layer MUST still have 0 rotation
      matrix = getViewerMatrix(tester);
      expect(matrix.row0.y, equals(0.0));
      expect(matrix.row1.x, equals(0.0));
    });

    testWidgets('Recenter in North-Up mode centers on user with 0 rotation', (WidgetTester tester) async {
      final key = GlobalKey<IndoorMapWidgetState>();
      final pos = PositionState(
        x: 400,
        y: 300,
        floor: 1,
        heading: 135.0, // Diagonal heading
        accuracy: 1.0,
        source: 'test',
        timestamp: 1000,
      );

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
                currentPosition: pos,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Trigger recenter
      key.currentState?.recenter();
      await tester.pumpAndSettle();

      final matrix = getViewerMatrix(tester);
      // Off-diagonal terms MUST be 0.0 (no rotation)
      expect(matrix.row0.y, equals(0.0));
      expect(matrix.row1.x, equals(0.0));
      // Scale is uniform positive
      expect(matrix.row0.x, greaterThan(1.0));
      expect(matrix.row0.x, equals(matrix.row1.y));
    });
  });
}
