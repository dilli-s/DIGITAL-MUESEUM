import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/navigation_models.dart';
import '../services/pathfinding.dart';

/// Bottom panel HUD displayed when an active route is being followed.
class NavigationRoutePanel extends StatelessWidget {
  final MapNode destinationNode;
  final RouteResult currentRoute;
  final String startLocationText;
  final VoidCallback onCancel;
  final VoidCallback onEditStartNode;
  final VoidCallback onViewSteps;
  final VoidCallback onScanArtifact;
  final VoidCallback onMarkVisited;

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
  });

  @override
  Widget build(BuildContext context) {
    final double distMeters = currentRoute.distance;
    int walkMinutes = (distMeters / (1.4 * 60)).ceil();
    if (walkMinutes < 1) walkMinutes = 1;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 20,
            offset: Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Row 1: Destination Title + Close Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Navigating to',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.indigo[600],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      destinationNode.name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(LucideIcons.x, color: Colors.grey),
                tooltip: 'Cancel Navigation',
                onPressed: onCancel,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Row 2: Walk Time & Distance Estimate
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.indigo[50]?.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.indigo[100]!),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.clock,
                      size: 18,
                      color: Colors.indigo[700],
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '~$walkMinutes min walk',
                      style: TextStyle(
                        color: Colors.indigo[900],
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
                      color: Colors.indigo[700],
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${distMeters.round()} m distance',
                      style: TextStyle(
                        color: Colors.indigo[900],
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

          // Row 3: "From [Location]" with Edit option
          Row(
            children: [
              Icon(LucideIcons.mapPin, size: 16, color: Colors.indigo[600]),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'From: $startLocationText',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[800],
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton.icon(
                onPressed: onEditStartNode,
                icon: const Icon(LucideIcons.edit3, size: 14),
                label: const Text(
                  'Edit',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Row 4: Action Buttons (View Steps, Scan Artifact, Mark Visited)
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onViewSteps,
                  icon: const Icon(LucideIcons.listOrdered, size: 16),
                  label: const Text(
                    'View steps',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(color: Colors.indigo[600]!),
                    foregroundColor: Colors.indigo[700],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onScanArtifact,
                  icon: const Icon(LucideIcons.qrCode, size: 16),
                  label: const Text(
                    'Scan artifact',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(color: Colors.indigo[600]!),
                    foregroundColor: Colors.indigo[700],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onMarkVisited,
              icon: const Icon(
                LucideIcons.checkCircle,
                color: Colors.white,
                size: 18,
              ),
              label: const Text(
                'Mark Visited',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo[600],
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
