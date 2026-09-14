class MapNode {
  final String id;
  final String name;
  final int floor;
  final double x;
  final double y;
  final String nodeType;
  final String? floorPlanId;
  final int? objectId;
  final double? latitude;
  final double? longitude;

  MapNode({
    required this.id,
    required this.name,
    required this.floor,
    required this.x,
    required this.y,
    required this.nodeType,
    this.floorPlanId,
    this.objectId,
    this.latitude,
    this.longitude,
  });

  factory MapNode.fromJson(Map<String, dynamic> json) {
    return MapNode(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      floor: json['floor'] ?? 0,
      x: (json['x_coordinate'] as num?)?.toDouble() ?? 0,
      y: (json['y_coordinate'] as num?)?.toDouble() ?? 0,
      nodeType: json['node_type'] ?? 'junction',
      floorPlanId: json['floor_plan_id']?.toString(),
      objectId: json['object_id'] is int ? json['object_id'] : int.tryParse(json['object_id']?.toString() ?? ''),
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'floor': floor,
    'x_coordinate': x, 'y_coordinate': y, 'node_type': nodeType,
    'floor_plan_id': floorPlanId, 'object_id': objectId,
    'latitude': latitude, 'longitude': longitude,
  };
}

class MapEdge {
  final String id;
  final String fromNodeId;
  final String toNodeId;
  final double distance;
  final bool walkable;
  final String edgeType;

  MapEdge({
    required this.id,
    required this.fromNodeId,
    required this.toNodeId,
    required this.distance,
    required this.walkable,
    this.edgeType = 'normal',
  });

  factory MapEdge.fromJson(Map<String, dynamic> json) {
    return MapEdge(
      id: json['id']?.toString() ?? '',
      fromNodeId: json['from_node_id']?.toString() ?? '',
      toNodeId: json['to_node_id']?.toString() ?? '',
      distance: (json['distance'] as num?)?.toDouble() ?? 0,
      walkable: json['walkable'] ?? true,
      edgeType: json['edge_type'] ?? 'normal',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'from_node_id': fromNodeId, 'to_node_id': toNodeId,
    'distance': distance, 'walkable': walkable, 'edge_type': edgeType,
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
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      floorNumber: json['floor_number'] ?? 0,
      imageUrl: json['image_url'] ?? '',
      widthPx: (json['width_px'] as num?)?.toDouble() ?? 0,
      heightPx: (json['height_px'] as num?)?.toDouble() ?? 0,
      scaleMetersPerPx: (json['scale_meters_per_px'] as num?)?.toDouble() ?? 0.01,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'floor_number': floorNumber,
    'image_url': imageUrl, 'width_px': widthPx, 'height_px': heightPx,
    'scale_meters_per_px': scaleMetersPerPx,
  };
}
