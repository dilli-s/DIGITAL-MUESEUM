import 'dart:math';

import '../models/navigation_models.dart';

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

  PathfindingService({
    required this.nodes,
    required this.edges,
    required this.floorPlans,
  });

  MapNode? getNode(String id) {
    try {
      return nodes.firstWhere((n) => n.id == id);
    } catch (_) {
      return null;
    }
  }

  double _calculateBearing(double x1, double y1, double x2, double y2) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    return atan2(dy, dx) * 180 / pi;
  }

  String _getTurnInstruction(double deg1, double deg2) {
    double diff = (deg2 - deg1) % 360;
    if (diff > 180) diff -= 360;

    if (diff.abs() < 20) return "Straight ahead";
    if (diff >= 20 && diff < 70) return "Slight right";
    if (diff >= 70 && diff <= 110) return "Turn right";
    if (diff > 110 && diff <= 160) return "Sharp right";
    if (diff <= -20 && diff > -70) return "Slight left";
    if (diff <= -70 && diff >= -110) return "Turn left";
    if (diff < -110 && diff >= -160) return "Sharp left";
    return "U-turn";
  }

  RouteResult? findShortestPath(String startId, String endId) {
    final Map<String, List<MapEdge>> graph = {};
    for (var edge in edges) {
      if (!edge.walkable) continue;
      graph.putIfAbsent(edge.fromNodeId, () => []).add(edge);
      // Ensure undirected graph properties are handled (assuming edges might be directional or we add both)
      // If edges are stored as directional but meant to be bidirectional, we add both.
      // Based on Flask code, they added both.
      graph.putIfAbsent(edge.toNodeId, () => []).add(MapEdge(
        id: edge.id,
        fromNodeId: edge.toNodeId,
        toNodeId: edge.fromNodeId,
        distance: edge.distance,
        walkable: edge.walkable,
      ));
    }

    if (!graph.containsKey(startId)) return null;

    final Map<String, double> distances = {};
    for (var node in nodes) {
      distances[node.id] = double.infinity;
    }
    distances[startId] = 0;

    final Map<String, String?> previous = {};
    final Set<String> unvisited = nodes.map((n) => n.id).toSet();

    while (unvisited.isNotEmpty) {
      String? current;
      double minDistance = double.infinity;
      for (var nodeId in unvisited) {
        if (distances[nodeId]! < minDistance) {
          minDistance = distances[nodeId]!;
          current = nodeId;
        }
      }

      if (current == null || current == endId) break;
      unvisited.remove(current);

      if (graph.containsKey(current)) {
        for (var edge in graph[current]!) {
          double alt = distances[current]! + edge.distance;
          if (alt < distances[edge.toNodeId]!) {
            distances[edge.toNodeId] = alt;
            previous[edge.toNodeId] = current;
          }
        }
      }
    }

    List<MapNode> path = [];
    String? current = endId;
    if (previous[current] == null && current != startId) {
      return null;
    }

    while (current != null) {
      final node = getNode(current);
      if (node != null) path.add(node);
      current = previous[current];
    }
    path = path.reversed.toList();

    List<String> instructions = [];
    if (path.length > 1) {
      instructions.add("Start at ${path[0].name}");

      for (int i = 1; i < path.length - 1; i++) {
        var prevNode = path[i - 1];
        var currNode = path[i];
        var nextNode = path[i + 1];

        if (currNode.floor != nextNode.floor) {
          String transition = nextNode.nodeType == 'elevator' || nextNode.nodeType == 'stairs' 
              ? nextNode.nodeType 
              : currNode.nodeType;
          instructions.add("Take $transition to floor ${nextNode.floor}");
          continue;
        }

        if (prevNode.floor != currNode.floor) {
          instructions.add("Head towards ${nextNode.name}");
          continue;
        }

        double deg1 = _calculateBearing(prevNode.x, prevNode.y, currNode.x, currNode.y);
        double deg2 = _calculateBearing(currNode.x, currNode.y, nextNode.x, nextNode.y);

        String turn = _getTurnInstruction(deg1, deg2);

        if (currNode.nodeType == 'junction') {
          instructions.add("$turn at ${currNode.name}");
        } else if (turn != "Straight ahead") {
          instructions.add("$turn near ${currNode.name}");
        }
      }
      instructions.add("Arrive at ${path.last.name}");
    }

    return RouteResult(
      path: path,
      distance: distances[endId] ?? 0,
      instructions: instructions,
    );
  }

  RouteResult? planFullTour(String entranceId, String exitId, List<String> artifactIds) {
    if (artifactIds.isEmpty) {
      return findShortestPath(entranceId, exitId);
    }

    List<MapNode> fullPath = [];
    List<String> fullInstructions = [];
    double totalDistance = 0;

    String currentStop = entranceId;
    List<String> unvisited = List.from(artifactIds);

    while (unvisited.isNotEmpty) {
      String? nearest;
      double minD = double.infinity;
      RouteResult? bestRoute;

      for (String aId in unvisited) {
        final r = findShortestPath(currentStop, aId);
        if (r != null && r.distance < minD) {
          minD = r.distance;
          nearest = aId;
          bestRoute = r;
        }
      }

      if (nearest == null || bestRoute == null) {
        break; 
      }

      if (fullPath.isNotEmpty && bestRoute.path.isNotEmpty) {
        fullPath.addAll(bestRoute.path.sublist(1));
      } else {
        fullPath.addAll(bestRoute.path);
      }
      
      fullInstructions.addAll(bestRoute.instructions);
      totalDistance += bestRoute.distance;

      currentStop = nearest;
      unvisited.remove(nearest);
    }

    final exitRoute = findShortestPath(currentStop, exitId);
    if (exitRoute != null) {
      if (fullPath.isNotEmpty && exitRoute.path.isNotEmpty) {
        fullPath.addAll(exitRoute.path.sublist(1));
      } else {
        fullPath.addAll(exitRoute.path);
      }
      fullInstructions.addAll(exitRoute.instructions);
      totalDistance += exitRoute.distance;
    }

    return RouteResult(
      path: fullPath,
      distance: totalDistance,
      instructions: fullInstructions,
    );
  }

  List<MapNode> getNearbyNodes(String startId, {double? radiusMeters, int? hops}) {
    // Similar to Flask implementation, a simplified nearby lookup
    final Map<String, List<MapEdge>> graph = {};
    for (var edge in edges) {
      if (!edge.walkable) continue;
      graph.putIfAbsent(edge.fromNodeId, () => []).add(edge);
      graph.putIfAbsent(edge.toNodeId, () => []).add(MapEdge(
        id: edge.id,
        fromNodeId: edge.toNodeId,
        toNodeId: edge.fromNodeId,
        distance: edge.distance,
        walkable: edge.walkable,
      ));
    }

    if (!graph.containsKey(startId)) return [];

    List<MapNode> nearby = [];
    
    if (hops != null) {
      List<MapEntry<String, int>> queue = [MapEntry(startId, 0)];
      Set<String> visited = {startId};

      while (queue.isNotEmpty) {
        var current = queue.removeAt(0);
        String currId = current.key;
        int currentHops = current.value;

        if (currId != startId) {
          var n = getNode(currId);
          if (n != null && !nearby.any((e) => e.id == n.id)) nearby.add(n);
        }

        if (currentHops < hops && graph.containsKey(currId)) {
          for (var edge in graph[currId]!) {
            if (!visited.contains(edge.toNodeId)) {
              visited.add(edge.toNodeId);
              queue.add(MapEntry(edge.toNodeId, currentHops + 1));
            }
          }
        }
      }
    }
    return nearby;
  }
}
