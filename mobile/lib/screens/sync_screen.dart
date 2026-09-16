import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/museum_provider.dart';
import '../models/navigation_models.dart';
import '../services/offline_store.dart';
import 'museum_selection_screen.dart';
import 'physical_museum_screen.dart';

class SyncScreen extends StatefulWidget {
  final int museumId;
  final String? initialFloorPlanId;
  final String? entranceNodeId;
  final bool forceSync;

  const SyncScreen({
    super.key,
    required this.museumId,
    this.initialFloorPlanId,
    this.entranceNodeId,
    this.forceSync = false,
  });

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> with SingleTickerProviderStateMixin {
  final OfflineStore _offlineStore = OfflineStore();

  int _progress = 0;
  String _statusMessage = 'Connecting to museum server...';
  String? _errorMessage;
  bool _isComplete = false;
  bool _canContinueOffline = false;
  List<FloorPlan> _floorPlans = [];

  late AnimationController _animController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startSync();
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _startSync() async {
    setState(() {
      _progress = 0;
      _statusMessage = 'Initializing offline preparation...';
      _errorMessage = null;
      _canContinueOffline = false;
    });

    try {
      // Check if already synced and recent
      final cachedMuseumId = await _offlineStore.getSyncedMuseumId();
      final cachedNodes = await _offlineStore.getNodes();
      final cachedFloorPlans = await _offlineStore.getFloorPlans();

      final hasMatchingFloor = widget.initialFloorPlanId == null ||
          cachedFloorPlans.any((p) => p.id == widget.initialFloorPlanId);

      if (!widget.forceSync &&
          cachedMuseumId == widget.museumId &&
          cachedNodes.isNotEmpty &&
          cachedFloorPlans.isNotEmpty &&
          hasMatchingFloor) {
        // Fast-path: local data already cached
        setState(() {
          _progress = 100;
          _statusMessage = 'Offline data verified!';
          _isComplete = true;
        });
        _floorPlans = cachedFloorPlans;
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) _proceedToMuseum();
        return;
      }

      // Perform full museum-scoped sync
      final result = await _offlineStore.syncMuseum(
        widget.museumId,
        (percent, message) {
          if (mounted) {
            setState(() {
              _progress = percent;
              _statusMessage = message;
            });
          }
        },
      );

      _floorPlans = (result['floor_plans'] as List<FloorPlan>?) ?? [];

      if (mounted) {
        setState(() {
          _progress = 100;
          _statusMessage = 'Ready for offline use!';
          _isComplete = true;
        });

        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) {
          _proceedToMuseum();
        }
      }
    } catch (e) {
      debugPrint('SyncScreen error: $e');
      List<MapNode> cachedNodes = [];
      try {
        cachedNodes = await _offlineStore.getNodes();
      } catch (_) {}
      final hasCachedData = cachedNodes.isNotEmpty;

      if (mounted) {
        setState(() {
          _errorMessage = hasCachedData
              ? 'Unable to refresh online data. You can continue with existing offline content.'
              : 'Failed to download museum guide: ${e.toString().replaceAll("Exception: ", "")}';
          _canContinueOffline = hasCachedData;
        });
      }
    }
  }

  void _proceedToMuseum() {
    final provider = context.read<MuseumProvider>();
    provider.setSelectedMuseum(widget.museumId);

    // Resolve floor plan
    String? floorId = widget.initialFloorPlanId;
    if ((floorId == null || !_floorPlans.any((p) => p.id == floorId)) &&
        _floorPlans.isNotEmpty) {
      floorId = _floorPlans.first.id;
    }
    if (floorId != null) {
      provider.setSelectedFloor(floorId);
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => PhysicalMuseumScreen(
          initialEntranceNodeId: widget.entranceNodeId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF17211F),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24.0),
          child: Column(
            children: [
              const SizedBox(height: 20),
              // Top branding
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          LucideIcons.compass,
                          size: 14,
                          color: Color(0xFFE2847A),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'VANALOK OFFLINE SETUP',
                          style: TextStyle(
                            color: Color(0xFFE2847A),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Spacer(flex: 2),

              // Animated Icon & Title
              ScaleTransition(
                scale: _isComplete ? const AlwaysStoppedAnimation(1.0) : _pulseAnimation,
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: _errorMessage != null
                          ? [const Color(0xFF7A2E2E), const Color(0xFF4A1A1A)]
                          : _isComplete
                              ? [const Color(0xFF2E6A4B), const Color(0xFF1E4631)]
                              : [const Color(0xFFD65F45), const Color(0xFF8F3924)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_errorMessage != null
                                ? const Color(0xFFD64545)
                                : const Color(0xFFD65F45))
                            .withValues(alpha: 0.35),
                        blurRadius: 28,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Icon(
                      _errorMessage != null
                          ? LucideIcons.alertCircle
                          : _isComplete
                              ? LucideIcons.check
                              : LucideIcons.downloadCloud,
                      size: 44,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),

              Text(
                _errorMessage != null
                    ? 'Download Interrupted'
                    : _isComplete
                        ? 'Download Complete'
                        : 'Preparing Museum Guide',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  _errorMessage ?? _statusMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _errorMessage != null
                        ? const Color(0xFFF09898)
                        : const Color(0xFFB5C0BD),
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ),

              const SizedBox(height: 36),

              // Progress Bar
              if (_errorMessage == null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: _progress / 100.0,
                    minHeight: 8,
                    backgroundColor: Colors.white.withValues(alpha: 0.1),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _isComplete ? const Color(0xFF48A774) : const Color(0xFFD65F45),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '$_progress%',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _isComplete ? 'Launching...' : 'Airplane-mode ready',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],

              const Spacer(flex: 3),

              // Checklist / Steps
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  children: [
                    _buildStepRow(
                      icon: LucideIcons.building,
                      label: 'Galleries & Floor Plans',
                      isDone: _progress >= 20,
                    ),
                    const Divider(color: Colors.white10, height: 16),
                    _buildStepRow(
                      icon: LucideIcons.landmark,
                      label: 'Artifacts & Metadata',
                      isDone: _progress >= 40,
                    ),
                    const Divider(color: Colors.white10, height: 16),
                    _buildStepRow(
                      icon: LucideIcons.mapPin,
                      label: 'Indoor Routing Graph',
                      isDone: _progress >= 60,
                    ),
                    const Divider(color: Colors.white10, height: 16),
                    _buildStepRow(
                      icon: LucideIcons.bookOpen,
                      label: 'Stories & Learning Content',
                      isDone: _progress >= 75,
                    ),
                    const Divider(color: Colors.white10, height: 16),
                    _buildStepRow(
                      icon: LucideIcons.headphones,
                      label: 'Audio & High-Res Images',
                      isDone: _progress >= 95,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Action buttons on error
              if (_errorMessage != null) ...[
                if (_canContinueOffline) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _proceedToMuseum,
                      icon: const Icon(LucideIcons.arrowRight, size: 18),
                      label: const Text('Continue with Offline Data'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2E6A4B),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => const MuseumSelectionScreen(
                                showBackButton: false,
                              ),
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white70,
                          side: const BorderSide(color: Colors.white24),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text('Back to List'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _startSync,
                        icon: const Icon(LucideIcons.refreshCw, size: 16),
                        label: const Text('Retry'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD65F45),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepRow({
    required IconData icon,
    required String label,
    required bool isDone,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: isDone ? const Color(0xFF48A774) : Colors.white38,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: isDone ? Colors.white : Colors.white54,
              fontSize: 13,
              fontWeight: isDone ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
        if (isDone)
          const Icon(
            LucideIcons.checkCircle2,
            size: 16,
            color: Color(0xFF48A774),
          )
        else
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(
                Colors.white.withValues(alpha: 0.2),
              ),
            ),
          ),
      ],
    );
  }
}
