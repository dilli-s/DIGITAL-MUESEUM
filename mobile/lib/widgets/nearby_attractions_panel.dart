import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';

/// Bottom panel displaying nearby attractions and orientation checkpoints when not following an active route.
class NearbyAttractionsPanel extends StatelessWidget {
  final List<MapNode> nearbyNodes;
  final bool hasPosition;
  final String? activeDestinationId;
  final ValueChanged<MapNode> onNodeTap;
  final List<Museum> museums;
  final Museum? selectedMuseum;
  final ValueChanged<Museum?>? onSelectMuseum;

  const NearbyAttractionsPanel({
    super.key,
    required this.nearbyNodes,
    required this.hasPosition,
    this.activeDestinationId,
    required this.onNodeTap,
    this.museums = const [],
    this.selectedMuseum,
    this.onSelectMuseum,
  });

  @override
  Widget build(BuildContext context) {
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.compass, size: 18, color: Colors.indigo[700]),
                  const SizedBox(width: 8),
                  const Text(
                    'Near You',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              if (hasPosition)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.green[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green[200]!),
                  ),
                  child: Text(
                    'Live Location',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.green[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              else
                const Text(
                  'Scan QR to find location',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (hasPosition && nearbyNodes.isNotEmpty)
            SizedBox(
              height: 100,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: nearbyNodes.map((node) {
                  final bool isSelected = activeDestinationId == node.id;
                  return GestureDetector(
                    onTap: () => onNodeTap(node),
                    child: Container(
                      width: 140,
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.indigo[50] : Colors.white,
                        border: Border.all(
                          color: isSelected
                              ? Colors.indigo[200]!
                              : Colors.grey[200]!,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            node.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            node.nodeType.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey[500],
                              letterSpacing: 1.1,
                            ),
                          ),
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
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Icon(
                    LucideIcons.scanLine,
                    size: 32,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Scan any checkpoint QR to begin.',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  if (museums.isNotEmpty && onSelectMuseum != null) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 12),
                    const Text(
                      'OR MANUALLY SELECT A MUSEUM',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                        letterSpacing: 1.1,
                      ),
                    ),
                    Builder(
                      builder: (context) {
                        final uniqueMuseums = <int, Museum>{};
                        for (final m in museums) {
                          uniqueMuseums.putIfAbsent(m.id, () => m);
                        }
                        final itemsList = uniqueMuseums.values.toList();
                        final validInitial = (selectedMuseum != null &&
                                itemsList.any((m) => m.id == selectedMuseum!.id))
                            ? itemsList.firstWhere((m) => m.id == selectedMuseum!.id)
                            : null;

                        return DropdownButtonFormField<Museum>(
                          initialValue: validInitial,
                          decoration: InputDecoration(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Colors.grey[300]!),
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
                          onChanged: onSelectMuseum,
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}
