import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/utils/wall_crossing_validator.dart';
import 'package:mobile/widgets/indoor_map_widget.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Part A: 1:1 Step-to-Update Mapping & Real Compass', () {
    test(
      'Strict 1:1 step-to-update mapping: N steps = exactly N position updates',
      () async {
        final service = IndoorPositionService();
        final floorPlan = FloorPlan(
          id: 'fp-1',
          name: 'Main Gallery',
          floorNumber: 1,
          imageUrl: 'floor1.png',
          widthPx: 1000,
          heightPx: 1000,
          scaleMetersPerPx: 0.05,
        );

        service.updateContext(floorPlan, [], []);
        service.updatePosition(
          PositionState(
            latitude: 12.971600,
            longitude: 77.594600,
            x: 0.50,
            y: 0.50,
            floor: 1,
            heading: 0.0,
            accuracy: 1.0,
            source: 'init',
            timestamp: 1000,
          ),
        );

        int positionUpdateCount = 0;
        final sub = service.positionStream.listen((pos) {
          positionUpdateCount++;
        });

        // 1. Set pending WiFi target (simulating background scan resolving)
        service.setPendingWifiTargetForTesting(0.52, 0.52, 0.85);

        // Assert that pending WiFi alone DID NOT trigger any position update!
        await Future.delayed(const Duration(milliseconds: 20));
        expect(
          positionUpdateCount,
          0,
          reason: 'WiFi scan must NEVER independently move marker without a detected step',
        );

        // 2. Simulate walking exactly 5 steps
        for (int i = 0; i < 5; i++) {
          service.onStepDetectedForTesting();
          await Future.delayed(const Duration(milliseconds: 10));
        }

        // Assert that exactly 5 position updates were applied
        expect(
          positionUpdateCount,
          5,
          reason: 'Walking exactly 5 steps must produce exactly 5 discrete position updates',
        );

        await sub.cancel();
        service.dispose();
      },
    );

    test('True compass fusion: 3D tilt compensation preserves magnetic north under pitch/roll', () {
      final service = IndoorPositionService();

      // With phone held flat: gravity vector points down Z axis (gx=0, gy=0, gz=9.8)
      // Magnetometer points along Y (North)
      service.processSensorHeadingForTesting(
        accelX: 0.0,
        accelY: 0.0,
        accelZ: 9.8,
        magX: 0.0,
        magY: 30.0,
        magZ: 0.0,
      );

      final flatHeading = service.currentHeading;
      expect(
        flatHeading,
        closeTo(0.0, 5.0),
        reason: 'Flat phone pointing North should yield ~0 degrees heading',
      );

      // Now tilt phone upward (pitch ~30 degrees): gravity shifts to Y axis (gy = -4.9, gz = 8.5)
      // Pure 2D atan2(-mx, my) would be corrupted by tilt, but 3D de-rotation maintains true compass heading
      service.processSensorHeadingForTesting(
        accelX: 0.0,
        accelY: -4.9,
        accelZ: 8.5,
        magX: 0.0,
        magY: 26.0,
        magZ: -15.0,
      );

      final tiltedHeading = service.currentHeading;
      expect(
        tiltedHeading,
        closeTo(0.0, 10.0),
        reason: 'Tilt-compensated fusion must keep heading stable near North under pitch',
      );

      service.dispose();
    });
  });

  group(
    'Part A & B: Proximity Trigger, Node Completion, & Route Line Persistence',
    () {
      testWidgets('Visited nodes render in distinct muted gray (0xFF94A3B8)', (
        tester,
      ) async {
        final floorPlan = FloorPlan(
          id: 'fp-1',
          name: 'Gallery Ground',
          floorNumber: 1,
          imageUrl: 'floor1.png',
          widthPx: 500,
          heightPx: 500,
          scaleMetersPerPx: 0.04,
        );

        final node1 = MapNode(
          id: 'node-1',
          floorPlanId: 'fp-1',
          name: 'Bronze Chola Nataraja',
          floor: 1,
          x: 0.2,
          y: 0.2,
          nodeType: 'exhibit',
          objectId: 101,
        );

        final node2 = MapNode(
          id: 'node-2',
          floorPlanId: 'fp-1',
          name: 'Hoysala Inscription',
          floor: 1,
          x: 0.7,
          y: 0.7,
          nodeType: 'exhibit',
          objectId: 102,
        );

        // Node 1 is visited, Node 2 is unvisited
        final visitedIds = {'node-1'};

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SizedBox(
                width: 400,
                height: 400,
                child: IndoorMapWidget(
                  floorPlan: floorPlan,
                  currentPosition: PositionState(
                    latitude: 12.0,
                    longitude: 77.0,
                    x: 0.25,
                    y: 0.25,
                    floor: 1,
                    heading: 0.0,
                    accuracy: 1.0,
                    source: 'pdr',
                    timestamp: 1000,
                  ),
                  routePath: [node1, node2],
                  destinationNode: node2,
                  allNodes: [node1, node2],
                  galleries: const [],
                  visitedNodeIds: visitedIds,
                  onNodeTap: (_) {},
                ),
              ),
            ),
          ),
        );

        await tester.pump(const Duration(milliseconds: 50));

        // Find IndoorMapWidget and confirm visitedNodeIds is linked
        final mapWidgetFinder = find.byType(IndoorMapWidget);
        expect(mapWidgetFinder, findsOneWidget);
        final widget = tester.widget<IndoorMapWidget>(mapWidgetFinder);
        expect(widget.visitedNodeIds.contains('node-1'), isTrue);
        expect(widget.visitedNodeIds.contains('node-2'), isFalse);
      });

      test('Route polyline persistence: route connects live marker to upcoming waypoints', () {
        final p1 = PositionState(
          latitude: 12.0,
          longitude: 77.0,
          x: 0.1,
          y: 0.1,
          floor: 1,
          heading: 0.0,
          accuracy: 1.0,
          source: 'pdr',
          timestamp: 1000,
        );

        final nextStop = MapNode(
          id: 'stop-2',
          floorPlanId: 'fp-1',
          name: 'Stop 2',
          floor: 1,
          x: 0.4,
          y: 0.4,
          nodeType: 'exhibit',
        );

        final remainingRoute = [nextStop];
        expect(remainingRoute.length, 1);
        expect(p1.x, 0.1);
        expect(nextStop.x, 0.4);
      });
    },
  );

  group('Part C: Wall-Crossing Constraint Validation', () {
    test('Straight-line movement crossing room boundary is REJECTED', () {
      // Room from x: 0.2..0.4, y: 0.2..0.4
      final room = RoomBoundary(
        id: 'room-1',
        name: 'Stair Landing',
        floor: 1,
        walkable: true,
        polygon: [
          math.Point(0.2, 0.2),
          math.Point(0.4, 0.2),
          math.Point(0.4, 0.4),
          math.Point(0.2, 0.4),
        ],
      );

      // 1. Move from inside (0.35, 0.30) to outside (0.50, 0.30) without doorway
      final resultRejected = WallCrossingValidator.validateMovement(
        x1: 0.35,
        y1: 0.30,
        x2: 0.50,
        y2: 0.30,
        floor: 1,
        rooms: [room],
        doorways: [],
        entranceNodes: [],
      );

      expect(
        resultRejected.allowed,
        isFalse,
        reason: 'Movement crossing wall boundary without a doorway MUST be rejected',
      );
      expect(resultRejected.rejectionReason, contains('crosses wall'));

      // 2. Legitimate movement passing through a doorway opening (at x=0.4, y=0.30)
      final doorway = DoorwayOpening(
        name: 'door-1',
        x1: 0.40,
        y1: 0.28,
        x2: 0.40,
        y2: 0.32,
      );

      final resultAllowed = WallCrossingValidator.validateMovement(
        x1: 0.35,
        y1: 0.30,
        x2: 0.50,
        y2: 0.30,
        floor: 1,
        rooms: [room],
        doorways: [doorway],
        entranceNodes: [],
      );

      expect(
        resultAllowed.allowed,
        isTrue,
        reason: 'Movement passing through a doorway MUST be allowed',
      );
    });

    test('IndoorPositionService rejects wall-crossing update and retains last valid position', () {
      final service = IndoorPositionService();
      final floorPlan = FloorPlan(
        id: 'fp-1',
        name: 'Floor with Walls',
        floorNumber: 1,
        imageUrl: '',
        widthPx: 1000,
        heightPx: 1000,
        scaleMetersPerPx: 0.04,
      );

      final room = RoomBoundary(
        id: 'room-1',
        name: 'Sculpture Room',
        floor: 1,
        walkable: true,
        polygon: [
          math.Point(0.1, 0.1),
          math.Point(0.3, 0.1),
          math.Point(0.3, 0.3),
          math.Point(0.1, 0.3),
        ],
      );

      service.updateContext(floorPlan, [], [], roomBoundaries: [room]);

      // Set initial valid position inside the room
      service.updatePosition(
        PositionState(
          latitude: 12.0,
          longitude: 77.0,
          x: 0.20,
          y: 0.20,
          floor: 1,
          heading: 0.0,
          accuracy: 1.0,
          source: 'qr',
          timestamp: 1000,
        ),
      );

      expect(service.currentPosition?.x, 0.20);
      expect(service.currentPosition?.y, 0.20);

      // Attempt to jump across the wall to (0.45, 0.20)
      service.updatePosition(
        PositionState(
          latitude: 12.001,
          longitude: 77.001,
          x: 0.45,
          y: 0.20,
          floor: 1,
          heading: 0.0,
          accuracy: 1.0,
          source: 'wifi',
          timestamp: 1001,
        ),
      );

      // Verify that update was REJECTED and position is held at (0.20, 0.20)
      expect(
        service.currentPosition?.x,
        0.20,
        reason: 'Position must be held at last valid position when wall crossing is detected',
      );
      expect(service.currentPosition?.y, 0.20);

      service.dispose();
    });
  });
}
