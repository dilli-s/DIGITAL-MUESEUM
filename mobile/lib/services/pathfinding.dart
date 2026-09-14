import 'dart:collection';
import 'dart:math';

import '../models/navigation_models.dart';
import '../utils/navigation_math.dart';

class RouteResult {
  final List<MapNode> path;
  final double distance;
  final List<String> instructions;
  RouteResult({
    required this.path,
    required this.distance,
    required this.instructions,
  });
}

class PathfindingService {
  final List<MapNode> nodes;
  final List<MapEdge> edges;
  final List<FloorPlan> floorPlans;

  late final Map<String, MapNode> _nodeMap;
  late final Map<String, List<_AdjEntry>> _graph;

  PathfindingService({
    required this.nodes,
    required this.edges,
    required this.floorPlans,
  }) {
    _nodeMap = {for (var n in nodes) n.id: n};
    _graph = {};
    for (var n in nodes) {
      _graph[n.id] = [];
    }
    for (var e in edges) {
      if (!e.walkable) continue;
      final u = _nodeMap[e.fromNodeId], v = _nodeMap[e.toNodeId];
      if (u == null || v == null) continue;
      
      double d = e.distance;
      if (d <= 0) {
        if (u.latitude != null && v.latitude != null && u.longitude != null && v.longitude != null) {
          d = NavigationMath.distanceBetween(
            u.latitude!,
            u.longitude!,
            v.latitude!,
            v.longitude!,
          );
        } else {
          final fp = floorPlans.where((p) => p.id == u.floorPlanId).firstOrNull ?? (floorPlans.isNotEmpty ? floorPlans.first : null);
          final double scale = (fp != null && fp.scaleMetersPerPx > 0) ? fp.scaleMetersPerPx : 0.035;
          final double dx = v.x - u.x;
          final double dy = v.y - u.y;
          d = max(0.5, sqrt(dx * dx + dy * dy) * scale);
        }
      }
      _graph[u.id]?.add(_AdjEntry(v.id, d, e.edgeType));
      _graph[v.id]?.add(_AdjEntry(u.id, d, e.edgeType));
    }
  }

  MapNode? getNode(String id) => _nodeMap[id];

  RouteResult? findShortestPath(String startId, String endId) {
    if (!_graph.containsKey(startId) || !_graph.containsKey(endId)) return null;

    final dist = <String, double>{};
    final prev = <String, String>{};
    for (var n in nodes) {
      dist[n.id] = double.infinity;
    }
    dist[startId] = 0;

    final pq = SplayTreeSet<_PQEntry>((a, b) {
      int c = a.dist.compareTo(b.dist);
      return c != 0 ? c : a.id.compareTo(b.id);
    });
    pq.add(_PQEntry(startId, 0));

    while (pq.isNotEmpty) {
      final cur = pq.first;
      pq.remove(cur);
      if (cur.dist > dist[cur.id]!) continue;
      if (cur.id == endId) break;
      for (var adj in _graph[cur.id] ?? []) {
        final alt = cur.dist + adj.dist;
        if (alt < dist[adj.id]!) {
          dist[adj.id] = alt;
          prev[adj.id] = cur.id;
          pq.add(_PQEntry(adj.id, alt));
        }
      }
    }

    if (dist[endId] == double.infinity) return null;

    List<MapNode> path = [];
    String? cur = endId;
    while (cur != null) {
      final n = _nodeMap[cur];
      if (n != null) path.add(n);
      cur = prev[cur];
    }
    path = path.reversed.toList();

    return RouteResult(
      path: path,
      distance: dist[endId]!,
      instructions: _generateInstructions(path),
    );
  }

  bool _isExitNode(MapNode n) =>
      n.nodeType.toLowerCase().split(',').map((s) => s.trim()).contains('exit');

  /// Floor-aware full tour: greedy nearest-neighbor, avoids zig-zagging floors.
  RouteResult? planFullTour(
    String entranceId,
    String? exitId,
    List<String> artifactIds,
  ) {
    String actualExitId = exitId ?? '';
    if (actualExitId.isEmpty || !_nodeMap.containsKey(actualExitId)) {
      final exitCandidates = nodes
          .where((n) => _isExitNode(n))
          .map((n) => n.id)
          .toList();
      String? bestEid;
      double minExitDist = double.infinity;
      for (var eid in exitCandidates) {
        final r = findShortestPath(entranceId, eid);
        if (r != null && r.distance < minExitDist) {
          minExitDist = r.distance;
          bestEid = eid;
        }
      }
      if (bestEid != null) actualExitId = bestEid;
    }

    if (artifactIds.isEmpty) return findShortestPath(entranceId, actualExitId);

    List<MapNode> fullPath = [];
    List<String> fullInstr = [];
    double totalDist = 0;
    String current = entranceId;
    List<String> remaining = List.from(artifactIds);

    while (remaining.isNotEmpty) {
      final currentFloor = _nodeMap[current]?.floor;
      final sameFloor = remaining
          .where((a) => _nodeMap[a]?.floor == currentFloor)
          .toList();
      final candidates = sameFloor.isNotEmpty ? sameFloor : remaining;

      String? bestId;
      RouteResult? bestRoute;
      double bestDist = double.infinity;

      for (var aid in candidates) {
        final r = findShortestPath(current, aid);
        if (r != null && r.distance < bestDist) {
          bestDist = r.distance;
          bestId = aid;
          bestRoute = r;
        }
      }

      if (bestId == null || bestRoute == null) break;

      if (fullPath.isNotEmpty && bestRoute.path.isNotEmpty) {
        fullPath.addAll(bestRoute.path.sublist(1));
      } else {
        fullPath.addAll(bestRoute.path);
      }
      fullInstr.addAll(bestRoute.instructions);
      totalDist += bestRoute.distance;
      current = bestId;
      remaining.remove(bestId);
    }

    RouteResult? exitRoute = findShortestPath(current, actualExitId);
    if (exitRoute == null) {
      final exitCandidates = nodes
          .where((n) => _isExitNode(n))
          .map((n) => n.id)
          .toList();
      double bestExitDist = double.infinity;
      for (var eid in exitCandidates) {
        final r = findShortestPath(current, eid);
        if (r != null && r.distance < bestExitDist) {
          bestExitDist = r.distance;
          exitRoute = r;
        }
      }
    }

    if (exitRoute != null) {
      if (fullPath.isNotEmpty) {
        fullPath.addAll(exitRoute.path.sublist(1));
      } else {
        fullPath.addAll(exitRoute.path);
      }
      fullInstr.addAll(exitRoute.instructions);
      totalDist += exitRoute.distance;
    }

    return RouteResult(
      path: fullPath,
      distance: totalDist,
      instructions: fullInstr,
    );
  }

  double _getNodeDist(MapNode n1, MapNode n2) {
    if (n1.latitude != null && n1.longitude != null && n2.latitude != null && n2.longitude != null) {
      return NavigationMath.distanceBetween(n1.latitude!, n1.longitude!, n2.latitude!, n2.longitude!);
    }
    final fp = floorPlans.where((p) => p.id == n1.floorPlanId).firstOrNull ?? (floorPlans.isNotEmpty ? floorPlans.first : null);
    final double scale = (fp != null && fp.scaleMetersPerPx > 0) ? fp.scaleMetersPerPx : 0.035;
    final double dx = n2.x - n1.x;
    final double dy = n2.y - n1.y;
    return max(1.0, sqrt(dx * dx + dy * dy) * scale);
  }

  double _getNodeBearing(MapNode n1, MapNode n2) {
    if (n1.latitude != null && n1.longitude != null && n2.latitude != null && n2.longitude != null) {
      return NavigationMath.bearing(n1.latitude!, n1.longitude!, n2.latitude!, n2.longitude!);
    }
    final double dx = n2.x - n1.x;
    final double dy = n2.y - n1.y;
    return (atan2(dx, -dy) * 180 / pi + 360) % 360;
  }

  List<String> _generateInstructions(List<MapNode> path) {
    if (path.length < 2) return ["You have arrived."];
    List<String> instr = ["Start at ${path[0].name}"];

    for (int i = 0; i < path.length - 1; i++) {
      final cur = path[i], nxt = path[i + 1];
      if (cur.floor != nxt.floor) {
        final connector =
            ['stairs', 'elevator', 'escalator'].contains(nxt.nodeType)
            ? nxt.nodeType
            : 'stairs';
        instr.add("Take the $connector to Floor ${nxt.floor}");
        continue;
      }
      if (i == path.length - 2) {
        final d = _getNodeDist(cur, nxt);
        instr.add(
          "Arrive at ${nxt.name} (${NavigationMath.formatDistance(d)} ahead)",
        );
        continue;
      }
      final nnxt = path[i + 2];
      if (nxt.floor != nnxt.floor) {
        final d = _getNodeDist(cur, nxt);
        instr.add("Walk ${NavigationMath.formatDistance(d)}");
        continue;
      }
      final b1 = _getNodeBearing(cur, nxt);
      final b2 = _getNodeBearing(nxt, nnxt);
      double diff = ((b2 - b1 + 180) % 360) - 180;
      final d = _getNodeDist(cur, nxt);
      if (diff.abs() < 25) {
        instr.add("Walk ${NavigationMath.formatDistance(d)}");
      } else if (diff > 0) {
        instr.add("Turn right at ${nxt.name}");
      } else {
        instr.add("Turn left at ${nxt.name}");
      }
    }
    return instr;
  }
}

class _AdjEntry {
  final String id;
  final double dist;
  final String edgeType;
  _AdjEntry(this.id, this.dist, this.edgeType);
}

class _PQEntry {
  final String id;
  final double dist;
  _PQEntry(this.id, this.dist);
}
