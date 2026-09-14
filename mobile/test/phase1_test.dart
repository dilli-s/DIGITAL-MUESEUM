import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/explore_models.dart';
import 'package:mobile/services/deep_link_service.dart';

void main() {
  group('DeepLinkService URI Parsing', () {
    test('parses custom scheme with node parameter', () {
      final payload = DeepLinkService.parseUri('vanalok://museum/1?node=entrance_gate');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(1));
      expect(payload.entranceNodeId, equals('entrance_gate'));
    });

    test('parses custom scheme with node_id query param', () {
      final payload = DeepLinkService.parseUri('vanalok://museum/5?node_id=n_101');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(5));
      expect(payload.entranceNodeId, equals('n_101'));
    });

    test('parses HTTPS App Link format', () {
      final payload = DeepLinkService.parseUri('https://vanalok.app/museum/2?node=lobby');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(2));
      expect(payload.entranceNodeId, equals('lobby'));
    });

    test('parses HTTPS App Link without node parameter', () {
      final payload = DeepLinkService.parseUri('https://vanalok.app/museum/3');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(3));
      expect(payload.entranceNodeId, isNull);
    });

    test('parses JSON format QR payload', () {
      final payload = DeepLinkService.parseUri('{"museumId": 7, "startNodeId": "main_entrance"}');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(7));
      expect(payload.entranceNodeId, equals('main_entrance'));
    });

    test('parses plain museum ID string', () {
      final payload = DeepLinkService.parseUri('42');
      expect(payload, isNotNull);
      expect(payload!.museumId, equals(42));
      expect(payload.entranceNodeId, isNull);
    });

    test('returns null for unrecognized format', () {
      final payload = DeepLinkService.parseUri('random_garbage_string');
      expect(payload, isNull);
    });
  });

  group('Explore Models Serialization', () {
    test('Story model parses json correctly', () {
      final json = {
        'id': 10,
        'object_id': 20,
        'title': 'The Secret of the Bronzes',
        'summary': 'A thrilling look into ancient Chola casting.',
        'image': '/images/bronze.jpg',
        'content': [
          {'heading': 'Introduction', 'text': 'Lost-wax technique was used.'},
        ],
        'duration': '5 mins',
      };
      final story = Story.fromJson(json);
      expect(story.id, equals(10));
      expect(story.objectId, equals(20));
      expect(story.title, equals('The Secret of the Bronzes'));
      expect(story.content?.length, equals(1));
      expect(story.content?.first['heading'], equals('Introduction'));

      final outJson = story.toJson();
      expect(outJson['title'], equals('The Secret of the Bronzes'));
      expect(outJson['duration'], equals('5 mins'));
    });

    test('LearningResource model parses json correctly', () {
      final json = {
        'id': 100,
        'object_id': 25,
        'title': 'Metallurgy in Ancient India',
        'description': 'Educational module on metal craft.',
        'type': 'article',
        'difficulty': 'intermediate',
        'category': 'history',
        'featured': true,
      };
      final lr = LearningResource.fromJson(json);
      expect(lr.id, equals(100));
      expect(lr.title, equals('Metallurgy in Ancient India'));
      expect(lr.featured, isTrue);
      expect(lr.difficulty, equals('intermediate'));
    });

    test('Exhibition model parses json and object ids list', () {
      final json = {
        'id': 5,
        'museum_id': 1,
        'title': 'Sacred Metalworks',
        'objects': [{'id': 12}, {'id': 15}, {'id': 18}],
      };
      final ex = Exhibition.fromJson(json);
      expect(ex.id, equals(5));
      expect(ex.museumId, equals(1));
      expect(ex.title, equals('Sacred Metalworks'));
      expect(ex.objectIds, equals([12, 15, 18]));
    });
  });
}
