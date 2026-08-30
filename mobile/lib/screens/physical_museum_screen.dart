import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;

import '../config/api.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';
import '../services/offline_store.dart';
import '../services/indoor_positioning.dart';
import '../services/pathfinding.dart';
import '../widgets/qr_scanner_modal.dart';
import '../widgets/offline_sync_panel.dart';
import '../widgets/indoor_map_widget.dart';
import '../widgets/object_detail_sheet.dart';

class PhysicalMuseumScreen extends StatefulWidget {
  const PhysicalMuseumScreen({super.key});

  @override
  State<PhysicalMuseumScreen> createState() => _PhysicalMuseumScreenState();
}

class _PhysicalMuseumScreenState extends State<PhysicalMuseumScreen> {
  bool isOnline = true;
  List<Museum> museums = [];
  List<Gallery> galleries = [];
  List<MuseumObject> objects = [];
  
  List<MapNode> allNodes = [];
  List<MapEdge> allEdges = [];
  List<FloorPlan> allFloorPlans = [];

  Museum? selectedMuseum;
  Gallery? selectedGallery;
  bool isLoaded = false;
  String? scanResult;
  Timer? scanResultTimer;

  final OfflineStore offlineStore = OfflineStore();
  late StreamSubscription<List<ConnectivityResult>> connectivitySubscription;

  // New Services
  late IndoorPositionService positionService;
  PathfindingService? pathfindingService;
  PositionState? currentPosition;
  RouteResult? currentRoute;
  MapNode? destinationNode;
  
  List<String> tourStops = [];
  bool isTourActive = false;

  @override
  void initState() {
    super.initState();
    positionService = IndoorPositionService();
    positionService.requestPermissions();
    positionService.positionStream.listen((pos) {
      if (mounted) {
        setState(() {
          currentPosition = pos;
          _checkRouteArrival();
        });
      }
    });

    _checkConnectivity();
    connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      if (mounted) {
        setState(() {
          isOnline = !results.contains(ConnectivityResult.none);
        });
      }
    });
    _loadData();
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
    connectivitySubscription.cancel();
    scanResultTimer?.cancel();
    positionService.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final m = await offlineStore.getMuseums();
    final g = await offlineStore.getGalleries();
    final o = await offlineStore.getObjects();
    final n = await offlineStore.getNodes();
    final e = await offlineStore.getEdges();
    final f = await offlineStore.getFloorPlans();

    if (m.isNotEmpty && n.isNotEmpty) {
      setState(() {
        museums = m;
        galleries = g;
        objects = o;
        allNodes = n;
        allEdges = e;
        allFloorPlans = f;
        
        pathfindingService = PathfindingService(
          nodes: allNodes, 
          edges: allEdges, 
          floorPlans: allFloorPlans
        );
        isLoaded = true;
      });
      return;
    }

    // Try to sync if empty
    if (isOnline) {
      try {
        final data = await offlineStore.syncAll((p, m) => print('$p%: $m'));
        _handleSyncComplete(data);
      } catch (e) {
        print('Error initial sync: $e');
      }
    }

    setState(() {
      isLoaded = true;
    });
  }

  void _handleSyncComplete(Map<String, dynamic> data) {
    setState(() {
      museums = data['museums'] ?? [];
      galleries = data['galleries'] ?? [];
      objects = data['objects'] ?? [];
      allNodes = data['nodes'] ?? [];
      allEdges = data['edges'] ?? [];
      allFloorPlans = data['floor_plans'] ?? [];

      pathfindingService = PathfindingService(
        nodes: allNodes, 
        edges: allEdges, 
        floorPlans: allFloorPlans
      );
    });
  }

  void _checkRouteArrival() {
    if (currentRoute != null && currentPosition != null && destinationNode != null) {
      if (currentPosition!.floor == destinationNode!.floor) {
        double dist = _calcDistance(
          currentPosition!.x, currentPosition!.y, 
          destinationNode!.x, destinationNode!.y
        );
        if (dist < 20.0) { // arbitrary arrival radius
          setState(() {
            scanResult = 'arrived';
            currentRoute = null;
            positionService.stopSimulation();
          });
          
          if (isTourActive && tourStops.isNotEmpty && destinationNode?.id == tourStops.first) {
            final arrivedNodeId = tourStops.removeAt(0);
            final arrivedNode = allNodes.firstWhere((n) => n.id == arrivedNodeId);
            
            if (arrivedNode.objectId != null) {
              try {
                final obj = objects.firstWhere((o) => o.id == arrivedNode.objectId);
                _showObjectDetail(obj);
              } catch (_) {
                 if (mounted && isTourActive) _routeToNextTourStop();
              }
            } else {
               if (mounted && isTourActive) _routeToNextTourStop();
            }
          }
          
          setState(() {
             destinationNode = null;
          });
          
          scanResultTimer?.cancel();
          scanResultTimer = Timer(const Duration(seconds: 4), () {
            if (mounted) setState(() => scanResult = null);
          });
        }
      }
    }
  }

  double _calcDistance(double x1, double y1, double x2, double y2) {
    return sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
  }

  void _calculateRoute(MapNode dest) {
    if (currentPosition?.currentNodeId == null || pathfindingService == null) return;
    final result = pathfindingService!.findShortestPath(
      currentPosition!.currentNodeId!, 
      dest.id
    );
    setState(() {
      destinationNode = dest;
      currentRoute = result;
    });
    
    // To test with real hardware (PDR), we no longer auto-start the simulation here.
    // Movement will now only happen when _onStepDetected is triggered by the phone's accelerometer.
    if (positionService.demoMode && result != null && result.path.isNotEmpty) {
       positionService.startSimulation(result.path);
    }
  }

  void _startFullTour() {
    if (currentFloorPlan == null || pathfindingService == null) return;
    final floorNodes = allNodes.where((n) => n.floor == currentFloorPlan!.floorNumber).toList();
    final entrances = floorNodes.where((n) => n.nodeType == 'entrance').toList();
    final exits = floorNodes.where((n) => n.nodeType == 'exit').toList();
    final artifacts = floorNodes.where((n) => n.nodeType == 'exhibit' || n.nodeType == 'artifact').map((n) => n.id).toList();

    if (entrances.isEmpty || exits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cannot start tour: Missing entrance or exit.')));
      return;
    }

    String startId = entrances.first.id;
    String exitId = exits.first.id;

    final tour = pathfindingService!.planFullTour(startId, exitId, artifacts);
    if (tour != null) {
      tourStops = [];
      for (var node in tour.path) {
        if (artifacts.contains(node.id) && !tourStops.contains(node.id)) {
          tourStops.add(node.id);
        }
      }
      tourStops.add(exitId); 
      isTourActive = true;
      _routeToNextTourStop();
    }
  }

  void _routeToNextTourStop() {
    if (tourStops.isEmpty) {
       isTourActive = false;
       ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tour complete!')));
       return;
    }
    String nextStopId = tourStops.first;
    MapNode destNode = allNodes.firstWhere((n) => n.id == nextStopId);
    _calculateRoute(destNode);
  }

  Future<void> _handleQRScan(String data) async {
    MapNode? foundNode;

    // 0. Check if the QR code contains JSON payload
    try {
      if (data.trim().startsWith('{')) {
        final Map<String, dynamic> jsonData = jsonDecode(data);
        final String? jsonNodeId = jsonData['startNodeId'] ?? jsonData['nodeId'] ?? jsonData['node_id'];
        if (jsonNodeId != null) {
          foundNode = allNodes.firstWhere((n) => n.id == jsonNodeId);
        } else if (jsonData['museumId'] != null) {
          foundNode = allNodes.firstWhere((n) => n.nodeType.toLowerCase() == 'entrance');
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
      final objIdRegex = RegExp(r'(?:objects/|object_id=|object[_-]?)(\d+)', caseSensitive: false);
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

      if (objId != null) {
        try {
          foundNode = allNodes.firstWhere((n) => n.objectId == objId);
        } catch (_) {}
      } else if (code != null) {
        final obj = await offlineStore.findObjectByCode(code);
        if (obj != null) {
          try {
            foundNode = allNodes.firstWhere((n) => n.objectId == obj.id);
          } catch (_) {}
        }
      }
    }

    // 3. Fallback for generic museum QR (entrance checkpoint)
    if (foundNode == null && (data.toLowerCase().contains('museum') || data.toLowerCase().contains('museum_id='))) {
      try {
        // Find the first entrance node
        foundNode = allNodes.firstWhere((n) => n.nodeType.toLowerCase() == 'entrance');
      } catch (_) {}
    }

    if (foundNode != null) {
      positionService.scanQR(foundNode);
      setState(() {
        scanResult = 'found';
        // Auto select floor plan if jumping to a new floor
        if (currentFloorPlan == null || currentFloorPlan!.floorNumber != foundNode!.floor) {
           currentFloorPlan = allFloorPlans.firstWhere((p) => p.floorNumber == foundNode!.floor);
        }
        positionService.updateContext(currentFloorPlan, allNodes, allEdges);
      });
      
      // Recalculate route if active
      if (destinationNode != null) {
        _calculateRoute(destinationNode!);
      }
      
      // B3: Open ObjectDetailSheet if it's an exhibit/artifact
      if (foundNode.objectId != null && (foundNode.nodeType == 'exhibit' || foundNode.nodeType == 'artifact')) {
        try {
          final obj = objects.firstWhere((o) => o.id == foundNode!.objectId);
          _showObjectDetail(obj);
        } catch (_) {}
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

  void _showObjectDetail(MuseumObject obj) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ObjectDetailSheet(
        obj: obj,
        onClose: () {
          Navigator.pop(context);
          if (mounted && isTourActive) _routeToNextTourStop();
        },
      ),
    );
  }

  FloorPlan? currentFloorPlan;

  @override
  Widget build(BuildContext context) {
    if (!isLoaded) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.grey),
              SizedBox(height: 16),
              Text('Loading museum data...', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    if (currentFloorPlan == null && allFloorPlans.isNotEmpty) {
      currentFloorPlan = allFloorPlans.first;
      positionService.updateContext(currentFloorPlan, allNodes, allEdges);
    }

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Museum Navigator', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Row(
              children: [
                Icon(
                  isOnline ? LucideIcons.wifi : LucideIcons.wifiOff,
                  size: 12,
                  color: isOnline ? Colors.green : Colors.amber,
                ),
                const SizedBox(width: 4),
                Text(
                  isOnline ? 'Online' : 'Offline mode',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ElevatedButton.icon(
              onPressed: _startFullTour,
              icon: const Icon(LucideIcons.map, size: 16, color: Colors.indigo),
              label: const Text('Tour', style: TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo[50],
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: ElevatedButton.icon(
              onPressed: _openScanner,
              icon: const Icon(LucideIcons.camera, size: 16, color: Colors.white),
              label: const Text('Scan QR', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo[600],
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // Status Banners
          if (scanResult == 'not-found')
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Icon(LucideIcons.alertCircle, size: 16, color: Colors.red[700]),
                  const SizedBox(width: 8),
                  Expanded(child: Text('QR code not recognized.', style: TextStyle(color: Colors.red[700], fontSize: 14))),
                ],
              ),
            ),
          if (scanResult == 'found')
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Icon(LucideIcons.checkCircle, size: 16, color: Colors.green[700]),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Location updated.', style: TextStyle(color: Colors.green[700], fontSize: 14))),
                ],
              ),
            ),
          if (scanResult == 'arrived')
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.indigo[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.indigo[200]!)),
              child: Row(
                children: [
                  Icon(LucideIcons.mapPin, size: 24, color: Colors.indigo[700]),
                  const SizedBox(width: 12),
                  Expanded(child: Text('You have arrived at your destination!', style: TextStyle(color: Colors.indigo[700], fontSize: 16, fontWeight: FontWeight.bold))),
                ],
              ),
            ),

          // Instructions Card
          if (currentRoute != null && currentRoute!.instructions.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.indigo[700],
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.indigo[800], borderRadius: const BorderRadius.only(topLeft: Radius.circular(16), bottomLeft: Radius.circular(16))),
                    child: const Icon(LucideIcons.navigation, color: Colors.white, size: 32),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('NEXT STEP', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                          const SizedBox(height: 4),
                          Text(
                            currentRoute!.instructions.length > 1 ? currentRoute!.instructions[1] : currentRoute!.instructions[0],
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, color: Colors.white54),
                    onPressed: () {
                      setState(() {
                        currentRoute = null;
                        destinationNode = null;
                        isTourActive = false;
                        positionService.stopSimulation();
                      });
                    },
                  )
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
                    allNodes: allNodes,
                    onNodeTap: (node) {
                      _calculateRoute(node);
                    },
                  )
                else
                  const Center(child: Text('No Map Data Available')),

                // Floor Selector
                if (allFloorPlans.length > 1)
                  Positioned(
                    right: 16,
                    bottom: 16,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
                      ),
                      child: Column(
                        children: allFloorPlans.map((fp) {
                          bool isSel = currentFloorPlan?.id == fp.id;
                          return InkWell(
                            onTap: () => setState(() => currentFloorPlan = fp),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: isSel ? Colors.indigo[50] : Colors.transparent,
                                border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
                              ),
                              child: Text(
                                'F${fp.floorNumber}',
                                style: TextStyle(fontWeight: FontWeight.bold, color: isSel ? Colors.indigo[700] : Colors.grey[700]),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Nearby / Discovery Panel
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 20, offset: Offset(0, -5))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Nearby Attractions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    if (currentPosition?.currentNodeId != null)
                      Text('Location established', style: TextStyle(fontSize: 12, color: Colors.green[600], fontWeight: FontWeight.bold))
                    else
                      const Text('Scan QR to find location', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                const SizedBox(height: 12),
                if (currentPosition?.currentNodeId != null && pathfindingService != null)
                  SizedBox(
                    height: 100,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: pathfindingService!.getNearbyNodes(currentPosition!.currentNodeId!, hops: 3).map((node) {
                        return GestureDetector(
                          onTap: () => _calculateRoute(node),
                          child: Container(
                            width: 140,
                            margin: const EdgeInsets.only(right: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: destinationNode?.id == node.id ? Colors.indigo[50] : Colors.white,
                              border: Border.all(color: destinationNode?.id == node.id ? Colors.indigo[200]! : Colors.grey[200]!),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(node.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                const SizedBox(height: 4),
                                Text(node.nodeType.toUpperCase(), style: TextStyle(fontSize: 10, color: Colors.grey[500], letterSpacing: 1.1)),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  )
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(16)),
                    child: Column(
                      children: [
                        Icon(LucideIcons.scanLine, size: 32, color: Colors.grey[400]),
                        const SizedBox(height: 8),
                        Text('Scan any checkpoint QR to begin.', style: TextStyle(color: Colors.grey[600])),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ], // End of Column children
      ),   // End of Column
    ], // End of Stack children
  ), // End of Stack
); // End of Scaffold
  }
}
