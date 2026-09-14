import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Rotating compass dial widget featuring cardinal direction labels (N, S, E, W)
/// and dual-tone needle. Rotates to match true magnetic/fused heading.
class CompassDialWidget extends StatelessWidget {
  final double heading;
  final double size;
  final VoidCallback? onTap;

  const CompassDialWidget({
    super.key,
    required this.heading,
    this.size = 46.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Tooltip(
        message: 'Compass: ${heading.toStringAsFixed(0)}° • Tap to Recenter',
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
            border: Border.all(
              color: const Color(0xFFCBD5E1), // slate-300
              width: 1.5,
            ),
          ),
          child: CustomPaint(
            painter: CompassDialPainter(heading: heading),
          ),
        ),
      ),
    );
  }
}

class CompassDialPainter extends CustomPainter {
  final double heading;

  CompassDialPainter({required this.heading});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Save canvas before rotating to magnetic heading
    canvas.save();
    canvas.translate(center.dx, center.dy);
    // Rotate canvas by -heading so North (N) on dial always points to physical North
    canvas.rotate(-heading * math.pi / 180.0);

    // Cardinal directions N, S, E, W
    const textStyleCardinals = TextStyle(
      fontSize: 8.5,
      fontWeight: FontWeight.w800,
      color: Color(0xFF475569), // slate-600
    );
    const textStyleNorth = TextStyle(
      fontSize: 9.5,
      fontWeight: FontWeight.w900,
      color: Color(0xFFDC2626), // red-600
    );

    void drawLabel(String text, double angleDeg, TextStyle style) {
      final rad = angleDeg * math.pi / 180.0;
      final textSpan = TextSpan(text: text, style: style);
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();
      final labelDist = radius - 7.5;
      final lx = labelDist * math.sin(rad) - (textPainter.width / 2);
      final ly = -labelDist * math.cos(rad) - (textPainter.height / 2);
      textPainter.paint(canvas, Offset(lx, ly));
    }

    drawLabel('N', 0, textStyleNorth);
    drawLabel('E', 90, textStyleCardinals);
    drawLabel('S', 180, textStyleCardinals);
    drawLabel('W', 270, textStyleCardinals);

    // Compass Needle (dual-tone 3D bevel)
    final needleLength = radius - 11.5;
    const needleWidth = 3.2;

    // North Pointer (Red bevel)
    final northLeft = Path()
      ..moveTo(0, -needleLength)
      ..lineTo(-needleWidth, 0)
      ..lineTo(0, -needleWidth * 0.4)
      ..close();
    canvas.drawPath(
      northLeft,
      Paint()
        ..color = const Color(0xFFEF4444) // red-500
        ..style = PaintingStyle.fill,
    );

    final northRight = Path()
      ..moveTo(0, -needleLength)
      ..lineTo(needleWidth, 0)
      ..lineTo(0, -needleWidth * 0.4)
      ..close();
    canvas.drawPath(
      northRight,
      Paint()
        ..color = const Color(0xFFDC2626) // red-600
        ..style = PaintingStyle.fill,
    );

    // South Pointer (Slate/Silver bevel)
    final southLeft = Path()
      ..moveTo(0, needleLength)
      ..lineTo(-needleWidth, 0)
      ..lineTo(0, needleWidth * 0.4)
      ..close();
    canvas.drawPath(
      southLeft,
      Paint()
        ..color = const Color(0xFF94A3B8) // slate-400
        ..style = PaintingStyle.fill,
    );

    final southRight = Path()
      ..moveTo(0, needleLength)
      ..lineTo(needleWidth, 0)
      ..lineTo(0, needleWidth * 0.4)
      ..close();
    canvas.drawPath(
      southRight,
      Paint()
        ..color = const Color(0xFF64748B) // slate-500
        ..style = PaintingStyle.fill,
    );

    // Center pivot dot
    canvas.drawCircle(
      Offset.zero,
      3.0,
      Paint()
        ..color = const Color(0xFF1E293B)
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      Offset.zero,
      1.2,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.fill,
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CompassDialPainter oldDelegate) {
    return (oldDelegate.heading - heading).abs() > 0.4;
  }
}
