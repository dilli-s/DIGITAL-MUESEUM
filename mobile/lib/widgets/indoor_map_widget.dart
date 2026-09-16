import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/api.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';
import '../services/indoor_positioning.dart';
import '../utils/navigation_math.dart';

class IndoorMapWidget extends StatefulWidget {
  final FloorPlan floorPlan;
  final PositionState? currentPosition;
  final List<MapNode> routePath;
  final MapNode? destinationNode;
  final List<MapNode> allNodes;
  final List<Gallery> galleries;
  final int? currentRoomId;
  final Set<String> visitedNodeIds;
  final Function(MapNode) onNodeTap;
  final Function(MapLibreMapController)? onMapCreated;

  const IndoorMapWidget({
    super.key,
    required this.floorPlan,
    this.currentPosition,
    this.routePath = const [],
    this.destinationNode,
    this.allNodes = const [],
    this.galleries = const [],
    this.currentRoomId,
    this.visitedNodeIds = const {},
    required this.onNodeTap,
    this.onMapCreated,
  });

  @override
  State<IndoorMapWidget> createState() => _IndoorMapWidgetState();
}

enum MapDisplayMode { floorPlan, streetMap }

class _IndoorMapWidgetState extends State<IndoorMapWidget>
    with TickerProviderStateMixin {
  MapLibreMapController? _mapController;
  bool _isMapReady = false;
  MapDisplayMode _displayMode = MapDisplayMode.floorPlan;
  final TransformationController _transformController = TransformationController();

  late AnimationController _positionAnimController;
  late Animation<double> _positionCurve;
  Offset? _animatedPos;
  Offset? _startPos;
  Offset? _targetPos;
  int? _currentPosFloor;

  late AnimationController _headingAnimController;
  late Animation<double> _headingCurve;
  double? _animatedHeading;
  double? _startHeading;
  double? _targetHeading;
  int _lastHeadingUpdateTime = 0;

  static const String osmMapStyleJson = '''{
    "version": 8,
    "sources": {
      "osm-tiles": {
        "type": "raster",
        "tiles": [
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        "tileSize": 256,
        "attribution": "© OpenStreetMap contributors"
      }
    },
    "layers": [
      {
        "id": "osm-tiles-layer",
        "type": "raster",
        "source": "osm-tiles",
        "minzoom": 0,
        "maxzoom": 22
      }
    ]
  }''';

  @override
  void initState() {
    super.initState();
    if (widget.floorPlan.imageUrl.isEmpty) {
      _displayMode = MapDisplayMode.streetMap;
    }

    _positionAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _positionCurve = CurvedAnimation(
      parent: _positionAnimController,
      curve: Curves.easeOutCubic,
    );
    _positionAnimController.addListener(() {
      if (_startPos != null && _targetPos != null) {
        final t = _positionCurve.value;
        _animatedPos = Offset(
          _startPos!.dx + (_targetPos!.dx - _startPos!.dx) * t,
          _startPos!.dy + (_targetPos!.dy - _startPos!.dy) * t,
        );
      }
    });

    _headingAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _headingCurve = CurvedAnimation(
      parent: _headingAnimController,
      curve: Curves.easeOutCubic,
    );
    _headingAnimController.addListener(() {
      if (_startHeading != null && _targetHeading != null) {
        final t = _headingCurve.value;
        double h = (_startHeading! + (_targetHeading! - _startHeading!) * t) % 360.0;
        if (h < 0) h += 360.0;
        _animatedHeading = h;
      }
    });

    if (widget.currentPosition != null) {
      final pos = widget.currentPosition!;
      final initOffset = Offset(pos.x, pos.y);
      _animatedPos = initOffset;
      _startPos = initOffset;
      _targetPos = initOffset;
      _currentPosFloor = pos.floor;

      _animatedHeading = pos.heading;
      _startHeading = pos.heading;
      _targetHeading = pos.heading;
      _lastHeadingUpdateTime =
          pos.timestamp > 0 ? pos.timestamp : DateTime.now().millisecondsSinceEpoch;
    }
  }

  @override
  void dispose() {
    _positionAnimController.dispose();
    _headingAnimController.dispose();
    _transformController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(IndoorMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.currentPosition != oldWidget.currentPosition) {
      final newPos = widget.currentPosition;
      if (newPos != null) {
        final newTarget = Offset(newPos.x, newPos.y);
        final floorChanged =
            _currentPosFloor != null && _currentPosFloor != newPos.floor;
        _currentPosFloor = newPos.floor;

        if (oldWidget.currentPosition == null ||
            _animatedPos == null ||
            floorChanged) {
          // Instant snap on first fix or floor change
          _positionAnimController.stop();
          _startPos = newTarget;
          _targetPos = newTarget;
          _animatedPos = newTarget;
        } else if (_targetPos != newTarget) {
          // Smooth redirection toward the new confirmed position
          _startPos = _animatedPos ?? newTarget;
          _targetPos = newTarget;
          _positionAnimController.forward(from: 0.0);
        }

        // Smooth heading animation & rotational speed capping
        final newHeading = newPos.heading;
        final now = (newPos.timestamp > 0 && newPos.timestamp > _lastHeadingUpdateTime)
            ? newPos.timestamp
            : DateTime.now().millisecondsSinceEpoch;

        if (oldWidget.currentPosition == null ||
            _animatedHeading == null ||
            floorChanged) {
          _headingAnimController.stop();
          _animatedHeading = newHeading;
          _startHeading = newHeading;
          _targetHeading = newHeading;
          _lastHeadingUpdateTime = now;
        } else {
          // Compute shortest angular difference along circular arc [-180, 180]
          double diff = ((newHeading - _animatedHeading! + 540.0) % 360.0) - 180.0;

          if (diff.abs() > 0.5) {
            // Cap maximum visual rotation speed per update (degrees per second)
            // 280°/s matches natural brisk human turning speed, preventing erratic visual snaps
            const double maxDegPerSec = 280.0;
            final dt = (_lastHeadingUpdateTime > 0)
                ? (now - _lastHeadingUpdateTime) / 1000.0
                : 0.05;
            final effectiveDt = dt.clamp(0.016, 0.5);
            final maxDelta = (maxDegPerSec * effectiveDt).clamp(6.0, 180.0);

            if (diff.abs() > maxDelta) {
              diff = diff.sign * maxDelta;
            }

            _headingAnimController.stop();
            _startHeading = _animatedHeading!;
            _targetHeading = _startHeading! + diff;

            final animDurationMs =
                (diff.abs() / maxDegPerSec * 1000).clamp(120, 260).toInt();
            _headingAnimController.duration =
                Duration(milliseconds: animDurationMs);
            _headingAnimController.forward(from: 0.0);
          }
          _lastHeadingUpdateTime = now;
        }
      } else {
        _positionAnimController.stop();
        _animatedPos = null;
        _startPos = null;
        _targetPos = null;
        _currentPosFloor = null;

        _headingAnimController.stop();
        _animatedHeading = null;
        _startHeading = null;
        _targetHeading = null;
        _lastHeadingUpdateTime = 0;
      }
    }

    if (_isMapReady && _displayMode == MapDisplayMode.streetMap) {
      bool staticChanged = oldWidget.galleries != widget.galleries ||
          oldWidget.routePath != widget.routePath ||
          oldWidget.allNodes != widget.allNodes ||
          oldWidget.currentRoomId != widget.currentRoomId ||
          oldWidget.destinationNode != widget.destinationNode;

      if (staticChanged) {
        _updateStaticSources();
      }

      if (widget.currentPosition != oldWidget.currentPosition) {
        _updateDynamicSources();
        // Only auto-center if navigating (route started)
        if (widget.routePath.isNotEmpty) {
          _animateToCurrentPosition();
        }
      }
    }
  }

  Future<void> _animateToCurrentPosition() async {
    if (widget.currentPosition?.latitude == null ||
        widget.currentPosition?.longitude == null) {
      return;
    }
    if (_mapController != null) {
      double bearing = 0.0;
      if (widget.routePath.isNotEmpty) {
        bearing = _animatedHeading ?? widget.currentPosition!.heading;
      }
      _mapController!.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: LatLng(
              widget.currentPosition!.latitude!,
              widget.currentPosition!.longitude!,
            ),
            zoom: 21,
            bearing: bearing,
          ),
        ),
      );
    }
  }

  void _onMapCreated(MapLibreMapController controller) {
    _mapController = controller;
    controller.onFeatureTapped.add(_onFeatureTapped);
    if (widget.onMapCreated != null) {
      widget.onMapCreated!(controller);
    }
  }

  void _onStyleLoaded() {
    setState(() {
      _isMapReady = true;
    });
    _addSourcesAndLayers();
  }

  void _onFeatureTapped(
    math.Point<double> point,
    LatLng coordinates,
    String id,
    String layerId,
    Annotation? annotation,
  ) async {
    if (_mapController == null) return;
    List<dynamic> features = await _mapController!.queryRenderedFeatures(
      point,
      ['nodes-layer'],
      null,
    );
    if (features.isNotEmpty) {
      final props = features.first['properties'];
      if (props != null && props['id'] != null) {
        final tappedNodeId = props['id'];
        try {
          final node = widget.allNodes.firstWhere((n) => n.id == tappedNodeId);
          widget.onNodeTap(node);
        } catch (_) {}
      }
    }
  }

  Future<void> _addSourcesAndLayers() async {
    if (_mapController == null) return;

    await _mapController!.addGeoJsonSource(
      'galleries-source',
      {"type": "FeatureCollection", "features": []},
    );
    await _mapController!.addGeoJsonSource(
      'route-source',
      {"type": "FeatureCollection", "features": []},
    );
    await _mapController!.addGeoJsonSource(
      'nodes-source',
      {"type": "FeatureCollection", "features": []},
    );
    await _mapController!.addGeoJsonSource(
      'position-cone-source',
      {"type": "FeatureCollection", "features": []},
    );
    await _mapController!.addGeoJsonSource(
      'position-source',
      {"type": "FeatureCollection", "features": []},
    );

    await _mapController!.addFillLayer(
      'galleries-source',
      'galleries-fill-neutral',
      const FillLayerProperties(
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
      ),
      filter: ['all', ['!=', 'isDestination', true], ['!=', 'isActive', true]],
    );

    await _mapController!.addFillLayer(
      'galleries-source',
      'galleries-fill-active',
      const FillLayerProperties(
        fillColor: '#10B981',
        fillOpacity: 0.30,
      ),
      filter: ['==', 'isActive', true],
    );

    await _mapController!.addFillLayer(
      'galleries-source',
      'galleries-fill-destination',
      const FillLayerProperties(
        fillColor: '#8B5CF6',
        fillOpacity: 0.35,
      ),
      filter: ['==', 'isDestination', true],
    );

    await _mapController!.addLineLayer(
      'galleries-source',
      'galleries-line-neutral',
      const LineLayerProperties(
        lineColor: '#64748B',
        lineWidth: 1.5,
      ),
      filter: ['all', ['!=', 'isDestination', true], ['!=', 'isActive', true]],
    );

    await _mapController!.addLineLayer(
      'galleries-source',
      'galleries-line-active',
      const LineLayerProperties(
        lineColor: '#10B981',
        lineWidth: 2.5,
      ),
      filter: ['==', 'isActive', true],
    );

    await _mapController!.addLineLayer(
      'galleries-source',
      'galleries-line-destination',
      const LineLayerProperties(
        lineColor: '#8B5CF6',
        lineWidth: 2.5,
      ),
      filter: ['==', 'isDestination', true],
    );

    await _mapController!.addSymbolLayer(
      'galleries-source',
      'galleries-labels',
      const SymbolLayerProperties(
        textField: ['get', 'name'],
        textSize: 11,
        textColor: '#1E293B',
        textHaloColor: '#FFFFFF',
        textHaloWidth: 2.0,
        textMaxWidth: 10,
      ),
    );

    await _mapController!.addLineLayer(
      'route-source',
      'route-layer',
      const LineLayerProperties(
        lineColor: '#4F46E5',
        lineWidth: 5,
        lineCap: 'round',
        lineJoin: 'round',
      ),
    );

    await _mapController!.addCircleLayer(
      'nodes-source',
      'nodes-layer',
      const CircleLayerProperties(
        circleColor: '#64748B',
        circleRadius: 6,
        circleStrokeWidth: 2,
        circleStrokeColor: '#FFFFFF',
      ),
    );

    await _mapController!.addCircleLayer(
      'nodes-source',
      'entrance-layer',
      const CircleLayerProperties(
        circleColor: '#10B981',
        circleRadius: 8,
        circleStrokeWidth: 2,
        circleStrokeColor: '#FFFFFF',
      ),
      filter: ['==', 'isEntrance', true],
    );

    await _mapController!.addCircleLayer(
      'nodes-source',
      'exit-layer',
      const CircleLayerProperties(
        circleColor: '#EF4444',
        circleRadius: 8,
        circleStrokeWidth: 2,
        circleStrokeColor: '#FFFFFF',
      ),
      filter: ['==', 'isExit', true],
    );

    await _mapController!.addCircleLayer(
      'nodes-source',
      'destination-layer',
      const CircleLayerProperties(
        circleColor: '#EC4899',
        circleRadius: 10,
        circleStrokeWidth: 2.5,
        circleStrokeColor: '#FFFFFF',
      ),
      filter: ['==', 'isDestination', true],
    );

    await _mapController!.addFillLayer(
      'position-cone-source',
      'position-cone-layer',
      const FillLayerProperties(
        fillColor: '#3B82F6',
        fillOpacity: 0.35,
      ),
    );

    await _mapController!.addCircleLayer(
      'position-source',
      'position-layer',
      const CircleLayerProperties(
        circleColor: '#2563EB',
        circleRadius: 8,
        circleStrokeWidth: 3,
        circleStrokeColor: '#FFFFFF',
      ),
    );

    _updateStaticSources();
    _updateDynamicSources();
  }

  void _updateStaticSources() async {
    if (_mapController == null || !_isMapReady) return;

    Gallery? activeRoom;
    if (widget.currentRoomId != null) {
      try {
        activeRoom = widget.galleries.firstWhere((g) => g.id == widget.currentRoomId);
      } catch (_) {}
    }

    MapNode? targetDestNode = widget.destinationNode;
    if (targetDestNode == null && widget.routePath.isNotEmpty) {
      targetDestNode = widget.routePath.last;
    }

    List<Map<String, dynamic>> galleryFeatures = [];
    for (var g in widget.galleries) {
      if (g.boundaryPolygon != null && g.boundaryPolygon!.length >= 3) {
        bool isActiveRoom = activeRoom != null && activeRoom.id == g.id;
        bool isDestRoom = false;
        if (targetDestNode != null &&
            targetDestNode.latitude != null &&
            targetDestNode.longitude != null) {
          isDestRoom = NavigationMath.isPointInPolygon(
            targetDestNode.latitude!,
            targetDestNode.longitude!,
            g.boundaryPolygon!,
          );
        }

        List<List<double>> coords =
            g.boundaryPolygon!.map((p) => [p['lng']!, p['lat']!]).toList();
        coords.add(coords.first);
        galleryFeatures.add({
          "type": "Feature",
          "properties": {
            "id": g.id,
            "name": g.name,
            "isDestination": isDestRoom,
            "isActive": isActiveRoom,
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [coords]
          }
        });
      }
    }
    await _mapController!.setGeoJsonSource('galleries-source', {
      "type": "FeatureCollection",
      "features": galleryFeatures
    });

    List<List<double>> routeCoords = [];
    if (widget.currentPosition != null &&
        widget.currentPosition!.latitude != null &&
        widget.currentPosition!.longitude != null &&
        widget.currentPosition!.floor == widget.floorPlan.floorNumber) {
      routeCoords.add([
        widget.currentPosition!.longitude!,
        widget.currentPosition!.latitude!,
      ]);
    }
    for (var node in widget.routePath) {
      if (node.latitude != null &&
          node.longitude != null &&
          node.floor == widget.floorPlan.floorNumber) {
        routeCoords.add([node.longitude!, node.latitude!]);
      }
    }
    List<Map<String, dynamic>> routeFeatures = [];
    if (routeCoords.length >= 2) {
      routeFeatures.add({
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "LineString",
          "coordinates": routeCoords,
        }
      });
    }
    await _mapController!.setGeoJsonSource('route-source', {
      "type": "FeatureCollection",
      "features": routeFeatures
    });

    List<Map<String, dynamic>> nodeFeatures = [];
    for (var node in widget.allNodes) {
      if (node.latitude == null || node.longitude == null) continue;
      if (node.floor != widget.floorPlan.floorNumber) continue;

      final isDest = targetDestNode != null && targetDestNode.id == node.id;
      final isEntrance = node.nodeType.contains('entrance');
      final isExit = node.nodeType.contains('exit');

      nodeFeatures.add({
        "type": "Feature",
        "properties": {
          "id": node.id,
          "name": node.name,
          "isDestination": isDest,
          "isEntrance": isEntrance,
          "isExit": isExit,
        },
        "geometry": {
          "type": "Point",
          "coordinates": [node.longitude!, node.latitude!]
        }
      });
    }
    await _mapController!.setGeoJsonSource('nodes-source', {
      "type": "FeatureCollection",
      "features": nodeFeatures
    });
  }

  void _updateDynamicSources() async {
    if (_mapController == null || !_isMapReady) return;

    List<Map<String, dynamic>> coneFeatures = [];
    if (widget.currentPosition != null &&
        widget.currentPosition!.latitude != null &&
        widget.currentPosition!.longitude != null) {
      double lat = widget.currentPosition!.latitude!;
      double lng = widget.currentPosition!.longitude!;
      double heading = _animatedHeading ?? widget.currentPosition!.heading;

      const double radiusMeters = 7.5;
      const double fovDegrees = 60.0;
      const int steps = 12;

      double startAngle = heading - (fovDegrees / 2.0);
      double stepSize = fovDegrees / steps;

      List<List<double>> coneCoords = [];
      coneCoords.add([lng, lat]);

      for (int i = 0; i <= steps; i++) {
        double angle = startAngle + (i * stepSize);
        double rad = angle * (math.pi / 180.0);
        double dx = radiusMeters * math.sin(rad);
        double dy = radiusMeters * math.cos(rad);
        double dLat = dy / 111320.0;
        double dLng = dx / (111320.0 * math.cos(lat * (math.pi / 180.0)));
        coneCoords.add([lng + dLng, lat + dLat]);
      }
      coneCoords.add([lng, lat]);

      coneFeatures.add({
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "Polygon",
          "coordinates": [coneCoords]
        }
      });
    }
    await _mapController!.setGeoJsonSource('position-cone-source', {
      "type": "FeatureCollection",
      "features": coneFeatures
    });

    List<Map<String, dynamic>> posFeatures = [];
    if (widget.currentPosition != null &&
        widget.currentPosition!.latitude != null &&
        widget.currentPosition!.longitude != null) {
      posFeatures.add({
        "type": "Feature",
        "properties": {"heading": _animatedHeading ?? widget.currentPosition!.heading},
        "geometry": {
          "type": "Point",
          "coordinates": [
            widget.currentPosition!.longitude!,
            widget.currentPosition!.latitude!
          ]
        }
      });
    }
    await _mapController!.setGeoJsonSource('position-source', {
      "type": "FeatureCollection",
      "features": posFeatures
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasFloorPlanImage = widget.floorPlan.imageUrl.isNotEmpty;

    return Stack(
      children: [
        if (_displayMode == MapDisplayMode.floorPlan && hasFloorPlanImage)
          _buildFloorPlanCanvas()
        else
          _buildMapLibreMap(),

        if (hasFloorPlanImage)
          Positioned(
            top: 16,
            right: 16,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildModeToggleButton(
                    title: 'Floor Plan',
                    icon: Icons.layers_rounded,
                    isSelected: _displayMode == MapDisplayMode.floorPlan,
                    onTap: () {
                      setState(() {
                        _displayMode = MapDisplayMode.floorPlan;
                      });
                    },
                  ),
                  _buildModeToggleButton(
                    title: 'Map',
                    icon: Icons.map_rounded,
                    isSelected: _displayMode == MapDisplayMode.streetMap,
                    onTap: () {
                      setState(() {
                        _displayMode = MapDisplayMode.streetMap;
                      });
                    },
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildModeToggleButton({
    required String title,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? Colors.indigo[700] : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : Colors.grey.shade600,
            ),
            const SizedBox(width: 5),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloorPlanCanvas() {
    final imageUrl = ApiConfig.getFloorPlanImageUrl(widget.floorPlan.imageUrl);
    final double widthPx = widget.floorPlan.widthPx > 0 ? widget.floorPlan.widthPx : 600;
    final double heightPx = widget.floorPlan.heightPx > 0 ? widget.floorPlan.heightPx : 400;
    final double aspectRatio = widthPx / heightPx;

    return Container(
      color: const Color(0xFFF1F5F9),
      child: LayoutBuilder(
        builder: (context, constraints) {
          double displayW = constraints.maxWidth;
          double displayH = displayW / aspectRatio;

          if (displayH > constraints.maxHeight) {
            displayH = constraints.maxHeight;
            displayW = displayH * aspectRatio;
          }

          return InteractiveViewer(
            transformationController: _transformController,
            minScale: 0.5,
            maxScale: 6.0,
            constrained: true,
            child: Center(
              child: Container(
                width: displayW,
                height: displayH,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: CachedNetworkImage(
                          key: ValueKey('${widget.floorPlan.id}_$imageUrl'),
                          imageUrl: imageUrl,
                          fit: BoxFit.fill,
                          placeholder: (context, url) => const Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          errorWidget: (context, url, error) => Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.broken_image_rounded, size: 36, color: Colors.grey.shade400),
                                const SizedBox(height: 6),
                                Text(
                                  'Floor plan unavailable',
                                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: GestureDetector(
                          onTapUp: (details) {
                            final localOffset = details.localPosition;
                            final normX = localOffset.dx / displayW;
                            final normY = localOffset.dy / displayH;

                            MapNode? tappedNode;
                            double minThreshold = 0.08;
                            for (var node in widget.allNodes) {
                              if (node.floor != widget.floorPlan.floorNumber) continue;
                              double nx = (node.x <= 1.0) ? node.x : (node.x / widthPx);
                              double ny = (node.y <= 1.0) ? node.y : (node.y / heightPx);
                              double dist = math.sqrt(math.pow(nx - normX, 2) + math.pow(ny - normY, 2));
                              if (dist < minThreshold) {
                                minThreshold = dist;
                                tappedNode = node;
                              }
                            }
                            if (tappedNode != null) {
                              widget.onNodeTap(tappedNode);
                            }
                          },
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _positionAnimController,
                              _headingAnimController,
                            ]),
                            builder: (context, child) {
                              final displayPosition =
                                  (widget.currentPosition != null)
                                      ? widget.currentPosition!.copyWith(
                                          x: _animatedPos?.dx ?? widget.currentPosition!.x,
                                          y: _animatedPos?.dy ?? widget.currentPosition!.y,
                                          heading: _animatedHeading ?? widget.currentPosition!.heading,
                                        )
                                      : null;

                              return CustomPaint(
                                painter: _FloorPlanPainter(
                                  floorPlan: widget.floorPlan,
                                  allNodes: widget.allNodes,
                                  routePath: widget.routePath,
                                  galleries: widget.galleries,
                                  currentRoomId: widget.currentRoomId,
                                  destinationNode: widget.destinationNode,
                                  currentPosition: displayPosition,
                                  visitedNodeIds: widget.visitedNodeIds,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMapLibreMap() {
    CameraPosition initialPos = const CameraPosition(
      target: LatLng(0, 0),
      zoom: 18,
    );

    if (widget.currentPosition?.latitude != null &&
        widget.currentPosition?.longitude != null) {
      initialPos = CameraPosition(
        target: LatLng(
          widget.currentPosition!.latitude!,
          widget.currentPosition!.longitude!,
        ),
        zoom: 20,
      );
    } else if (widget.allNodes.isNotEmpty) {
      try {
        var firstNode = widget.allNodes.firstWhere(
          (n) =>
              n.latitude != null &&
              n.longitude != null &&
              n.floor == widget.floorPlan.floorNumber,
        );
        initialPos = CameraPosition(
          target: LatLng(firstNode.latitude!, firstNode.longitude!),
          zoom: 19,
        );
      } catch (_) {}
    }

    return MapLibreMap(
      initialCameraPosition: initialPos,
      onMapCreated: _onMapCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      styleString: osmMapStyleJson,
      myLocationEnabled: false,
      myLocationRenderMode: MyLocationRenderMode.normal,
      compassEnabled: false,
      zoomGesturesEnabled: true,
      trackCameraPosition: true,
    );
  }
}

class _FloorPlanPainter extends CustomPainter {
  final FloorPlan floorPlan;
  final List<MapNode> allNodes;
  final List<MapNode> routePath;
  final List<Gallery> galleries;
  final int? currentRoomId;
  final MapNode? destinationNode;
  final PositionState? currentPosition;
  final Set<String> visitedNodeIds;

  _FloorPlanPainter({
    required this.floorPlan,
    required this.allNodes,
    required this.routePath,
    required this.galleries,
    this.currentRoomId,
    this.destinationNode,
    this.currentPosition,
    this.visitedNodeIds = const {},
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;
    final double widthPx = floorPlan.widthPx > 0 ? floorPlan.widthPx : 600;
    final double heightPx = floorPlan.heightPx > 0 ? floorPlan.heightPx : 400;

    Offset toCanvas(double x, double y) {
      double nx = (x <= 1.0) ? x : (x / widthPx);
      double ny = (y <= 1.0) ? y : (y / heightPx);
      return Offset(nx * w, ny * h);
    }

    // Filter galleries strictly for the active floor plan to prevent cross-floor overlap
    final floorGalleries = galleries.where((g) {
      if (g.floor != null && g.floor!.isNotEmpty) {
        final parsedFloor = int.tryParse(g.floor!);
        if (parsedFloor != null) {
          return parsedFloor == floorPlan.floorNumber;
        }
        final clean = g.floor!.replaceAll(RegExp(r'[^0-9]'), '');
        if (clean.isNotEmpty) {
          return int.tryParse(clean) == floorPlan.floorNumber;
        }
        if (g.floor!.toLowerCase().contains('ground') && floorPlan.floorNumber == 1) {
          return true;
        }
      }
      return false;
    }).toList();

    for (var g in floorGalleries) {
      if (g.boundaryPolygon != null && g.boundaryPolygon!.length >= 3) {
        final path = Path();
        bool isFirst = true;
        double sumX = 0, sumY = 0;
        int ptCount = 0;

        for (var pt in g.boundaryPolygon!) {
          double? px = pt['x'];
          double? py = pt['y'];
          if (px == null || py == null) continue;
          final offset = toCanvas(px, py);
          if (isFirst) {
            path.moveTo(offset.dx, offset.dy);
            isFirst = false;
          } else {
            path.lineTo(offset.dx, offset.dy);
          }
          sumX += offset.dx;
          sumY += offset.dy;
          ptCount++;
        }
        path.close();

        final isActive = currentRoomId != null && g.id == currentRoomId;
        final isDest = destinationNode != null &&
            destinationNode!.floor == floorPlan.floorNumber &&
            NavigationMath.isPointInNormalizedPolygon(
              destinationNode!.x,
              destinationNode!.y,
              g.boundaryPolygon!,
            );

        final fillPaint = Paint()
          ..style = PaintingStyle.fill
          ..color = isActive
              ? const Color(0x3310B981)
              : isDest
                  ? const Color(0x338B5CF6)
                  : const Color(0x153B82F6);
        canvas.drawPath(path, fillPaint);

        final strokePaint = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = isActive ? 2.5 : (isDest ? 2.0 : 1.2)
          ..color = isActive
              ? const Color(0xFF10B981)
              : isDest
                  ? const Color(0xFF8B5CF6)
                  : const Color(0xFF64748B);
        canvas.drawPath(path, strokePaint);

        if (ptCount > 0 && g.name.isNotEmpty) {
          final textPainter = TextPainter(
            text: TextSpan(
              text: g.name,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive || isDest ? FontWeight.bold : FontWeight.w600,
                color: isDest ? const Color(0xFF6D28D9) : const Color(0xFF1E293B),
                backgroundColor: const Color(0xB3FFFFFF),
              ),
            ),
            textDirection: TextDirection.ltr,
          );
          textPainter.layout();
          textPainter.paint(
            canvas,
            Offset((sumX / ptCount) - (textPainter.width / 2),
                (sumY / ptCount) - (textPainter.height / 2)),
          );
        }
      }
    }

    final floorRoute =
        routePath.where((n) => n.floor == floorPlan.floorNumber).toList();
    if (floorRoute.isNotEmpty) {
      final routePaint = Paint()
        ..color = const Color(0xFF2563EB)
        ..strokeWidth = 4.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      final underlayPaint = Paint()
        ..color = const Color(0x443B82F6)
        ..strokeWidth = 9.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      final routePathObj = Path();
      bool started = false;

      // Draw route starting cleanly from the closest forward node to currentPosition, avoiding backtracking lines
      int startIndex = 0;
      if (currentPosition != null && currentPosition!.floor == floorPlan.floorNumber) {
        final userStart = toCanvas(currentPosition!.x, currentPosition!.y);
        double minD = double.infinity;
        for (int i = 0; i < floorRoute.length; i++) {
          final pt = toCanvas(floorRoute[i].x, floorRoute[i].y);
          final d = (pt.dx - userStart.dx) * (pt.dx - userStart.dx) +
              (pt.dy - userStart.dy) * (pt.dy - userStart.dy);
          if (d < minD) {
            minD = d;
            startIndex = i;
          }
        }
        routePathObj.moveTo(userStart.dx, userStart.dy);
        started = true;
      }

      for (int i = startIndex; i < floorRoute.length; i++) {
        final pt = toCanvas(floorRoute[i].x, floorRoute[i].y);
        if (!started) {
          routePathObj.moveTo(pt.dx, pt.dy);
          started = true;
        } else {
          routePathObj.lineTo(pt.dx, pt.dy);
        }
      }
      if (started) {
        canvas.drawPath(routePathObj, underlayPaint);
        canvas.drawPath(routePathObj, routePaint);
      }
    }

    final floorNodes =
        allNodes.where((n) => n.floor == floorPlan.floorNumber).toList();
    for (var node in floorNodes) {
      final pos = toCanvas(node.x, node.y);
      final isVisited = visitedNodeIds.contains(node.id);
      final isDest = destinationNode != null && destinationNode!.id == node.id;
      final isEntrance = node.nodeType.contains('entrance');
      final isExit = node.nodeType.contains('exit');
      final isAmenity = node.nodeType.contains('restroom') ||
          node.nodeType.contains('elevator') ||
          node.nodeType.contains('stairs');

      Color pinColor = const Color(0xFF64748B);
      double radius = 4.5;

      if (isVisited) {
        // Muted/off state for visited/completed artifact nodes
        pinColor = const Color(0xFF94A3B8); // Muted slate gray
        radius = 4.0;
      } else if (isDest) {
        pinColor = const Color(0xFFEC4899);
        radius = 8.0;
      } else if (isEntrance) {
        pinColor = const Color(0xFF10B981);
        radius = 6.5;
      } else if (isExit) {
        pinColor = const Color(0xFFEF4444);
        radius = 6.5;
      } else if (isAmenity) {
        pinColor = const Color(0xFF06B6D4);
        radius = 6.0;
      } else if (node.objectId != null) {
        pinColor = const Color(0xFFF59E0B);
        radius = 5.5;
      }

      canvas.drawCircle(
        pos,
        radius + (isVisited ? 1.0 : 1.5),
        Paint()..color = isVisited ? const Color(0x99FFFFFF) : Colors.white,
      );
      canvas.drawCircle(
        pos,
        radius,
        Paint()..color = pinColor,
      );
    }

    if (currentPosition != null &&
        currentPosition!.floor == floorPlan.floorNumber) {
      final userPos = toCanvas(currentPosition!.x, currentPosition!.y);
      final heading = currentPosition!.heading;

      const double coneLength = 55.0;
      const double fovDegrees = 65.0;
      final startAngleRad = (heading - fovDegrees / 2.0 - 90.0) * (math.pi / 180.0);
      final sweepAngleRad = fovDegrees * (math.pi / 180.0);

      final conePath = Path();
      conePath.moveTo(userPos.dx, userPos.dy);
      conePath.arcTo(
        Rect.fromCircle(center: userPos, radius: coneLength),
        startAngleRad,
        sweepAngleRad,
        false,
      );
      conePath.close();

      final conePaint = Paint()
        ..shader = RadialGradient(
          colors: const [
            Color(0x663B82F6),
            Color(0x1A3B82F6),
            Colors.transparent,
          ],
          stops: const [0.0, 0.75, 1.0],
        ).createShader(Rect.fromCircle(center: userPos, radius: coneLength));
      canvas.drawPath(conePath, conePaint);

      // Multi-layer high-visibility Blue Dot Navigator
      canvas.drawCircle(
        userPos,
        22.0,
        Paint()..color = const Color(0x263B82F6),
      );

      canvas.drawCircle(
        userPos,
        14.0,
        Paint()..color = const Color(0x402563EB),
      );

      canvas.drawCircle(
        userPos,
        8.5,
        Paint()
          ..color = Colors.white
          ..style = PaintingStyle.fill,
      );

      canvas.drawCircle(
        userPos,
        6.5,
        Paint()
          ..color = const Color(0xFF1D4ED8)
          ..style = PaintingStyle.fill,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _FloorPlanPainter oldDelegate) {
    return oldDelegate.currentPosition != currentPosition ||
        oldDelegate.routePath != routePath ||
        oldDelegate.currentRoomId != currentRoomId ||
        oldDelegate.destinationNode != destinationNode ||
        oldDelegate.floorPlan != floorPlan ||
        oldDelegate.visitedNodeIds != visitedNodeIds;
  }
}
