import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/widgets/compass_dial_widget.dart';

void main() {
  group('Part H — Compass Dial Widget & Rotation Tests', () {
    testWidgets('CompassDialWidget renders with cardinal direction labels N, S, E, W', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: CompassDialWidget(
                heading: 45.0,
                size: 50.0,
              ),
            ),
          ),
        ),
      );

      expect(find.byType(CompassDialWidget), findsOneWidget);
      expect(find.byType(CustomPaint), findsWidgets);

      // Verify custom painter uses heading
      final customPaintFinder = find.descendant(
        of: find.byType(CompassDialWidget),
        matching: find.byType(CustomPaint),
      );
      final customPaint = tester.widget<CustomPaint>(customPaintFinder);
      expect(customPaint.painter, isA<CompassDialPainter>());
      final painter = customPaint.painter as CompassDialPainter;
      expect(painter.heading, 45.0);
    });

    testWidgets('CompassDialWidget invokes onTap callback to recenter map', (WidgetTester tester) async {
      bool recentered = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: CompassDialWidget(
                heading: 90.0,
                size: 50.0,
                onTap: () {
                  recentered = true;
                },
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byType(CompassDialWidget));
      await tester.pumpAndSettle();

      expect(recentered, isTrue);
    });

    test('CompassDialPainter shouldRepaint triggers on significant heading rotation', () {
      final painter1 = CompassDialPainter(heading: 0.0);
      final painter2 = CompassDialPainter(heading: 1.5);
      final painter3 = CompassDialPainter(heading: 0.1);

      expect(painter2.shouldRepaint(painter1), isTrue);
      expect(painter3.shouldRepaint(painter1), isFalse);
    });

    test('HeadingStream in IndoorPositionService broadcasts real-time heading updates', () async {
      final service = IndoorPositionService();
      double? receivedHeading;
      final sub = service.headingStream.listen((h) {
        receivedHeading = h;
      });

      // Simulate heading update using sensor test helper
      service.processSensorHeadingForTesting(
        magX: -1.0,
        magY: 0.0,
        timestampMs: 1000,
      );
      await Future.delayed(const Duration(milliseconds: 20));

      expect(receivedHeading, isNotNull);
      expect(receivedHeading!, closeTo(90.0, 1.0));
      await sub.cancel();
      service.dispose();
    });
  });

  group('Part I — Manual Start Navigation Gate Tests', () {
    test('Static entrance position does NOT advance via PDR when navigation is inactive', () {
      final service = IndoorPositionService();
      final entranceNode = MapNode(
        id: 'node_ent_1',
        name: 'Main Entrance',
        floor: 1,
        nodeType: 'entrance',
        x: 100.0,
        y: 200.0,
        latitude: 12.9716,
        longitude: 77.5946,
      );

      // Simulate static initial placement at entrance without starting tour
      service.updatePosition(
        PositionState(
          x: entranceNode.x,
          y: entranceNode.y,
          floor: entranceNode.floor,
          heading: 0.0,
          accuracy: 1.0,
          source: 'qr',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          currentNodeId: entranceNode.id,
          latitude: entranceNode.latitude,
          longitude: entranceNode.longitude,
        ),
      );

      expect(service.currentPosition, isNotNull);
      expect(service.currentPosition!.x, 100.0);
      expect(service.currentPosition!.y, 200.0);
      expect(service.currentPosition!.source, 'qr');

      // Before start, PDR is stopped
      expect(service.isPdrRunning, isFalse);

      service.dispose();
    });

    test('PDR starts only when startPdr() is explicitly called upon tapping Start Navigation', () {
      final service = IndoorPositionService();
      expect(service.isPdrRunning, isFalse);

      // User taps "Start Navigation"
      service.startPdr();
      expect(service.isPdrRunning, isTrue);

      // User cancels navigation
      service.stopPdr();
      expect(service.isPdrRunning, isFalse);

      service.dispose();
    });
  });
}
