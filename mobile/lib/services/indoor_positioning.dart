import 'dart:async';
import 'dart:math';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:permission_handler/permission_handler.dart';

import '../models/navigation_models.dart';

class PositionState {
  final double x;
  final double y;
  final int floor;
  final double heading;
  final double accuracy;
  final String source;
  final int timestamp;
  final String? currentNodeId;

  PositionState({
    required this.x,
    required this.y,
    required this.floor,
    required this.heading,
    required this.accuracy,
    required this.source,
    required this.timestamp,
    this.currentNodeId,
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
    );
  }
}

class IndoorPositionService {
  final _positionController = StreamController<PositionState>.broadcast();
  Stream<PositionState> get positionStream => _positionController.stream;

  PositionState? _currentPosition;
  PositionState? get currentPosition => _currentPosition;

  StreamSubscription? _accelSub;
  StreamSubscription? _magSub;
  
  bool _isPdrRunning = false;
  double _currentHeading = 0.0;
  
  // Step detection state
  static const double _stepThreshold = 1.2;
  static const int _minTimeBetweenSteps = 300; // ms
  int _lastStepTime = 0;
  
  FloorPlan? _currentFloorPlan;
  List<MapEdge> _currentEdges = [];
  List<MapNode> _currentNodes = [];

  // Simulator state
  Timer? _simTimer;
  List<MapNode>? _simPath;
  int _simIndex = 0;
  double _simProgress = 0.0;
  bool demoMode = false;

  Future<void> requestPermissions() async {
    await [
      Permission.camera,
      Permission.locationWhenInUse,
      Permission.sensors,
    ].request();
  }

  void updateContext(FloorPlan? floorPlan, List<MapNode> nodes, List<MapEdge> edges) {
    _currentFloorPlan = floorPlan;
    _currentNodes = nodes;
    _currentEdges = edges;
  }

  void updatePosition(PositionState newPos) {
    _currentPosition = newPos;
    _positionController.add(newPos);
  }

  void scanQR(MapNode node) {
    stopSimulation();
    
    final newPos = PositionState(
      x: node.x,
      y: node.y,
      floor: node.floor,
      heading: _currentPosition?.heading ?? 0.0,
      accuracy: 1.0,
      source: 'qr',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      currentNodeId: node.id,
    );
    updatePosition(newPos);
    
    if (!demoMode && !_isPdrRunning) {
      _startPdr();
    }
  }

  void _startPdr() {
    _isPdrRunning = true;
    _magSub = magnetometerEventStream().listen((MagnetometerEvent event) {
      // Simple heading from magnetometer (y, x swapped based on orientation normally)
      _currentHeading = atan2(event.y, event.x) * 180 / pi;
    });

    _accelSub = accelerometerEventStream().listen((AccelerometerEvent event) {
      if (_currentPosition == null || _currentFloorPlan == null) return;
      
      final now = DateTime.now().millisecondsSinceEpoch;
      final magnitude = sqrt(event.x*event.x + event.y*event.y + event.z*event.z);
      
      // Basic gravity removal (assuming roughly 9.8)
      final linearAcc = (magnitude - 9.8).abs();

      if (linearAcc > _stepThreshold && (now - _lastStepTime) > _minTimeBetweenSteps) {
        _lastStepTime = now;
        _onStepDetected();
      }
    });
  }

  void _onStepDetected() {
    if (_currentPosition == null || _currentFloorPlan == null) return;

    final strideMeters = 0.75;
    final scale = _currentFloorPlan!.scaleMetersPerPx;
    final stridePx = strideMeters / scale;

    final rad = _currentHeading * pi / 180;
    
    double newX = _currentPosition!.x + stridePx * cos(rad);
    double newY = _currentPosition!.y + stridePx * sin(rad);

    // Graph Snapping
    if (_currentNodes.isNotEmpty && _currentEdges.isNotEmpty) {
      var snapped = _snapToGraph(newX, newY, _currentPosition!.floor);
      newX = snapped[0];
      newY = snapped[1];
    }

    final newPos = PositionState(
      x: newX,
      y: newY,
      floor: _currentPosition!.floor,
      heading: _currentHeading,
      accuracy: 5.0,
      source: 'pdr',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      currentNodeId: _currentPosition!.currentNodeId,
    );
    updatePosition(newPos);
  }

  List<double> _snapToGraph(double px, double py, int floor) {
    // Project point onto nearest walkable edge on the same floor
    double minDist = double.infinity;
    double bestX = px;
    double bestY = py;

    final floorNodes = _currentNodes.where((n) => n.floor == floor).toList();
    final nodeDict = {for (var n in floorNodes) n.id: n};

    for (var edge in _currentEdges) {
      if (!edge.walkable) continue;
      final u = nodeDict[edge.fromNodeId];
      final v = nodeDict[edge.toNodeId];
      if (u == null || v == null) continue;

      // Distance from point (px,py) to line segment (u, v)
      final l2 = pow(u.x - v.x, 2) + pow(u.y - v.y, 2);
      if (l2 == 0) continue;

      double t = ((px - u.x) * (v.x - u.x) + (py - u.y) * (v.y - u.y)) / l2;
      t = max(0, min(1, t));

      final projX = u.x + t * (v.x - u.x);
      final projY = u.y + t * (v.y - u.y);

      final d2 = pow(px - projX, 2) + pow(py - projY, 2);
      if (d2 < minDist) {
        minDist = d2.toDouble();
        bestX = projX;
        bestY = projY;
      }
    }
    
    // If we're too far from any edge, just return original (don't snap wildly)
    if (minDist > pow(100, 2)) return [px, py];
    return [bestX, bestY];
  }

  // --- Mock Position Simulator (Demo Mode) ---
  void startSimulation(List<MapNode> path) {
    stopSimulation();
    if (path.isEmpty) return;

    _simPath = path;
    _simIndex = 0;
    _simProgress = 0.0;

    scanQR(path[0]);

    _simTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (_simPath == null || _simIndex >= _simPath!.length - 1) {
        stopSimulation();
        return;
      }

      var current = _simPath![_simIndex];
      var next = _simPath![_simIndex + 1];

      if (current.floor != next.floor) {
        _simProgress += 0.02;
        if (_simProgress >= 1.0) {
          _simProgress = 0.0;
          _simIndex++;
          scanQR(_simPath![_simIndex]);
        }
        return;
      }

      double distance = sqrt(pow(next.x - current.x, 2) + pow(next.y - current.y, 2));
      double speed = 2.0;
      double progressStep = speed / max(distance, 1.0);

      _simProgress += progressStep;

      if (_simProgress >= 1.0) {
        _simProgress = 0.0;
        _simIndex++;
        if (_simIndex >= _simPath!.length) {
          stopSimulation();
          return;
        }
        current = _simPath![_simIndex];
        if (_simIndex < _simPath!.length - 1) {
           next = _simPath![_simIndex + 1];
        }
      }

      if (_simIndex < _simPath!.length - 1 && current.floor == next.floor) {
        double newX = current.x + (next.x - current.x) * _simProgress;
        double newY = current.y + (next.y - current.y) * _simProgress;
        
        final rand = Random();
        newX += (rand.nextDouble() - 0.5) * 0.5;
        newY += (rand.nextDouble() - 0.5) * 0.5;

        double heading = atan2(next.y - current.y, next.x - current.x) * 180 / pi;

        final newPos = PositionState(
          x: newX,
          y: newY,
          floor: current.floor,
          heading: heading,
          accuracy: 2.5,
          source: 'sensor_sim',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          currentNodeId: _simProgress < 0.5 ? current.id : next.id,
        );
        updatePosition(newPos);
      }
    });
  }

  void stopSimulation() {
    _simTimer?.cancel();
    _simTimer = null;
    _simPath = null;
  }
  
  void stopPdr() {
    _accelSub?.cancel();
    _magSub?.cancel();
    _isPdrRunning = false;
  }

  void dispose() {
    stopSimulation();
    stopPdr();
    _positionController.close();
  }
}
