import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/navigation_models.dart';
import '../services/pathfinding.dart';

/// Interactive bottom drawer HUD displayed when an active route is being followed.
/// Features a compact peek mode that keeps the museum map fully visible and an
/// expandable drawer with complete route details, nearby points, and quick actions.
class NavigationRoutePanel extends StatefulWidget {
  final MapNode destinationNode;
  final RouteResult currentRoute;
  final String startLocationText;
  final VoidCallback onCancel;
  final VoidCallback onEditStartNode;
  final VoidCallback onViewSteps;
  final VoidCallback onScanArtifact;
  final VoidCallback onMarkVisited;
  final List<MapNode> nearbyNodes;
  final ValueChanged<MapNode>? onSelectNearbyNode;
  final bool initiallyExpanded;

  const NavigationRoutePanel({
    super.key,
    required this.destinationNode,
    required this.currentRoute,
    required this.startLocationText,
    required this.onCancel,
    required this.onEditStartNode,
    required this.onViewSteps,
    required this.onScanArtifact,
    required this.onMarkVisited,
    this.nearbyNodes = const [],
    this.onSelectNearbyNode,
    this.initiallyExpanded = false,
  });

  @override
  State<NavigationRoutePanel> createState() => _NavigationRoutePanelState();
}

class _NavigationRoutePanelState extends State<NavigationRoutePanel> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initiallyExpanded;
  }

  void _toggleExpanded() {
    setState(() {
      _isExpanded = !_isExpanded;
    });
  }

  @override
  Widget build(BuildContext context) {
    final double distMeters = widget.currentRoute.distance;
    int walkMinutes = (distMeters / (1.4 * 60)).ceil();
    if (walkMinutes < 1) walkMinutes = 1;

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity! < -100) {
          if (!_isExpanded) setState(() => _isExpanded = true);
        } else if (details.primaryVelocity! > 100) {
          if (_isExpanded) setState(() => _isExpanded = false);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 4,
              offset: const Offset(0, -1),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOutCubic,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top drag handle bar
                Center(
                  child: InkWell(
                    onTap: _toggleExpanded,
                    borderRadius: BorderRadius.circular(10),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Container(
                        width: 36,
                        height: 4.5,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ),
                ),

                if (!_isExpanded)
                  // COMPACT / PEEK MODE (Unobtrusive & Clean)
                  _buildPeekContent(walkMinutes, distMeters)
                else
                  // EXPANDED DRAWER MODE (Full Details & Controls)
                  _buildExpandedContent(walkMinutes, distMeters),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Compact peek view that occupies minimal vertical space to leave the map clear
  Widget _buildPeekContent(int walkMinutes, double distMeters) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 12, bottom: 12),
      child: Row(
        children: [
          // Navigation Indicator Icon
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.indigo.shade600, Colors.indigo.shade800],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.indigo.withValues(alpha: 0.28),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.navigation,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),

          // Destination Name & Live ETA
          Expanded(
            child: InkWell(
              onTap: _toggleExpanded,
              borderRadius: BorderRadius.circular(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.destinationNode.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.clock,
                        size: 13,
                        color: Colors.indigo.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '~$walkMinutes min',
                        style: TextStyle(
                          color: Colors.indigo.shade700,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 3,
                        height: 3,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.grey.shade400,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        LucideIcons.footprints,
                        size: 13,
                        color: Colors.indigo.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${distMeters.round()} m',
                        style: TextStyle(
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Quick "Arrived" button
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onMarkVisited,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      LucideIcons.checkCircle2,
                      size: 14,
                      color: Colors.green.shade700,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'Arrived',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.green.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),

          // Expand Chevron Toggle
          IconButton(
            icon: const Icon(LucideIcons.chevronUp, size: 22, color: Color(0xFF64748B)),
            tooltip: 'Expand route details',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            onPressed: _toggleExpanded,
          ),
        ],
      ),
    );
  }

  /// Full expanded view with all route controls, nearby items, and actions
  Widget _buildExpandedContent(int walkMinutes, double distMeters) {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header: Title + Collapse & Cancel Actions
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'NAVIGATING TO',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.indigo.shade700,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.destinationNode.name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(LucideIcons.chevronDown, color: Color(0xFF64748B), size: 22),
                tooltip: 'Collapse drawer',
                onPressed: _toggleExpanded,
              ),
              IconButton(
                icon: const Icon(LucideIcons.x, color: Color(0xFF94A3B8), size: 20),
                tooltip: 'Cancel Navigation',
                onPressed: widget.onCancel,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Walk Time & Distance Estimate Box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.indigo.shade50.withValues(alpha: 0.8),
                  Colors.indigo.shade50.withValues(alpha: 0.4),
                ],
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.indigo.shade100),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.clock,
                      size: 18,
                      color: Colors.indigo.shade700,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '~$walkMinutes min walk',
                      style: TextStyle(
                        color: Colors.indigo.shade900,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Icon(
                      LucideIcons.footprints,
                      size: 18,
                      color: Colors.indigo.shade700,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${distMeters.round()} m distance',
                      style: TextStyle(
                        color: Colors.indigo.shade900,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // "From [Location]" with Edit option
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.mapPin, size: 15, color: Colors.indigo.shade600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'From: ${widget.startLocationText}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF334155),
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                TextButton.icon(
                  onPressed: widget.onEditStartNode,
                  icon: const Icon(LucideIcons.edit3, size: 13),
                  label: const Text(
                    'Edit',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.indigo.shade700,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Near You Section (if exhibits/checkpoints exist along the route)
          if (widget.nearbyNodes.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.compass, size: 14, color: Colors.indigo.shade600),
                      const SizedBox(width: 6),
                      const Text(
                        'Near You',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 32,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: widget.nearbyNodes.take(6).length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (context, idx) {
                        final node = widget.nearbyNodes[idx];
                        return InkWell(
                          onTap: () => widget.onSelectNearbyNode?.call(node),
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.indigo.shade100),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  node.objectId != null ? LucideIcons.image : LucideIcons.mapPin,
                                  size: 13,
                                  color: Colors.indigo.shade700,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  node.name,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.indigo.shade900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Action Buttons: View Steps & Scan Artifact
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: widget.onViewSteps,
                  icon: const Icon(LucideIcons.listOrdered, size: 16),
                  label: const Text(
                    'View steps',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(color: Colors.indigo.shade600),
                    foregroundColor: Colors.indigo.shade700,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: widget.onScanArtifact,
                  icon: const Icon(LucideIcons.qrCode, size: 16),
                  label: const Text(
                    'Scan artifact',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(color: Colors.indigo.shade600),
                    foregroundColor: Colors.indigo.shade700,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Primary Full-Width Mark Visited Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: widget.onMarkVisited,
              icon: const Icon(
                LucideIcons.checkCircle2,
                color: Colors.white,
                size: 18,
              ),
              label: const Text(
                'Mark Visited',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.2,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
