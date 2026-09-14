import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/pathfinding.dart';

/// Modal bottom sheet displaying detailed step-by-step turn instructions.
class TurnByTurnStepsModal extends StatelessWidget {
  final RouteResult currentRoute;
  final VoidCallback? onClose;

  const TurnByTurnStepsModal({
    super.key,
    required this.currentRoute,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    LucideIcons.listOrdered,
                    color: Colors.indigo[700],
                    size: 22,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Turn-by-Turn Steps',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(LucideIcons.x),
                onPressed: onClose ?? () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(),
          Expanded(
            child: ListView.separated(
              itemCount: currentRoute.instructions.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, idx) {
                final stepText = currentRoute.instructions[idx];
                IconData stepIcon = LucideIcons.arrowUp;
                if (stepText.toLowerCase().contains('right')) {
                  stepIcon = LucideIcons.cornerUpRight;
                } else if (stepText.toLowerCase().contains('left')) {
                  stepIcon = LucideIcons.cornerUpLeft;
                } else if (stepText.toLowerCase().contains('stairs') ||
                    stepText.toLowerCase().contains('elevator')) {
                  stepIcon = LucideIcons.layers;
                } else if (stepText.toLowerCase().contains('arrive')) {
                  stepIcon = LucideIcons.checkCircle2;
                } else if (stepText.toLowerCase().contains('start')) {
                  stepIcon = LucideIcons.mapPin;
                }

                final isFirst = idx == 0;
                final isLast = idx == currentRoute.instructions.length - 1;

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isFirst
                        ? Colors.green[100]
                        : (isLast ? Colors.pink[100] : Colors.indigo[50]),
                    child: Icon(
                      stepIcon,
                      color: isFirst
                          ? Colors.green[700]
                          : (isLast ? Colors.pink[700] : Colors.indigo[700]),
                      size: 18,
                    ),
                  ),
                  title: Text(
                    stepText,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  subtitle: Text(
                    'Step ${idx + 1}',
                    style: TextStyle(color: Colors.grey[500], fontSize: 11),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
