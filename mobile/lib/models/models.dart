class Museum {
  final int id;
  final String name;

  Museum({required this.id, required this.name});

  factory Museum.fromJson(Map<String, dynamic> json) {
    return Museum(id: json['id'], name: json['name'] ?? '');
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class Gallery {
  final int id;
  final int museumId;
  final String name;
  final String? description;
  final String? floor;
  final String? audioUrl;

  Gallery({
    required this.id,
    required this.museumId,
    required this.name,
    this.description,
    this.floor,
    this.audioUrl,
  });

  factory Gallery.fromJson(Map<String, dynamic> json) {
    return Gallery(
      id: json['id'],
      museumId: json['museum_id'] ?? 0,
      name: json['name'] ?? '',
      description: json['description'],
      floor: json['floor'],
      audioUrl: json['audio_url'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'museum_id': museumId,
    'name': name,
    'description': description,
    'floor': floor,
    'audio_url': audioUrl,
  };
}

class MuseumObject {
  final int id;
  final int museumId;
  final int galleryId;
  final String name;
  final String? category;
  final String? period;
  final String? origin;
  final String? description;
  final String? image;
  final String? audioUrl;
  final String? code;

  MuseumObject({
    required this.id,
    required this.museumId,
    required this.galleryId,
    required this.name,
    this.category,
    this.period,
    this.origin,
    this.description,
    this.image,
    this.audioUrl,
    this.code,
  });

  factory MuseumObject.fromJson(Map<String, dynamic> json) {
    return MuseumObject(
      id: json['id'],
      museumId: json['museum_id'] ?? 0,
      galleryId: json['gallery_id'] ?? 0,
      name: json['name'] ?? '',
      category: json['category'],
      period: json['period'],
      origin: json['origin'],
      description: json['description'],
      image: json['image'],
      audioUrl: json['audio_url'],
      code: json['code'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'museum_id': museumId,
    'gallery_id': galleryId,
    'name': name,
    'category': category,
    'period': period,
    'origin': origin,
    'description': description,
    'image': image,
    'audio_url': audioUrl,
    'code': code,
  };
}
