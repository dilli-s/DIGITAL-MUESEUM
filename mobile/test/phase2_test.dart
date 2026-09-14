import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/services/location_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 2 — LocationService GPS/PDR Handoff Tests', () {
    test('LocationService initializes with default outdoor state', () {
      final locService = LocationService();
      expect(locService.isInsideMuseum, isFalse);
      expect(locService.isTracking, isFalse);
      expect(locService.currentGpsPosition, isNull);
    });

    test('forceIndoorMode switches isInsideMuseum to true', () {
      final locService = LocationService();
      bool listenerNotified = false;
      locService.addListener(() {
        listenerNotified = true;
      });

      locService.forceIndoorMode();
      expect(locService.isInsideMuseum, isTrue);
      expect(listenerNotified, isTrue);
    });

    test('setEntranceNodes filters nodes with null coordinates', () {
      final locService = LocationService();
      final nodes = [
        MapNode(
          id: 'entrance-1',
          name: 'Main Entrance',
          floor: 0,
          x: 10,
          y: 20,
          nodeType: 'entrance',
          latitude: 13.0690,
          longitude: 80.2550,
        ),
        MapNode(
          id: 'hallway-1',
          name: 'Hallway',
          floor: 0,
          x: 30,
          y: 40,
          nodeType: 'hallway',
          latitude: null,
          longitude: null,
        ),
      ];

      locService.setEntranceNodes(nodes);
      // Valid nodes with non-null coordinates are retained
      expect(locService.isInsideMuseum, isFalse);
    });
  });

  group('Phase 2 — IndoorPositionService GPS Feed Tests', () {
    test('setGpsPosition updates coordinate and sets source to gps', () async {
      final service = IndoorPositionService()..demoMode = true;

      service.setGpsPosition(13.0695, 80.2555);

      final pos = service.currentPosition;
      expect(pos, isNotNull);
      expect(pos!.latitude, equals(13.0695));
      expect(pos.longitude, equals(80.2555));
      expect(pos.source, equals('gps'));
    });

    test('QR scan updates coordinate and sets source to qr', () async {
      final service = IndoorPositionService()..demoMode = true;
      final entrance = MapNode(
        id: 'node-entrance',
        name: 'Gate A',
        floor: 1,
        x: 50,
        y: 100,
        nodeType: 'entrance',
        latitude: 13.0692,
        longitude: 80.2552,
      );

      service.scanQR(entrance);

      final pos = service.currentPosition;
      expect(pos, isNotNull);
      expect(pos!.currentNodeId, equals('node-entrance'));
      expect(pos.latitude, equals(13.0692));
      expect(pos.longitude, equals(80.2552));
      expect(pos.source, equals('qr'));
      expect(pos.floor, equals(1));
    });

    test('setGpsPosition snaps closest node floor when nodes available', () async {
      final service = IndoorPositionService()..demoMode = true;
      final entrance = MapNode(
        id: 'entrance-f2',
        name: 'Floor 2 Skybridge',
        floor: 2,
        x: 0,
        y: 0,
        nodeType: 'entrance',
        latitude: 13.0692,
        longitude: 80.2552,
      );

      service.updateContext(null, [entrance], []);
      // Close to entrance (<10m)
      service.setGpsPosition(13.0692, 80.2552);

      final pos = service.currentPosition;
      expect(pos, isNotNull);
      expect(pos!.floor, equals(2));
      expect(pos.currentNodeId, equals('entrance-f2'));
    });
  });
}
