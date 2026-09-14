class Museum {
  final int id;
  final String name;
  final String address;
  final double? latitude;
  final double? longitude;
  final String? description;
  final String? imageUrl;

  Museum({
    required this.id,
    required this.name,
    this.address = '',
    this.latitude,
    this.longitude,
    this.description,
    this.imageUrl,
  });

  factory Museum.fromJson(Map<String, dynamic> json) {
    return Museum(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      address: json['location'] ?? json['address'] ?? '',
      latitude: json['latitude'] != null
          ? (json['latitude'] as num).toDouble()
          : null,
      longitude: json['longitude'] != null
          ? (json['longitude'] as num).toDouble()
          : null,
      description: json['description'],
      imageUrl: json['image'] ?? json['image_url'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'location': address,
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'description': description,
    'image': imageUrl,
    'image_url': imageUrl,
  };
}

class Gallery {
  final int id;
  final int museumId;
  final String name;
  final String? description;
  final String? floor;
  final String? audioUrl;
  final List<Map<String, double>>? boundaryPolygon;

  Gallery({
    required this.id,
    required this.museumId,
    required this.name,
    this.description,
    this.floor,
    this.audioUrl,
    this.boundaryPolygon,
  });

  factory Gallery.fromJson(Map<String, dynamic> json) {
    List<Map<String, double>>? parsedPolygon;
    if (json['boundary_polygon'] != null && json['boundary_polygon'] is List) {
      parsedPolygon = (json['boundary_polygon'] as List)
          .whereType<Map>()
          .map((point) {
            final lat = point['lat'] ?? point['y'];
            final lng = point['lng'] ?? point['x'];
            if (lat is! num || lng is! num) return null;
            return <String, double>{
              'lat': lat.toDouble(),
              'lng': lng.toDouble(),
              'x': lng.toDouble(),
              'y': lat.toDouble(),
            };
          })
          .whereType<Map<String, double>>()
          .toList();
      if (parsedPolygon.isEmpty) parsedPolygon = null;
    }

    return Gallery(
      id: json['id'],
      museumId: json['museum_id'] ?? 0,
      name: json['name'] ?? '',
      description: json['description'],
      floor: json['floor'],
      audioUrl: json['audio_url'],
      boundaryPolygon: parsedPolygon,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'museum_id': museumId,
    'name': name,
    'description': description,
    'floor': floor,
    'audio_url': audioUrl,
    'boundary_polygon': boundaryPolygon,
  };
}

class MuseumObject {
  final int id;
  final int museumId;
  final int galleryId;
  final String name;
  final String? localName;
  final String? commonName;
  final String? scientificName;
  final String? category;
  final String? period;
  final String? origin;
  final String? description;
  final String? significance;
  final List<String> facts;
  final List<String> images;
  final String? image;
  final String? audioUrl;
  final String? videoUrl;
  final String? model3dUrl;
  final String? code;

  MuseumObject({
    required this.id,
    required this.museumId,
    required this.galleryId,
    required this.name,
    this.localName,
    this.commonName,
    this.scientificName,
    this.category,
    this.period,
    this.origin,
    this.description,
    this.significance,
    this.facts = const [],
    this.images = const [],
    this.image,
    this.audioUrl,
    this.videoUrl,
    this.model3dUrl,
    this.code,
  });

  factory MuseumObject.fromJson(Map<String, dynamic> json) {
    return MuseumObject(
      id: json['id'],
      museumId: json['museum_id'] ?? 0,
      galleryId: json['gallery_id'] ?? 0,
      name: json['name'] ?? '',
      localName: json['local_name'],
      commonName: json['common_name'],
      scientificName: json['scientific_name'],
      category: json['category'],
      period: json['period'],
      origin: json['origin'],
      description: json['description'],
      significance: json['significance'],
      facts:
          (json['facts'] as List?)?.map((fact) => fact.toString()).toList() ??
          const [],
      images:
          (json['images'] as List?)
              ?.map((image) => image.toString())
              .toList() ??
          const [],
      image: json['image'],
      audioUrl: json['audio_url'],
      videoUrl: json['video_url'],
      model3dUrl: json['model_3d_url'],
      code: json['code'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'museum_id': museumId,
    'gallery_id': galleryId,
    'name': name,
    'local_name': localName,
    'common_name': commonName,
    'scientific_name': scientificName,
    'category': category,
    'period': period,
    'origin': origin,
    'description': description,
    'significance': significance,
    'facts': facts,
    'images': images,
    'image': image,
    'audio_url': audioUrl,
    'video_url': videoUrl,
    'model_3d_url': model3dUrl,
    'code': code,
  };
}
