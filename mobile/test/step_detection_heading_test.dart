import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final testFloorPlan = FloorPlan(
    id: 'fp-test',
    name: 'Main Gallery',
    floorNumber: 1,
    imageUrl: 'floor1.png',
    widthPx: 1000,
    heightPx: 1000,
    scaleMetersPerPx: 0.05,
  );

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

  group('Step Detection — Handling Rejection vs Genuine Walking', () {
    late IndoorPositionService service;

    setUp(() {
      service = IndoorPositionService()..demoMode = true;
      final nodeA = MapNode(
        id: 'a',
        name: 'A',
        floor: 1,
        x: 100,
        y: 100,
        nodeType: 'exhibit',
      );
      final nodeB = MapNode(
        id: 'b',
        name: 'B',
        floor: 1,
        x: 200,
        y: 100,
        nodeType: 'exhibit',
      );
      service.updateContext(
        testFloorPlan,
        [nodeA, nodeB],
        [
          MapEdge(
            id: 'e1',
            fromNodeId: 'a',
            toNodeId: 'b',
            distance: 20,
            walkable: true,
          ),
        ],
      );
      service.scanQR(nodeA);
    });

    tearDown(() {
      service.dispose();
    });

    test('Single pickup / handling spike does NOT advance position', () {
      final initialX = service.currentPosition!.x;
      final initialY = service.currentPosition!.y;
      int t = 1000;

      // Rest baseline
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.8, t);

      // Picking up phone: sudden acceleration spike (magnitude ~12.5 m/s^2, linear ~2.7)
      t += 50;
      service.processAccelerometerSampleForTesting(1.2, 1.8, 12.2, t);
      t += 50;
      service.processAccelerometerSampleForTesting(1.5, 2.0, 12.5, t); // peak
      t += 50;
      service.processAccelerometerSampleForTesting(0.5, 0.8, 10.5, t);
      t += 100;
      service.processAccelerometerSampleForTesting(
        0.0,
        0.0,
        9.8,
        t,
      ); // back to rest

      // No second periodic peak within walking cadence window
      t += 1500;
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.8, t);

      expect(service.currentPosition!.x, equals(initialX));
      expect(service.currentPosition!.y, equals(initialY));
      expect(service.hasStepSinceLastWifiCorrection, isFalse);
    });

    test('Setting phone down onto table does NOT advance position', () {
      final initialX = service.currentPosition!.x;
      final initialY = service.currentPosition!.y;
      int t = 1000;

      // Table impact spike (magnitude ~14.0 m/s^2, linear ~4.2)
      service.processAccelerometerSampleForTesting(0.2, 0.1, 9.8, t);
      t += 30;
      service.processAccelerometerSampleForTesting(
        0.5,
        0.5,
        14.0,
        t,
      ); // impact peak
      t += 30;
      service.processAccelerometerSampleForTesting(0.1, 0.1, 10.2, t);
      t += 40;
      service.processAccelerometerSampleForTesting(
        0.0,
        0.0,
        9.8,
        t,
      ); // resting flat

      // Idle for 1500ms
      t += 1500;
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.8, t);

      expect(service.currentPosition!.x, equals(initialX));
      expect(service.currentPosition!.y, equals(initialY));
      expect(service.hasStepSinceLastWifiCorrection, isFalse);
    });

    test('Stationary phone rotation in hand does NOT advance position', () {
      final initialX = service.currentPosition!.x;
      final initialY = service.currentPosition!.y;
      int t = 1000;

      // Tilting / twisting phone in hand (centripetal linear spike ~2.0 m/s^2)
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.8, t);
      t += 80;
      service.processAccelerometerSampleForTesting(2.0, 3.0, 11.2, t);
      t += 80;
      service.processAccelerometerSampleForTesting(0.1, 0.2, 9.8, t);

      t += 1500;
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.8, t);

      expect(service.currentPosition!.x, equals(initialX));
      expect(service.currentPosition!.y, equals(initialY));
      expect(service.hasStepSinceLastWifiCorrection, isFalse);
    });

    test('Genuine walking gait (periodic 1.8 Hz peak-trough-peak) advances position', () {
      int t = 1000;
      // Face East (90 degrees) towards node B (x=200, y=100)
      service.processSensorHeadingForTesting(
        magX: -1.0,
        magY: 0.0,
        timestampMs: t,
      );

      final initialX = service.currentPosition!.x;
      final initialY = service.currentPosition!.y;

      // Step 1: Heel strike peak at t=1000
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);
      t += 30;
      service.processAccelerometerSampleForTesting(
        1.0,
        1.0,
        12.8,
        t,
      ); // peak 1 (~3.0 linear)
      t += 30;
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);

      // Swing phase trough at t=1250 (decompression dip, linear < 0.7)
      t = 1250;
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.6, t); // trough

      // Step 2: Heel strike peak at t=1550 (interval = 550ms = 1.81 Hz, within 350..850ms cadence)
      t = 1520;
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);
      t = 1550;
      service.processAccelerometerSampleForTesting(1.0, 1.0, 13.0, t); // peak 2
      t = 1580;
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);

      // 2 consecutive gait peaks confirmed -> step detected!
      expect(service.currentPosition!.x > initialX, isTrue);
      expect(service.hasStepSinceLastWifiCorrection, isTrue);

      final secondStepX = service.currentPosition!.x;

      // Swing phase trough at t=1800
      t = 1800;
      service.processAccelerometerSampleForTesting(0.0, 0.0, 9.5, t); // trough

      // Step 3: Heel strike peak at t=2100 (interval = 550ms)
      t = 2070;
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);
      t = 2100;
      service.processAccelerometerSampleForTesting(1.0, 1.0, 13.0, t); // peak 3
      t = 2130;
      service.processAccelerometerSampleForTesting(0.5, 0.5, 11.0, t);

      // Step 3 advances position further
      expect(service.currentPosition!.x > secondStepX, isTrue);
    });
  });

  group('Heading Calculation & Complementary Sensor Fusion', () {
    late IndoorPositionService service;

    setUp(() {
      service = IndoorPositionService()..demoMode = true;
      final nodeA = MapNode(
        id: 'a',
        name: 'A',
        floor: 1,
        x: 100,
        y: 100,
        nodeType: 'exhibit',
      );
      service.updateContext(testFloorPlan, [nodeA], []);
      service.scanQR(nodeA);
    });

    tearDown(() {
      service.dispose();
    });

    test('Resting phone gyro noise within deadband does not cause drift', () {
      int t = 1000;
      // Initialize compass bearing at 90 degrees East (mx = -1.0, my = 0.0)
      service.processSensorHeadingForTesting(
        magX: -1.0,
        magY: 0.0,
        timestampMs: t,
      );
      expect(service.currentPosition!.heading, closeTo(90.0, 0.5));

      // Simulate 10 seconds of resting gyro noise (0.02 rad/s, within 0.035 deadband)
      for (int i = 1; i <= 100; i++) {
        t += 100;
        service.processSensorHeadingForTesting(gyroZ: 0.02, timestampMs: t);
      }

      // Heading should not have drifted
      expect(service.currentPosition!.heading, closeTo(90.0, 0.5));
    });

    test(
      'Genuine fast body rotation (> 70 deg/s) responds promptly without lag',
      () {
        int t = 1000;
        // Start North (heading 0)
        service.processSensorHeadingForTesting(
          magX: 0.0,
          magY: 1.0,
          timestampMs: t,
        );

        // Initialize gyro timestamp
        t += 50;
        service.processSensorHeadingForTesting(gyroZ: 0.0, timestampMs: t);

        // Fast clockwise turn: angular velocity -2.0 rad/s (-114.6 deg/s) over 500ms
        // 5 intervals of 100ms: Delta = 5 * (2.0 * 180 / pi * 0.1) = +57.3 degrees
        for (int i = 0; i < 5; i++) {
          t += 100;
          service.processSensorHeadingForTesting(gyroZ: -2.0, timestampMs: t);
        }

        expect(service.currentPosition!.heading, closeTo(57.3, 1.5));
      },
    );

    test(
      'Drift correction pulls heading towards magnetic reference over time',
      () {
        int t = 1000;
        // Initialize at 0 degrees
        service.processSensorHeadingForTesting(
          magX: 0.0,
          magY: 1.0,
          timestampMs: t,
        );

        // Initialize gyro timestamp
        t += 50;
        service.processSensorHeadingForTesting(gyroZ: 0.0, timestampMs: t);

        // Magnetometer reference points at 45 degrees
        final rad45 = 45.0 * math.pi / 180.0;
        double mx = -math.sin(rad45);
        double my = math.cos(rad45);

        // Apply 60 updates over 6 seconds
        for (int i = 0; i < 60; i++) {
          t += 100;
          service.processSensorHeadingForTesting(
            magX: mx,
            magY: my,
            gyroZ: 0.0,
            timestampMs: t,
          );
        }

        // Heading should have smoothly converged towards 45 degrees
        expect(service.currentPosition!.heading, greaterThan(25.0));
        expect(service.currentPosition!.heading, lessThanOrEqualTo(45.5));
      },
    );
  });

  group('IndoorMapWidget Heading Cone Smoothing & Rate Capping', () {
    testWidgets(
      'Heading cone animates smoothly and caps visual rotation speed',
      (tester) async {
        final pos1 = PositionState(
          x: 100.0,
          y: 100.0,
          floor: 1,
          heading: 0.0,
          accuracy: 1.0,
          source: 'pdr',
          timestamp: DateTime.now().millisecondsSinceEpoch,
        );

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

        var painted = getPaintedPosition(tester);
        expect(painted, isNotNull);
        expect(painted!.heading, equals(0.0));

        // Sensor briefly sends an abrupt heading jump of 90 degrees 50ms later
        final pos2 = pos1.copyWith(heading: 90.0);
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

        // Rate cap prevents instant snap to 90 degrees
        await tester.pump(const Duration(milliseconds: 20));
        painted = getPaintedPosition(tester);
        expect(painted!.heading, greaterThan(0.0));
        expect(painted.heading, lessThan(90.0));

        // After update finishes, heading smoothly settles towards target
        await tester.pump(const Duration(milliseconds: 300));
        painted = getPaintedPosition(tester);
        expect(painted!.heading, greaterThan(50.0));
        expect(painted.heading, lessThanOrEqualTo(90.0));

        // Second update brings heading to 90
        final pos3 = pos2.copyWith(
          heading: 90.0,
          timestamp: pos2.timestamp + 500,
        );
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
        await tester.pump(const Duration(milliseconds: 300));
        painted = getPaintedPosition(tester);
        expect(painted!.heading, closeTo(90.0, 0.5));
      },
    );
  });
}
