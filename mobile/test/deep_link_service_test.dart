import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/services/deep_link_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('DeepLinkService URI Parsing & HTTPS Degrade Tests', () {
    test('1. Parses real HTTPS deep link https://vanalok.app/m/3', () {
      final payload = DeepLinkService.parseUri('https://vanalok.app/m/3');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(3));
      expect(payload.entranceNodeId, isNull);
    });

    test('2. Parses HTTPS deep link with entrance node https://vanalok.app/m/3?node=entrance_gate_1', () {
      final payload = DeepLinkService.parseUri('https://vanalok.app/m/3?node=entrance_gate_1');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(3));
      expect(payload.entranceNodeId, equals('entrance_gate_1'));
    });

    test('3. Parses arbitrary domain https://custom.museum.org/m/7', () {
      final payload = DeepLinkService.parseUri('https://custom.museum.org/m/7');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(7));
    });

    test('4. Parses vanalok:// custom scheme link vanalok://m/2?entrance=door_a', () {
      final payload = DeepLinkService.parseUri('vanalok://m/2?entrance=door_a');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(2));
      expect(payload.entranceNodeId, equals('door_a'));
    });

    test('5. Parses legacy vanalok://museum/5', () {
      final payload = DeepLinkService.parseUri('vanalok://museum/5');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(5));
    });

    test('6. Parses JSON payload', () {
      final payload = DeepLinkService.parseUri('{"museumId": 12, "startNodeId": "north_entry"}');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(12));
      expect(payload.entranceNodeId, equals('north_entry'));
    });

    test('7. Parses plain integer string fallback', () {
      final payload = DeepLinkService.parseUri('4');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(4));
    });

    test('8. Returns null on invalid string', () {
      final payload = DeepLinkService.parseUri('invalid_random_string');
      expect(payload, isNull);
    });
  });

  group('DeepLinkService Deferred Persistence on First Install Open', () {
    test('Persists and consumes pending payload across launches', () async {
      final originalPayload = DeepLinkPayload(
        museumId: 9,
        entranceNodeId: 'main_foyer',
      );

      await DeepLinkService.persistPendingPayload(originalPayload);

      // Verify that consume retrieves and removes it
      final consumed = await DeepLinkService.consumePendingPayload();
      expect(consumed, isNotNull);
      expect(consumed!.museumId, equals(9));
      expect(consumed.entranceNodeId, equals('main_foyer'));

      // Subsequent consume returns null
      final secondConsume = await DeepLinkService.consumePendingPayload();
      expect(secondConsume, isNull);
    });
  });
}
