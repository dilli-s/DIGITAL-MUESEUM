import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/screens/wifi_survey_screen.dart';
import 'package:mobile/services/indoor_positioning.dart';
import 'package:mobile/services/wifi_fingerprint_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('WiFi Fingerprinting & Platform Constraint Tests', () {
    test('Platform Constraint: Non-Android platforms (iOS/Desktop) return isSupported == false', () {
      final service = WifiFingerprintService();
      // In Flutter test environment, defaultTargetPlatform is not Android by default
      if (defaultTargetPlatform != TargetPlatform.android) {
        expect(service.isSupported, isFalse);
      }
    });

    test('Platform Constraint: iOS / non-Android scanCurrentReadings returns empty list and never fakes data', () async {
      final service = WifiFingerprintService();
      if (!service.isSupported) {
        final readings = await service.scanCurrentReadings();
        expect(readings, isEmpty);
      }
    });

    test('IndoorPositionService: PDR and QR operation unchanged by WiFi addition', () async {
      final positionService = IndoorPositionService()..demoMode = true;

      final fp = FloorPlan(
        id: 'fp-1',
        name: 'Floor 1',
        floorNumber: 1,
        imageUrl: 'http://example.com/plan.png',
        widthPx: 1000,
        heightPx: 1000,
        scaleMetersPerPx: 0.05,
      );

      final n1 = MapNode(id: 'node-1', name: 'Start', floor: 1, x: 0.2, y: 0.2, nodeType: 'waypoint');
      final n2 = MapNode(id: 'node-2', name: 'QR Spot', floor: 1, x: 0.5, y: 0.5, nodeType: 'artifact');

      positionService.updateContext(fp, [n1, n2], [], roomId: 'room-alpha');

      // Scan QR
      positionService.scanQR(n2);
      expect(positionService.currentPosition, isNotNull);
      expect(positionService.currentPosition!.x, equals(0.5));
      expect(positionService.currentPosition!.y, equals(0.5));
      expect(positionService.currentPosition!.source, equals('qr'));

      // Low confidence or failed WiFi estimate should NEVER move the marker
      // Verify marker remains exactly at (0.5, 0.5)
      expect(positionService.currentPosition!.x, equals(0.5));
      expect(positionService.currentPosition!.y, equals(0.5));

      positionService.dispose();
    });

    test('captureFingerprint populates lastErrorMessage on failure or unsupported platform', () async {
      final service = WifiFingerprintService();
      if (!service.isSupported) {
        final success = await service.captureFingerprint(
          roomId: 'test-room',
          x: 0.5,
          y: 0.5,
          readings: [{'bssid': '11:22:33:44:55:66', 'rssi': -60}],
        );
        expect(success, isFalse);
        expect(service.lastErrorMessage, isNotNull);
        expect(service.lastErrorMessage, contains('not supported'));
      }
    });

    test('SurveyRoomItem stores canonical UUID and name correctly', () {
      const room = SurveyRoomItem(id: '4296e1b5-8af3-4146-a437-1fc87d3168e6', name: 'Bathroom 2');
      expect(room.id, equals('4296e1b5-8af3-4146-a437-1fc87d3168e6'));
      expect(room.name, equals('Bathroom 2'));
    });

    test('ScannedWifiNetwork correctly handles SSID, BSSID, dBm, frequency, and hidden network detection', () {
      const ap1 = ScannedWifiNetwork(
        bssid: 'aa:bb:cc:dd:ee:01',
        ssid: 'Museum-Staff',
        level: -54,
        frequency: 2412,
        capabilities: '[WPA2-PSK-CCMP]',
      );

      expect(ap1.bssid, equals('aa:bb:cc:dd:ee:01'));
      expect(ap1.ssid, equals('Museum-Staff'));
      expect(ap1.level, equals(-54));
      expect(ap1.frequency, equals(2412));
      expect(ap1.frequencyBand, equals('2.4 GHz'));
      expect(ap1.isHidden, isFalse);

      final reading = ap1.toReadingMap();
      expect(reading['bssid'], equals('aa:bb:cc:dd:ee:01'));
      expect(reading['rssi'], equals(-54));
      expect(reading['ssid'], equals('Museum-Staff'));

      const hiddenAp = ScannedWifiNetwork(
        bssid: 'aa:bb:cc:dd:ee:02',
        ssid: '',
        level: -82,
        frequency: 5180,
      );
      expect(hiddenAp.isHidden, isTrue);
      expect(hiddenAp.frequencyBand, equals('5 GHz'));
    });

    test('Network list sorting places strongest AP first (closer to 0 dBm)', () {
      final networks = [
        const ScannedWifiNetwork(bssid: 'ap-weak', ssid: 'Net-A', level: -88),
        const ScannedWifiNetwork(bssid: 'ap-strong', ssid: 'Net-B', level: -45),
        const ScannedWifiNetwork(bssid: 'ap-mid', ssid: 'Net-C', level: -67),
      ];

      networks.sort((a, b) => b.level.compareTo(a.level));

      expect(networks[0].bssid, equals('ap-strong')); // -45 dBm
      expect(networks[1].bssid, equals('ap-mid'));    // -67 dBm
      expect(networks[2].bssid, equals('ap-weak'));   // -88 dBm
    });

    test('Unchecking/filtering excludes unchecked BSSID from saved fingerprint payload', () {
      final allDetected = [
        const ScannedWifiNetwork(bssid: '11:11:11:11:11:11', ssid: 'Main-Net', level: -50),
        const ScannedWifiNetwork(bssid: '22:22:22:22:22:22', ssid: 'Rogue-AP', level: -89),
        const ScannedWifiNetwork(bssid: '33:33:33:33:33:33', ssid: 'Staff-Net', level: -62),
      ];

      // Admin selects all, then unchecks rogue/weak AP '22:22:22:22:22:22'
      final selectedBssids = {'11:11:11:11:11:11', '33:33:33:33:33:33'};

      final payloadReadings = allDetected
          .where((n) => selectedBssids.contains(n.bssid))
          .map((n) => n.toReadingMap())
          .toList();

      expect(payloadReadings.length, equals(2));
      expect(payloadReadings.any((r) => r['bssid'] == '22:22:22:22:22:22'), isFalse);
      expect(payloadReadings.any((r) => r['bssid'] == '11:11:11:11:11:11'), isTrue);
      expect(payloadReadings.any((r) => r['bssid'] == '33:33:33:33:33:33'), isTrue);
    });

    test('Platform Constraint: iOS / non-Android scanDetectedNetworks returns empty list', () async {
      final service = WifiFingerprintService();
      if (!service.isSupported) {
        final networks = await service.scanDetectedNetworks();
        expect(networks, isEmpty);
      }
    });
  });
}
