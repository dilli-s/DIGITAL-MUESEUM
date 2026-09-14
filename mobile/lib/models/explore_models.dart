/// Models for the "Explore More" content flow.
/// Maps to backend: stories, learning_resources, exhibitions tables.
library;

class Story {
  final int id;
  final int objectId;
  final String title;
  final String? summary;
  final String? image;
  final List<Map<String, dynamic>>? content; // [{heading, text}]
  final String? duration;

  Story({
    required this.id,
    required this.objectId,
    required this.title,
    this.summary,
    this.image,
    this.content,
    this.duration,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>>? parsedContent;
    if (json['content'] is List) {
      parsedContent = (json['content'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    return Story(
      id: json['id'] ?? 0,
      objectId: json['object_id'] ?? 0,
      title: json['title'] ?? '',
      summary: json['summary'],
      image: json['image'],
      content: parsedContent,
      duration: json['duration'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'object_id': objectId,
    'title': title,
    'summary': summary,
    'image': image,
    'content': content,
    'duration': duration,
  };
}

class LearningResource {
  final int id;
  final int objectId;
  final String title;
  final String? description;
  final String? type;
  final List<Map<String, dynamic>>? content; // [{heading, text}]
  final String? duration;
  final String? difficulty;
  final String? category;
  final bool featured;

  LearningResource({
    required this.id,
    required this.objectId,
    required this.title,
    this.description,
    this.type,
    this.content,
    this.duration,
    this.difficulty,
    this.category,
    this.featured = false,
  });

  factory LearningResource.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>>? parsedContent;
    if (json['content'] is List) {
      parsedContent = (json['content'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    return LearningResource(
      id: json['id'] ?? 0,
      objectId: json['object_id'] ?? 0,
      title: json['title'] ?? '',
      description: json['description'],
      type: json['type'],
      content: parsedContent,
      duration: json['duration'],
      difficulty: json['difficulty'],
      category: json['category'],
      featured: json['featured'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'object_id': objectId,
    'title': title,
    'description': description,
    'type': type,
    'content': content,
    'duration': duration,
    'difficulty': difficulty,
    'category': category,
    'featured': featured,
  };
}

class Exhibition {
  final int id;
  final int museumId;
  final String title;
  final String? subtitle;
  final String? description;
  final String? longDescription;
  final String? image;
  final String? category;
  final String? theme;
  final String? period;
  final String? location;
  final bool featured;
  final List<int> objectIds; // IDs of related objects

  Exhibition({
    required this.id,
    required this.museumId,
    required this.title,
    this.subtitle,
    this.description,
    this.longDescription,
    this.image,
    this.category,
    this.theme,
    this.period,
    this.location,
    this.featured = false,
    this.objectIds = const [],
  });

  factory Exhibition.fromJson(Map<String, dynamic> json) {
    List<int> objIds = [];
    if (json['objects'] is List) {
      objIds = (json['objects'] as List)
          .map((o) => o is Map ? (o['id'] as int? ?? 0) : (o as int? ?? 0))
          .where((id) => id > 0)
          .toList();
    } else if (json['object_ids'] is List) {
      objIds = (json['object_ids'] as List)
          .map((e) => e is int ? e : int.tryParse(e.toString()) ?? 0)
          .where((id) => id > 0)
          .toList();
    }

    return Exhibition(
      id: json['id'] ?? 0,
      museumId: json['museum_id'] ?? 0,
      title: json['title'] ?? '',
      subtitle: json['subtitle'],
      description: json['description'],
      longDescription: json['long_description'],
      image: json['image'],
      category: json['category'],
      theme: json['theme'],
      period: json['period'],
      location: json['location'],
      featured: json['featured'] ?? false,
      objectIds: objIds,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'museum_id': museumId,
    'title': title,
    'subtitle': subtitle,
    'description': description,
    'long_description': longDescription,
    'image': image,
    'category': category,
    'theme': theme,
    'period': period,
    'location': location,
    'featured': featured,
    'object_ids': objectIds,
  };
}
