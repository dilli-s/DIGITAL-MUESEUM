import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/navigation_models.dart';

/// Modal bottom sheet allowing visitors to select or override the starting route node.
class StartNodePickerModal extends StatelessWidget {
  final List<MapNode> allNodes;
  final MapNode? customStartNode;
  final ValueChanged<MapNode?> onSelectStartNode;
  final VoidCallback? onClose;

  const StartNodePickerModal({
    super.key,
    required this.allNodes,
    required this.customStartNode,
    required this.onSelectStartNode,
    this.onClose,
  });

  bool _isEntrance(MapNode n) => n.nodeType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .contains('entrance');

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Choose Starting Location',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(LucideIcons.x),
                onPressed: onClose ?? () => Navigator.pop(context),
              ),
            ],
          ),
          const Text(
            'Default is visitor live position. Pick another node to preview or test route.',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
          const SizedBox(height: 12),
          ListTile(
            leading: const Icon(LucideIcons.navigation, color: Colors.blue),
            title: const Text(
              'Live Visitor Position',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: const Text('Fused GPS + PDR + Sensor Checkpoint'),
            trailing: customStartNode == null
                ? const Icon(LucideIcons.check, color: Colors.green)
                : null,
            onTap: () {
              Navigator.pop(context);
              onSelectStartNode(null);
            },
          ),
          const Divider(),
          Expanded(
            child: ListView(
              children: allNodes.map((n) {
                final bool isCurrentSelection = customStartNode?.id == n.id;
                return ListTile(
                  leading: Icon(
                    _isEntrance(n)
                        ? LucideIcons.doorOpen
                        : (n.nodeType == 'exhibit'
                            ? LucideIcons.image
                            : LucideIcons.mapPin),
                    color: isCurrentSelection ? Colors.indigo : Colors.grey[600],
                  ),
                  title: Text(
                    n.name,
                    style: TextStyle(
                      fontWeight: isCurrentSelection
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  ),
                  subtitle: Text(
                    'Floor ${n.floor} • ${n.nodeType.toUpperCase()}',
                  ),
                  trailing: isCurrentSelection
                      ? const Icon(LucideIcons.check, color: Colors.indigo)
                      : null,
                  onTap: () {
                    Navigator.pop(context);
                    onSelectStartNode(n);
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
