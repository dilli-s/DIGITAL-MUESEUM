import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/config/api.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/models/museum_provider.dart';

void main() {
  group('ApiConfig & MuseumProvider Tests', () {
    test('ApiConfig has correct default production URLs', () {
      expect(ApiConfig.baseUrl, 'http://127.0.0.1:5000/api');
      expect(ApiConfig.mapServiceUrl, 'http://127.0.0.1:5001/api');
    });

    test('MuseumProvider initial state is clean', () {
      final provider = MuseumProvider();
      expect(provider.museums, isEmpty);
      expect(provider.isLoadingMuseums, isFalse);
      expect(provider.isUsingCachedData, isFalse);
      expect(provider.errorMessage, isNull);
    });

    test('getDistanceLabel returns "-" when location is not granted or coordinates missing', () {
      final provider = MuseumProvider();
      final museum = Museum(
        id: 1,
        name: 'Test Museum',
        address: 'Bengaluru',
        latitude: null,
        longitude: null,
      );
      expect(provider.getDistanceLabel(museum), '—');
    });

    test(
      'Location permission failure does not throw unhandled exceptions',
      () async {
        final provider = MuseumProvider();
        TestWidgetsFlutterBinding.ensureInitialized();
        // Should handle permission request gracefully even without physical device
        await provider.requestLocationPermission();
        expect(provider.locationPermissionGranted, isFalse);
      },
    );

    test('Cached data preserves museums and flags isUsingCachedData', () {
      final provider = MuseumProvider();
      final museum = Museum(
        id: 12,
        name: 'Vanalok Test Museum',
        address: 'Bengaluru',
      );
      provider.museums = [museum];
      provider.isUsingCachedData = true;

      expect(provider.museums.length, 1);
      expect(provider.isUsingCachedData, isTrue);
      expect(provider.museums.first.name, 'Vanalok Test Museum');
    });
  });
}
