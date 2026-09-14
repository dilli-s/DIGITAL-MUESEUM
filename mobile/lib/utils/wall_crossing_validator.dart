import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import '../models/navigation_models.dart';

/// Represents a 2D room boundary polygon for wall-crossing detection.
class RoomBoundary {
  final String id;
  final String name;
  final int floor;
  final bool walkable;
  final List<math.Point<double>> polygon;

  RoomBoundary({
    required this.id,
    required this.name,
    this.floor = 0,
    this.walkable = true,
    required this.polygon,
  });
}

/// Represents a marked doorway opening segment between two rooms.
class DoorwayOpening {
  final double x1;
  final double y1;
  final double x2;
  final double y2;
  final String? name;

  DoorwayOpening({
    required this.x1,
    required this.y1,
    required this.x2,
    required this.y2,
    this.name,
  });
}

/// Result of a wall-crossing validation check.
class WallCrossingResult {
  final bool allowed;
  final String? rejectionReason;
  final String? crossedRoomName;

  const WallCrossingResult.allow()
      : allowed = true,
        rejectionReason = null,
        crossedRoomName = null;

  const WallCrossingResult.reject({
    required this.rejectionReason,
    this.crossedRoomName,
  }) : allowed = false;
}

/// Validates live position movements against room wall boundaries using ray casting.
/// Mirrors the edge validation geometry from the mapping service.
class WallCrossingValidator {
  static const double defaultDoorTolerance = 0.06; // ~6% of floor plan scale (~2-3m)

  /// Returns true if point (px, py) lies inside [poly] using ray-casting.
  static bool pointInPolygon(double px, double py, List<math.Point<double>> poly) {
    if (poly.length < 3) return false;

    int n = poly.length;
    bool inside = false;

    double p1x = poly[0].x;
    double p1y = poly[0].y;

    for (int i = 0; i <= n; i++) {
      final p2 = poly[i % n];
      final p2x = p2.x;
      final p2y = p2.y;

      if (py > math.min(p1y, p2y)) {
        if (py <= math.max(p1y, p2y)) {
          if (px <= math.max(p1x, p2x)) {
            double xinters;
            if (p1y != p2y) {
              xinters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
            } else {
              xinters = p1x;
            }
            if (p1x == p2x || px <= xinters) {
              inside = !inside;
            }
          }
        }
      }
      p1x = p2x;
      p1y = p2y;
    }

    return inside;
  }

  static double _hypot(double dx, double dy) => math.sqrt(dx * dx + dy * dy);

  /// Calculates perpendicular distance from point (px, py) to segment (x1, y1) -> (x2, y2).
  static double distancePointToSegment(
    double px,
    double py,
    double x1,
    double y1,
    double x2,
    double y2,
  ) {
    final dx = x2 - x1;
    final dy = y2 - y1;
    final l2 = dx * dx + dy * dy;
    if (l2 == 0) return _hypot(px - x1, py - y1);

    double t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = t.clamp(0.0, 1.0);
    final closestX = x1 + t * dx;
    final closestY = y1 + t * dy;
    return _hypot(px - closestX, py - closestY);
  }

  /// Finds intersection point of segment p1-p2 and p3-p4, or null if no intersection.
  static math.Point<double>? segmentIntersection(
    math.Point<double> p1,
    math.Point<double> p2,
    math.Point<double> p3,
    math.Point<double> p4, {
    double eps = 1e-5,
  }) {
    final denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom.abs() < 1e-12) return null; // Parallel or colinear

    final ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    final ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    if (ua >= eps && ua <= 1.0 - eps && ub >= eps && ub <= 1.0 - eps) {
      final ix = p1.x + ua * (p2.x - p1.x);
      final iy = p1.y + ua * (p2.y - p1.y);
      return math.Point(ix, iy);
    }

    return null;
  }

  /// Validates whether a proposed move from (x1, y1) to (x2, y2) illegally crosses any wall.
  ///
  /// Returns [WallCrossingResult.allow] if:
  /// - No wall boundary is crossed, OR
  /// - Any wall intersection point lies within [doorTolerance] of a marked doorway or entrance node.
  ///
  /// Returns [WallCrossingResult.reject] if:
  /// - The candidate movement attempts to pass through a wall without an entrance/doorway.
  /// - The candidate movement lands in a non-walkable room.
  static WallCrossingResult validateMovement({
    required double x1,
    required double y1,
    required double x2,
    required double y2,
    required int floor,
    required List<RoomBoundary> rooms,
    List<DoorwayOpening> doorways = const [],
    List<MapNode> entranceNodes = const [],
    double doorTolerance = defaultDoorTolerance,
  }) {
    // If movement is negligible, allow immediately
    if (_hypot(x2 - x1, y2 - y1) < 1e-4) {
      return const WallCrossingResult.allow();
    }

    final p1 = math.Point(x1, y1);
    final p2 = math.Point(x2, y2);
    final midX = (x1 + x2) / 2.0;
    final midY = (y1 + y2) / 2.0;

    // Filter relevant rooms on this floor
    final floorRooms = rooms.where((r) => r.floor == floor && r.polygon.length >= 3).toList();
    if (floorRooms.isEmpty) {
      return const WallCrossingResult.allow();
    }

    // Filter entrance nodes on this floor
    final floorEntranceNodes = entranceNodes.where((n) {
      if (n.floor != floor) return false;
      final type = n.nodeType.toLowerCase();
      final name = n.name.toLowerCase();
      return type.contains('entrance') || type.contains('door') || name.contains('entrance') || name.contains('door');
    }).toList();

    for (final room in floorRooms) {
      final poly = room.polygon;
      final n = poly.length;

      // 1. Non-walkable room check
      if (!room.walkable) {
        if (pointInPolygon(x2, y2, poly) || pointInPolygon(midX, midY, poly)) {
          final reason = 'Attempted movement into non-walkable room: "${room.name}"';
          debugPrint('[WALL_CROSSING_REJECTED] $reason from ($x1, $y1) to ($x2, $y2)');
          return WallCrossingResult.reject(
            rejectionReason: reason,
            crossedRoomName: room.name,
          );
        }
      }

      // 2. Wall segment intersection check
      for (int i = 0; i < n; i++) {
        final b1 = poly[i];
        final b2 = poly[(i + 1) % n];

        final intersection = segmentIntersection(p1, p2, b1, b2);
        if (intersection != null) {
          final ix = intersection.x;
          final iy = intersection.y;

          // Check if intersection point passes through a doorway opening
          bool passesThroughDoorway = false;
          for (final d in doorways) {
            final dist = distancePointToSegment(ix, iy, d.x1, d.y1, d.x2, d.y2);
            if (dist <= doorTolerance) {
              passesThroughDoorway = true;
              break;
            }
          }

          // Check if intersection point passes near an entrance/door node
          if (!passesThroughDoorway) {
            for (final node in floorEntranceNodes) {
              final dist = _hypot(ix - node.x, iy - node.y);
              if (dist <= doorTolerance) {
                passesThroughDoorway = true;
                break;
              }
            }
          }

          // If intersection is not a valid doorway, reject the update!
          if (!passesThroughDoorway) {
            final reason = 'Segment from ($x1, $y1) to ($x2, $y2) crosses wall of "${room.name}" at ($ix, $iy) without an entrance/doorway';
            debugPrint('[WALL_CROSSING_REJECTED] $reason');
            return WallCrossingResult.reject(
              rejectionReason: reason,
              crossedRoomName: room.name,
            );
          }
        }
      }
    }

    return const WallCrossingResult.allow();
  }
}
