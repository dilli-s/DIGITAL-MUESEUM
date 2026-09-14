import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../config/api.dart';
import '../models/navigation_models.dart';
import '../services/wifi_fingerprint_service.dart';

class SurveyRoomItem {
  final String id;
  final String name;

  const SurveyRoomItem({required this.id, required this.name});
}

class WifiSurveyScreen extends StatefulWidget {
  final FloorPlan floorPlan;
  final List<dynamic>? rooms;
  final String? initialRoomId;

  const WifiSurveyScreen({
    super.key,
    required this.floorPlan,
    this.rooms,
    this.initialRoomId,
  });

  @override
  State<WifiSurveyScreen> createState() => _WifiSurveyScreenState();
}

class _WifiSurveyScreenState extends State<WifiSurveyScreen> {
  final WifiFingerprintService _wifiService = WifiFingerprintService();

  List<SurveyRoomItem> _availableRooms = [];
  String? _selectedRoomId;
  double? _selectedX;
  double? _selectedY;

  bool _isScanning = false;
  bool _isSaving = false;
  bool _isLoadingCoverage = false;
  WifiCoverageResult? _coverage;
  List<Map<String, dynamic>> _surveyedPoints = [];
  List<ScannedWifiNetwork> _detectedNetworks = [];
  final Set<String> _selectedBssids = {};
  bool _hasScanned = false;
  int _activeBottomTab = 1; // 0 = Detected Networks, 1 = Room Points
  String? _statusMessage;
  bool _isError = false;

  @override
  void initState() {
    super.initState();
    _initRooms();
  }

  Future<void> _initRooms() async {
    final mappingRooms = <SurveyRoomItem>[];

    // Fetch fresh from mapping service (canonical rooms with UUIDs)
    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/floor-plans/${widget.floorPlan.id}/rooms');
      final resp = await http.get(url).timeout(const Duration(seconds: 6));
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body);
        final list = body['data'] as List? ?? [];
        for (final item in list) {
          final id = item['id']?.toString();
          final name = item['name']?.toString();
          if (id != null && name != null && id.isNotEmpty) {
            mappingRooms.add(SurveyRoomItem(id: id, name: name));
          }
        }
      }
    } catch (e) {
      debugPrint('WifiSurveyScreen._initRooms fetch error: $e');
    }

    final roomsList = <SurveyRoomItem>[];
    if (mappingRooms.isNotEmpty) {
      roomsList.addAll(mappingRooms);
    } else if (widget.rooms != null && widget.rooms!.isNotEmpty) {
      // Fallback to widget.rooms only if mapping service returned no rooms
      final seen = <String>{};
      for (final r in widget.rooms!) {
        final id = r is Map ? r['id']?.toString() : (r.id?.toString());
        final name = r is Map ? r['name']?.toString() : (r.name?.toString());
        if (id != null && name != null && id.isNotEmpty && !seen.contains(id)) {
          seen.add(id);
          roomsList.add(SurveyRoomItem(id: id, name: name));
        }
      }
    }

    if (mounted) {
      String? nextSelectedId = _selectedRoomId;

      // Resolve initialRoomId (which may be a legacy gallery integer ID or name) to a valid room UUID
      if (widget.initialRoomId != null && widget.initialRoomId!.isNotEmpty) {
        final rawInit = widget.initialRoomId!;

        // 1. Direct ID match
        final directMatch = roomsList.firstWhere(
          (r) => r.id == rawInit,
          orElse: () => const SurveyRoomItem(id: '', name: ''),
        );
        if (directMatch.id.isNotEmpty) {
          nextSelectedId = directMatch.id;
        } else {
          // 2. Resolve via widget.rooms (e.g. Gallery id: 14 -> name: "Bathroom 2" -> mapping room UUID)
          String? initialName;
          if (widget.rooms != null) {
            for (final r in widget.rooms!) {
              final rId = r is Map ? r['id']?.toString() : (r.id?.toString());
              if (rId == rawInit) {
                initialName = r is Map ? r['name']?.toString() : (r.name?.toString());
                break;
              }
            }
          }
          initialName ??= rawInit;

          final nameMatch = roomsList.firstWhere(
            (r) => r.name.toLowerCase().trim() == initialName!.toLowerCase().trim(),
            orElse: () => const SurveyRoomItem(id: '', name: ''),
          );
          if (nameMatch.id.isNotEmpty) {
            nextSelectedId = nameMatch.id;
          }
        }
      }

      if (nextSelectedId == null || !roomsList.any((r) => r.id == nextSelectedId)) {
        if (roomsList.isNotEmpty) {
          nextSelectedId = roomsList.first.id;
        } else {
          nextSelectedId = null;
        }
      }

      setState(() {
        _availableRooms = roomsList;
        _selectedRoomId = nextSelectedId;
      });

      if (_selectedRoomId != null) {
        _loadRoomData(_selectedRoomId!);
      }
    }
  }

  Future<void> _loadRoomData(String roomId) async {
    setState(() {
      _isLoadingCoverage = true;
      _statusMessage = null;
    });

    final cov = await _wifiService.checkCoverage(roomId);
    final points = await _wifiService.getRoomFingerprints(roomId);

    if (mounted) {
      setState(() {
        _coverage = cov;
        _surveyedPoints = points;
        _isLoadingCoverage = false;
      });
    }
  }

  Future<void> _onScanPressed() async {
    if (!_wifiService.isSupported) {
      setState(() {
        _statusMessage = 'WiFi Scanning is not supported on iOS (Apple restricts WiFi network scanning).';
        _isError = true;
      });
      return;
    }

    if (_selectedRoomId == null) {
      setState(() {
        _statusMessage = 'Please select a room first.';
        _isError = true;
      });
      return;
    }

    if (_selectedX == null || _selectedY == null) {
      setState(() {
        _statusMessage = 'Tap a location on the floor plan first to place a survey pin.';
        _isError = true;
      });
      return;
    }

    setState(() {
      _isScanning = true;
      _statusMessage = 'Scanning nearby WiFi access points...';
      _isError = false;
      _activeBottomTab = 0;
    });

    final networks = await _wifiService.scanDetectedNetworks();
    if (!mounted) return;

    setState(() {
      _isScanning = false;
      _hasScanned = true;
      _detectedNetworks = networks;
      _selectedBssids.clear();
      if (networks.isNotEmpty) {
        // Default to checked for all detected networks
        _selectedBssids.addAll(networks.map((n) => n.bssid));
        _statusMessage = 'Detected ${networks.length} networks. Review and uncheck any to exclude, then tap "Save Point".';
        _isError = false;
      } else {
        _statusMessage = 'No networks detected — check WiFi is enabled';
        _isError = true;
      }
    });
  }

  Future<void> _onSavePointPressed() async {
    if (_selectedRoomId == null || _selectedX == null || _selectedY == null) {
      return;
    }

    final selectedReadings = _detectedNetworks
        .where((n) => _selectedBssids.contains(n.bssid))
        .map((n) => n.toReadingMap())
        .toList();

    if (selectedReadings.isEmpty) {
      setState(() {
        _statusMessage = 'Select at least one network before saving.';
        _isError = true;
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _statusMessage = 'Saving fingerprint with ${selectedReadings.length} selected networks...';
      _isError = false;
    });

    final success = await _wifiService.captureFingerprint(
      roomId: _selectedRoomId!,
      x: _selectedX!,
      y: _selectedY!,
      readings: selectedReadings,
    );

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    if (success) {
      final count = selectedReadings.length;
      final savedX = _selectedX!;
      final savedY = _selectedY!;
      setState(() {
        _statusMessage = 'Saved $count network${count == 1 ? '' : 's'} at point (${(savedX * 100).toStringAsFixed(1)}%, ${(savedY * 100).toStringAsFixed(1)}%)';
        _isError = false;
        _selectedX = null;
        _selectedY = null;
        _detectedNetworks = [];
        _selectedBssids.clear();
        _hasScanned = false;
        _activeBottomTab = 1;
      });

      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(LucideIcons.checkCircle2, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Saved $count network${count == 1 ? '' : 's'} at this point',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF059669),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
        ),
      );

      _loadRoomData(_selectedRoomId!);
    } else {
      setState(() {
        final err = _wifiService.lastErrorMessage;
        _statusMessage = (err != null && err.isNotEmpty)
            ? 'Failed to save fingerprint: $err'
            : 'Failed to save fingerprint to mapping service.';
        _isError = true;
      });
    }
  }

  Future<void> _onDeletePoint(String id) async {
    final success = await _wifiService.deleteFingerprint(id);
    if (success && mounted && _selectedRoomId != null) {
      _loadRoomData(_selectedRoomId!);
    }
  }

  Widget _buildDetectedNetworksView() {
    if (_isScanning) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Colors.cyanAccent),
            SizedBox(height: 12),
            Text(
              'Scanning nearby WiFi access points...',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
      );
    }

    if (!_hasScanned) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.scanLine, color: Colors.white24, size: 36),
              const SizedBox(height: 10),
              Text(
                _selectedX == null
                    ? 'Tap a location on the floor plan above to place a survey pin, then tap "Scan WiFi".'
                    : 'Survey pin placed! Tap "Scan WiFi" above to detect nearby networks.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white54, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    if (_detectedNetworks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.wifiOff, color: Colors.amberAccent, size: 36),
              const SizedBox(height: 10),
              const Text(
                'No networks detected — check WiFi is enabled',
                style: TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              const Text(
                'Ensure WiFi and device Location are enabled in Android settings, then tap "Rescan WiFi".',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white60, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    final allSelected = _selectedBssids.length == _detectedNetworks.length;

    return Column(
      children: [
        // Selection toolbar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_selectedBssids.length} of ${_detectedNetworks.length} selected for fingerprint',
                style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
              ),
              TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () {
                  setState(() {
                    if (allSelected) {
                      _selectedBssids.clear();
                    } else {
                      _selectedBssids.addAll(_detectedNetworks.map((n) => n.bssid));
                    }
                  });
                },
                child: Text(
                  allSelected ? 'Deselect All' : 'Select All',
                  style: const TextStyle(color: Colors.cyanAccent, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        // Network items list
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            itemCount: _detectedNetworks.length,
            separatorBuilder: (context, index) => const Divider(color: Colors.white10, height: 1),
            itemBuilder: (context, i) {
              final net = _detectedNetworks[i];
              final isChecked = _selectedBssids.contains(net.bssid);

              Color badgeColor;
              Color badgeBg;
              if (net.level >= -65) {
                badgeColor = const Color(0xFF34D399); // Strong: green
                badgeBg = const Color(0x2610B981);
              } else if (net.level >= -75) {
                badgeColor = const Color(0xFF38BDF8); // Moderate: light cyan
                badgeBg = const Color(0x260284C7);
              } else if (net.level >= -85) {
                badgeColor = const Color(0xFFFBBF24); // Fair: amber
                badgeBg = const Color(0x26D97706);
              } else {
                badgeColor = const Color(0xFFF87171); // Weak: red
                badgeBg = const Color(0x26DC2626);
              }

              return CheckboxListTile(
                dense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
                activeColor: Colors.cyanAccent,
                checkColor: Colors.black,
                controlAffinity: ListTileControlAffinity.leading,
                value: isChecked,
                onChanged: (bool? val) {
                  setState(() {
                    if (val == true) {
                      _selectedBssids.add(net.bssid);
                    } else {
                      _selectedBssids.remove(net.bssid);
                    }
                  });
                },
                title: Row(
                  children: [
                    Expanded(
                      child: Text(
                        net.isHidden ? 'Hidden network' : net.ssid,
                        style: TextStyle(
                          color: isChecked ? Colors.white : Colors.white38,
                          fontWeight: FontWeight.w600,
                          fontStyle: net.isHidden ? FontStyle.italic : FontStyle.normal,
                          fontSize: 13,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: badgeColor.withValues(alpha: 0.5), width: 0.8),
                      ),
                      child: Text(
                        '${net.level} dBm',
                        style: TextStyle(
                          color: badgeColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                subtitle: Row(
                  children: [
                    Text(
                      net.bssid,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: isChecked ? Colors.white60 : Colors.white24,
                      ),
                    ),
                    if (net.frequencyBand.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(
                        '• ${net.frequencyBand}',
                        style: TextStyle(
                          fontSize: 11,
                          color: isChecked ? Colors.cyanAccent.withValues(alpha: 0.7) : Colors.white24,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSavedPointsView() {
    if (_isLoadingCoverage) {
      return const Center(child: CircularProgressIndicator(color: Colors.cyanAccent));
    }

    if (_surveyedPoints.isEmpty) {
      return Center(
        child: Text(
          _selectedRoomId == null
              ? 'Select a room above'
              : 'No survey points yet. Tap on floor plan to survey.',
          style: const TextStyle(color: Colors.white38, fontSize: 13),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      itemCount: _surveyedPoints.length,
      separatorBuilder: (context, index) => const Divider(color: Colors.white12, height: 1),
      itemBuilder: (context, i) {
        final pt = _surveyedPoints[i];
        final xPct = ((pt['x'] as num?)?.toDouble() ?? 0.0) * 100;
        final yPct = ((pt['y'] as num?)?.toDouble() ?? 0.0) * 100;
        final readings = pt['readings'] as List? ?? [];
        final id = pt['id']?.toString() ?? '';

        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            radius: 12,
            backgroundColor: Colors.cyanAccent.withValues(alpha: 0.2),
            child: Text(
              '${i + 1}',
              style: const TextStyle(color: Colors.cyanAccent, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
          title: Text(
            'Point ${i + 1}: (${xPct.toStringAsFixed(1)}%, ${yPct.toStringAsFixed(1)}%)',
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            '${readings.length} APs surveyed',
            style: const TextStyle(color: Colors.white54, fontSize: 11),
          ),
          trailing: IconButton(
            icon: const Icon(LucideIcons.trash2, color: Colors.redAccent, size: 16),
            onPressed: () => _onDeletePoint(id),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isIos = !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
    final canSave = !isIos &&
        !_isScanning &&
        !_isSaving &&
        _selectedX != null &&
        _selectedY != null &&
        _selectedRoomId != null &&
        _selectedBssids.isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFF13171B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1B2228),
        foregroundColor: Colors.white,
        title: const Row(
          children: [
            Icon(LucideIcons.wifi, color: Colors.cyanAccent, size: 20),
            SizedBox(width: 8),
            Text('WiFi Survey Mode', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        actions: [
          if (_selectedRoomId != null)
            IconButton(
              icon: const Icon(LucideIcons.refreshCw, size: 18),
              onPressed: () => _loadRoomData(_selectedRoomId!),
              tooltip: 'Refresh',
            ),
        ],
      ),
      body: Column(
        children: [
          // iOS warning banner if on iOS
          if (isIos)
            Container(
              width: double.infinity,
              color: Colors.amber.shade900.withValues(alpha: 0.8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: const Row(
                children: [
                  Icon(LucideIcons.shieldAlert, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'iOS does not allow apps to scan nearby WiFi networks. This feature is Android-only.',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          // Room selector bar & Coverage badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFF1B2228),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: (_selectedRoomId != null &&
                              _availableRooms.any((room) => room.id == _selectedRoomId))
                          ? _selectedRoomId
                          : null,
                      dropdownColor: const Color(0xFF242C33),
                      isExpanded: true,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                      hint: const Text('Select a Room', style: TextStyle(color: Colors.white60)),
                      items: _availableRooms.map((room) {
                        return DropdownMenuItem<String>(
                          value: room.id,
                          child: Text(room.name, overflow: TextOverflow.ellipsis),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedRoomId = val;
                            _selectedX = null;
                            _selectedY = null;
                            _detectedNetworks = [];
                            _selectedBssids.clear();
                            _hasScanned = false;
                            _activeBottomTab = 1;
                          });
                          _loadRoomData(val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                if (_coverage != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _coverage!.isSparse
                          ? Colors.amber.shade900.withValues(alpha: 0.4)
                          : Colors.green.shade900.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _coverage!.isSparse ? Colors.amberAccent : Colors.greenAccent,
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _coverage!.isSparse ? LucideIcons.alertTriangle : LucideIcons.checkCircle2,
                          size: 13,
                          color: _coverage!.isSparse ? Colors.amberAccent : Colors.greenAccent,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          '${_coverage!.count} points',
                          style: TextStyle(
                            color: _coverage!.isSparse ? Colors.amberAccent : Colors.greenAccent,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // Status & Helper Message
          if (_statusMessage != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: _isError ? Colors.red.shade900.withValues(alpha: 0.6) : Colors.cyan.shade900.withValues(alpha: 0.6),
              child: Text(
                _statusMessage!,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
              ),
            ),

          // Floor Plan Interactive Canvas
          Expanded(
            flex: 5,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final displayW = constraints.maxWidth;
                final displayH = constraints.maxHeight;

                return GestureDetector(
                  onTapUp: (details) {
                    if (isIos) return;
                    final local = details.localPosition;
                    final nx = (local.dx / displayW).clamp(0.0, 1.0);
                    final ny = (local.dy / displayH).clamp(0.0, 1.0);
                    setState(() {
                      _selectedX = nx;
                      _selectedY = ny;
                      _detectedNetworks = [];
                      _selectedBssids.clear();
                      _hasScanned = false;
                      _statusMessage = 'Pin placed at (${(nx * 100).toStringAsFixed(1)}%, ${(ny * 100).toStringAsFixed(1)}%). Tap "Scan WiFi" to detect signals.';
                      _isError = false;
                      _activeBottomTab = 0;
                    });
                  },
                  child: Stack(
                    children: [
                      // Floor plan image
                      Positioned.fill(
                        child: widget.floorPlan.imageUrl.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: ApiConfig.getFloorPlanImageUrl(widget.floorPlan.imageUrl),
                                fit: BoxFit.contain,
                                placeholder: (context, url) => const Center(
                                  child: CircularProgressIndicator(color: Colors.cyanAccent),
                                ),
                                errorWidget: (context, url, error) => const Center(
                                  child: Text('Floor plan unavailable', style: TextStyle(color: Colors.white54)),
                                ),
                              )
                            : Container(color: const Color(0xFF1E262C)),
                      ),

                      // Existing Surveyed Points Markers
                      ..._surveyedPoints.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final p = entry.value;
                        final px = (p['x'] as num?)?.toDouble() ?? 0.0;
                        final py = (p['y'] as num?)?.toDouble() ?? 0.0;
                        return Positioned(
                          left: px * displayW - 10,
                          top: py * displayH - 10,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: Colors.cyanAccent.withValues(alpha: 0.85),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.black, width: 1.5),
                              boxShadow: const [
                                BoxShadow(color: Colors.cyan, blurRadius: 4, spreadRadius: 1),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                '${idx + 1}',
                                style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        );
                      }),

                      // Currently Selected Point Pin
                      if (_selectedX != null && _selectedY != null)
                        Positioned(
                          left: _selectedX! * displayW - 14,
                          top: _selectedY! * displayH - 28,
                          child: const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(LucideIcons.mapPin, color: Colors.amberAccent, size: 28),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Bottom Action Bar & Results Panel
          Expanded(
            flex: 5,
            child: Container(
              color: const Color(0xFF181F24),
              child: Column(
                children: [
                  // Action buttons bar
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                    child: Row(
                      children: [
                        // Button 1: Scan / Rescan
                        Expanded(
                          flex: 5,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isIos
                                  ? Colors.grey.shade700
                                  : (_selectedX != null ? const Color(0xFF0284C7) : Colors.grey.shade800),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: _isScanning
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Icon(LucideIcons.wifi, size: 18),
                            label: Text(
                              _isScanning
                                  ? 'Scanning...'
                                  : (_selectedX == null
                                      ? 'Place Pin First'
                                      : (_hasScanned ? 'Rescan WiFi' : 'Scan WiFi')),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                            onPressed: (isIos || _isScanning || _isSaving || _selectedX == null)
                                ? null
                                : _onScanPressed,
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Button 2: Save Point
                        Expanded(
                          flex: 5,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: canSave
                                  ? const Color(0xFF059669)
                                  : Colors.grey.shade800,
                              foregroundColor: canSave
                                  ? Colors.white
                                  : Colors.white38,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: _isSaving
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Icon(LucideIcons.checkCircle, size: 18),
                            label: Text(
                              _isSaving
                                  ? 'Saving...'
                                  : (_selectedBssids.isEmpty
                                      ? 'Save Point'
                                      : 'Save (${_selectedBssids.length} APs)'),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                            onPressed: canSave ? _onSavePointPressed : null,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Tab switcher bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      children: [
                        // Tab 0: Detected APs
                        InkWell(
                          onTap: () {
                            setState(() {
                              _activeBottomTab = 0;
                            });
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: _activeBottomTab == 0
                                  ? Colors.cyan.shade900.withValues(alpha: 0.6)
                                  : Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _activeBottomTab == 0
                                    ? Colors.cyanAccent.withValues(alpha: 0.8)
                                    : Colors.white12,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  LucideIcons.radio,
                                  size: 13,
                                  color: _activeBottomTab == 0 ? Colors.cyanAccent : Colors.white60,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'DETECTED (${_detectedNetworks.length})',
                                  style: TextStyle(
                                    color: _activeBottomTab == 0 ? Colors.white : Colors.white60,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Tab 1: Saved Points
                        InkWell(
                          onTap: () {
                            setState(() {
                              _activeBottomTab = 1;
                            });
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: _activeBottomTab == 1
                                  ? Colors.cyan.shade900.withValues(alpha: 0.6)
                                  : Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _activeBottomTab == 1
                                    ? Colors.cyanAccent.withValues(alpha: 0.8)
                                    : Colors.white12,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  LucideIcons.mapPin,
                                  size: 13,
                                  color: _activeBottomTab == 1 ? Colors.cyanAccent : Colors.white60,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'ROOM POINTS (${_surveyedPoints.length})',
                                  style: TextStyle(
                                    color: _activeBottomTab == 1 ? Colors.white : Colors.white60,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const Spacer(),
                        if (_activeBottomTab == 1 && _coverage != null && _coverage!.isSparse)
                          const Text(
                            'Warning: Sparse (<3)',
                            style: TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                      ],
                    ),
                  ),

                  // Tab Content
                  Expanded(
                    child: _activeBottomTab == 0
                        ? _buildDetectedNetworksView()
                        : _buildSavedPointsView(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
