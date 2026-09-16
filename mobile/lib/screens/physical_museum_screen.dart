import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:provider/provider.dart';

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

import '../utils/wall_crossing_validator.dart';

import 'package:cached_network_image/cached_network_image.dart';

import '../config/api.dart';
import '../models/models.dart';
import '../models/museum_provider.dart';
import '../models/navigation_models.dart';
import '../services/offline_store.dart';
import 'museum_selection_screen.dart';
import 'explore_more_screen.dart';
import '../services/indoor_positioning.dart';
import '../services/location_service.dart';
import '../services/deep_link_service.dart';
import '../services/pathfinding.dart';
import '../utils/navigation_math.dart';
import '../widgets/qr_scanner_modal.dart';
import '../widgets/indoor_map_widget.dart';
import '../widgets/object_detail_sheet.dart';
import '../widgets/turn_by_turn_steps_modal.dart';
import '../widgets/start_node_picker_modal.dart';
import '../widgets/floor_plan_picker_modal.dart';
import '../widgets/navigation_route_panel.dart';
import '../widgets/nearby_attractions_panel.dart';
import '../widgets/compass_dial_widget.dart';

class PhysicalMuseumScreen extends StatefulWidget {
  final String? initialEntranceNodeId;
  static const double deviationThresholdMeters = 4.5;
  static const int deviationDebounceMs = 1500;

  const PhysicalMuseumScreen({super.key, this.initialEntranceNodeId});

  @override
  State<PhysicalMuseumScreen> createState() => _PhysicalMuseumScreenState();
}

class _PhysicalMuseumScreenState extends State<PhysicalMuseumScreen> {
  bool isOnline = true;
  bool isAtMuseum = true;
  String? locationError;
  List<Museum> museums = [];
  List<Gallery> galleries = [];
  List<MuseumObject> objects = [];

  List<MapNode> allNodes = [];
  List<MapEdge> allEdges = [];
  List<FloorPlan> allFloorPlans = [];

  Museum? selectedMuseum;
  Gallery? selectedGallery;
  bool isRoomMapMode = false;
  bool isRoomCompleted = false;
  MapNode? roomDoorwayNode;
  bool isLoaded = false;
  String? scanResult;
  Timer? scanResultTimer;

  final OfflineStore offlineStore = OfflineStore();
  late StreamSubscription<List<ConnectivityResult>> connectivitySubscription;

  // New Services
  late IndoorPositionService positionService;
  late LocationService locationService;
  PathfindingService? pathfindingService;
  PositionState? currentPosition;
  RouteResult? currentRoute;
  MapNode? destinationNode;

  List<String> tourStops = [];
  bool isTourActive = false;
  bool isNavigationActive = false;
  double _compassHeading = 0.0;
  StreamSubscription<double>? _headingSubscription;
  bool isFullscreen = false;

  List<String>? suspendedTourStops;
  bool isTourSuspended = false;
  MapNode? selectiveTargetNode;

  void _startSelectiveNavigation(MapNode target) {
    locationService.forceIndoorMode();
    positionService.startPdr();
    setState(() {
      isNavigationActive = true;
    });
    if (isTourActive) {
      suspendedTourStops = List.from(tourStops);
      isTourSuspended = true;
      isTourActive = false;
    }
    selectiveTargetNode = target;

    // If target is on a different floor plan, switch to that floor plan
    if (currentFloorPlan != null && target.floor != currentFloorPlan!.floorNumber) {
      try {
        final targetFp = allFloorPlans.firstWhere(
          (fp) => fp.floorNumber == target.floor,
        );
        setState(() {
          currentFloorPlan = targetFp;
        });
        context.read<MuseumProvider>().setSelectedFloor(targetFp.id);
        _updatePositionServiceContext();
      } catch (_) {}
    }

    _calculateRoute(target);
  }

  void _resumeTour() {
    if (suspendedTourStops != null && suspendedTourStops!.isNotEmpty) {
      setState(() {
        tourStops = List.from(suspendedTourStops!);
        suspendedTourStops = null;
        isTourSuspended = false;
        selectiveTargetNode = null;
        isTourActive = true;
      });
      _routeToNextTourStop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tour resumed'),
          duration: Duration(seconds: 2),
        ),
      );
    } else {
      setState(() {
        isTourSuspended = false;
        selectiveTargetNode = null;
      });
      _startFullTour();
    }
  }

  int? _offRouteStartTime;
  bool isOffRoute = false;
  bool isRecalculating = false;
  final Set<String> visitedNodeIds = {};

  String searchQuery = '';
  bool showOptionsMenu = false;
  MapLibreMapController? mapController;

  int? currentRoomId;
  int? _pendingRoomId;
  int _roomDwellStartTime = 0;

  List<MuseumObject> get filteredObjects {
    if (searchQuery.trim().isEmpty) return [];
    final q = searchQuery.toLowerCase().trim();
    return objects.where((obj) {
      final nameMatch = obj.name.toLowerCase().contains(q);
      final catMatch = (obj.category ?? '').toLowerCase().contains(q);
      final periodMatch = (obj.period ?? '').toLowerCase().contains(q);
      return nameMatch || catMatch || periodMatch;
    }).toList();
  }

  void _recenterMap() {
    if (mapController != null &&
        currentPosition?.latitude != null &&
        currentPosition?.longitude != null) {
      mapController!.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: LatLng(
              currentPosition!.latitude!,
              currentPosition!.longitude!,
            ),
            zoom: 21,
          ),
        ),
      );
    } else if (mapController != null && allNodes.isNotEmpty) {
      final node = allNodes.firstWhere(
        (n) => n.latitude != null && n.longitude != null,
        orElse: () => allNodes.first,
      );
      if (node.latitude != null && node.longitude != null) {
        mapController!.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: LatLng(node.latitude!, node.longitude!),
              zoom: 20,
            ),
          ),
        );
      }
    }
  }

  void _startNavigationToObject(MuseumObject obj) {
    MapNode? targetNode;
    try {
      targetNode = allNodes.firstWhere((n) => n.objectId == obj.id);
    } catch (_) {
      try {
        targetNode = allNodes.firstWhere(
          (n) => n.name.toLowerCase().trim() == obj.name.toLowerCase().trim(),
        );
      } catch (_) {}
    }

    if (targetNode != null) {
      if (currentPosition?.currentNodeId == null && allNodes.isNotEmpty) {
        try {
          final entranceNode = allNodes.firstWhere((n) => _isEntrance(n));
          positionService.scanQR(entranceNode);
        } catch (_) {
          positionService.scanQR(allNodes.first);
        }
      }
      setState(() {
        searchQuery = '';
      });
      _startSelectiveNavigation(targetNode);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'No spatial map node assigned to artifact "${obj.name}".',
          ),
        ),
      );
    }
  }

  void _toggleFullscreen() {
    setState(() {
      isFullscreen = !isFullscreen;
    });
    if (isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setEnabledSystemUIMode(
        SystemUiMode.manual,
        overlays: SystemUiOverlay.values,
      );
    }
  }

  @override
  void initState() {
    super.initState();
    positionService = IndoorPositionService();
    positionService.requestPermissions();
    _headingSubscription = positionService.headingStream.listen((heading) {
      if (mounted) {
        setState(() {
          _compassHeading = heading;
        });
      }
    });
    positionService.positionStream.listen((pos) {
      if (mounted) {
        // Auto-switch floor plan if floor changed
        if (pos.floorChanged && currentFloorPlan?.floorNumber != pos.floor) {
          try {
            currentFloorPlan = allFloorPlans.firstWhere(
              (fp) => fp.floorNumber == pos.floor,
            );
            _updatePositionServiceContext();
          } catch (_) {
            // Floor plan not found, keep current one
          }
        }

        setState(() {
          currentPosition = pos;
          _compassHeading = pos.heading;

          _updateNearbyAndProximity();
          _checkArtifactAutoPopup(pos);
          if (isNavigationActive && currentRoute != null) {
            _advanceRouteProgress(pos);
            _checkRouteArrival();
            _checkRouteDeviation(pos);
          }
          _checkRoomScope(pos);
        });
      }
    });

    _checkConnectivity();
    connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      results,
    ) {
      if (mounted) {
        setState(() {
          isOnline = !results.contains(ConnectivityResult.none);
        });
      }
    });

    locationService = LocationService();
    locationService.onGpsPositionUpdate = (lat, lng) {
      if (mounted) {
        // Only override position with raw outdoor GPS if we are not actively navigating on an indoor floor plan
        if (currentFloorPlan == null ||
            currentPosition?.source == 'gps' ||
            currentPosition?.currentNodeId == null) {
          positionService.setGpsPosition(lat, lng);
        }
      }
    };
    locationService.onEnterMuseum = () {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Entered museum: tap "Start Navigation" to begin tour.',
            ),
            duration: Duration(seconds: 2),
          ),
        );
      }
    };
    locationService.startTracking();

    _checkGPSBounds();
    _loadData();
    _autoPopupCheckTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && isNavigationActive && currentPosition != null) {
        _checkArtifactAutoPopup(currentPosition!);
      }
    });
  }

  Future<void> _checkGPSBounds() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => locationError = 'Location permissions denied');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(
          () => locationError = 'Location permissions are permanently denied',
        );
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      double lat = position.latitude;
      double lng = position.longitude;

      double? museumLat = selectedMuseum?.latitude;
      double? museumLng = selectedMuseum?.longitude;

      if (museumLat == null && allNodes.isNotEmpty) {
        for (var n in allNodes) {
          if (n.latitude != null && n.longitude != null) {
            museumLat = n.latitude;
            museumLng = n.longitude;
            break;
          }
        }
      }

      if (museumLat != null && museumLng != null) {
        final dist = NavigationMath.distanceBetween(
          lat,
          lng,
          museumLat,
          museumLng,
        );
        if (dist <= 1000) {
          setState(() => isAtMuseum = true);
        } else {
          setState(() {
            isAtMuseum = false;
            locationError =
                'You appear to be ${(dist / 1000).toStringAsFixed(1)} km from the museum.';
          });
        }
      } else if (lat >= 13.060 &&
          lat <= 13.080 &&
          lng >= 80.240 &&
          lng <= 80.260) {
        setState(() => isAtMuseum = true);
      } else {
        setState(() => isAtMuseum = true);
      }
    } catch (e) {
      debugPrint("GPS Check Error: $e");
    }
  }

  Future<void> _checkConnectivity() async {
    final results = await Connectivity().checkConnectivity();
    if (mounted) {
      setState(() {
        isOnline = !results.contains(ConnectivityResult.none);
      });
    }
  }

  @override
  void dispose() {
    _headingSubscription?.cancel();
    _autoPopupCheckTimer?.cancel();
    connectivitySubscription.cancel();
    scanResultTimer?.cancel();
    locationService.dispose();
    positionService.dispose();
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    super.dispose();
  }

  Future<void> _loadData() async {
    // 1. If online, verify with server whether museums exist or were deleted
    if (isOnline) {
      try {
        final res = await http
            .get(Uri.parse('${ApiConfig.baseUrl}/museums?per_page=50'))
            .timeout(const Duration(seconds: 6));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          final serverList = (decoded['data'] as List?) ?? [];
          if (serverList.isEmpty) {
            // Admin deleted all museums: Clear local offline storage
            await offlineStore.clearMuseumData();
            if (mounted) {
              setState(() {
                museums = [];
                galleries = [];
                objects = [];
                allNodes = [];
                allEdges = [];
                allFloorPlans = [];
                currentFloorPlan = null;
                selectedMuseum = null;
                currentRoute = null;
                destinationNode = null;
                isTourActive = false;
                isLoaded = true;
              });
            }
            return;
          }
        }
      } catch (e) {
        debugPrint('Online check failed: $e');
      }
    }

    final m = await offlineStore.getMuseums();
    final g = await offlineStore.getGalleries();
    final o = await offlineStore.getObjects();
    final n = await offlineStore.getNodes();
    final e = await offlineStore.getEdges();
    final f = await offlineStore.getFloorPlans();

    if (m.isNotEmpty && n.isNotEmpty) {
      if (!mounted) return;
      final provider = context.read<MuseumProvider>();
      FloorPlan? selectedPlan;
      if (provider.selectedFloorPlanId != null && f.isNotEmpty) {
        try {
          selectedPlan = f.firstWhere(
            (p) => p.id == provider.selectedFloorPlanId,
          );
        } catch (_) {}
      }
      selectedPlan ??= f.isNotEmpty ? f.first : null;

      Museum? selMus;
      if (provider.selectedMuseumId != null && m.isNotEmpty) {
        try {
          selMus = m.firstWhere((mus) => mus.id == provider.selectedMuseumId);
        } catch (_) {}
      }
      selMus ??= m.isNotEmpty ? m.first : null;

      setState(() {
        museums = m;
        galleries = g;
        objects = o;
        allNodes = n;
        allEdges = e;
        allFloorPlans = f;
        currentFloorPlan = selectedPlan;
        selectedMuseum = selMus;

        pathfindingService = PathfindingService(
          nodes: allNodes,
          edges: allEdges,
          floorPlans: allFloorPlans,
        );
        isLoaded = true;
      });

      _updatePositionServiceContext();
      final entrances = allNodes.where(_isEntrance).toList();
      locationService.setEntranceNodes(entrances);

      if (widget.initialEntranceNodeId != null && allNodes.isNotEmpty) {
        try {
          final entranceNode = allNodes.firstWhere(
            (n) => n.id == widget.initialEntranceNodeId,
          );
          positionService.updatePosition(
            PositionState(
              x: entranceNode.x,
              y: entranceNode.y,
              floor: entranceNode.floor,
              heading: positionService.currentHeading,
              accuracy: 1.0,
              source: 'qr',
              timestamp: DateTime.now().millisecondsSinceEpoch,
              currentNodeId: entranceNode.id,
              latitude: entranceNode.latitude,
              longitude: entranceNode.longitude,
            ),
          );
          positionService.stopPdr();
          locationService.forceIndoorMode();
        } catch (_) {}
      } else if (entrances.isNotEmpty &&
          currentPosition?.currentNodeId == null) {
        final activeFloorNum = currentFloorPlan?.floorNumber;
        final matchingEntrance = entrances.firstWhere(
          (n) => activeFloorNum == null || n.floor == activeFloorNum,
          orElse: () => entrances.first,
        );
        positionService.updatePosition(
          PositionState(
            x: matchingEntrance.x,
            y: matchingEntrance.y,
            floor: matchingEntrance.floor,
            heading: positionService.currentHeading,
            accuracy: 1.0,
            source: 'qr',
            timestamp: DateTime.now().millisecondsSinceEpoch,
            currentNodeId: matchingEntrance.id,
            latitude: matchingEntrance.latitude,
            longitude: matchingEntrance.longitude,
          ),
        );
        positionService.stopPdr();
        locationService.forceIndoorMode();
      }
    }

    // Always fetch fresh museum data, floor plans, and nodes if online
    if (isOnline) {
      if (!mounted) return;
      final provider = context.read<MuseumProvider>();
      final targetMusId = provider.selectedMuseumId ?? (selectedMuseum?.id ?? 1);
      try {
        final data = await offlineStore.syncMuseum(
          targetMusId,
          (p, m) => debugPrint('$p%: $m'),
        );
        if (mounted) {
          _handleSyncComplete(data);
        }
      } catch (e) {
        debugPrint('Error syncing museum data: $e');
        try {
          final data = await offlineStore.syncAll(
            (p, m) => debugPrint('$p%: $m'),
          );
          if (mounted) {
            _handleSyncComplete(data);
          }
        } catch (_) {}
      }
    }

    if (mounted && !isLoaded) {
      setState(() {
        isLoaded = true;
      });
    }
  }

  void _handleSyncComplete(Map<String, dynamic> data) {
    if (!mounted) return;
    final provider = context.read<MuseumProvider>();
    final f = (data['floor_plans'] as List<FloorPlan>?) ?? [];
    final m = (data['museums'] as List<Museum>?) ?? [];

    FloorPlan? selectedPlan;
    if (provider.selectedFloorPlanId != null && f.isNotEmpty) {
      try {
        selectedPlan = f.firstWhere(
          (p) => p.id == provider.selectedFloorPlanId,
        );
      } catch (_) {}
    }
    selectedPlan ??= f.isNotEmpty ? f.first : null;

    Museum? selMus;
    if (provider.selectedMuseumId != null && m.isNotEmpty) {
      try {
        selMus = m.firstWhere((mus) => mus.id == provider.selectedMuseumId);
      } catch (_) {}
    }
    selMus ??= m.isNotEmpty ? m.first : null;

    if (selectedPlan != null) {
      provider.setSelectedFloor(selectedPlan.id);
      final url = ApiConfig.getFloorPlanImageUrl(selectedPlan.imageUrl);
      if (url.isNotEmpty) {
        try {
          CachedNetworkImage.evictFromCache(url);
        } catch (_) {}
      }
    }

    setState(() {
      museums = m;
      galleries = (data['galleries'] as List<Gallery>?) ?? [];
      objects = (data['objects'] as List<MuseumObject>?) ?? [];
      allNodes = (data['nodes'] as List<MapNode>?) ?? [];
      allEdges = (data['edges'] as List<MapEdge>?) ?? [];
      allFloorPlans = f;
      currentFloorPlan = selectedPlan;
      selectedMuseum = selMus;
      isLoaded = true;

      pathfindingService = PathfindingService(
        nodes: allNodes,
        edges: allEdges,
        floorPlans: allFloorPlans,
      );
    });

    _updatePositionServiceContext();
    final entrances = allNodes.where(_isEntrance).toList();
    locationService.setEntranceNodes(entrances);

    if (widget.initialEntranceNodeId != null && allNodes.isNotEmpty) {
      try {
        final entranceNode = allNodes.firstWhere(
          (n) => n.id == widget.initialEntranceNodeId,
        );
        positionService.updatePosition(
          PositionState(
            x: entranceNode.x,
            y: entranceNode.y,
            floor: entranceNode.floor,
            heading: positionService.currentHeading,
            accuracy: 1.0,
            source: 'qr',
            timestamp: DateTime.now().millisecondsSinceEpoch,
            currentNodeId: entranceNode.id,
            latitude: entranceNode.latitude,
            longitude: entranceNode.longitude,
          ),
        );
        positionService.stopPdr();
        locationService.forceIndoorMode();
      } catch (_) {}
    } else if (entrances.isNotEmpty && currentPosition?.currentNodeId == null) {
      final activeFloorNum = currentFloorPlan?.floorNumber;
      final matchingEntrance = entrances.firstWhere(
        (n) => activeFloorNum == null || n.floor == activeFloorNum,
        orElse: () => entrances.first,
      );
      positionService.updatePosition(
        PositionState(
          x: matchingEntrance.x,
          y: matchingEntrance.y,
          floor: matchingEntrance.floor,
          heading: positionService.currentHeading,
          accuracy: 1.0,
          source: 'qr',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          currentNodeId: matchingEntrance.id,
          latitude: matchingEntrance.latitude,
          longitude: matchingEntrance.longitude,
        ),
      );
      positionService.stopPdr();
      locationService.forceIndoorMode();
    }
  }

  Future<void> _refreshAndSync() async {
    if (!isOnline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot sync: device is offline')),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Syncing latest floor plan & map data...'),
        duration: Duration(seconds: 1),
      ),
    );
    final provider = context.read<MuseumProvider>();
    final targetMusId = provider.selectedMuseumId ?? (selectedMuseum?.id ?? 1);
    try {
      final data = await offlineStore.syncMuseum(
        targetMusId,
        (p, m) => debugPrint('$p%: $m'),
      );
      if (mounted) {
        _handleSyncComplete(data);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Floor plan and map updated successfully!'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sync failed: $e')),
        );
      }
    }
  }

  void _checkRoomScope(PositionState pos) {
    int? newRoomId;
    final activeFloorNum = pos.floor;

    // Only test rooms belonging strictly to this position's floor
    final floorGalleries = galleries.where((g) {
      if (g.floor != null && g.floor!.isNotEmpty) {
        final parsed = int.tryParse(g.floor!);
        if (parsed != null) return parsed == activeFloorNum;
        final clean = g.floor!.replaceAll(RegExp(r'[^0-9]'), '');
        if (clean.isNotEmpty) return int.tryParse(clean) == activeFloorNum;
        if (g.floor!.toLowerCase().contains('ground') && activeFloorNum == 1) return true;
      }
      return false;
    }).toList();

    for (var g in floorGalleries) {
      if (g.boundaryPolygon != null && g.boundaryPolygon!.length >= 3) {
        bool inside = NavigationMath.isPointInNormalizedPolygon(
          pos.x,
          pos.y,
          g.boundaryPolygon!,
        );

        if (!inside && pos.latitude != null && pos.longitude != null) {
          inside = NavigationMath.isPointInPolygon(
            pos.latitude!,
            pos.longitude!,
            g.boundaryPolygon!,
          );
        }

        if (inside) {
          newRoomId = g.id;
          break;
        }
      }
    }

    if (newRoomId != _pendingRoomId) {
      _pendingRoomId = newRoomId;
      _roomDwellStartTime = DateTime.now().millisecondsSinceEpoch;
    } else if (newRoomId != currentRoomId) {
      if (DateTime.now().millisecondsSinceEpoch - _roomDwellStartTime > 1500) {
        currentRoomId = newRoomId;
        if (currentRoomId != null) {
          try {
            selectedGallery = galleries.firstWhere(
              (g) => g.id == currentRoomId,
            );
          } catch (_) {
            selectedGallery = null;
          }
        } else {
          selectedGallery = null;
        }
        positionService.currentRoomId = _effectiveRoomId?.toString();
      }
    }

    // Room Completion & Exit Guidance
    if (isRoomMapMode && roomDoorwayNode != null) {
      // Find exhibits belonging to the active room
      final roomPrefix = selectedGallery?.name.toLowerCase().split(' ').first ?? '';
      final roomExhibits = allNodes.where((n) =>
        _isExhibit(n) &&
        (n.floor == (currentFloorPlan?.floorNumber ?? 0)) &&
        (roomPrefix.isNotEmpty && n.name.toLowerCase().contains(roomPrefix))
      ).toList();

      if (roomExhibits.isNotEmpty && roomExhibits.every((n) => visitedNodeIds.contains(n.id))) {
        if (!isRoomCompleted) {
          isRoomCompleted = true;
          // Calculate path to room exit doorway
          _calculateRoute(roomDoorwayNode!);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: Color(0xFF2C5E43),
              content: Text('🎉 Gallery complete! Follow the green route to the exit.'),
              duration: Duration(seconds: 4),
            ),
          );
        }
      }

      // Check if visitor has exited the room (reached doorway or outside polygon)
      if (isRoomCompleted) {
        final double distToDoor = ((pos.x - roomDoorwayNode!.x).abs() + (pos.y - roomDoorwayNode!.y).abs());
        if (distToDoor < 0.08 || (newRoomId == null && pos.x > 0)) {
          // Revert to Whole Museum Map!
          setState(() {
            isRoomMapMode = false;
            selectedGallery = null;
            isRoomCompleted = false;
            roomDoorwayNode = null;
            currentRoute = null;
            destinationNode = null;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: Color(0xFF17211F),
              content: Text('🚪 Exited Gallery. Returned to Whole Museum Map!'),
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    }
  }

  List<MapNode> _nearbyNodes = [];
  final int _lastAutoTriggerTime = 0;
  MuseumObject? _proximityPromptObject;
  MapNode? _proximityPromptNode;
  static const double proximityTriggerRadius = 2.8; // 2.8m proximity radius
  static const double autoPopupProximityRadius = 2.8; // 2.8m auto-popup threshold for artifacts
  int _currentRouteStepIndex = 0;

  bool _isObjectDetailSheetOpen = false;
  String? _currentOpenNodeId;
  int? _currentOpenObjectId;
  String? _lastAutoPoppedNodeId;
  int? _lastAutoPoppedObjectId;
  Timer? _autoPopupCheckTimer;

  double _distanceToNode(PositionState pos, MapNode node) {
    double? geoDist;
    if (pos.latitude != null &&
        pos.longitude != null &&
        node.latitude != null &&
        node.longitude != null) {
      geoDist = NavigationMath.distanceBetween(
        pos.latitude!,
        pos.longitude!,
        node.latitude!,
        node.longitude!,
      );
    }

    final fp = currentFloorPlan;
    final double w = (fp != null && fp.widthPx > 0) ? fp.widthPx : 600.0;
    final double h = (fp != null && fp.heightPx > 0) ? fp.heightPx : 400.0;
    final double scale = (fp != null && fp.scaleMetersPerPx > 0)
        ? fp.scaleMetersPerPx
        : 0.04;

    double pX = pos.x <= 1.0 ? pos.x * w : pos.x;
    double pY = pos.y <= 1.0 ? pos.y * h : pos.y;
    double nX = node.x <= 1.0 ? node.x * w : node.x;
    double nY = node.y <= 1.0 ? node.y * h : node.y;

    final dx = pX - nX;
    final dy = pY - nY;
    final xyDist = math.sqrt(dx * dx + dy * dy) * scale;

    final hasXy = (pos.x != 0 || pos.y != 0) && (node.x != 0 || node.y != 0);
    if (hasXy) {
      return xyDist;
    } else if (geoDist != null) {
      return geoDist;
    }
    return xyDist;
  }

  void _updatePositionServiceContext() {
    final activeFloorNum = currentFloorPlan?.floorNumber ?? 1;
    final floorGalleries = galleries.where((g) {
      if (g.floor != null && g.floor!.isNotEmpty) {
        final parsed = int.tryParse(g.floor!);
        if (parsed != null) return parsed == activeFloorNum;
        final clean = g.floor!.replaceAll(RegExp(r'[^0-9]'), '');
        if (clean.isNotEmpty) return int.tryParse(clean) == activeFloorNum;
        if (g.floor!.toLowerCase().contains('ground') && activeFloorNum == 1) return true;
      }
      return false;
    }).toList();

    final boundaries = floorGalleries.map((g) {
      final poly = (g.boundaryPolygon ?? []).map((pt) {
        double px = (pt['x'] ?? pt['lng'] ?? 0.0).toDouble();
        double py = (pt['y'] ?? pt['lat'] ?? 0.0).toDouble();
        return math.Point<double>(px, py);
      }).toList();
      return RoomBoundary(
        id: g.id.toString(),
        name: g.name,
        floor: activeFloorNum,
        walkable: true,
        polygon: poly,
      );
    }).toList();

    positionService.updateContext(
      currentFloorPlan,
      allNodes,
      allEdges,
      roomId: _effectiveRoomId?.toString(),
      roomBoundaries: boundaries,
    );
  }

  void _updateNearbyAndProximity() {
    if (currentPosition == null) return;
    final pos = currentPosition!;

    // 1. Calculate Nearby for active floor: sort all non-junction/waypoint nodes by distance
    final floorNodes = allNodes.where((n) {
      if (n.floor != pos.floor) return false;
      if (n.nodeType == 'junction' || n.nodeType == 'waypoint') return false;
      return true;
    }).toList();

    floorNodes.sort(
      (a, b) => _distanceToNode(pos, a).compareTo(_distanceToNode(pos, b)),
    );
    _nearbyNodes = floorNodes.take(10).toList();

    // Snap currentNodeId to closest floor node if within 6 meters
    if (floorNodes.isNotEmpty) {
      final closestDist = _distanceToNode(pos, floorNodes.first);
      if (closestDist <= 6.0 && currentPosition!.currentNodeId != floorNodes.first.id) {
        currentPosition = currentPosition!.copyWith(currentNodeId: floorNodes.first.id);
      }
    }

    // 2. Proximity Trigger Prompt (for artifacts/exhibits)
    MapNode? promptNode;
    MuseumObject? promptObj;

    for (final node in _nearbyNodes) {
      if ((node.nodeType == 'exhibit' || node.nodeType == 'artifact') &&
          node.objectId != null) {
        final d = _distanceToNode(pos, node);
        if (d <= proximityTriggerRadius) {
          try {
            promptObj = objects.firstWhere((o) => o.id == node.objectId);
            promptNode = node;
            break;
          } catch (_) {}
        }
      }
    }

    if (promptObj != null && promptNode != null) {
      if (_proximityPromptNode?.id != promptNode.id) {
        setState(() {
          _proximityPromptObject = promptObj;
          _proximityPromptNode = promptNode;
        });
      }
    } else if (_proximityPromptNode != null) {
      final distToLast = _distanceToNode(pos, _proximityPromptNode!);
      if (distToLast > 3.5) {
        setState(() {
          _proximityPromptObject = null;
          _proximityPromptNode = null;
        });
      }
    }
  }

  void _checkArtifactAutoPopup(PositionState pos) {
    if (!mounted || !isLoaded || objects.isEmpty || allNodes.isEmpty) return;

    // Filter exhibit/artifact nodes on the visitor's current floor
    final candidateNodes = allNodes.where((n) {
      if (n.floor != pos.floor) return false;
      if (!_isExhibit(n) || n.objectId == null) return false;
      return true;
    }).toList();

    if (candidateNodes.isEmpty) return;

    // Find closest exhibit/artifact node within autoPopupProximityRadius
    MapNode? closestNode;
    MuseumObject? closestObj;
    double minDistance = double.infinity;

    for (final node in candidateNodes) {
      final dist = _distanceToNode(pos, node);
      if (dist <= autoPopupProximityRadius && dist < minDistance) {
        try {
          final obj = objects.firstWhere((o) => o.id == node.objectId);
          closestNode = node;
          closestObj = obj;
          minDistance = dist;
        } catch (_) {}
      }
    }

    if (closestNode != null && closestObj != null) {
      // If modal bottom sheet is already open for this exact artifact, do nothing
      if (_isObjectDetailSheetOpen && _currentOpenObjectId == closestObj.id) {
        return;
      }

      // If user closed this exact artifact's popup recently and hasn't walked away, avoid re-opening repeatedly
      if (_lastAutoPoppedObjectId == closestObj.id) {
        return;
      }

      // Dismiss any existing bottom sheet to show newly approached artifact
      if (_isObjectDetailSheetOpen && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }

      // Mark as visited in history & update auto-pop tracking
      visitedNodeIds.add(closestNode.id);
      _lastAutoPoppedNodeId = closestNode.id;
      _lastAutoPoppedObjectId = closestObj.id;

      // Advance tour stop if active tour stop matches
      if (isTourActive &&
          tourStops.isNotEmpty &&
          closestNode.id == tourStops.first) {
        tourStops.removeAt(0);
      }

      // If this was the destination node, trigger arrival
      if (destinationNode?.id == closestNode.id) {
        scanResult = 'arrived';
        if (isTourActive && tourStops.isNotEmpty) {
          _routeToNextTourStop();
        } else {
          currentRoute = null;
          destinationNode = null;
        }
      }

      // Always pop up the artifact details directly!
      _showObjectDetail(closestObj);
    } else {
      // If visitor moved away (> 3.5m) from last auto-popped node, reset cooldown
      if (_lastAutoPoppedNodeId != null) {
        try {
          final lastNode = allNodes.firstWhere(
            (n) => n.id == _lastAutoPoppedNodeId,
          );
          final distToLast = _distanceToNode(pos, lastNode);
          if (distToLast > 3.5) {
            _lastAutoPoppedNodeId = null;
            _lastAutoPoppedObjectId = null;
          }
        } catch (_) {
          _lastAutoPoppedNodeId = null;
          _lastAutoPoppedObjectId = null;
        }
      }
    }
  }

  void _advanceRouteProgress(PositionState pos) {
    if (currentRoute == null || currentRoute!.path.length < 2) return;
    final path = currentRoute!.path;
    int closestIdx = _currentRouteStepIndex;
    double minDist = double.infinity;

    for (int i = _currentRouteStepIndex; i < path.length; i++) {
      final d = _distanceToNode(pos, path[i]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    if (closestIdx > _currentRouteStepIndex && minDist <= 3.5) {
      setState(() {
        _currentRouteStepIndex = closestIdx;
      });
    }
  }

  static const double deviationThresholdMeters = 4.5;
  static const int deviationDebounceMs = 1500;

  void _checkRouteDeviation(PositionState pos) {
    if (currentRoute == null || currentRoute!.path.isEmpty || isRecalculating) {
      return;
    }

    double distToPolyline = double.infinity;
    if (pos.latitude != null && pos.longitude != null) {
      distToPolyline = NavigationMath.distanceToPolyline(
        pos.latitude!,
        pos.longitude!,
        currentRoute!.path,
      );
    } else if (currentFloorPlan != null) {
      final fp = currentFloorPlan!;
      final double w = fp.widthPx > 0 ? fp.widthPx : 600.0;
      final double h = fp.heightPx > 0 ? fp.heightPx : 400.0;
      final double scale = fp.scaleMetersPerPx > 0 ? fp.scaleMetersPerPx : 0.04;
      double px = (pos.x <= 1.0) ? pos.x * w : pos.x;
      double py = (pos.y <= 1.0) ? pos.y * h : pos.y;

      final floorNodes = currentRoute!.path
          .where((n) => n.floor == pos.floor)
          .toList();
      if (floorNodes.length >= 2) {
        for (int i = 0; i < floorNodes.length - 1; i++) {
          final u = floorNodes[i];
          final v = floorNodes[i + 1];
          double ux = (u.x <= 1.0) ? u.x * w : u.x;
          double uy = (u.y <= 1.0) ? u.y * h : u.y;
          double vx = (v.x <= 1.0) ? v.x * w : v.x;
          double vy = (v.y <= 1.0) ? v.y * h : v.y;
          double dSeg =
              WallCrossingValidator.distancePointToSegment(
                px,
                py,
                ux,
                uy,
                vx,
                vy,
              ) *
              scale;
          if (dSeg < distToPolyline) distToPolyline = dSeg;
        }
      }
    }

    if (distToPolyline > deviationThresholdMeters) {
      final now = DateTime.now().millisecondsSinceEpoch;
      if (_offRouteStartTime == null) {
        _offRouteStartTime = now;
        if (!isOffRoute) {
          setState(() => isOffRoute = true);
        }
      } else if (now - _offRouteStartTime! > deviationDebounceMs) {
        // Debounce confirmed: recalculate directly from current fused position
        _recalculateRouteFromCurrentLocation(
          reason: 'Visitor off-route (>4.5m)',
        );
      }
    } else {
      _offRouteStartTime = null;
      if (isOffRoute) {
        setState(() => isOffRoute = false);
      }
    }
  }

  void _recalculateRouteFromCurrentLocation({
    String? reason,
    MapNode? targetNodeOverride,
  }) {
    if (isRecalculating || pathfindingService == null) return;

    isRecalculating = true;
    _offRouteStartTime = null;

    // Immediately compute new route without arbitrary blanking timer
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      String? startId;
      if (currentPosition != null) {
        final floorNodes = allNodes
            .where((n) => n.floor == currentPosition!.floor)
            .toList();

        if (floorNodes.isNotEmpty) {
          final dest = targetNodeOverride ?? destinationNode;
          MapNode? bestCandidate;
          double bestTotalDist = double.infinity;

          // Rank candidates by proximity to current live position
          final sortedCandidates = List<MapNode>.from(floorNodes);
          sortedCandidates.sort((a, b) =>
              _distanceToNode(currentPosition!, a)
                  .compareTo(_distanceToNode(currentPosition!, b)));

          // Evaluate the closest candidates to choose the optimal forward node toward destination
          final nearbyCandidates = sortedCandidates.take(5).toList();
          if (dest != null && nearbyCandidates.length > 1) {
            for (final candidate in nearbyCandidates) {
              final dUserToCand = _distanceToNode(currentPosition!, candidate);
              final route = pathfindingService!.findShortestPath(candidate.id, dest.id);
              if (route != null) {
                final total = dUserToCand + route.distance;
                if (total < bestTotalDist) {
                  bestTotalDist = total;
                  bestCandidate = candidate;
                }
              }
            }
          }

          bestCandidate ??= sortedCandidates.first;
          startId = bestCandidate.id;

          // Update currentPosition so it is in sync with the forward recalculation
          currentPosition = currentPosition!.copyWith(
            currentNodeId: bestCandidate.id,
          );
        }
      }

      if (startId == null && allNodes.isNotEmpty) {
        try {
          startId = allNodes.firstWhere((n) => _isEntrance(n)).id;
        } catch (_) {
          startId = allNodes.first.id;
        }
      }

      if (startId == null) {
        setState(() => isRecalculating = false);
        return;
      }

      if (isTourActive && tourStops.isNotEmpty) {
        tourStops.removeWhere(
          (stopId) =>
              visitedNodeIds.contains(stopId) && stopId != tourStops.last,
        );

        if (targetNodeOverride != null) {
          tourStops.remove(targetNodeOverride.id);
          tourStops.insert(0, targetNodeOverride.id);
        }

        if (tourStops.isEmpty) {
          setState(() {
            isTourActive = false;
            currentRoute = null;
            destinationNode = null;
            isRecalculating = false;
            isOffRoute = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Tour complete! All planned stops visited.'),
            ),
          );
          return;
        }

        final remainingArtifacts = tourStops
            .where((id) => id != tourStops.last)
            .toList();
        final exitId = tourStops.last;

        RouteResult? newTourRoute;
        if (remainingArtifacts.isNotEmpty) {
          newTourRoute = pathfindingService!.planFullTour(
            startId,
            exitId,
            remainingArtifacts,
          );
        } else {
          newTourRoute = pathfindingService!.findShortestPath(startId, exitId);
        }

        if (newTourRoute != null && newTourRoute.path.isNotEmpty) {
          final newStops = <String>[];
          for (var node in newTourRoute.path) {
            if (remainingArtifacts.contains(node.id) &&
                !newStops.contains(node.id)) {
              newStops.add(node.id);
            }
          }
          newStops.add(exitId);

          setState(() {
            currentRoute = newTourRoute;
            tourStops = newStops;
            destinationNode = allNodes.firstWhere(
              (n) => n.id == newStops.first,
              orElse: () => allNodes.firstWhere((n) => n.id == exitId),
            );
            isRecalculating = false;
            isOffRoute = false;
          });

          if (positionService.demoMode && newTourRoute.path.isNotEmpty) {
            positionService.startSimulation(newTourRoute.path);
          }

          if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) {
            ScaffoldMessenger.maybeOf(context)?.showSnackBar(
              SnackBar(
                content: Text(
                  reason != null
                      ? 'Recalculating route... ($reason)'
                      : 'Recalculated route from live position',
                ),
                duration: const Duration(seconds: 2),
                backgroundColor: Colors.indigo[700],
              ),
            );
          }
        } else {
          setState(() => isRecalculating = false);
        }
      } else {
        final targetDest = targetNodeOverride ?? destinationNode;
        if (targetDest != null) {
          final result = pathfindingService!.findShortestPath(
            startId,
            targetDest.id,
          );
          setState(() {
            destinationNode = targetDest;
            currentRoute = result;
            isRecalculating = false;
            isOffRoute = false;
          });

          if (positionService.demoMode &&
              result != null &&
              result.path.isNotEmpty) {
            positionService.startSimulation(result.path);
          }

          if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  reason != null
                      ? 'Recalculating route... ($reason)'
                      : 'Recalculated route to destination from live position',
                ),
                duration: const Duration(seconds: 2),
                backgroundColor: Colors.indigo,
              ),
            );
          }
        } else {
          setState(() => isRecalculating = false);
        }
      }
    });
  }

  void _checkRouteArrival() {
    if (currentRoute != null &&
        currentPosition != null &&
        destinationNode != null) {
      if (currentPosition!.floor == destinationNode!.floor) {
        double dist = _distanceToNode(currentPosition!, destinationNode!);
        if (dist < 1.5) {
          // 1.5m arrival radius
          final arrivedNode = destinationNode!;
          visitedNodeIds.add(arrivedNode.id);
          scanResult = 'arrived';
          positionService.stopSimulation();

          if (isTourActive &&
              tourStops.isNotEmpty &&
              arrivedNode.id == tourStops.first) {
            tourStops.removeAt(0);

            if (tourStops.isNotEmpty) {
              _routeToNextTourStop();
            } else {
              setState(() {
                currentRoute = null;
                destinationNode = null;
                isTourActive = false;
              });
            }

            if (arrivedNode.objectId != null) {
              try {
                final obj = objects.firstWhere(
                  (o) => o.id == arrivedNode.objectId,
                );
                _showObjectDetail(obj);
              } catch (_) {}
            }
          } else {
            setState(() {
              currentRoute = null;
              destinationNode = null;
            });
            if (arrivedNode.objectId != null && _isExhibit(arrivedNode)) {
              try {
                final obj = objects.firstWhere(
                  (o) => o.id == arrivedNode.objectId,
                );
                _showObjectDetail(obj);
              } catch (_) {}
            }
          }

          if (isTourSuspended) {
            final arrivedName = arrivedNode.name;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Arrived at $arrivedName.'),
                action: SnackBarAction(
                  label: 'Resume Tour',
                  textColor: Colors.white,
                  onPressed: _resumeTour,
                ),
                duration: const Duration(seconds: 8),
                backgroundColor: const Color(0xFF2E6A4B),
              ),
            );
          }

          scanResultTimer?.cancel();
          scanResultTimer = Timer(const Duration(seconds: 4), () {
            if (mounted) setState(() => scanResult = null);
          });
        }
      }
    }
  }

  MapNode? customStartNode;

  void _calculateRoute(MapNode dest, {MapNode? overrideStartNode}) {
    if (pathfindingService == null) return;

    final startNode = overrideStartNode ?? customStartNode;
    String? startId = startNode?.id;

    if (startId == null && currentPosition != null) {
      final targetFloor = currentPosition!.floor;
      final floorNodes = allNodes.where((n) => n.floor == targetFloor).toList();
      if (floorNodes.isNotEmpty) {
        floorNodes.sort((a, b) => _distanceToNode(currentPosition!, a).compareTo(_distanceToNode(currentPosition!, b)));
        startId = floorNodes.first.id;
      }
    }

    if (startId == null) {
      final targetFloor = currentFloorPlan?.floorNumber ?? dest.floor;
      final floorNodes = allNodes.where((n) => n.floor == targetFloor).toList();
      try {
        startId = floorNodes.firstWhere(_isEntrance).id;
      } catch (_) {
        if (floorNodes.isNotEmpty) {
          startId = floorNodes.first.id;
        } else if (allNodes.isNotEmpty) {
          startId = allNodes.first.id;
        }
      }
    }

    if (startId == null) return;

    final result = pathfindingService!.findShortestPath(startId, dest.id);
    setState(() {
      _currentRouteStepIndex = 0;
      customStartNode = startNode;
      destinationNode = dest;
      currentRoute = result;

      // Ensure blue dot is anchored on this floor at the route start point
      if (result != null && result.path.isNotEmpty) {
        final startPt = result.path.first;
        if (currentPosition == null || currentPosition!.floor != startPt.floor) {
          currentPosition = PositionState(
            x: startPt.x,
            y: startPt.y,
            floor: startPt.floor,
            heading: currentPosition?.heading ?? 0.0,
            accuracy: 1.0,
            source: 'fused',
            timestamp: DateTime.now().millisecondsSinceEpoch,
            currentNodeId: startPt.id,
            latitude: startPt.latitude,
            longitude: startPt.longitude,
          );
          positionService.updatePosition(currentPosition!);
        }
      }
    });

    if (positionService.demoMode && result != null && result.path.isNotEmpty) {
      positionService.startSimulation(result.path);
    }
  }

  void _showTurnByTurnStepsModal() {
    if (currentRoute == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TurnByTurnStepsModal(currentRoute: currentRoute!),
    );
  }

  void _showStartNodePickerModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StartNodePickerModal(
        allNodes: allNodes,
        customStartNode: customStartNode,
        onSelectStartNode: (n) {
          if (destinationNode != null) {
            _calculateRoute(destinationNode!, overrideStartNode: n);
          } else {
            setState(() => customStartNode = n);
          }
        },
      ),
    );
  }

  bool _isEntrance(MapNode n) => n.nodeType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .contains('entrance');
  bool _isExit(MapNode n) =>
      n.nodeType.toLowerCase().split(',').map((s) => s.trim()).contains('exit');

  bool _isExhibit(MapNode n) => n.nodeType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .any((type) => type == 'exhibit' || type == 'artifact');

  void _startNavigationManually() {
    setState(() {
      isNavigationActive = true;
    });
    positionService.startPdr();
    _startFullTour();
  }

  void _startFullTour() {
    if (currentFloorPlan == null ||
        pathfindingService == null ||
        allNodes.isEmpty)
      return;
    locationService.forceIndoorMode();
    positionService.startPdr();
    final entrances = allNodes.where((n) => _isEntrance(n)).toList();
    final exits = allNodes.where((n) => _isExit(n)).toList();
    final artifacts = allNodes.where(_isExhibit).map((n) => n.id).toList();

    String startId;
    if (currentPosition?.currentNodeId != null &&
        allNodes.any((n) => n.id == currentPosition!.currentNodeId)) {
      startId = currentPosition!.currentNodeId!;
    } else if (entrances.isNotEmpty) {
      startId = entrances.first.id;
    } else {
      startId = allNodes.first.id;
    }

    String exitId;
    if (exits.isNotEmpty) {
      exitId = exits.first.id;
    } else if (entrances.length > 1) {
      exitId = entrances.last.id;
    } else if (entrances.isNotEmpty) {
      exitId = entrances.first.id;
    } else {
      exitId = allNodes.last.id;
    }

    final unvisitedArtifacts = artifacts
        .where((id) => !visitedNodeIds.contains(id))
        .toList();

    final tour = pathfindingService!.planFullTour(
      startId,
      exitId,
      unvisitedArtifacts,
    );
    if (tour != null) {
      tourStops = [];
      for (var node in tour.path) {
        if (unvisitedArtifacts.contains(node.id) &&
            !tourStops.contains(node.id)) {
          tourStops.add(node.id);
        }
      }
      if (!tourStops.contains(exitId)) {
        tourStops.add(exitId);
      }
      setState(() {
        isTourActive = true;
        isNavigationActive = true;
      });
      _routeToNextTourStop();
    }
  }

  void _routeToNextTourStop() {
    tourStops.removeWhere(
      (id) => visitedNodeIds.contains(id) && id != tourStops.last,
    );

    if (tourStops.isEmpty) {
      isTourActive = false;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Tour complete!')));
      return;
    }
    String nextStopId = tourStops.first;
    MapNode destNode = allNodes.firstWhere((n) => n.id == nextStopId);
    _calculateRoute(destNode);
  }

  void _showFloorPlanPicker() {
    if (allFloorPlans.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No maps are available for this museum.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => FloorPlanPickerModal(
        allFloorPlans: allFloorPlans,
        currentFloorPlan: currentFloorPlan,
        onSelectFloorPlan: (floorPlan) {
          setState(() {
            currentFloorPlan = floorPlan;
            currentRoute = null;
            destinationNode = null;
            isTourActive = false;

            // Anchor blue dot to the newly selected floor plan
            final floorNodes = allNodes.where((n) => n.floor == floorPlan.floorNumber).toList();
            MapNode? floorAnchor;
            try {
              floorAnchor = floorNodes.firstWhere(_isEntrance);
            } catch (_) {
              if (floorNodes.isNotEmpty) floorAnchor = floorNodes.first;
            }

            if (floorAnchor != null &&
                (currentPosition == null || currentPosition!.floor != floorPlan.floorNumber)) {
              currentPosition = PositionState(
                x: floorAnchor.x,
                y: floorAnchor.y,
                floor: floorPlan.floorNumber,
                heading: currentPosition?.heading ?? 0.0,
                accuracy: 1.0,
                source: 'fused',
                timestamp: DateTime.now().millisecondsSinceEpoch,
                currentNodeId: floorAnchor.id,
                latitude: floorAnchor.latitude,
                longitude: floorAnchor.longitude,
              );
              positionService.updatePosition(currentPosition!);
            }
          });
          context.read<MuseumProvider>().setSelectedFloor(floorPlan.id);
          _updatePositionServiceContext();
        },
      ),
    );
  }

  void _handleManualMuseumSelection() {
    if (selectedMuseum == null || allNodes.isEmpty) return;

    MapNode? startNode;
    try {
      startNode = allNodes.firstWhere((n) => _isEntrance(n));
    } catch (_) {
      try {
        startNode = allNodes.firstWhere(
          (n) => n.latitude != null && n.longitude != null,
        );
      } catch (_) {}
    }

    if (startNode != null) {
      positionService.scanQR(startNode);
      setState(() {
        scanResult = 'found';
        if (allFloorPlans.isNotEmpty) {
          try {
            currentFloorPlan = allFloorPlans.firstWhere(
              (p) => p.floorNumber == startNode!.floor,
            );
          } catch (_) {
            currentFloorPlan = allFloorPlans.first;
          }
        }
        _updatePositionServiceContext();
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No mapping nodes available for this museum.'),
        ),
      );
    }
  }

  Future<void> _handleQRScan(String data) async {
    MapNode? foundNode;

    // Call the new Flask backend QR resolver first
    try {
      String payload = data.trim();
      if (payload.startsWith('http')) {
        final uri = Uri.parse(payload);
        payload = uri.pathSegments.last;
      }
      final response = await http.get(
        Uri.parse('${ApiConfig.mapServiceUrl}/qr-locations/$payload'),
      );
      if (response.statusCode == 200) {
        final resData = jsonDecode(response.body);
        if (resData['data'] != null) {
          final nodeId = resData['data']['node_id'].toString();
          foundNode = allNodes.firstWhere((n) => n.id == nodeId);
        }
      }
    } catch (e) {
      debugPrint("QR Backend resolution failed: $e");
    }

    // 0. Fallback: Check if the QR code contains JSON payload
    try {
      if (data.trim().startsWith('{')) {
        final Map<String, dynamic> jsonData = jsonDecode(data);
        final String? jsonNodeId =
            jsonData['startNodeId'] ??
            jsonData['nodeId'] ??
            jsonData['node_id'];
        if (jsonNodeId != null) {
          foundNode = allNodes.firstWhere((n) => n.id == jsonNodeId);
        } else if (jsonData['museumId'] != null) {
          foundNode = allNodes.firstWhere((n) => _isEntrance(n));
        }
      }
    } catch (_) {}

    // 1. Check if it's a direct node ID (exact match or query param)
    if (foundNode == null) {
      try {
        if (data.contains('node_id=')) {
          final match = RegExp(r'node_id=([a-zA-Z0-9_-]+)').firstMatch(data);
          if (match != null) {
            foundNode = allNodes.firstWhere((n) => n.id == match.group(1));
          }
        } else {
          foundNode = allNodes.firstWhere((n) => n.id == data);
        }
      } catch (_) {}
    }

    // 2. Fallback check for object ID mapping
    if (foundNode == null) {
      final objIdRegex = RegExp(
        r'(?:objects/|object_id=|object[_-]?)(\d+)',
        caseSensitive: false,
      );
      final codeRegex = RegExp(r'code[=:]?([A-Z0-9-]+)', caseSensitive: false);

      int? objId;
      String? code;

      final objMatch = objIdRegex.firstMatch(data);
      if (objMatch != null) {
        objId = int.tryParse(objMatch.group(1)!);
      } else {
        final codeMatch = codeRegex.firstMatch(data);
        if (codeMatch != null) {
          code = codeMatch.group(1)!;
        } else {
          // If it's just a raw number
          objId = int.tryParse(data);
        }
      }

      MuseumObject? scannedObject;
      if (objId != null) {
        try {
          scannedObject = objects.firstWhere((o) => o.id == objId);
        } catch (_) {}
        try {
          foundNode = allNodes.firstWhere((n) => n.objectId == objId);
        } catch (_) {}
      } else if (code != null) {
        scannedObject = await offlineStore.findObjectByCode(code);
        if (scannedObject != null) {
          try {
            foundNode = allNodes.firstWhere(
              (n) => n.objectId == scannedObject!.id,
            );
          } catch (_) {}
        }
      }
    }

    // 3. Fallback for generic museum QR (entrance checkpoint)
    if (foundNode == null &&
        (data.toLowerCase().contains('museum') ||
            data.toLowerCase().contains('museum_id='))) {
      try {
        // Find the first entrance node
        foundNode = allNodes.firstWhere((n) => _isEntrance(n));
      } catch (_) {}
    }

    // Check deep link URI formats (vanalok://museum/1?node=entrance_1)
    if (foundNode == null) {
      final payload = DeepLinkService.parseUri(data);
      if (payload != null && payload.entranceNodeId != null) {
        try {
          foundNode = allNodes.firstWhere(
            (n) => n.id == payload.entranceNodeId,
          );
        } catch (_) {}
      }
    }

    if (foundNode != null) {
      positionService.scanQR(foundNode);
      locationService.forceIndoorMode();

      // Check QR type (Room Doorway vs Museum Entrance)
      final isRoomEntry = data.contains('/room/') ||
          data.contains('room_') ||
          foundNode.name.toLowerCase().contains('door') ||
          foundNode.name.toLowerCase().contains('foyer');
      final isMuseumEntrance = (data.contains('vanalok://museum/') && !data.contains('/room/')) ||
          data.contains('museum_1_entrance') ||
          data.contains('vanalok_museum_');

      Gallery? matchedGallery;
      if (isRoomEntry) {
        for (var g in galleries) {
          final gName = g.name.toLowerCase();
          final nodeName = foundNode.name.toLowerCase();
          if (nodeName.contains(gName) ||
              (gName.contains('living') && (nodeName.contains('living') || data.contains('living'))) ||
              (gName.contains('kitchen') && (nodeName.contains('kitchen') || data.contains('kitchen'))) ||
              (gName.contains('bedroom') && (nodeName.contains('bedroom') || data.contains('bedroom'))) ||
              (gName.contains('bath') && (nodeName.contains('bath') || data.contains('bath')))) {
            matchedGallery = g;
            break;
          }
        }
        matchedGallery ??= galleries.isNotEmpty ? galleries.first : null;
      }

      setState(() {
        scanResult = 'found';
        if (isMuseumEntrance) {
          isRoomMapMode = false;
          selectedGallery = null;
          isRoomCompleted = false;
          roomDoorwayNode = null;
        } else if (isRoomEntry) {
          isRoomMapMode = true;
          selectedGallery = matchedGallery;
          currentRoomId = matchedGallery?.id;
          isRoomCompleted = false;
          roomDoorwayNode = foundNode;
        }

        // Auto select floor plan if jumping to a new floor
        if (currentFloorPlan == null ||
            currentFloorPlan!.floorNumber != foundNode!.floor) {
          try {
            currentFloorPlan = allFloorPlans.firstWhere(
              (p) => p.floorNumber == foundNode!.floor,
            );
          } catch (_) {
            currentFloorPlan = allFloorPlans.first;
          }
        }
        _updatePositionServiceContext();
      });

      if (mounted) {
        if (isMuseumEntrance) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: Color(0xFF17211F),
              content: Text('🏛️ Welcome to Museum! Whole Museum Map Active.'),
            ),
          );
        } else if (isRoomEntry) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF2C5E43),
              content: Text('📍 Entered ${matchedGallery?.name ?? 'Gallery'}! Room Map Active.'),
            ),
          );
        }
      }

      // If navigation is active, recalculate route to next destination; if not active, manual start is required
      if (isNavigationActive && destinationNode != null) {
        _calculateRoute(destinationNode!);
      } else if (!isNavigationActive) {
        positionService.stopPdr();
      }

      // Open ObjectDetailSheet if it's an exhibit/artifact
      if (foundNode.objectId != null && _isExhibit(foundNode)) {
        visitedNodeIds.add(foundNode.id);
        try {
          final obj = objects.firstWhere((o) => o.id == foundNode!.objectId);
          _showObjectDetail(obj);
        } catch (_) {}
      }
    } else if (data.contains('object') ||
        data.contains('code') ||
        int.tryParse(data) != null) {
      // Direct object scan even if not tied to a map node
      final objIdRegex = RegExp(
        r'(?:objects/|object_id=|object[_-]?)(\d+)',
        caseSensitive: false,
      );
      final match = objIdRegex.firstMatch(data);
      int? foundId = match != null
          ? int.tryParse(match.group(1)!)
          : int.tryParse(data);
      MuseumObject? matched;
      if (foundId != null) {
        try {
          matched = objects.firstWhere((o) => o.id == foundId);
        } catch (_) {}
      }
      if (matched != null) {
        setState(() {
          scanResult = 'found';
        });
        _showObjectDetail(matched);
      } else {
        setState(() {
          scanResult = 'not-found';
        });
      }
    } else {
      setState(() {
        scanResult = 'not-found';
      });
    }

    scanResultTimer?.cancel();
    scanResultTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => scanResult = null);
    });
  }

  void _openScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      builder: (_) => QRScannerModal(
        onScan: (data) {
          Navigator.pop(context);
          _handleQRScan(data);
        },
      ),
    );
  }

  void _showObjectDetail(MuseumObject obj, {VoidCallback? onNavigate}) {
    if (!mounted) return;
    if (_isObjectDetailSheetOpen && _currentOpenObjectId == obj.id) return;

    _isObjectDetailSheetOpen = true;
    _currentOpenObjectId = obj.id;
    try {
      final match = allNodes.firstWhere((n) => n.objectId == obj.id);
      _currentOpenNodeId = match.id;
    } catch (_) {}

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ObjectDetailSheet(
        obj: obj,
        onNavigate: onNavigate ?? () => _startNavigationToObject(obj),
        onExploreMore: () => _openExploreMore(obj),
        onClose: () {
          Navigator.pop(context);
          if (mounted && isTourActive && tourStops.isNotEmpty) {
            _routeToNextTourStop();
          }
        },
      ),
    ).whenComplete(() {
      if (mounted) {
        setState(() {
          _isObjectDetailSheetOpen = false;
          _currentOpenObjectId = null;
          _currentOpenNodeId = null;
        });
      }
    });
  }

  void _openExploreMore(MuseumObject obj) {
    Navigator.pop(context);
    final provider = context.read<MuseumProvider>();
    final mId = provider.selectedMuseumId ?? 1;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ExploreMoreScreen(object: obj, museumId: mId),
      ),
    );
  }

  FloorPlan? currentFloorPlan;

  int? get _effectiveRoomId {
    if (currentRoomId == null) return null;
    if (currentRoute != null && destinationNode != null) {
      try {
        Gallery g = galleries.firstWhere((gal) => gal.id == currentRoomId);
        if (g.boundaryPolygon != null &&
            destinationNode!.latitude != null &&
            destinationNode!.longitude != null) {
          if (!NavigationMath.isPointInPolygon(
            destinationNode!.latitude!,
            destinationNode!.longitude!,
            g.boundaryPolygon!,
          )) {
            return null;
          }
        }
      } catch (_) {}
    }
    return currentRoomId;
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MuseumProvider>();
    if (provider.selectedFloorPlanId != null &&
        currentFloorPlan == null &&
        allFloorPlans.isNotEmpty) {
      try {
        currentFloorPlan = allFloorPlans.firstWhere(
          (fp) => fp.id == provider.selectedFloorPlanId,
        );
        _updatePositionServiceContext();
      } catch (_) {
        currentFloorPlan = allFloorPlans.first;
        _updatePositionServiceContext();
      }
    }

    if (!isLoaded) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'Loading museum data...',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    if (currentFloorPlan == null && allFloorPlans.isNotEmpty) {
      currentFloorPlan = allFloorPlans.first;
      _updatePositionServiceContext();
    }

    return ScaffoldMessenger(
      child: Scaffold(
        backgroundColor: Colors.grey[50],
        appBar: isFullscreen
            ? null
            : AppBar(
                backgroundColor: Colors.indigo[900],
                elevation: 2,
                titleSpacing: 12,
                title: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: TextField(
                    onChanged: (val) => setState(() => searchQuery = val),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search exhibits, artworks...',
                      hintStyle: const TextStyle(
                        color: Colors.white60,
                        fontSize: 14,
                      ),
                      prefixIcon: const Icon(
                        LucideIcons.search,
                        color: Colors.white70,
                        size: 18,
                      ),
                      suffixIcon: searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(
                                LucideIcons.x,
                                color: Colors.white70,
                                size: 16,
                              ),
                              onPressed: () => setState(() => searchQuery = ''),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                actions: [
                  IconButton(
                    icon: Icon(
                      isOnline ? LucideIcons.wifi : LucideIcons.wifiOff,
                      size: 18,
                      color: isOnline ? Colors.greenAccent : Colors.amber,
                    ),
                    onPressed: () {},
                    tooltip: isOnline ? 'Online' : 'Offline mode',
                  ),
                  IconButton(
                    icon: const Icon(
                      LucideIcons.camera,
                      size: 20,
                      color: Colors.white,
                    ),
                    onPressed: _openScanner,
                    tooltip: 'Scan QR',
                  ),
                  IconButton(
                    icon: Icon(
                      isTourActive
                          ? LucideIcons.refreshCw
                          : (tourStops.isNotEmpty
                                ? LucideIcons.play
                                : LucideIcons.map),
                      size: 20,
                      color: Colors.white,
                    ),
                    onPressed: () {
                      if (isTourActive) {
                        _startFullTour();
                      } else if (tourStops.isNotEmpty) {
                        setState(() => isTourActive = true);
                        _routeToNextTourStop();
                      } else {
                        _startFullTour();
                      }
                    },
                    tooltip: isTourActive
                        ? 'Recalculate Tour'
                        : (tourStops.isNotEmpty ? 'Resume Tour' : 'Full Tour'),
                  ),

                  IconButton(
                    icon: const Icon(
                      LucideIcons.refreshCw,
                      size: 20,
                      color: Colors.white,
                    ),
                    onPressed: _refreshAndSync,
                    tooltip: 'Sync latest map',
                  ),
                  IconButton(
                    icon: const Icon(
                      LucideIcons.layers,
                      size: 20,
                      color: Colors.white,
                    ),
                    onPressed: _showFloorPlanPicker,
                    tooltip: 'Select map',
                  ),
                  IconButton(
                    icon: const Icon(
                      LucideIcons.building2,
                      size: 20,
                      color: Colors.white,
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const MuseumSelectionScreen(
                            showBackButton: true,
                          ),
                        ),
                      );
                    },
                    tooltip: 'Change Museum',
                  ),
                ],
              ),
        body: Stack(
          children: [
            Column(
              children: [
                // Search Results Dropdown Overlay
                if (searchQuery.trim().isNotEmpty)
                  Container(
                    constraints: const BoxConstraints(maxHeight: 280),
                    margin: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 16,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: ListView(
                        shrinkWrap: true,
                        children: filteredObjects.isEmpty
                            ? [
                                const Padding(
                                  padding: EdgeInsets.all(16.0),
                                  child: Text(
                                    'No exhibits found.',
                                    style: TextStyle(
                                      color: Colors.grey,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ]
                            : filteredObjects.map((obj) {
                                Gallery? room;
                                try {
                                  room = galleries.firstWhere(
                                    (g) => g.id == obj.galleryId,
                                  );
                                } catch (_) {}
                                return ListTile(
                                  leading: Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: Colors.grey[200],
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    clipBehavior: Clip.hardEdge,
                                    child:
                                        obj.image != null &&
                                            obj.image!.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: ApiConfig.getMediaUrl(
                                              obj.image!,
                                            ),
                                            fit: BoxFit.cover,
                                          )
                                        : const Icon(
                                            LucideIcons.image,
                                            size: 20,
                                            color: Colors.grey,
                                          ),
                                  ),
                                  title: Text(
                                    obj.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                  subtitle: Text(
                                    room?.name ?? 'Museum Exhibit',
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontSize: 12,
                                    ),
                                  ),
                                  trailing: const Icon(
                                    LucideIcons.chevronRight,
                                    size: 18,
                                    color: Colors.indigo,
                                  ),
                                  onTap: () {
                                    _showObjectDetail(
                                      obj,
                                      onNavigate: () =>
                                          _startNavigationToObject(obj),
                                    );
                                  },
                                );
                              }).toList(),
                      ),
                    ),
                  ),

                // Status Banners
                if (!isAtMuseum || locationError != null)
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.orange[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.alertTriangle,
                          size: 16,
                          color: Colors.orange[700],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            locationError ?? 'You are not physically at the museum. Navigation disabled.',
                            style: TextStyle(
                              color: Colors.orange[700],
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (currentPosition?.isLost == true)
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.wifi,
                          size: 16,
                          color: Colors.red[700],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Lost graph signal. Scan the nearest QR checkpoint to resync position.',
                            style: TextStyle(
                              color: Colors.red[700],
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (!isFullscreen && scanResult == 'not-found')
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.alertCircle,
                          size: 16,
                          color: Colors.red[700],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'QR code not recognized.',
                            style: TextStyle(
                              color: Colors.red[700],
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (!isFullscreen && scanResult == 'found')
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.checkCircle,
                          size: 16,
                          color: Colors.green[700],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Location updated.',
                            style: TextStyle(
                              color: Colors.green[700],
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (!isFullscreen && scanResult == 'arrived')
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.indigo[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.indigo[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.mapPin,
                          size: 24,
                          color: Colors.indigo[700],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'You have arrived at your destination!',
                            style: TextStyle(
                              color: Colors.indigo[700],
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                if (isRecalculating || isOffRoute)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: isRecalculating
                          ? Colors.indigo[900]?.withValues(alpha: 0.92)
                          : Colors.amber[900]?.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 8,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            isRecalculating
                                ? 'Recalculating route from live position...'
                                : 'Deviated off-route — Rerouting automatically...',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Active Gallery / Room Pill
                if (selectedGallery != null)
                  Container(
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 2),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF17211F).withValues(alpha: 0.90),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF46745B).withValues(alpha: 0.5),
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isRoomMapMode ? LucideIcons.doorOpen : LucideIcons.landmark,
                          color: isRoomMapMode ? const Color(0xFF68D391) : const Color(0xFFE2847A),
                          size: 14,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            isRoomMapMode
                                ? 'ROOM MAP: ${selectedGallery!.name.toUpperCase()}'
                                : '${selectedGallery!.name.toUpperCase()} • FLOOR ${currentFloorPlan?.floorNumber ?? 0}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.1,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isRoomMapMode) ...[
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () {
                              setState(() {
                                isRoomMapMode = false;
                                selectedGallery = null;
                                isRoomCompleted = false;
                                roomDoorwayNode = null;
                                currentRoute = null;
                                destinationNode = null;
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  backgroundColor: Color(0xFF17211F),
                                  content: Text('Returned to Whole Museum Map'),
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white24,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Row(
                                children: [
                                  Icon(LucideIcons.logOut, size: 10, color: Colors.white),
                                  SizedBox(width: 3),
                                  Text(
                                    'EXIT',
                                    style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                // Tour Suspended Banner
                if (isTourSuspended)
                  Container(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: const Color(0xFFE2847A).withValues(alpha: 0.6),
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 8,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.pauseCircle,
                          color: Color(0xFFE2847A),
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            selectiveTargetNode != null
                                ? 'Tour paused • Heading to ${selectiveTargetNode!.name}'
                                : 'Tour paused for selective navigation',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: _resumeTour,
                          icon: const Icon(LucideIcons.play, size: 12),
                          label: const Text('Resume Tour'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF46745B),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Instructions / Active Route Top Banner
                if (currentRoute != null &&
                    currentRoute!.instructions.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.indigo[700],
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black12,
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.indigo[800],
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(16),
                              bottomLeft: Radius.circular(16),
                            ),
                          ),
                          child: const Icon(
                            LucideIcons.navigation,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  destinationNode != null
                                      ? 'DIRECTIONS TO ${destinationNode!.name.toUpperCase()}'
                                      : 'NEXT STEP',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.2,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Builder(
                                        builder: (context) {
                                          final int displayIdx = math.min(
                                            _currentRouteStepIndex + 1,
                                            currentRoute!.instructions.length - 1,
                                          );
                                          final instr = currentRoute!.instructions.isNotEmpty
                                              ? currentRoute!.instructions[displayIdx]
                                              : 'Follow route';
                                          return Text(
                                            instr,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                    Builder(
                                      builder: (context) {
                                        double totalRemaining = currentRoute!.distance;
                                        if (currentPosition != null) {
                                          final path = currentRoute!.path;
                                          int nextIdx = math.min(_currentRouteStepIndex + 1, path.length - 1);
                                          if (path.isNotEmpty) {
                                            double distToNext = _distanceToNode(currentPosition!, path[nextIdx]);
                                            double remDist = 0;
                                            for (int i = nextIdx; i < path.length - 1; i++) {
                                              remDist += _distanceToNode(
                                                PositionState(
                                                  x: path[i].x,
                                                  y: path[i].y,
                                                  floor: path[i].floor,
                                                  heading: 0,
                                                  accuracy: 1,
                                                  source: 'path',
                                                  timestamp: 0,
                                                  latitude: path[i].latitude,
                                                  longitude: path[i].longitude,
                                                ),
                                                path[i + 1],
                                              );
                                            }
                                            totalRemaining = distToNext + remDist;
                                          }
                                        }
                                        String displayDist =
                                            totalRemaining < 10.0
                                            ? totalRemaining.toStringAsFixed(1)
                                            : totalRemaining.round().toString();
                                        return Text(
                                          '$displayDist m',
                                          style: const TextStyle(
                                            color: Colors.greenAccent,
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(LucideIcons.x, color: Colors.white),
                          tooltip: 'Cancel Navigation',
                          onPressed: () {
                            setState(() {
                              currentRoute = null;
                              destinationNode = null;
                              isTourActive = false;
                              positionService.stopSimulation();
                            });
                          },
                        ),
                      ],
                    ),
                  ),

                // Map Area
                Expanded(
                  child: Stack(
                    children: [
                      if (currentFloorPlan != null)
                        IndoorMapWidget(
                          floorPlan: currentFloorPlan!,
                          currentPosition: currentPosition,
                          routePath: currentRoute?.path ?? [],
                          destinationNode: destinationNode,
                          allNodes: allNodes,
                          galleries: galleries,
                          currentRoomId: _effectiveRoomId,
                          visitedNodeIds: visitedNodeIds,
                          onNodeTap: (node) {
                            if (_isExhibit(node) && node.objectId != null) {
                              try {
                                final object = objects.firstWhere(
                                  (item) => item.id == node.objectId,
                                );
                                _showObjectDetail(object);
                                return;
                              } catch (_) {}
                            }
                            _startSelectiveNavigation(node);
                          },
                          onMapCreated: (ctrl) {
                            mapController = ctrl;
                          },
                        )
                      else
                        const Center(child: Text('No Map Data Available')),

                      // Proximity Prompt Banner Overlay (Part A)
                      if (_proximityPromptObject != null && !_isObjectDetailSheetOpen)
                        Positioned(
                          top: 16,
                          left: 16,
                          right: 16,
                          child: Material(
                            color: Colors.transparent,
                            elevation: 6,
                            borderRadius: BorderRadius.circular(14),
                            child: InkWell(
                              onTap: () {
                                final obj = _proximityPromptObject!;
                                _showObjectDetail(obj);
                              },
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E1B4B)
                                      .withValues(alpha: 0.95),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: Colors.indigoAccent.shade100
                                        .withValues(alpha: 0.6),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.15,
                                        ),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        LucideIcons.sparkles,
                                        color: Colors.amberAccent,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Text(
                                            'Nearby Exhibit Detected',
                                            style: TextStyle(
                                              color: Colors.white70,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          Text(
                                            _proximityPromptObject!.name,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const Text(
                                            'Tap to view details & audio guide',
                                            style: TextStyle(
                                              color: Colors.amberAccent,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(
                                        LucideIcons.x,
                                        color: Colors.white70,
                                        size: 18,
                                      ),
                                      onPressed: () {
                                        setState(() {
                                          _proximityPromptObject = null;
                                          _proximityPromptNode = null;
                                        });
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Bottom-Left Rotating N/S/E/W Compass & Recenter Button (Part H)
                      Positioned(
                        left: 16,
                        bottom: 16,
                        child: CompassDialWidget(
                          heading: _compassHeading,
                          size: 46.0,
                          onTap: _recenterMap,
                        ),
                      ),

                      // Explicit "Start Navigation" Button (Part I)
                      if (!isNavigationActive && currentFloorPlan != null)
                        Positioned(
                          bottom: 24,
                          left: 48,
                          right: 48,
                          child: Center(
                            child: Material(
                              elevation: 6,
                              borderRadius: BorderRadius.circular(30),
                              color: const Color(0xFF4338CA),
                              child: InkWell(
                                key: const Key('start_navigation_button'),
                                onTap: _startNavigationManually,
                                borderRadius: BorderRadius.circular(30),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 24,
                                    vertical: 14,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(30),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Colors.black26,
                                        blurRadius: 8,
                                        offset: Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      Icon(
                                        LucideIcons.navigation,
                                        color: Colors.white,
                                        size: 18,
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        'Start Navigation',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 0.3,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Bottom-Right Options Control ("•••" icon)
                      Positioned(
                        right: 16,
                        bottom: 16,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (showOptionsMenu)
                              Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 4,
                                  horizontal: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 10,
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    TextButton.icon(
                                      onPressed: () {
                                        _toggleFullscreen();
                                        setState(() => showOptionsMenu = false);
                                      },
                                      icon: Icon(
                                        isFullscreen
                                            ? LucideIcons.minimize
                                            : LucideIcons.maximize,
                                        size: 16,
                                        color: Colors.indigo[700],
                                      ),
                                      label: Text(
                                        isFullscreen
                                            ? 'Exit Fullscreen'
                                            : 'Fullscreen',
                                        style: TextStyle(
                                          color: Colors.indigo[700],
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    if (allFloorPlans.length > 1) ...[
                                      const Divider(height: 1),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 4,
                                        ),
                                        child: Text(
                                          'FLOORS',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.grey[500],
                                          ),
                                        ),
                                      ),
                                      ...allFloorPlans.map((fp) {
                                        bool isSel =
                                            currentFloorPlan?.id == fp.id;
                                        return TextButton(
                                          onPressed: () {
                                            setState(() {
                                              currentFloorPlan = fp;
                                              showOptionsMenu = false;
                                            });
                                          },
                                          child: Text(
                                            'Floor ${fp.floorNumber}',
                                            style: TextStyle(
                                              color: isSel
                                                  ? Colors.indigo[700]
                                                  : Colors.grey[700],
                                              fontWeight: isSel
                                                  ? FontWeight.bold
                                                  : FontWeight.normal,
                                              fontSize: 12,
                                            ),
                                          ),
                                        );
                                      }),
                                    ],
                                  ],
                                ),
                              ),
                            FloatingActionButton(
                              heroTag: 'options_btn',
                              mini: true,
                              backgroundColor: Colors.white,
                              elevation: 4,
                              onPressed: () => setState(
                                () => showOptionsMenu = !showOptionsMenu,
                              ),
                              tooltip: 'Options',
                              child: Icon(
                                LucideIcons.moreHorizontal,
                                color: Colors.indigo[700],
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Nearby / Discovery Panel OR Bottom Navigation Route Panel
                if (!isFullscreen)
                      currentRoute != null && destinationNode != null
                          ? NavigationRoutePanel(
                              destinationNode: destinationNode!,
                              currentRoute: currentRoute!,
                              startLocationText:
                                  customStartNode?.name ??
                                  (currentPosition?.currentNodeId != null
                                      ? 'Live Fused Position'
                                      : 'Main Entrance'),
                              nearbyNodes: _nearbyNodes,
                              onSelectNearbyNode: (n) {
                                if (n.objectId != null) {
                                  try {
                                    final obj = objects.firstWhere((o) => o.id == n.objectId);
                                    _showObjectDetail(obj);
                                  } catch (_) {
                                    _startSelectiveNavigation(n);
                                  }
                                } else {
                                  _startSelectiveNavigation(n);
                                }
                              },
                              onCancel: () {
                                setState(() {
                                  currentRoute = null;
                                  destinationNode = null;
                                  isTourActive = false;
                                  isNavigationActive = false;
                                  positionService.stopSimulation();
                                  positionService.stopPdr();
                                });
                              },
                              onEditStartNode: _showStartNodePickerModal,
                              onViewSteps: _showTurnByTurnStepsModal,
                              onScanArtifact: _openScanner,
                              onMarkVisited: () {
                                setState(() {
                                  scanResult = 'arrived';
                                  currentRoute = null;
                                  positionService.stopSimulation();
                                });
                                if (isTourActive &&
                                    tourStops.isNotEmpty &&
                                    destinationNode?.id == tourStops.first) {
                                  tourStops.removeAt(0);
                                  if (destinationNode?.objectId != null) {
                                    try {
                                      final obj = objects.firstWhere(
                                        (o) => o.id == destinationNode!.objectId,
                                      );
                                      _showObjectDetail(obj);
                                    } catch (_) {
                                      if (mounted && isTourActive) {
                                        _routeToNextTourStop();
                                      }
                                    }
                                  } else {
                                    if (mounted && isTourActive) {
                                      _routeToNextTourStop();
                                    }
                                  }
                                }
                                setState(() {
                                  destinationNode = null;
                                });
                              },
                            )
                          : NearbyAttractionsPanel(
                              nearbyNodes: _nearbyNodes,
                              hasPosition: currentPosition != null && pathfindingService != null,
                              activeDestinationId: destinationNode?.id,
                              onNodeTap: _startSelectiveNavigation,
                              museums: museums,
                              selectedMuseum: selectedMuseum,
                              onSelectMuseum: (val) {
                                setState(() => selectedMuseum = val);
                                if (val != null) _handleManualMuseumSelection();
                              },
                            ),
              ], // End of Column children
            ), // End of Column
          ], // End of Stack children
        ), // End of Stack
      ), // End of Scaffold
    ); // End of ScaffoldMessenger
  }
}
