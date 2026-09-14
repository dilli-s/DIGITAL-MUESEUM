import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/services/tour_navigation_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Artifact Auto-Popup 1-Meter Proximity Tests', () {
    late TourNavigationManager tourManager;

    final nodeEntrance = MapNode(
      id: 'entrance-1',
      name: 'Main Entrance',
      floor: 1,
      x: 0,
      y: 0,
      nodeType: 'entrance',
    );

    final artifact1 = MapNode(
      id: 'art-1',
      name: 'Bronze Nataraja',
      floor: 1,
      x: 10,
      y: 0,
      nodeType: 'artifact',
      objectId: 101,
    );

    final artifact2OnWay = MapNode(
      id: 'art-2',
      name: 'Hoysala Inscription',
      floor: 1,
      x: 100,
      y: 0,
      nodeType: 'exhibit',
      objectId: 102,
    );

    final artifact3Final = MapNode(
      id: 'art-3',
      name: 'Mughal Dagger',
      floor: 1,
      x: 200,
      y: 0,
      nodeType: 'artifact',
      objectId: 103,
    );

    final artifactOtherFloor = MapNode(
      id: 'art-floor2',
      name: 'Ancient Manuscripts',
      floor: 2,
      x: 10,
      y: 0,
      nodeType: 'artifact',
      objectId: 104,
    );

    final allNodes = [
      nodeEntrance,
      artifact1,
      artifact2OnWay,
      artifact3Final,
      artifactOtherFloor,
    ];

    setUp(() {
      tourManager = TourNavigationManager();
    });

    test('1. Visitor standing still without knowing artifact is there triggers auto-popup within 1m', () {
      // Artifact 1 is at x: 10, y: 0. With dx=20px at 0.035 scale: dist = 20 * 0.035 = 0.7m (<= 1.0m)
      // Visitor position: x: 15, y: 0 => dx = 5 => dist = 5 * 0.035 = 0.175m (<= 1.0m)
      final standingPosition = PositionState(
        latitude: null,
        longitude: null,
        x: 15,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'init',
        timestamp: 1000,
      );

      final detected = tourManager.findArtifactWithinProximity(
        currentPosition: standingPosition,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );

      expect(detected, isNotNull);
      expect(detected!.id, equals('art-1'));
      expect(detected.objectId, equals(101));
    });

    test('2. Visitor far from artifact (> 1.0m) does NOT trigger auto-popup', () {
      // Position far away: x: 80, y: 50
      final farPosition = PositionState(
        latitude: null,
        longitude: null,
        x: 80,
        y: 50,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1000,
      );

      final detected = tourManager.findArtifactWithinProximity(
        currentPosition: farPosition,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );

      expect(detected, isNull);
    });

    test('3. Artifact on a different floor does NOT trigger popup even with matching coordinates', () {
      // Standing right at (10, 0) on floor 1, artifactOtherFloor is on floor 2
      final positionFloor1 = PositionState(
        latitude: null,
        longitude: null,
        x: 10,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1000,
      );

      final detected = tourManager.findArtifactWithinProximity(
        currentPosition: positionFloor1,
        allNodes: [artifactOtherFloor],
        radiusMeters: 1.0,
      );

      expect(detected, isNull, reason: 'Must not trigger for artifacts on different floor');
    });

    test('4. All artifacts on the way from first to final destination trigger auto-popup as visitor walks past', () {
      // Destination is artifact3Final (x: 60)
      // Step 1: Near artifact1 (x: 10)
      final posNearArt1 = PositionState(
        x: 12,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1000,
      );
      final art1Detected = tourManager.findArtifactWithinProximity(
        currentPosition: posNearArt1,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );
      expect(art1Detected?.id, equals('art-1'));

      // Step 2: In hallway between art-1 and art-2 (x: 55) -> dist > 1.0m
      final posInHallway = PositionState(
        x: 55,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1001,
      );
      final hallwayDetected = tourManager.findArtifactWithinProximity(
        currentPosition: posInHallway,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );
      expect(hallwayDetected, isNull);

      // Step 3: Walking past intermediate artifact2 (x: 100) -> auto-pops!
      final posNearArt2 = PositionState(
        x: 102,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1002,
      );
      final art2Detected = tourManager.findArtifactWithinProximity(
        currentPosition: posNearArt2,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );
      expect(art2Detected?.id, equals('art-2'));
      expect(art2Detected?.objectId, equals(102));

      // Step 4: Arriving at final destination artifact3 (x: 200) -> auto-pops!
      final posNearArt3 = PositionState(
        x: 202,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1003,
      );
      final art3Detected = tourManager.findArtifactWithinProximity(
        currentPosition: posNearArt3,
        allNodes: allNodes,
        radiusMeters: 1.0,
      );
      expect(art3Detected?.id, equals('art-3'));
      expect(art3Detected?.objectId, equals(103));
    });

    test('5. Destination arrival marks node as visited within 1.0m radius', () {
      final arrivalPos = PositionState(
        x: 201,
        y: 0,
        floor: 1,
        heading: 0.0,
        accuracy: 1.0,
        source: 'pdr',
        timestamp: 1004,
      );

      final arrived = tourManager.evaluateArrival(
        currentPosition: arrivalPos,
        destinationNode: artifact3Final,
        radiusMeters: 1.0,
      );

      expect(arrived, isNotNull);
      expect(arrived!.id, equals('art-3'));
      expect(tourManager.visitedNodeIds.contains('art-3'), isTrue);
    });
  });
}
