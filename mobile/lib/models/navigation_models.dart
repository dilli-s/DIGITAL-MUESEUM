class MapNode {
  final String id;
  final String name;
  final int floor;
  final double x;
  final double y;
  final String nodeType;
  final String? floorPlanId;
  final int? objectId;

  MapNode({
    required this.id,
    required this.name,
    required this.floor,
    required this.x,
    required this.y,
    required this.nodeType,
    this.floorPlanId,
    this.objectId,
  });

  factory MapNode.fromJson(Map<String, dynamic> json) {
    return MapNode(
      id: json['id'],
      name: json['name'],
      floor: json['floor'],
      x: (json['x_coordinate'] as num).toDouble(),
      y: (json['y_coordinate'] as num).toDouble(),
      nodeType: json['node_type'],
      floorPlanId: json['floor_plan_id'],
      objectId: json['object_id'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'floor': floor,
        'x_coordinate': x,
        'y_coordinate': y,
        'node_type': nodeType,
        'floor_plan_id': floorPlanId,
        'object_id': objectId,
      };
}

class MapEdge {
  final String id;
  final String fromNodeId;
  final String toNodeId;
  final double distance;
  final bool walkable;

  MapEdge({
    required this.id,
    required this.fromNodeId,
    required this.toNodeId,
    required this.distance,
    required this.walkable,
  });

  factory MapEdge.fromJson(Map<String, dynamic> json) {
    return MapEdge(
      id: json['id'],
      fromNodeId: json['from_node_id'],
      toNodeId: json['to_node_id'],
      distance: (json['distance'] as num).toDouble(),
      walkable: json['walkable'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'from_node_id': fromNodeId,
        'to_node_id': toNodeId,
        'distance': distance,
        'walkable': walkable,
      };
}

class FloorPlan {
  final String id;
  final String name;
  final int floorNumber;
  final String imageUrl;
  final double widthPx;
  final double heightPx;
  final double scaleMetersPerPx;

  FloorPlan({
    required this.id,
    required this.name,
    required this.floorNumber,
    required this.imageUrl,
    required this.widthPx,
    required this.heightPx,
    required this.scaleMetersPerPx,
  });

  factory FloorPlan.fromJson(Map<String, dynamic> json) {
    return FloorPlan(
      id: json['id'],
      name: json['name'],
      floorNumber: json['floor_number'],
      imageUrl: json['image_url'],
      widthPx: (json['width_px'] as num).toDouble(),
      heightPx: (json['height_px'] as num).toDouble(),
      scaleMetersPerPx: (json['scale_meters_per_px'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'floor_number': floorNumber,
        'image_url': imageUrl,
        'width_px': widthPx,
        'height_px': heightPx,
        'scale_meters_per_px': scaleMetersPerPx,
      };
}
