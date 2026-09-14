import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final testFloorPlan = FloorPlan(
    id: 'floor-1',
    name: 'Floor 1',
    floorNumber: 1,
    imageUrl: 'floor1.png',
    widthPx: 1000,
    heightPx: 1000,
    scaleMetersPerPx: 0.05,
  );

  PositionState createPosition({
    required double x,
    required double y,
    int floor = 1,
    double heading = 0.0,
    String source = 'pdr',
  }) {
    return PositionState(
      x: x,
      y: y,
      floor: floor,
      heading: heading,
      accuracy: 1.0,
      source: source,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );
  }

  // Helper to extract the CustomPaint's painter currentPosition
  PositionState? getPaintedPosition(WidgetTester tester) {
    final customPaintFinder = find.byType(CustomPaint);
    for (final element in customPaintFinder.evaluate()) {
      final widget = element.widget as CustomPaint;
      final painter = widget.painter;
      if (painter != null &&
          painter.runtimeType.toString() == '_FloorPlanPainter') {
        final dynamic p = painter;
        return p.currentPosition as PositionState?;
      }
    }
    return null;
  }

  testWidgets('Stationary position marker does not move or extrapolate', (
    tester,
  ) async {
    final initialPos = createPosition(x: 100.0, y: 200.0);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: initialPos,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Initial position
    var paintedPos = getPaintedPosition(tester);
    expect(paintedPos, isNotNull);
    expect(paintedPos!.x, equals(100.0));
    expect(paintedPos.y, equals(200.0));

    // Wait without any new updates
    await tester.pump(const Duration(milliseconds: 500));
    paintedPos = getPaintedPosition(tester);
    expect(paintedPos!.x, equals(100.0));
    expect(paintedPos.y, equals(200.0));

    await tester.pump(const Duration(seconds: 2));
    paintedPos = getPaintedPosition(tester);
    expect(paintedPos!.x, equals(100.0));
    expect(paintedPos.y, equals(200.0));
  });

  testWidgets('Walking step produces smooth visual interpolation over 280ms', (
    tester,
  ) async {
    final pos1 = createPosition(x: 100.0, y: 100.0);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: pos1,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    var paintedPos = getPaintedPosition(tester);
    expect(paintedPos!.x, equals(100.0));
    expect(paintedPos.y, equals(100.0));

    // Step update: moved to x=200, y=100
    final pos2 = createPosition(x: 200.0, y: 100.0);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: pos2,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Midway through interpolation (140ms)
    await tester.pump(const Duration(milliseconds: 140));
    paintedPos = getPaintedPosition(tester);
    expect(paintedPos, isNotNull);
    // Should be smoothly between 100 and 200 (not jumping instantly to 200)
    expect(paintedPos!.x, greaterThan(100.0));
    expect(paintedPos.x, lessThan(200.0));
    expect(paintedPos.y, equals(100.0));

    // Finish remaining animation duration
    await tester.pump(const Duration(milliseconds: 150));
    paintedPos = getPaintedPosition(tester);
    // Should reach exactly 200.0
    expect(paintedPos!.x, closeTo(200.0, 0.01));
    expect(paintedPos.y, equals(100.0));
  });

  testWidgets('Brisk walking smoothly redirects mid-flight without queueing', (
    tester,
  ) async {
    final pos1 = createPosition(x: 100.0, y: 100.0);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: pos1,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Step 1: moving toward x=200
    final pos2 = createPosition(x: 200.0, y: 100.0);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: pos2,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Advance partially (100ms)
    await tester.pump(const Duration(milliseconds: 100));
    final midPos = getPaintedPosition(tester)!;
    expect(midPos.x, greaterThan(100.0));
    expect(midPos.x, lessThan(200.0));

    // Step 2 arrives mid-flight, heading toward x=300, y=150
    final pos3 = createPosition(x: 300.0, y: 150.0);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 800,
            height: 600,
            child: IndoorMapWidget(
              floorPlan: testFloorPlan,
              currentPosition: pos3,
              onNodeTap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Advance 140ms from redirect
    await tester.pump(const Duration(milliseconds: 140));
    final redirectedPos = getPaintedPosition(tester)!;
    // Should smoothly head toward 300 from midPos
    expect(redirectedPos.x, greaterThan(midPos.x));
    expect(redirectedPos.x, lessThan(300.0));
    expect(redirectedPos.y, greaterThan(100.0));

    // Finish redirect animation (another 150ms)
    await tester.pump(const Duration(milliseconds: 150));
    final finalPos = getPaintedPosition(tester)!;
    expect(finalPos.x, closeTo(300.0, 0.01));
    expect(finalPos.y, closeTo(150.0, 0.01));
  });

  testWidgets(
    'Floor change immediately snaps position without cross-floor interpolation',
    (tester) async {
      final posFloor1 = createPosition(x: 100.0, y: 100.0, floor: 1);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 800,
              height: 600,
              child: IndoorMapWidget(
                floorPlan: testFloorPlan,
                currentPosition: posFloor1,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      var paintedPos = getPaintedPosition(tester);
      expect(paintedPos!.x, equals(100.0));
      expect(paintedPos.floor, equals(1));

      // Switch floor to floor 2 with totally different coordinates
      final posFloor2 = createPosition(x: 800.0, y: 900.0, floor: 2);
      final floor2Plan = FloorPlan(
        id: 'floor-2',
        name: 'Floor 2',
        floorNumber: 2,
        imageUrl: 'floor2.png',
        widthPx: 1000,
        heightPx: 1000,
        scaleMetersPerPx: 0.05,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 800,
              height: 600,
              child: IndoorMapWidget(
                floorPlan: floor2Plan,
                currentPosition: posFloor2,
                onNodeTap: (_) {},
              ),
            ),
          ),
        ),
      );

      // Must snap immediately on frame 0, NOT interpolate across floors
      paintedPos = getPaintedPosition(tester);
      expect(paintedPos!.x, equals(800.0));
      expect(paintedPos.y, equals(900.0));
      expect(paintedPos.floor, equals(2));
    },
  );
}
