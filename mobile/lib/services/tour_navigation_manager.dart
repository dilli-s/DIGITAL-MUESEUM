import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/navigation_models.dart';
import '../utils/navigation_math.dart';
import 'indoor_positioning.dart';
import 'pathfinding.dart';

/// Manages museum tour lifecycle, selective navigation, and progress tracking.
class TourNavigationManager extends ChangeNotifier {
  List<String> tourStops = [];
  bool isTourActive = false;

  List<String>? suspendedTourStops;
  bool isTourSuspended = false;
  MapNode? selectiveTargetNode;

  final Set<String> visitedNodeIds = {};

  bool _isEntrance(MapNode n) => n.nodeType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .contains('entrance');

  bool _isExit(MapNode n) =>
      n.nodeType.toLowerCase().split(',').map((s) => s.trim()).contains('exit');

  bool _isExhibit(MapNode n) => n.nodeType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .any((type) => type == 'exhibit' || type == 'artifact');

  /// Start a comprehensive tour covering exhibits across the entire museum.
  RouteResult? startFullTour({
    required List<MapNode> allNodes,
    required PathfindingService pathfindingService,
    PositionState? currentPosition,
  }) {
    if (allNodes.isEmpty) return null;

    final entrances = allNodes.where((n) => _isEntrance(n)).toList();
    final exits = allNodes.where((n) => _isExit(n)).toList();
    final artifacts = allNodes.where(_isExhibit).map((n) => n.id).toList();

    String startId;
    if (currentPosition?.currentNodeId != null &&
        allNodes.any((n) => n.id == currentPosition!.currentNodeId)) {
      startId = currentPosition!.currentNodeId!;
    } else if (entrances.isNotEmpty) {
      startId = entrances.first.id;
    } else {
      startId = allNodes.first.id;
    }

    String exitId;
    if (exits.isNotEmpty) {
      exitId = exits.first.id;
    } else if (entrances.length > 1) {
      exitId = entrances.last.id;
    } else if (entrances.isNotEmpty) {
      exitId = entrances.first.id;
    } else {
      exitId = allNodes.last.id;
    }

    final unvisitedArtifacts = artifacts
        .where((id) => !visitedNodeIds.contains(id))
        .toList();

    final tour = pathfindingService.planFullTour(
      startId,
      exitId,
      unvisitedArtifacts,
    );

    if (tour != null) {
      tourStops = [];
      for (var node in tour.path) {
        if (unvisitedArtifacts.contains(node.id) &&
            !tourStops.contains(node.id)) {
          tourStops.add(node.id);
        }
      }
      if (!tourStops.contains(exitId)) {
        tourStops.add(exitId);
      }
      isTourActive = true;
      isTourSuspended = false;
      suspendedTourStops = null;
      selectiveTargetNode = null;
      notifyListeners();
    }
    return tour;
  }

  /// Suspend active tour when navigating to a specific target node (amenity, artifact, search).
  void startSelectiveNavigation(MapNode target) {
    if (isTourActive) {
      suspendedTourStops = List.from(tourStops);
      isTourSuspended = true;
      isTourActive = false;
    }
    selectiveTargetNode = target;
    notifyListeners();
  }

  /// Resume a previously suspended tour schedule.
  bool resumeTour() {
    if (suspendedTourStops != null && suspendedTourStops!.isNotEmpty) {
      tourStops = List.from(suspendedTourStops!);
      suspendedTourStops = null;
      isTourSuspended = false;
      selectiveTargetNode = null;
      isTourActive = true;
      notifyListeners();
      return true;
    } else {
      isTourSuspended = false;
      selectiveTargetNode = null;
      notifyListeners();
      return false;
    }
  }

  /// Removes visited stops and returns the next destination node to route to, or null if complete.
  MapNode? getNextTourStop(List<MapNode> allNodes) {
    tourStops.removeWhere(
      (id) => visitedNodeIds.contains(id) && id != tourStops.last,
    );

    if (tourStops.isEmpty) {
      isTourActive = false;
      notifyListeners();
      return null;
    }

    final nextStopId = tourStops.first;
    try {
      return allNodes.firstWhere((n) => n.id == nextStopId);
    } catch (_) {
      return null;
    }
  }

  /// Evaluates arrival proximity to destinationNode (default 1.0m threshold).
  MapNode? evaluateArrival({
    required PositionState? currentPosition,
    required MapNode? destinationNode,
    double radiusMeters = 1.0,
  }) {
    if (currentPosition == null || destinationNode == null) return null;
    if (currentPosition.floor != destinationNode.floor) return null;
    double dist;
    if (currentPosition.latitude != null &&
        currentPosition.longitude != null &&
        destinationNode.latitude != null &&
        destinationNode.longitude != null) {
      dist = NavigationMath.distanceBetween(
        currentPosition.latitude!,
        currentPosition.longitude!,
        destinationNode.latitude!,
        destinationNode.longitude!,
      );
    } else {
      final dx = destinationNode.x - currentPosition.x;
      final dy = destinationNode.y - currentPosition.y;
      dist = sqrt(dx * dx + dy * dy) * 0.035;
    }

    if (dist <= radiusMeters) {
      visitedNodeIds.add(destinationNode.id);
      if (isTourActive &&
          tourStops.isNotEmpty &&
          destinationNode.id == tourStops.first) {
        tourStops.removeAt(0);
      }
      notifyListeners();
      return destinationNode;
    }
    return null;
  }

  /// Finds any exhibit/artifact node within proximity (default 1.0m) regardless of destination.
  MapNode? findArtifactWithinProximity({
    required PositionState? currentPosition,
    required List<MapNode> allNodes,
    double radiusMeters = 1.0,
  }) {
    if (currentPosition == null) return null;
    MapNode? closest;
    double minDist = double.infinity;

    for (final node in allNodes) {
      if (node.floor != currentPosition.floor) continue;
      if (!_isExhibit(node) || node.objectId == null) continue;

      double dist;
      if (currentPosition.latitude != null &&
          currentPosition.longitude != null &&
          node.latitude != null &&
          node.longitude != null) {
        dist = NavigationMath.distanceBetween(
          currentPosition.latitude!,
          currentPosition.longitude!,
          node.latitude!,
          node.longitude!,
        );
      } else {
        final dx = node.x - currentPosition.x;
        final dy = node.y - currentPosition.y;
        dist = sqrt(dx * dx + dy * dy) * 0.035;
      }

      if (dist <= radiusMeters && dist < minDist) {
        minDist = dist;
        closest = node;
      }
    }
    return closest;
  }
}
