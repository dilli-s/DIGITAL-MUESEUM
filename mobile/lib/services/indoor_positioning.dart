import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'package:http/http.dart' as http;
import 'package:sensors_plus/sensors_plus.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/api.dart';
import '../models/navigation_models.dart';
import '../utils/navigation_math.dart';
import '../utils/wall_crossing_validator.dart';

class PositionState {
  final double x;
  final double y;
  final int floor;
  final double heading;
  final double accuracy;
  final String source;
  final int timestamp;
  final String? currentNodeId;
  final double? latitude;
  final double? longitude;
  final bool isLost;
  final bool floorChanged;

  PositionState({
    required this.x,
    required this.y,
    required this.floor,
    required this.heading,
    required this.accuracy,
    required this.source,
    required this.timestamp,
    this.currentNodeId,
    this.latitude,
    this.longitude,
    this.isLost = false,
    this.floorChanged = false,
  });

  PositionState copyWith({
    double? x,
    double? y,
    int? floor,
    double? heading,
    double? accuracy,
    String? source,
    int? timestamp,
    String? currentNodeId,
    double? latitude,
    double? longitude,
    bool? isLost,
    bool? floorChanged,
  }) {
    return PositionState(
      x: x ?? this.x,
      y: y ?? this.y,
      floor: floor ?? this.floor,
      heading: heading ?? this.heading,
      accuracy: accuracy ?? this.accuracy,
      source: source ?? this.source,
      timestamp: timestamp ?? this.timestamp,
      currentNodeId: currentNodeId ?? this.currentNodeId,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isLost: isLost ?? this.isLost,
      floorChanged: floorChanged ?? this.floorChanged,
    );
  }
}

class IndoorPositionService {
  final _positionController = StreamController<PositionState>.broadcast();
  Stream<PositionState> get positionStream => _positionController.stream;
  final StreamController<double> _headingController = StreamController<double>.broadcast();
  Stream<double> get headingStream => _headingController.stream;

  PositionState? _currentPosition;
  PositionState? get currentPosition => _currentPosition;

  StreamSubscription? _accelSub;
  StreamSubscription? _accelHeadSub;
  StreamSubscription? _magSub;
  StreamSubscription? _gyroSub;
  bool _isPdrRunning = false;
  bool get isPdrRunning => _isPdrRunning;
  // Accelerometer gravity estimate for 3D tilt compensation (default device flat: az = 9.8 m/s^2)
  double _gravX = 0.0;
  double _gravY = 0.0;
  double _gravZ = 9.80665;

  // Room wall boundaries & doorways for ray-casting wall-crossing prevention
  List<RoomBoundary> _roomBoundaries = [];
  List<DoorwayOpening> _doorways = [];

  @visibleForTesting
  void onStepDetectedForTesting() => _onStepDetected();

  bool _hasStepDetected = false;
  @visibleForTesting
  bool get hasStepSinceLastWifiCorrection => _hasStepDetected;

  @visibleForTesting
  void setPendingWifiTargetForTesting(double targetX, double targetY, double confidence) {}

  @visibleForTesting
  void setRoomBoundariesForTesting(List<RoomBoundary> rooms, {List<DoorwayOpening>? doorways}) {
    _roomBoundaries = rooms;
    if (doorways != null) _doorways = doorways;
  }

  double _currentHeading = 0.0;
  double get currentHeading => _currentHeading;
  double _filteredHeading = 0.0;
  double _filteredMagHeading = 0.0;
  bool _hasInitialMag = false;
  int _lastHeadingEmitTime = 0;
  int _lastGyroTime = 0;

  // Stationary gyroscope noise deadband: MEMS gyro zero-rate bias is ~0.02 - 0.03 rad/s (~1.1 - 1.7 deg/s)
  static const double _gyroDeadbandRadS = 0.035; // ~2.0 deg/sec

  // Step detection parameters & state (walking cadence ~1.5 - 2.5 Hz / 360 - 850 ms)
  static const double _walkingPeakMinLinear = 1.5; // m/s^2 linear acceleration peak
  static const double _walkingTroughMaxLinear = 0.7; // m/s^2 trough decompression
  static const int _cadenceMinIntervalMs = 350; // max ~2.85 Hz walking
  static const int _cadenceMaxIntervalMs = 850; // min ~1.17 Hz walking
  static const int _gaitTimeoutMs = 1200; // Reset gait accumulator if idle

  int _lastStepTime = 0;
  int _lastGaitPeakTime = 0;
  int _consecutiveGaitPeaks = 0;
  bool _hasTroughSinceLastPeak = false;
  double _prevLinear = 0.0;
  double _prevPrevLinear = 0.0;
  int _prevSampleTime = 0;

  FloorPlan? _currentFloorPlan;
  FloorPlan? get currentFloorPlan => _currentFloorPlan;
  List<MapEdge> _currentEdges = [];
  List<MapNode> _currentNodes = [];


  String? currentRoomId;

  bool demoMode = false;

  IndoorPositionService({bool autoStartSensors = false}) {
    if (autoStartSensors) {
      startContinuousHeadingTracking();
    }
  }

  Future<void> requestPermissions() async {
    await [
      Permission.camera,
      Permission.locationWhenInUse,
      Permission.sensors,
    ].request();
    startContinuousHeadingTracking();
  }

  /// Starts continuous real-time heading tracking using fused accelerometer, magnetometer, and gyroscope.
  /// 1. Accelerometer estimates gravity vector (pitch and roll angles for 3D tilt compensation).
  /// 2. Magnetometer readings are de-rotated to horizontal plane for true magnetic-north azimuth.
  /// 3. Gyroscope provides responsive, zero-lag dynamic rotation tracking via complementary filter.
  void startContinuousHeadingTracking() {
    if (demoMode) return;
    _accelHeadSub?.cancel();
    _magSub?.cancel();
    _gyroSub?.cancel();

    try {
      _accelHeadSub = accelerometerEventStream(samplingPeriod: SensorInterval.uiInterval).handleError((e) {
        debugPrint('IndoorPositionService: Accel orientation error: $e');
      }).listen((e) {
        _updateAccelerometerTilt(e.x, e.y, e.z);
      }, onError: (e) {
        debugPrint('IndoorPositionService: Accel orientation error: $e');
      });

      _magSub = magnetometerEventStream(samplingPeriod: SensorInterval.uiInterval).handleError((e) {
        debugPrint('IndoorPositionService: Mag sensor error: $e');
      }).listen((e) {
        _updateMagnetometerHeading(e.x, e.y, mz: e.z);
      }, onError: (e) {
        debugPrint('IndoorPositionService: Mag sensor error: $e');
      });

      _gyroSub = gyroscopeEventStream(samplingPeriod: SensorInterval.uiInterval).handleError((e) {
        debugPrint('IndoorPositionService: Gyro sensor error: $e');
      }).listen((e) {
        final now = DateTime.now().millisecondsSinceEpoch;
        _updateGyroscopeHeading(e.z, now);
      }, onError: (e) {
        debugPrint('IndoorPositionService: Gyro sensor error: $e');
      });
    } catch (e) {
      debugPrint('IndoorPositionService: Orientation sensors unavailable: $e');
    }
  }

  void _updateAccelerometerTilt(double ax, double ay, double az) {
    // Low-pass filter to isolate gravity acceleration from rapid hand tremors
    _gravX = _gravX * 0.85 + ax * 0.15;
    _gravY = _gravY * 0.85 + ay * 0.15;
    _gravZ = _gravZ * 0.85 + az * 0.15;
  }

  void _updateMagnetometerHeading(double mx, double my, {double mz = 0.0, int? timestampMs}) {
    // 3D Tilt-Compensated Compass Azimuth (Google Maps standard)
    // De-rotates earth's magnetic field vector to horizontal plane using device pitch & roll
    double g = sqrt(_gravX * _gravX + _gravY * _gravY + _gravZ * _gravZ);
    if (g < 1e-3) g = 9.80665;
    double axNorm = (_gravX / g).clamp(-1.0, 1.0);
    double ayNorm = (_gravY / g).clamp(-1.0, 1.0);

    // Device pitch (tilt angle towards user eyes)
    double pitch = asin(-ayNorm);
    double cosPitch = cos(pitch);
    // Device roll (tilt angle left/right)
    double roll = 0.0;
    if (cosPitch.abs() > 1e-4) {
      roll = asin((axNorm / cosPitch).clamp(-1.0, 1.0));
    }

    double cosP = cos(pitch);
    double sinP = sin(pitch);
    double cosR = cos(roll);
    double sinR = sin(roll);

    // De-rotate magnetometer vector into horizontal plane:
    // xh: East-West horizontal component
    // yh: North-South horizontal component
    double xh = mx * cosP + mz * sinP;
    double yh = mx * sinR * sinP + my * cosR - mz * sinR * cosP;

    // Azimuth clockwise from true magnetic North (like Google Maps' arrow)
    double rawMagHeading = atan2(-xh, yh) * 180.0 / pi;
    if (rawMagHeading < 0) rawMagHeading += 360.0;

    if (!_hasInitialMag) {
      _filteredHeading = rawMagHeading;
      _filteredMagHeading = rawMagHeading;
      _hasInitialMag = true;
      _onHeadingUpdated(_filteredHeading, timestampMs: timestampMs);
    } else {
      // Low-pass filter magnetometer readings to reject high-frequency indoor magnetic interference
      double magDiff = ((rawMagHeading - _filteredMagHeading + 540.0) % 360.0) - 180.0;
      _filteredMagHeading = (_filteredMagHeading + magDiff * 0.12) % 360.0;
      if (_filteredMagHeading < 0) _filteredMagHeading += 360.0;
    }
  }

  void _updateGyroscopeHeading(double gz, int now) {
    if (_lastGyroTime > 0) {
      final dt = (now - _lastGyroTime) / 1000.0;
      if (dt > 0 && dt < 1.0) {
        // Apply deadband: ignore stationary gyro drift and hand micro-tremors
        double effectiveGz = gz;
        if (effectiveGz.abs() < _gyroDeadbandRadS) {
          effectiveGz = 0.0;
        }

        // Gyroscope prediction (e.z is counter-clockwise rad/s around device vertical axis)
        double deltaDeg = -effectiveGz * (180.0 / pi) * dt;
        double predictedHeading = (_filteredHeading + deltaDeg) % 360.0;
        if (predictedHeading < 0) predictedHeading += 360.0;

        if (!_hasInitialMag) {
          _filteredHeading = predictedHeading;
        } else {
          // Complementary filter fusion:
          // Gyroscope tracks fast, dynamic rotations with zero lag;
          // Magnetometer slowly corrects gyro bias drift over ~1.5s time constant.
          double magDiff = ((_filteredMagHeading - predictedHeading + 540.0) % 360.0) - 180.0;
          double alpha = (dt * 1.5).clamp(0.005, 0.06);

          if (effectiveGz.abs() > 0.08) {
            // Turning (> 4.5°/s): gyro has 100% authority for responsive, natural compass movement
            _filteredHeading = predictedHeading;
          } else {
            // Stationary / resting: fuse predicted heading with stable magnetometer
            _filteredHeading = (predictedHeading + magDiff * alpha) % 360.0;
            if (_filteredHeading < 0) _filteredHeading += 360.0;
          }
        }

        _onHeadingUpdated(_filteredHeading, timestampMs: now);
      }
    }
    _lastGyroTime = now;
  }

  @visibleForTesting
  void processSensorHeadingForTesting({
    double? accelX,
    double? accelY,
    double? accelZ,
    double? magX,
    double? magY,
    double? magZ,
    double? gyroZ,
    int? timestampMs,
  }) {
    final now = timestampMs ?? DateTime.now().millisecondsSinceEpoch;
    if (accelX != null || accelY != null || accelZ != null) {
      _updateAccelerometerTilt(accelX ?? 0.0, accelY ?? 0.0, accelZ ?? 9.80665);
    }
    if (magX != null && magY != null) {
      _updateMagnetometerHeading(magX, magY, mz: magZ ?? 0.0, timestampMs: now);
    }
    if (gyroZ != null) {
      _updateGyroscopeHeading(gyroZ, now);
    }
  }

  void _onHeadingUpdated(double heading, {int? timestampMs}) {
    _currentHeading = heading;
    if (!_headingController.isClosed) {
      _headingController.add(heading);
    }
    final now = timestampMs ?? DateTime.now().millisecondsSinceEpoch;

    // Dispatch heading update if position exists and change is significant (> 0.8°) throttled to ~25-30fps (35ms)
    if (_currentPosition != null) {
      double angleDiff = (_currentPosition!.heading - heading).abs();
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      if (angleDiff > 0.8 && (now - _lastHeadingEmitTime) > 35) {
        _lastHeadingEmitTime = now;
        updatePosition(_currentPosition!.copyWith(heading: heading));
      }
    }
  }

  void updateContext(
    FloorPlan? fp,
    List<MapNode> nodes,
    List<MapEdge> edges, {
    String? roomId,
    List<RoomBoundary>? roomBoundaries,
    List<DoorwayOpening>? doorways,
  }) {
    _currentFloorPlan = fp;
    _currentNodes = nodes;
    _currentEdges = edges;
    if (roomId != null) currentRoomId = roomId;
    if (roomBoundaries != null) _roomBoundaries = roomBoundaries;
    if (doorways != null) _doorways = doorways;
  }

  void updatePosition(PositionState newPos) {
    // Wall-crossing constraint check for live position movements
    if (_currentPosition != null &&
        (newPos.source == 'pdr' || newPos.source == 'pdr+wifi' || newPos.source == 'wifi')) {
      final oldPos = _currentPosition!;
      final result = WallCrossingValidator.validateMovement(
        x1: oldPos.x,
        y1: oldPos.y,
        x2: newPos.x,
        y2: newPos.y,
        floor: newPos.floor,
        rooms: _roomBoundaries,
        doorways: _doorways,
        entranceNodes: _currentNodes,
      );

      if (!result.allowed) {
        debugPrint(
          '[WALL_CROSSING_REJECTED] Rejecting ${newPos.source} update from (${oldPos.x.toStringAsFixed(2)}, ${oldPos.y.toStringAsFixed(2)}) '
          'to (${newPos.x.toStringAsFixed(2)}, ${newPos.y.toStringAsFixed(2)}): ${result.rejectionReason}',
        );
        // Hold marker at last valid position
        return;
      }
    }

    _currentPosition = newPos;
    _positionController.add(newPos);
  }

  /// Sets outdoor position directly from continuous GPS stream.
  /// Stops PDR while outdoors so sensor steps don't interfere with real GPS coordinates.
  void setGpsPosition(double lat, double lng, {double? heading, double? accuracy}) {
    if (_currentFloorPlan != null &&
        _currentPosition != null &&
        (_isPdrRunning || _currentPosition!.source == 'qr' || _currentPosition!.source == 'pdr' || _currentPosition!.source == 'pdr+wifi')) {
      // Indoor navigation is actively engaged; do not let background outdoor GPS cancel it
      return;
    }
    stopPdr();
    int floor = _currentPosition?.floor ?? (_currentFloorPlan?.floorNumber ?? 0);
    double posX = _currentPosition?.x ?? 0;
    double posY = _currentPosition?.y ?? 0;
    String? closestNodeId;
    if (_currentNodes.isNotEmpty) {
      double minDist = double.infinity;
      MapNode? nearestNode;
      for (var n in _currentNodes) {
        if (n.latitude != null && n.longitude != null) {
          final d = NavigationMath.distanceBetween(lat, lng, n.latitude!, n.longitude!);
          if (d < minDist) {
            minDist = d;
            nearestNode = n;
            if (minDist < 10.0) {
              closestNodeId = n.id;
              floor = n.floor;
            }
          }
        }
      }
      // Update floor plan x,y from nearest node or IDW estimation
      if (nearestNode != null) {
        if (minDist < 10.0) {
          final estimated = _geoToFloorXY(lat, lng, floor);
          if (estimated != null) {
            posX = estimated.$1;
            posY = estimated.$2;
          } else {
            posX = nearestNode.x;
            posY = nearestNode.y;
          }
        } else if (posX == 0 && posY == 0) {
          posX = nearestNode.x;
          posY = nearestNode.y;
          floor = nearestNode.floor;
          closestNodeId ??= nearestNode.id;
        }
      }
    }

    updatePosition(
      PositionState(
        x: posX,
        y: posY,
        floor: floor,
        heading: (heading != null && heading > 0) ? heading : _currentHeading,
        accuracy: accuracy ?? 5.0,
        source: 'gps',
        timestamp: DateTime.now().millisecondsSinceEpoch,
        currentNodeId: closestNodeId ?? _currentPosition?.currentNodeId,
        latitude: lat,
        longitude: lng,
      ),
    );
  }

  /// Explicitly start PDR when entering museum proximity or when handed off from GPS.
  void startPdr() {
    if (!demoMode && !_isPdrRunning) _startPdr();
  }

  /// QR scan resets PDR to the artifact's true coordinate — drift eliminated.
  void scanQR(MapNode node) {
    stopSimulation();
    updatePosition(
      PositionState(
        x: node.x,
        y: node.y,
        floor: node.floor,
        heading: _currentHeading,
        accuracy: 1.0,
        source: 'qr',
        timestamp: DateTime.now().millisecondsSinceEpoch,
        currentNodeId: node.id,
        latitude: node.latitude,
        longitude: node.longitude,
      ),
    );
    // Always restart PDR after QR scan (stop first to reset accelerometer subscription)
    if (!demoMode) {
      stopPdr();
      _startPdr();
    }
  }

  void _startPdr() {
    _isPdrRunning = true;
    try {
      _accelSub = accelerometerEventStream().listen((e) {
        final now = DateTime.now().millisecondsSinceEpoch;
        _processAccelerometerSample(e.x, e.y, e.z, now);
      }, onError: (e) {
        debugPrint('IndoorPositionService: Accel sensor error: $e');
      });
    } catch (e) {
      debugPrint('IndoorPositionService: Accelerometer unavailable: $e');
    }
  }

  void _processAccelerometerSample(double x, double y, double z, int now) {
    if (_currentPosition == null) return;

    final mag = sqrt(x * x + y * y + z * z);
    final linear = (mag - 9.80665).abs();

    // Reset gait cycle if cadence has lapsed (e.g. visitor paused walking)
    if (_lastGaitPeakTime > 0 && (now - _lastGaitPeakTime) > _gaitTimeoutMs) {
      _consecutiveGaitPeaks = 0;
      _hasTroughSinceLastPeak = false;
    }

    // Trough detection: swing/rebound phase drops below trough threshold
    if (linear < _walkingTroughMaxLinear) {
      _hasTroughSinceLastPeak = true;
    }

    // Local peak detection: slope transition (+ to -) where previous sample was the peak
    if (_prevLinear > _prevPrevLinear &&
        _prevLinear >= linear &&
        _prevLinear >= _walkingPeakMinLinear) {
      final peakTime = _prevSampleTime > 0 ? _prevSampleTime : now;
      final interval = (_lastGaitPeakTime > 0) ? (peakTime - _lastGaitPeakTime) : 0;

      if (_lastGaitPeakTime == 0 || interval > _cadenceMaxIntervalMs) {
        // Isolated acceleration spike (picking up, rotating, setting down) or first step of new gait
        _consecutiveGaitPeaks = 1;
        _lastGaitPeakTime = peakTime;
        _hasTroughSinceLastPeak = false;
      } else if (interval >= _cadenceMinIntervalMs && interval <= _cadenceMaxIntervalMs) {
        // Interval is within genuine human walking cadence window (1.5 - 2.5 Hz / 360 - 850 ms)
        if (_hasTroughSinceLastPeak) {
          _consecutiveGaitPeaks++;
          _lastGaitPeakTime = peakTime;
          _hasTroughSinceLastPeak = false;

          // Require at least 2 consistent periodic peaks before registering a step
          if (_consecutiveGaitPeaks >= 2) {
            _lastStepTime = now;
            _onStepDetected();
          }
        }
      } else if (interval < _cadenceMinIntervalMs) {
        // Spurious high-frequency noise or shaking (< 350ms) - ignore
      }
    }

    _prevPrevLinear = _prevLinear;
    _prevLinear = linear;
    _prevSampleTime = now;
  }

  @visibleForTesting
  void processAccelerometerSampleForTesting(double x, double y, double z, int now) {
    _processAccelerometerSample(x, y, z, now);
  }

  void _onStepDetected() {
    if (_currentPosition == null) return;
    _hasStepDetected = true;

    const strideMeters = 0.75;
    final rad = _currentHeading * pi / 180;

    final hasGeoNodes = _currentNodes.any(
      (n) => n.floor == _currentPosition!.floor && n.latitude != null && n.longitude != null,
    );

    // Branch: if georeferenced nodes exist on this floor and pos has lat/lng, move in geodetic space; otherwise move in floor-plan x/y space
    if (hasGeoNodes && _currentPosition!.latitude != null && _currentPosition!.longitude != null) {
      _onStepWithGeo(strideMeters, rad);
    } else {
      _onStepWithXY(strideMeters, rad);
    }
  }

  /// PDR step movement in geodetic (lat/lng) space with graph snapping.
  void _onStepWithGeo(double strideMeters, double rad) {
    // Move in geodetic space: approximate lat/lng displacement
    final dLat = strideMeters * cos(rad) / 111320.0;
    final dLng =
        strideMeters *
        sin(rad) /
        (111320.0 * cos(_currentPosition!.latitude! * pi / 180));

    double newLat = _currentPosition!.latitude! + dLat;
    double newLng = _currentPosition!.longitude! + dLng;

    // Snap to nearest graph edge for corridor following (now cross-floor aware)
    // Returns: (lat, lng, closestNodeId, newFloor?, isLost, snappedX, snappedY)
    final snapped = _snapToGraphGeo(newLat, newLng, _currentPosition!.floor);
    newLat = snapped.$1;
    newLng = snapped.$2;
    String? nearestNodeId = snapped.$3;
    int? detectedFloor = snapped.$4;
    bool isLost = snapped.$5;
    double newX = snapped.$6;
    double newY = snapped.$7;

    // If snapping didn't produce valid x,y, fall back to nearest-node estimation
    if (newX == _currentPosition!.x && newY == _currentPosition!.y && !isLost) {
      final estimated = _geoToFloorXY(newLat, newLng, _currentPosition!.floor);
      if (estimated != null) {
        newX = estimated.$1;
        newY = estimated.$2;
      }
    }

    // If geo snapping produced no coordinate movement on the floor plan, fall back to x/y displacement
    if (newX == _currentPosition!.x && newY == _currentPosition!.y) {
      _onStepWithXY(strideMeters, rad);
      return;
    }

    // Detect floor transition
    bool floorTransitioned = false;
    int finalFloor = _currentPosition!.floor;
    if (detectedFloor != null && detectedFloor != _currentPosition!.floor) {
      finalFloor = detectedFloor;
      floorTransitioned = true;
    }

    String source = 'pdr';
    double blendedAcc = isLost ? 15.0 : 5.0;

    updatePosition(
      PositionState(
        x: newX,
        y: newY,
        floor: finalFloor,
        heading: _currentHeading,
        accuracy: blendedAcc,
        source: source,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        currentNodeId: nearestNodeId ?? _currentPosition!.currentNodeId,
        latitude: newLat,
        longitude: newLng,
        isLost: isLost,
        floorChanged: floorTransitioned,
      ),
    );

    // Stream real sensor step to mapping service PDR fusion endpoint
    if (_currentFloorPlan != null) {
      http.post(
        Uri.parse('${ApiConfig.mapServiceUrl}/navigation/pdr-step'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'floor_plan_id': _currentFloorPlan!.id,
          'current_position': {
            'map_x': newX,
            'map_y': newY,
            'latitude': newLat,
            'longitude': newLng,
          },
          'sensor_event': {
            'stride_meters': strideMeters,
            'heading_degrees': _currentHeading,
            'timestamp': DateTime.now().millisecondsSinceEpoch,
          },
        }),
      ).catchError((_) => http.Response('', 500));
    }
  }

  /// PDR step movement in floor-plan x/y space (fallback when lat/lng unavailable).
  /// Uses the floor plan's scale to convert stride meters to pixel displacement.
  void _onStepWithXY(double strideMeters, double rad) {
    final fp = _currentFloorPlan;
    // Determine pixel stride from floor plan scale
    double stridePx;
    if (fp != null && fp.scaleMetersPerPx > 0) {
      stridePx = strideMeters / fp.scaleMetersPerPx;
    } else {
      // Default: assume floor plan is ~600px wide representing ~30m → 0.05 m/px
      stridePx = strideMeters / 0.05;
    }

    // Normalize to floor plan dimensions if coordinates are in [0,1] range
    final double widthPx = fp != null && fp.widthPx > 0 ? fp.widthPx : 600;
    final double heightPx = fp != null && fp.heightPx > 0 ? fp.heightPx : 400;

    final bool isNormalized = _currentPosition!.x <= 1.0 && _currentPosition!.y <= 1.0;

    double dx, dy;
    if (isNormalized) {
      // Convert stride from pixels to normalized [0,1] space
      dx = stridePx * sin(rad) / widthPx;
      dy = -stridePx * cos(rad) / heightPx; // negative because y-axis is inverted in screen coords
    } else {
      dx = stridePx * sin(rad);
      dy = -stridePx * cos(rad);
    }

    double newX = _currentPosition!.x + dx;
    double newY = _currentPosition!.y + dy;

    // Clamp to floor plan bounds
    if (isNormalized) {
      newX = newX.clamp(0.0, 1.0);
      newY = newY.clamp(0.0, 1.0);
    } else {
      newX = newX.clamp(0.0, widthPx);
      newY = newY.clamp(0.0, heightPx);
    }

    // Snap to nearest graph edge in x/y space for corridor following
    final snapped = _snapToGraphXY(newX, newY, _currentPosition!.floor);
    newX = snapped.$1;
    newY = snapped.$2;
    String? nearestNodeId = snapped.$3;
    bool isLost = snapped.$4;

    String source = 'pdr';
    double blendedAcc = isLost ? 15.0 : 5.0;

    updatePosition(
      PositionState(
        x: newX,
        y: newY,
        floor: _currentPosition!.floor,
        heading: _currentHeading,
        accuracy: blendedAcc,
        source: source,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        currentNodeId: nearestNodeId ?? _currentPosition!.currentNodeId,
        latitude: null,
        longitude: null,
        isLost: isLost,
      ),
    );
  }

  /// Project position onto nearest walkable edge in geodetic space (cross-floor aware).
  /// Returns: (lat, lng, closestNodeId, newFloor?, isLost, snappedX, snappedY)
  /// - lat, lng: snapped geo coordinates
  /// - closestNodeId: nearest node to snapped position
  /// - newFloor: non-null if a floor transition detected (different from current floor)
  /// - isLost: true if snapped > 15m away (lost signal)
  /// - snappedX, snappedY: interpolated floor plan coordinates from edge endpoints
  (double, double, String?, int?, bool, double, double) _snapToGraphGeo(
    double lat,
    double lng,
    int floor,
  ) {
    double minDist = double.infinity;
    double bestLat = lat, bestLng = lng;
    double bestX = _currentPosition?.x ?? 0;
    double bestY = _currentPosition?.y ?? 0;
    String? closestNodeId;
    int? closestNodeFloor;

    final floorNodes = {
      for (var n in _currentNodes.where((n) => n.floor == floor)) n.id: n,
    };

    // First pass: snap to edges on the current floor
    for (var edge in _currentEdges) {
      if (!edge.walkable) continue;
      final u = floorNodes[edge.fromNodeId], v = floorNodes[edge.toNodeId];
      if (u == null || v == null || u.latitude == null || v.latitude == null) {
        continue;
      }

      // Project onto line segment u→v in lat/lng space
      final dx = v.latitude! - u.latitude!, dy = v.longitude! - u.longitude!;
      final l2 = dx * dx + dy * dy;
      if (l2 == 0) continue;

      double t = ((lat - u.latitude!) * dx + (lng - u.longitude!) * dy) / l2;
      t = t.clamp(0.0, 1.0);

      final projLat = u.latitude! + t * dx;
      final projLng = u.longitude! + t * dy;

      final d = NavigationMath.distanceBetween(lat, lng, projLat, projLng);
      if (d < minDist) {
        minDist = d;
        bestLat = projLat;
        bestLng = projLng;
        closestNodeId = t < 0.5 ? u.id : v.id;
        closestNodeFloor = floor; // same floor
        // Interpolate floor plan x,y from edge endpoints using the same t parameter
        bestX = u.x + t * (v.x - u.x);
        bestY = u.y + t * (v.y - u.y);
      }
    }

    // Second pass: if no good snap on current floor, check cross-floor edges (stairs/lifts)
    if (minDist > 10.0) {
      for (var edge in _currentEdges) {
        if (!edge.walkable) continue;
        MapNode? u, v;
        try {
          u = _currentNodes.firstWhere((n) => n.id == edge.fromNodeId);
        } catch (_) {}
        try {
          v = _currentNodes.firstWhere((n) => n.id == edge.toNodeId);
        } catch (_) {}
        if (u == null ||
            v == null ||
            u.latitude == null ||
            v.latitude == null) {
          continue;
        }

        // Only consider edges that cross floors (stairs/lifts)
        if (u.floor == v.floor) continue;

        // Project onto the cross-floor edge
        final dx = v.latitude! - u.latitude!, dy = v.longitude! - u.longitude!;
        final l2 = dx * dx + dy * dy;
        if (l2 == 0) continue;

        double t = ((lat - u.latitude!) * dx + (lng - u.longitude!) * dy) / l2;
        t = t.clamp(0.0, 1.0);

        final projLat = u.latitude! + t * dx;
        final projLng = u.longitude! + t * dy;

        final d = NavigationMath.distanceBetween(lat, lng, projLat, projLng);
        if (d < minDist) {
          minDist = d;
          bestLat = projLat;
          bestLng = projLng;
          closestNodeId = t < 0.5 ? u.id : v.id;
          closestNodeFloor = t < 0.5 ? u.floor : v.floor;
          // Interpolate floor plan x,y from edge endpoints
          bestX = u.x + t * (v.x - u.x);
          bestY = u.y + t * (v.y - u.y);
        }
      }
    }

    // Determine if lost (too far from any edge)
    bool isLost = minDist > 15.0;

    // Determine if floor changed
    int? newFloor = (closestNodeFloor != null && closestNodeFloor != floor)
        ? closestNodeFloor
        : null;

    if (isLost) {
      return (
        lat,
        lng,
        null,
        null,
        true,
        _currentPosition?.x ?? 0,
        _currentPosition?.y ?? 0,
      ); // Return original position, no node, is lost
    }
    return (bestLat, bestLng, closestNodeId, newFloor, false, bestX, bestY);
  }

  /// Snap position to nearest walkable edge in floor-plan x/y space.
  /// Returns: (snappedX, snappedY, closestNodeId, isLost)
  (double, double, String?, bool) _snapToGraphXY(double x, double y, int floor) {
    double minDist = double.infinity;
    double bestX = x, bestY = y;
    String? closestNodeId;

    final floorNodes = {
      for (var n in _currentNodes.where((n) => n.floor == floor)) n.id: n,
    };

    for (var edge in _currentEdges) {
      if (!edge.walkable) continue;
      final u = floorNodes[edge.fromNodeId], v = floorNodes[edge.toNodeId];
      if (u == null || v == null) continue;

      // Project onto line segment u→v in x/y space
      final dx = v.x - u.x, dy = v.y - u.y;
      final l2 = dx * dx + dy * dy;
      if (l2 == 0) continue;

      double t = ((x - u.x) * dx + (y - u.y) * dy) / l2;
      t = t.clamp(0.0, 1.0);

      final projX = u.x + t * dx;
      final projY = u.y + t * dy;

      final d = sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
      if (d < minDist) {
        minDist = d;
        bestX = projX;
        bestY = projY;
        closestNodeId = t < 0.5 ? u.id : v.id;
      }
    }

    // Determine threshold for "lost" — use a fraction of floor plan size
    final fp = _currentFloorPlan;
    final double refSize = (fp != null && fp.widthPx > 0) ? fp.widthPx : 600;
    // If coordinates are normalized (0-1), threshold is relative; otherwise in pixels
    final bool isNormalized = x <= 1.5 && y <= 1.5;
    final double lostThreshold = isNormalized ? 0.15 : refSize * 0.15;

    bool isLost = minDist > lostThreshold;

    if (isLost) {
      return (x, y, null, true);
    }
    return (bestX, bestY, closestNodeId, false);
  }

  /// Test probe for validating graph constraints without changing navigation behavior.
  (double, double, String?, int?, bool, double, double) snapToGraphGeoForTesting(
    double lat,
    double lng,
    int floor,
  ) => _snapToGraphGeo(lat, lng, floor);

  /// Estimate floor plan x,y from lat/lng using inverse-distance-weighted
  /// interpolation from nearby nodes. Used as fallback when not snapped to an edge.
  (double, double)? _geoToFloorXY(double lat, double lng, int floor) {
    final floorNodes = _currentNodes
        .where((n) => n.floor == floor && n.latitude != null && n.longitude != null)
        .toList();
    if (floorNodes.isEmpty) return null;

    // Find the 3 closest nodes and do inverse-distance-weighted interpolation
    floorNodes.sort((a, b) {
      final da = NavigationMath.distanceBetween(lat, lng, a.latitude!, a.longitude!);
      final db = NavigationMath.distanceBetween(lat, lng, b.latitude!, b.longitude!);
      return da.compareTo(db);
    });

    // If very close to a single node, just use its x,y
    final closest = floorNodes.first;
    final closestDist = NavigationMath.distanceBetween(lat, lng, closest.latitude!, closest.longitude!);
    if (closestDist < 0.5) return (closest.x, closest.y);

    // IDW with up to 3 nearest nodes
    final count = floorNodes.length < 3 ? floorNodes.length : 3;
    double sumW = 0, sumWx = 0, sumWy = 0;
    for (int i = 0; i < count; i++) {
      final n = floorNodes[i];
      final d = NavigationMath.distanceBetween(lat, lng, n.latitude!, n.longitude!);
      final w = 1.0 / (d * d + 0.01); // add small epsilon to avoid division by zero
      sumW += w;
      sumWx += w * n.x;
      sumWy += w * n.y;
    }
    return (sumWx / sumW, sumWy / sumW);
  }

  /// Zero-timer rule: Timer simulation removed. Movement strictly follows real device sensors and QR scans.
  void startSimulation(List<MapNode> path) {
    if (path.isNotEmpty) {
      scanQR(path[0]);
    }
  }

  void stopSimulation() {}

  void stopPdr() {
    _hasStepDetected = false;
    _accelSub?.cancel();
    _accelSub = null;
    _isPdrRunning = false;
    _lastGaitPeakTime = 0;
    _consecutiveGaitPeaks = 0;
    _hasTroughSinceLastPeak = false;
    _prevLinear = 0.0;
    _prevPrevLinear = 0.0;
    _prevSampleTime = 0;
  }



  void dispose() {
    stopSimulation();
    stopPdr();
    _accelHeadSub?.cancel();
    _magSub?.cancel();
    _gyroSub?.cancel();
    _headingController.close();
    _positionController.close();
  }
}
