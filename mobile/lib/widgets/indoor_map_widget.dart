import 'dart:math';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../models/navigation_models.dart';
import '../services/indoor_positioning.dart';

class IndoorMapWidget extends StatefulWidget {
  final FloorPlan floorPlan;
  final PositionState? currentPosition;
  final List<MapNode> routePath;
  final List<MapNode> allNodes;
  final Function(MapNode) onNodeTap;

  const IndoorMapWidget({
    super.key,
    required this.floorPlan,
    this.currentPosition,
    this.routePath = const [],
    this.allNodes = const [],
    required this.onNodeTap,
  });

  @override
  State<IndoorMapWidget> createState() => _IndoorMapWidgetState();
}

class _IndoorMapWidgetState extends State<IndoorMapWidget> {
  final TransformationController _transformController = TransformationController();

  @override
  void didUpdateWidget(IndoorMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Optionally auto-pan to user if position changes significantly
    // But usually we let the user pan freely or have a recenter button outside
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate the scale to fit the map in the view initially
        double scale = constraints.maxWidth / widget.floorPlan.widthPx;
        double displayHeight = widget.floorPlan.heightPx * scale;

        return InteractiveViewer(
          transformationController: _transformController,
          minScale: 0.5,
          maxScale: 5.0,
          constrained: true,
          child: Stack(
            children: [
              // 1. The Map Image
              Positioned.fill(
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: widget.floorPlan.imageUrl,
                    fit: BoxFit.contain,
                    width: constraints.maxWidth,
                    height: displayHeight,
                    placeholder: (context, url) => const Center(child: CircularProgressIndicator()),
                    errorWidget: (context, url, error) => const Center(child: Icon(Icons.error)),
                  ),
                ),
              ),
              
              // 2. The Custom Painter for Routes and Nodes
              Positioned.fill(
                child: Center(
                  child: SizedBox(
                    width: constraints.maxWidth,
                    height: displayHeight,
                    child: GestureDetector(
                      onTapUp: (details) {
                        // Find if a node was tapped
                        final RenderBox box = context.findRenderObject() as RenderBox;
                        final localOffset = box.globalToLocal(details.globalPosition);
                        
                        // Need to adjust tap based on scale
                        final x = localOffset.dx / scale;
                        final y = localOffset.dy / scale;
                        
                        // Find closest node
                        for (var node in widget.allNodes) {
                          if (node.floor != widget.floorPlan.floorNumber) continue;
                          final dx = node.x - x;
                          final dy = node.y - y;
                          final dist = (dx * dx) + (dy * dy);
                          if (dist < 900) { // roughly 30px radius tap target
                            widget.onNodeTap(node);
                            break;
                          }
                        }
                      },
                      child: CustomPaint(
                        painter: _IndoorMapPainter(
                          scale: scale,
                          routePath: widget.routePath.where((n) => n.floor == widget.floorPlan.floorNumber).toList(),
                          allNodes: widget.allNodes.where((n) => n.floor == widget.floorPlan.floorNumber).toList(),
                          currentPosition: widget.currentPosition?.floor == widget.floorPlan.floorNumber 
                              ? widget.currentPosition 
                              : null,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      }
    );
  }
}

class _IndoorMapPainter extends CustomPainter {
  final double scale;
  final List<MapNode> routePath;
  final List<MapNode> allNodes;
  final PositionState? currentPosition;

  _IndoorMapPainter({
    required this.scale,
    required this.routePath,
    required this.allNodes,
    this.currentPosition,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Draw route line
    if (routePath.length > 1) {
      final paint = Paint()
        ..color = Colors.indigo.withOpacity(0.8)
        ..strokeWidth = 8.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      final path = Path();
      path.moveTo(routePath[0].x * scale, routePath[0].y * scale);
      for (int i = 1; i < routePath.length; i++) {
        path.lineTo(routePath[i].x * scale, routePath[i].y * scale);
      }
      canvas.drawPath(path, paint);
      
      // Dashed inner line for style
      final innerPaint = Paint()
        ..color = Colors.indigoAccent
        ..strokeWidth = 4.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;
        
      // Flutter doesn't have native dashed paths, but we can fake it or just use a solid inner line
      canvas.drawPath(path, innerPaint);
    }

    // Draw all nodes (small dots)
    final nodePaint = Paint()..color = Colors.grey.withOpacity(0.5)..style = PaintingStyle.fill;
    for (var node in allNodes) {
      canvas.drawCircle(Offset(node.x * scale, node.y * scale), 4.0, nodePaint);
    }
    
    // Draw route destination (if any)
    if (routePath.isNotEmpty) {
      final dest = routePath.last;
      canvas.drawCircle(
        Offset(dest.x * scale, dest.y * scale), 
        10.0, 
        Paint()..color = Colors.red
      );
      canvas.drawCircle(
        Offset(dest.x * scale, dest.y * scale), 
        10.0, 
        Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3.0
      );
    }

    // Draw current position
    if (currentPosition != null) {
      final x = currentPosition!.x * scale;
      final y = currentPosition!.y * scale;

      // Accuracy circle
      canvas.drawCircle(
        Offset(x, y), 
        currentPosition!.accuracy * 5.0 * scale, // just a visual multiplier
        Paint()..color = Colors.blue.withOpacity(0.2)
      );

      // Marker
      canvas.drawCircle(
        Offset(x, y), 
        12.0, 
        Paint()..color = Colors.white
      );
      canvas.drawCircle(
        Offset(x, y), 
        10.0, 
        Paint()..color = Colors.blueAccent
      );

      // Heading indicator (triangle pointing in heading direction)
      // Note: Flutter canvas rotations can be tricky, we'll calculate points
      double rad = currentPosition!.heading * 3.14159 / 180.0;
      double size = 15.0;
      Path triangle = Path();
      triangle.moveTo(x + cos(rad) * size, y + sin(rad) * size);
      triangle.lineTo(x + cos(rad + 2.5) * size * 0.8, y + sin(rad + 2.5) * size * 0.8);
      triangle.lineTo(x + cos(rad - 2.5) * size * 0.8, y + sin(rad - 2.5) * size * 0.8);
      triangle.close();
      
      canvas.drawPath(triangle, Paint()..color = Colors.blueAccent);
    }
  }

  @override
  bool shouldRepaint(covariant _IndoorMapPainter oldDelegate) {
    return oldDelegate.scale != scale ||
           oldDelegate.currentPosition != currentPosition ||
           oldDelegate.routePath != routePath;
  }
}
