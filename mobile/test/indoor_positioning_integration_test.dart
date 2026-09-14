import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';

void main() {
  MapNode node(String id, int floor, double lat, double lng) => MapNode(
    id: id,
    name: id,
    floor: floor,
    x: 0,
    y: 0,
    nodeType: floor == 1 ? 'entrance' : 'stair',
    latitude: lat,
    longitude: lng,
  );

  test('synthetic multi-floor PDR path switches floors and QR removes drift', () async {
    final service = IndoorPositionService()..demoMode = true;
    final floorOne = node('floor-one', 1, 13.0000, 77.0000);
    final floorOneCheckpoint = node('floor-one-checkpoint', 1, 13.0001, 77.0000);
    final stair = node('stair-floor-two', 2, 13.0002, 77.0000);
    final floorTwoCheckpoint = node('floor-two-checkpoint', 2, 13.0002, 77.0001);
    final destination = node('destination', 2, 13.0002, 77.0002);
    final route = [
      floorOne,
      floorOneCheckpoint,
      stair,
      floorTwoCheckpoint,
      destination,
    ];

    service.updateContext(
      null,
      route,
      [
        MapEdge(
          id: 'floor-one-walkway',
          fromNodeId: floorOne.id,
          toNodeId: floorOneCheckpoint.id,
          distance: 11,
          walkable: true,
        ),
        MapEdge(
          id: 'stairs',
          fromNodeId: floorOneCheckpoint.id,
          toNodeId: stair.id,
          distance: 11,
          walkable: true,
        ),
        MapEdge(
          id: 'floor-two-walkway',
          fromNodeId: stair.id,
          toNodeId: floorTwoCheckpoint.id,
          distance: 11,
          walkable: true,
        ),
        MapEdge(
          id: 'destination-walkway',
          fromNodeId: floorTwoCheckpoint.id,
          toNodeId: destination.id,
          distance: 11,
          walkable: true,
        ),
      ],
    );

    // The midpoint beyond the stair transition must report floor two.
    final snapped = service.snapToGraphGeoForTesting(13.00019, 77.0000, 1);
    expect(snapped.$4, 2);
    expect(snapped.$5, isFalse);

    for (final checkpoint in route) {
      service.updatePosition(
        PositionState(
          x: checkpoint.x + 4,
          y: checkpoint.y + 4,
          floor: checkpoint.floor,
          heading: 0,
          accuracy: 15,
          source: 'pdr',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          latitude: checkpoint.latitude! + 0.00001,
          longitude: checkpoint.longitude! + 0.00001,
        ),
      );
      service.scanQR(checkpoint);

      expect(service.currentPosition?.source, 'qr');
      expect(service.currentPosition?.currentNodeId, checkpoint.id);
      expect(service.currentPosition?.floor, checkpoint.floor);
      expect(service.currentPosition?.latitude, checkpoint.latitude);
      expect(service.currentPosition?.longitude, checkpoint.longitude);
    }

    expect(service.currentPosition?.floor, 2);
    expect(service.currentPosition?.currentNodeId, destination.id);

    service.dispose();
  });

  test('graph snap ignores non-walkable edges', () {
    final service = IndoorPositionService();
    final first = node('first', 1, 13.0000, 77.0000);
    final second = node('second', 1, 13.0000, 77.0002);
    service.updateContext(
      null,
      [first, second],
      [
        MapEdge(
          id: 'blocked',
          fromNodeId: first.id,
          toNodeId: second.id,
          distance: 20,
          walkable: false,
        ),
      ],
    );

    final result = service.snapToGraphGeoForTesting(13.0000, 77.0001, 1);
    expect(result.$5, isTrue);
    expect(result.$3, isNull);
    service.dispose();
  });

  test('active indoor PDR is not cancelled by outdoor GPS fixes', () {
    final service = IndoorPositionService()..demoMode = true;
    final fp = FloorPlan(
      id: 'fp-1',
      name: 'Floor 1',
      floorNumber: 1,
      imageUrl: 'floor1.png',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
    );
    final entrance = node('entrance', 1, 13.0000, 77.0000);
    service.updateContext(fp, [entrance], []);
    service.scanQR(entrance);

    expect(service.currentPosition?.source, 'qr');

    // Simulate background GPS update while indoors
    service.setGpsPosition(13.0099, 77.5713);

    // Source must remain QR / indoor, NOT overwritten to outdoor GPS
    expect(service.currentPosition?.source, 'qr');
    expect(service.currentPosition?.x, entrance.x);
    service.dispose();
  });

  test('PDR step detection advances coordinates even with non-georeferenced floor plan nodes', () {
    final service = IndoorPositionService()..demoMode = true;
    final fp = FloorPlan(
      id: 'fp-1',
      name: 'Floor 1',
      floorNumber: 1,
      imageUrl: 'floor1.png',
      widthPx: 1000,
      heightPx: 1000,
      scaleMetersPerPx: 0.05,
    );
    // Non-georeferenced nodes (null lat/lng)
    final nodeA = MapNode(
      id: 'node-a',
      name: 'A',
      floor: 1,
      x: 0.2,
      y: 0.8,
      nodeType: 'exhibit',
      latitude: null,
      longitude: null,
    );
    final nodeB = MapNode(
      id: 'node-b',
      name: 'B',
      floor: 1,
      x: 0.2,
      y: 0.2,
      nodeType: 'exhibit',
      latitude: null,
      longitude: null,
    );
    final edge = MapEdge(
      id: 'edge-ab',
      fromNodeId: 'node-a',
      toNodeId: 'node-b',
      distance: 30,
      walkable: true,
    );

    service.updateContext(fp, [nodeA, nodeB], [edge]);
    service.scanQR(nodeA);

    final initialX = service.currentPosition!.x;
    final initialY = service.currentPosition!.y;

    // Simulate step detection
    expect(service.hasStepSinceLastWifiCorrection, isFalse);
    service.onStepDetectedForTesting();

    // Must have moved coordinates and flagged step
    expect(service.hasStepSinceLastWifiCorrection, isTrue);
    final movedPos = service.currentPosition!;
    expect(movedPos.source, 'pdr');
    expect(movedPos.x != initialX || movedPos.y != initialY, isTrue);

    service.dispose();
  });
}
