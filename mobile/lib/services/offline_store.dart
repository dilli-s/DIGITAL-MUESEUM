import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;

import '../config/api.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';
import '../models/explore_models.dart';

class OfflineStore {
  static final OfflineStore instance = OfflineStore();

  static const String tableCache = 'cache';
  static const String keyMuseums = 'offline_museums';
  static const String keyGalleries = 'offline_galleries';
  static const String keyObjects = 'offline_objects';
  static const String keyNodes = 'offline_nodes';
  static const String keyEdges = 'offline_edges';
  static const String keyFloorPlans = 'offline_floor_plans';
  static const String keyStories = 'offline_stories';
  static const String keyLearning = 'offline_learning';
  static const String keyExhibitions = 'offline_exhibitions';
  static const String keyLastSync = 'offline_last_sync';
  static const String keySyncedMuseumId = 'offline_synced_museum_id';

  static Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDB('museum_cache.db');
    return _db!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $tableCache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        // v2 adds explore content keys — no schema change needed (same KV table)
      },
    );
  }

  Future<void> _save(String key, String value) async {
    final db = await database;
    await db.insert(tableCache, {'key': key, 'value': value},
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<String?> _get(String key) async {
    final db = await database;
    final res = await db.query(tableCache, where: 'key = ?', whereArgs: [key]);
    if (res.isNotEmpty) {
      return res.first['value'] as String?;
    }
    return null;
  }

  // ─── Museums ─────────────────────────────────────────────────

  Future<void> saveMuseums(List<Museum> museums) async {
    await _save(
        keyMuseums, jsonEncode(museums.map((m) => m.toJson()).toList()));
  }

  Future<List<Museum>> getMuseums() async {
    final jsonString = await _get(keyMuseums);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Museum.fromJson(j)).toList();
  }

  // ─── Galleries ───────────────────────────────────────────────

  Future<void> saveGalleries(List<Gallery> galleries) async {
    await _save(
        keyGalleries, jsonEncode(galleries.map((g) => g.toJson()).toList()));
  }

  Future<List<Gallery>> getGalleries() async {
    final jsonString = await _get(keyGalleries);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Gallery.fromJson(j)).toList();
  }

  // ─── Objects ─────────────────────────────────────────────────

  Future<void> saveObjects(List<MuseumObject> objects) async {
    await _save(
        keyObjects, jsonEncode(objects.map((o) => o.toJson()).toList()));
  }

  Future<List<MuseumObject>> getObjects() async {
    final jsonString = await _get(keyObjects);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MuseumObject.fromJson(j)).toList();
  }

  // ─── Nodes ───────────────────────────────────────────────────

  Future<void> saveNodes(List<MapNode> nodes) async {
    await _save(keyNodes, jsonEncode(nodes.map((n) => n.toJson()).toList()));
  }

  Future<List<MapNode>> getNodes() async {
    final jsonString = await _get(keyNodes);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MapNode.fromJson(j)).toList();
  }

  // ─── Edges ───────────────────────────────────────────────────

  Future<void> saveEdges(List<MapEdge> edges) async {
    await _save(keyEdges, jsonEncode(edges.map((e) => e.toJson()).toList()));
  }

  Future<List<MapEdge>> getEdges() async {
    final jsonString = await _get(keyEdges);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MapEdge.fromJson(j)).toList();
  }

  // ─── Floor Plans ─────────────────────────────────────────────

  Future<void> saveFloorPlans(List<FloorPlan> plans) async {
    await _save(
        keyFloorPlans, jsonEncode(plans.map((p) => p.toJson()).toList()));
  }

  Future<List<FloorPlan>> getFloorPlans() async {
    final jsonString = await _get(keyFloorPlans);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => FloorPlan.fromJson(j)).toList();
  }

  // ─── Stories ─────────────────────────────────────────────────

  Future<void> saveStories(List<Story> stories) async {
    await _save(
        keyStories, jsonEncode(stories.map((s) => s.toJson()).toList()));
  }

  Future<List<Story>> getStories() async {
    final jsonString = await _get(keyStories);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Story.fromJson(j)).toList();
  }

  Future<List<Story>> getStoriesForObject(int objectId) async {
    final all = await getStories();
    return all.where((s) => s.objectId == objectId).toList();
  }

  // ─── Learning Resources ──────────────────────────────────────

  Future<void> saveLearning(List<LearningResource> resources) async {
    await _save(
        keyLearning, jsonEncode(resources.map((r) => r.toJson()).toList()));
  }

  Future<List<LearningResource>> getLearning() async {
    final jsonString = await _get(keyLearning);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => LearningResource.fromJson(j)).toList();
  }

  Future<List<LearningResource>> getLearningForObject(int objectId) async {
    final all = await getLearning();
    return all.where((r) => r.objectId == objectId).toList();
  }

  // ─── Exhibitions ─────────────────────────────────────────────

  Future<void> saveExhibitions(List<Exhibition> exhibitions) async {
    await _save(keyExhibitions,
        jsonEncode(exhibitions.map((e) => e.toJson()).toList()));
  }

  Future<List<Exhibition>> getExhibitions() async {
    final jsonString = await _get(keyExhibitions);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Exhibition.fromJson(j)).toList();
  }

  Future<List<Exhibition>> getExhibitionsForObject(int objectId) async {
    final all = await getExhibitions();
    return all.where((e) => e.objectIds.contains(objectId)).toList();
  }

  // ─── Sync Metadata ──────────────────────────────────────────

  Future<int?> getLastSync() async {
    final val = await _get(keyLastSync);
    if (val != null) return int.tryParse(val);
    return null;
  }

  Future<int?> getSyncedMuseumId() async {
    final val = await _get(keySyncedMuseumId);
    if (val != null) return int.tryParse(val);
    return null;
  }

  // ─── Object Lookup ───────────────────────────────────────────

  Future<MuseumObject?> getObject(int id) async {
    final objects = await getObjects();
    try {
      return objects.firstWhere((o) => o.id == id);
    } catch (e) {
      return null;
    }
  }

  Future<MuseumObject?> findObjectByCode(String code) async {
    final objects = await getObjects();
    try {
      return objects.firstWhere((o) => o.code == code);
    } catch (e) {
      return null;
    }
  }

  // ─── Media Pre-download ──────────────────────────────────────

  /// Get the local media cache directory.
  Future<Directory> _getMediaCacheDir() async {
    final appDir = await getApplicationDocumentsDirectory();
    final mediaDir = Directory(join(appDir.path, 'museum_media'));
    if (!await mediaDir.exists()) {
      await mediaDir.create(recursive: true);
    }
    return mediaDir;
  }

  /// Download a remote file to local cache. Returns local path.
  /// If already cached, returns existing path immediately.
  Future<String?> _downloadFile(String url, String localName) async {
    if (url.isEmpty) return null;
    try {
      final mediaDir = await _getMediaCacheDir();
      final localFile = File(join(mediaDir.path, localName));

      if (await localFile.exists()) {
        return localFile.path;
      }

      final fullUrl = ApiConfig.getMediaUrl(url);
      if (fullUrl.isEmpty) return null;

      final response = await http.get(Uri.parse(fullUrl));
      if (response.statusCode == 200) {
        await localFile.writeAsBytes(response.bodyBytes);
        return localFile.path;
      }
    } catch (e) {
      debugPrint('Failed to cache file $url: $e');
    }
    return null;
  }

  /// Get local path for a cached media file, or null if not cached.
  Future<String?> getLocalMediaPath(String url) async {
    if (url.isEmpty) return null;
    final mediaDir = await _getMediaCacheDir();
    final localName = _urlToLocalName(url);
    final localFile = File(join(mediaDir.path, localName));
    if (await localFile.exists()) {
      return localFile.path;
    }
    return null;
  }

  String _urlToLocalName(String url) {
    // Create a deterministic filename from URL
    final hash = url.hashCode.toUnsigned(32).toRadixString(16);
    final ext = url.contains('.') ? url.split('.').last.split('?').first : 'bin';
    return '${hash}_media.$ext';
  }

  // ─── Museum-Scoped Full Sync ─────────────────────────────────

  /// Download all content for a specific museum and cache it locally.
  /// This is the primary sync method for the visitor flow.
  Future<Map<String, dynamic>> syncMuseum(
    int museumId,
    void Function(int percent, String message) onProgress,
  ) async {
    try {
      // Step 1: Fetch museums list
      onProgress(5, 'Loading museum info...');
      final mRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/museums?per_page=50'),
      );
      List<Museum> museums = [];
      if (mRes.statusCode == 200) {
        final d = jsonDecode(mRes.body);
        final list = (d['data'] as List?) ?? [];
        museums = list.map((e) => Museum.fromJson(e)).toList();
      }

      // Step 2: Fetch galleries for this museum
      onProgress(15, 'Downloading galleries...');
      final gRes = await http.get(
        Uri.parse(
            '${ApiConfig.baseUrl}/galleries?museum_id=$museumId&per_page=100'),
      );
      List<Gallery> galleries = [];
      if (gRes.statusCode == 200) {
        final d = jsonDecode(gRes.body);
        final list = (d['data'] as List?) ?? [];
        galleries = list.map((e) => Gallery.fromJson(e)).toList();
      }

      // Step 3: Fetch objects for this museum
      onProgress(25, 'Downloading exhibits...');
      final oRes = await http.get(
        Uri.parse(
            '${ApiConfig.baseUrl}/objects?museum_id=$museumId&per_page=500'),
      );
      List<MuseumObject> objects = [];
      if (oRes.statusCode == 200) {
        final d = jsonDecode(oRes.body);
        final list = (d['data'] as List?) ?? [];
        objects = list.map((e) => MuseumObject.fromJson(e)).toList();
      }

      // Step 4: Fetch map graph (nodes, edges, floor plans)
      onProgress(40, 'Downloading map data...');
      final graphRes = await http.get(
        Uri.parse('${ApiConfig.mapServiceUrl}/graph?museum_id=$museumId'),
      );
      List<MapNode> nodes = [];
      List<MapEdge> edges = [];
      List<FloorPlan> floorPlans = [];

      if (graphRes.statusCode == 200) {
        final d = jsonDecode(graphRes.body);

        final nodeList = (d['nodes'] as List?) ?? [];
        nodes = nodeList.map((e) => MapNode.fromJson(e)).toList();

        final edgeList = (d['edges'] as List?) ?? [];
        edges = edgeList.map((e) => MapEdge.fromJson(e)).toList();

        final planList = (d['floor_plans'] as List?) ?? [];
        floorPlans = planList.map((e) => FloorPlan.fromJson(e)).toList();
      }

      // Step 5: Fetch stories for objects
      onProgress(55, 'Downloading stories...');
      List<Story> stories = [];
      try {
        final sRes = await http.get(
          Uri.parse(
              '${ApiConfig.baseUrl}/admin/stories?museum_id=$museumId&per_page=500'),
        );
        if (sRes.statusCode == 200) {
          final d = jsonDecode(sRes.body);
          final list = (d['data'] as List?) ?? (d as List?) ?? [];
          stories = list.map((e) => Story.fromJson(e)).toList();
        }
      } catch (e) {
        debugPrint('Stories fetch failed (non-critical): $e');
      }

      // Step 6: Fetch learning resources
      onProgress(62, 'Downloading learning content...');
      List<LearningResource> learning = [];
      try {
        final lRes = await http.get(
          Uri.parse(
              '${ApiConfig.baseUrl}/learning?per_page=500'),
        );
        if (lRes.statusCode == 200) {
          final d = jsonDecode(lRes.body);
          final list = (d['data'] as List?) ?? (d as List?) ?? [];
          learning = list.map((e) => LearningResource.fromJson(e)).toList();
        }
      } catch (e) {
        debugPrint('Learning fetch failed (non-critical): $e');
      }

      // Step 7: Fetch exhibitions
      onProgress(68, 'Downloading exhibitions...');
      List<Exhibition> exhibitions = [];
      try {
        final eRes = await http.get(
          Uri.parse(
              '${ApiConfig.baseUrl}/exhibitions?museum_id=$museumId&per_page=100'),
        );
        if (eRes.statusCode == 200) {
          final d = jsonDecode(eRes.body);
          final list = (d['data'] as List?) ?? (d as List?) ?? [];
          exhibitions = list.map((e) => Exhibition.fromJson(e)).toList();
        }
      } catch (e) {
        debugPrint('Exhibitions fetch failed (non-critical): $e');
      }

      // Step 8: Pre-download media (images, audio)
      onProgress(75, 'Caching media for offline use...');
      int mediaDone = 0;
      int mediaTotal = 0;

      // Collect all media URLs
      List<MapEntry<String, String>> mediaQueue = [];
      for (var obj in objects) {
        if (obj.image != null && obj.image!.isNotEmpty) {
          mediaQueue.add(MapEntry(obj.image!, 'img_${obj.id}'));
        }
        if (obj.audioUrl != null && obj.audioUrl!.isNotEmpty) {
          mediaQueue.add(MapEntry(obj.audioUrl!, 'audio_${obj.id}'));
        }
        for (int i = 0; i < obj.images.length && i < 5; i++) {
          mediaQueue.add(MapEntry(obj.images[i], 'img_${obj.id}_$i'));
        }
      }
      mediaTotal = mediaQueue.length;

      // Download in batches of 3
      for (int i = 0; i < mediaQueue.length; i += 3) {
        final batch = mediaQueue.skip(i).take(3);
        await Future.wait(batch.map((entry) async {
          final localName = _urlToLocalName(entry.key);
          await _downloadFile(entry.key, localName);
          mediaDone++;
        }));
        final pct = 75 + ((mediaDone / (mediaTotal > 0 ? mediaTotal : 1)) * 15).round();
        onProgress(pct.clamp(75, 90), 'Caching media ($mediaDone/$mediaTotal)...');
      }

      // Step 9: Save everything to SQLite
      onProgress(92, 'Saving to device...');
      await saveMuseums(museums);
      await saveGalleries(galleries);
      await saveObjects(objects);
      await saveNodes(nodes);
      await saveEdges(edges);
      await saveFloorPlans(floorPlans);
      await saveStories(stories);
      await saveLearning(learning);
      await saveExhibitions(exhibitions);

      await _save(
          keyLastSync, DateTime.now().millisecondsSinceEpoch.toString());
      await _save(keySyncedMuseumId, museumId.toString());

      onProgress(100, 'Ready for offline use!');

      return {
        'museums': museums,
        'galleries': galleries,
        'objects': objects,
        'nodes': nodes,
        'edges': edges,
        'floor_plans': floorPlans,
        'stories': stories,
        'learning': learning,
        'exhibitions': exhibitions,
      };
    } catch (e) {
      throw Exception('Museum sync failed: $e');
    }
  }

  /// Legacy global sync — kept for backward compatibility.
  Future<Map<String, dynamic>> syncAll(
      Function(int, String) onProgress) async {
    try {
      onProgress(10, 'Fetching museums...');
      final mRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/museums?per_page=50'),
      );
      List<Museum> museums = [];
      if (mRes.statusCode == 200) {
        final d = jsonDecode(mRes.body);
        final list = (d['data'] as List?) ?? [];
        museums = list.map((e) => Museum.fromJson(e)).toList();
      }

      onProgress(30, 'Fetching galleries...');
      final gRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/galleries?per_page=100'),
      );
      List<Gallery> galleries = [];
      if (gRes.statusCode == 200) {
        final d = jsonDecode(gRes.body);
        final list = (d['data'] as List?) ?? [];
        galleries = list.map((e) => Gallery.fromJson(e)).toList();
      }

      onProgress(50, 'Fetching objects...');
      final oRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/objects?per_page=200'),
      );
      List<MuseumObject> objects = [];
      if (oRes.statusCode == 200) {
        final d = jsonDecode(oRes.body);
        final list = (d['data'] as List?) ?? [];
        objects = list.map((e) => MuseumObject.fromJson(e)).toList();
      }

      onProgress(70, 'Fetching map graph...');
      final graphRes = await http.get(
        Uri.parse('${ApiConfig.mapServiceUrl}/graph'),
      );
      List<MapNode> nodes = [];
      List<MapEdge> edges = [];
      List<FloorPlan> floorPlans = [];

      if (graphRes.statusCode == 200) {
        final d = jsonDecode(graphRes.body);

        final nodeList = (d['nodes'] as List?) ?? [];
        nodes = nodeList.map((e) => MapNode.fromJson(e)).toList();

        final edgeList = (d['edges'] as List?) ?? [];
        edges = edgeList.map((e) => MapEdge.fromJson(e)).toList();

        final planList = (d['floor_plans'] as List?) ?? [];
        floorPlans = planList.map((e) => FloorPlan.fromJson(e)).toList();
      }

      onProgress(90, 'Saving locally...');
      await saveMuseums(museums);
      await saveGalleries(galleries);
      await saveObjects(objects);
      await saveNodes(nodes);
      await saveEdges(edges);
      await saveFloorPlans(floorPlans);

      await _save(
          keyLastSync, DateTime.now().millisecondsSinceEpoch.toString());

      onProgress(100, 'Done');

      return {
        'museums': museums,
        'galleries': galleries,
        'objects': objects,
        'nodes': nodes,
        'edges': edges,
        'floor_plans': floorPlans,
      };
    } catch (e) {
      throw Exception('Sync failed: $e');
    }
  }

  /// Clears all cached database tables and metadata
  Future<void> clearAll() async {
    final db = await database;
    await db.delete(tableCache);
  }

  /// Clears cached museum content when museums are deleted or reset
  Future<void> clearMuseumData() async {
    final db = await database;
    await db.delete(tableCache, where: 'key IN (?, ?, ?, ?, ?, ?, ?, ?, ?)', whereArgs: [
      keyMuseums,
      keyGalleries,
      keyObjects,
      keyNodes,
      keyEdges,
      keyFloorPlans,
      keyStories,
      keyExhibitions,
      keyLearning,
    ]);
  }
}
