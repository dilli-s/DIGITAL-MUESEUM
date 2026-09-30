import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';

/// Bottom drawer displaying nearby attractions and orientation checkpoints when not following an active route.
/// Supports a compact peek mode to keep the museum map clear and expandable drawer for discovery.
class NearbyAttractionsPanel extends StatefulWidget {
  final List<MapNode> nearbyNodes;
  final bool hasPosition;
  final String? activeDestinationId;
  final ValueChanged<MapNode> onNodeTap;
  final List<Museum> museums;
  final Museum? selectedMuseum;
  final ValueChanged<Museum?>? onSelectMuseum;
  final bool initiallyExpanded;

  const NearbyAttractionsPanel({
    super.key,
    required this.nearbyNodes,
    required this.hasPosition,
    this.activeDestinationId,
    required this.onNodeTap,
    this.museums = const [],
    this.selectedMuseum,
    this.onSelectMuseum,
    this.initiallyExpanded = false,
  });

  @override
  State<NearbyAttractionsPanel> createState() => _NearbyAttractionsPanelState();
}

class _NearbyAttractionsPanelState extends State<NearbyAttractionsPanel> {
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
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle bar
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

                // Drawer Header (Interactive Tap to Toggle)
                InkWell(
                  onTap: _toggleExpanded,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.indigo.shade50,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                LucideIcons.compass,
                                size: 18,
                                color: Colors.indigo.shade700,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Near You',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1E293B),
                                  ),
                                ),
                                if (widget.hasPosition && widget.nearbyNodes.isNotEmpty)
                                  Text(
                                    '${widget.nearbyNodes.length} exhibits & spots nearby',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            if (widget.hasPosition)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFECFDF5),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Color(0xFF10B981),
                                      ),
                                    ),
                                    const SizedBox(width: 5),
                                    const Text(
                                      'Live Location',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF047857),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              const Text(
                                'Scan QR to find location',
                                style: TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                            const SizedBox(width: 6),
                            IconButton(
                              icon: Icon(
                                _isExpanded
                                    ? LucideIcons.chevronDown
                                    : LucideIcons.chevronUp,
                                size: 20,
                                color: const Color(0xFF64748B),
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              onPressed: _toggleExpanded,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded Discovery Content
                if (_isExpanded) ...[
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _buildDiscoveryBody(),
                  ),
                  const SizedBox(height: 14),
                ] else ...[
                  const SizedBox(height: 10),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDiscoveryBody() {
    if (widget.hasPosition && widget.nearbyNodes.isNotEmpty) {
      return SizedBox(
        height: 100,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: widget.nearbyNodes.map((node) {
            final bool isSelected = widget.activeDestinationId == node.id;
            return GestureDetector(
              onTap: () => widget.onNodeTap(node),
              child: Container(
                width: 140,
                margin: const EdgeInsets.only(right: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.indigo.shade50 : Colors.white,
                  border: Border.all(
                    color: isSelected
                        ? Colors.indigo.shade300
                        : Colors.grey.shade200,
                    width: isSelected ? 1.5 : 1.0,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      node.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: isSelected ? Colors.indigo.shade900 : const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      node.nodeType.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        color: isSelected ? Colors.indigo.shade600 : Colors.grey.shade500,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      );
    } else {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          children: [
            Icon(
              LucideIcons.scanLine,
              size: 28,
              color: Colors.indigo.shade300,
            ),
            const SizedBox(height: 8),
            Text(
              'Scan any checkpoint QR to orient your live position.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            if (widget.museums.isNotEmpty && widget.onSelectMuseum != null) ...[
              const SizedBox(height: 14),
              const Divider(),
              const SizedBox(height: 10),
              const Text(
                'OR MANUALLY SELECT A MUSEUM',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Builder(
                builder: (context) {
                  final uniqueMuseums = <int, Museum>{};
                  for (final m in widget.museums) {
                    uniqueMuseums.putIfAbsent(m.id, () => m);
                  }
                  final itemsList = uniqueMuseums.values.toList();
                  final validInitial = (widget.selectedMuseum != null &&
                          itemsList.any((m) => m.id == widget.selectedMuseum!.id))
                      ? itemsList.firstWhere((m) => m.id == widget.selectedMuseum!.id)
                      : null;

                  return DropdownButtonFormField<Museum>(
                    initialValue: validInitial,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    items: itemsList.map((m) {
                      return DropdownMenuItem<Museum>(
                        value: m,
                        child: Text(
                          m.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: widget.onSelectMuseum,
                  );
                },
              ),
            ],
          ],
        ),
      );
    }
  }
}
