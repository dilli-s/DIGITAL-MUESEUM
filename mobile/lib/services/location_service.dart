import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../models/navigation_models.dart';
import '../utils/navigation_math.dart';

/// Continuous GPS provider with GPS-outdoor / PDR-indoor handoff.
///
/// When the visitor is >15m from the nearest entrance node, GPS coordinates
/// are the position source. Once ≤15m (inside), GPS stops feeding position
/// and PDR + QR scans take over via IndoorPositionService.
class LocationService extends ChangeNotifier {
  static const double entranceProximityThreshold = 15.0; // meters

  StreamSubscription<Position>? _gpsSub;
  Position? _currentGpsPosition;
  bool _isInsideMuseum = false;
  bool _isTracking = false;
  List<MapNode> _entranceNodes = [];

  Position? get currentGpsPosition => _currentGpsPosition;
  bool get isInsideMuseum => _isInsideMuseum;
  bool get isTracking => _isTracking;

  /// Callback fired when GPS → PDR handoff occurs (visitor enters museum).
  VoidCallback? onEnterMuseum;

  /// Callback fired with each GPS position update while outdoors.
  void Function(double lat, double lng)? onGpsPositionUpdate;

  /// Set entrance nodes for proximity detection.
  void setEntranceNodes(List<MapNode> entrances) {
    _entranceNodes =
        entrances.where((n) => n.latitude != null && n.longitude != null).toList();
  }

  /// Start continuous GPS tracking.
  Future<void> startTracking() async {
    if (_isTracking) return;

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('LocationService: Location services disabled');
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('LocationService: Permission denied');
        return;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      debugPrint('LocationService: Permission permanently denied');
      return;
    }

    _isTracking = true;
    notifyListeners();

    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 1, // Update every 1 meter
      ),
    ).listen(_onGpsUpdate, onError: (e) {
      debugPrint('LocationService GPS error: $e');
    });
  }

  void _onGpsUpdate(Position position) {
    _currentGpsPosition = position;

    // Check proximity to entrance nodes
    if (_entranceNodes.isNotEmpty) {
      double minDist = double.infinity;
      for (var entrance in _entranceNodes) {
        final d = NavigationMath.distanceBetween(
          position.latitude,
          position.longitude,
          entrance.latitude!,
          entrance.longitude!,
        );
        if (d < minDist) minDist = d;
      }

      final wasInside = _isInsideMuseum;
      _isInsideMuseum = minDist <= entranceProximityThreshold;

      if (_isInsideMuseum && !wasInside) {
        // Transition: outdoor → indoor
        debugPrint(
            'LocationService: Entered museum proximity (${minDist.toStringAsFixed(1)}m)');
        onEnterMuseum?.call();
      }
    }

    // Feed GPS position to consumers while outdoors
    if (!_isInsideMuseum) {
      onGpsPositionUpdate?.call(position.latitude, position.longitude);
    }

    notifyListeners();
  }

  /// Force indoor mode (e.g., when QR scan confirms visitor is inside).
  void forceIndoorMode() {
    _isInsideMuseum = true;
    notifyListeners();
  }

  /// Get a single GPS fix (for initial position).
  Future<Position?> getCurrentPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
    } catch (e) {
      debugPrint('LocationService: getCurrentPosition error: $e');
      return null;
    }
  }

  void stopTracking() {
    _gpsSub?.cancel();
    _gpsSub = null;
    _isTracking = false;
    notifyListeners();
  }

  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}
