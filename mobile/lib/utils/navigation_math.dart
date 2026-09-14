import 'dart:math';
import '../models/navigation_models.dart';

/// Single source of truth for all distance/bearing calculations in the mobile app.
/// All navigation distances trace back to [distanceBetween] (Haversine).
class NavigationMath {
  /// Haversine distance in **meters** between two lat/lng points.
  static double distanceBetween(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371000;
    final double phi1 = lat1 * pi / 180;
    final double phi2 = lat2 * pi / 180;
    final double deltaPhi = (lat2 - lat1) * pi / 180;
    final double deltaLambda = (lon2 - lon1) * pi / 180;

    final double a = sin(deltaPhi / 2) * sin(deltaPhi / 2) +
        cos(phi1) * cos(phi2) * sin(deltaLambda / 2) * sin(deltaLambda / 2);
    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  /// Initial bearing in degrees from point 1 to point 2.
  static double bearing(double lat1, double lon1, double lat2, double lon2) {
    final phi1 = lat1 * pi / 180;
    final phi2 = lat2 * pi / 180;
    final dl = (lon2 - lon1) * pi / 180;
    final x = sin(dl) * cos(phi2);
    final y = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dl);
    return (atan2(x, y) * 180 / pi + 360) % 360;
  }

  /// Display-friendly distance: <10m → '3.2 m', ≥10m → '42 m'
  static String formatDistance(double meters) {
    if (meters < 10) return '${meters.toStringAsFixed(1)} m';
    return '${meters.round()} m';
  }

  /// Ray-casting algorithm to determine if a point is inside a polygon
  static bool isPointInPolygon(double lat, double lng, List<dynamic> polygon) {
    if (polygon.length < 3) return false;
    bool inside = false;
    for (int i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final pi = polygon[i];
      final pj = polygon[j];
      final double xi = (pi['lat'] ?? pi['x'] ?? 0.0).toDouble();
      final double yi = (pi['lng'] ?? pi['y'] ?? 0.0).toDouble();
      final double xj = (pj['lat'] ?? pj['x'] ?? 0.0).toDouble();
      final double yj = (pj['lng'] ?? pj['y'] ?? 0.0).toDouble();

      bool intersect = ((yi > lng) != (yj > lng)) &&
          (lat < (xj - xi) * (lng - yi) / (yj - yi == 0 ? 0.000001 : yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /// Ray-casting algorithm for indoor coordinates (x, y)
  static bool isPointInNormalizedPolygon(double px, double py, List<dynamic> polygon) {
    if (polygon.length < 3) return false;
    bool inside = false;
    for (int i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final pi = polygon[i];
      final pj = polygon[j];
      final double xi = (pi['x'] ?? pi['lng'] ?? 0.0).toDouble();
      final double yi = (pi['y'] ?? pi['lat'] ?? 0.0).toDouble();
      final double xj = (pj['x'] ?? pj['lng'] ?? 0.0).toDouble();
      final double yj = (pj['y'] ?? pj['lat'] ?? 0.0).toDouble();

      bool intersect = ((yi > py) != (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi == 0 ? 0.000001 : yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /// Distance in meters from point (pLat, pLng) to segment (aLat, aLng) -> (bLat, bLng).
  static double distanceToSegment(double pLat, double pLng, double aLat, double aLng, double bLat, double bLng) {
    final double ab2 = (bLat - aLat) * (bLat - aLat) + (bLng - aLng) * (bLng - aLng);
    if (ab2 == 0) return distanceBetween(pLat, pLng, aLat, aLng);
    double t = ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) / ab2;
    t = max(0.0, min(1.0, t));
    final double projLat = aLat + t * (bLat - aLat);
    final double projLng = aLng + t * (bLng - aLng);
    return distanceBetween(pLat, pLng, projLat, projLng);
  }

  /// Minimum distance in meters from point (pLat, pLng) to a polyline path of MapNodes.
  static double distanceToPolyline(double pLat, double pLng, List<MapNode> path) {
    if (path.isEmpty) return double.infinity;
    if (path.length == 1) {
      if (path[0].latitude == null || path[0].longitude == null) return double.infinity;
      return distanceBetween(pLat, pLng, path[0].latitude!, path[0].longitude!);
    }
    double minDist = double.infinity;
    for (int i = 0; i < path.length - 1; i++) {
      final n1 = path[i];
      final n2 = path[i + 1];
      if (n1.latitude == null || n1.longitude == null || n2.latitude == null || n2.longitude == null) continue;
      final d = distanceToSegment(pLat, pLng, n1.latitude!, n1.longitude!, n2.latitude!, n2.longitude!);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }
}
