import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

import '../config/api.dart';
import '../models/models.dart';
import '../models/navigation_models.dart';

class OfflineStore {
  static const String keyMuseums = 'offline_museums';
  static const String keyGalleries = 'offline_galleries';
  static const String keyObjects = 'offline_objects';
  static const String keyNodes = 'offline_nodes';
  static const String keyEdges = 'offline_edges';
  static const String keyFloorPlans = 'offline_floor_plans';
  static const String keyLastSync = 'offline_last_sync';

  Future<void> saveMuseums(List<Museum> museums) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(museums.map((m) => m.toJson()).toList());
    await prefs.setString(keyMuseums, jsonString);
  }

  Future<List<Museum>> getMuseums() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyMuseums);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Museum.fromJson(j)).toList();
  }

  Future<void> saveGalleries(List<Gallery> galleries) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(galleries.map((g) => g.toJson()).toList());
    await prefs.setString(keyGalleries, jsonString);
  }

  Future<List<Gallery>> getGalleries() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyGalleries);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => Gallery.fromJson(j)).toList();
  }

  Future<void> saveObjects(List<MuseumObject> objects) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(objects.map((o) => o.toJson()).toList());
    await prefs.setString(keyObjects, jsonString);
  }

  Future<List<MuseumObject>> getObjects() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyObjects);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MuseumObject.fromJson(j)).toList();
  }

  Future<void> saveNodes(List<MapNode> nodes) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(nodes.map((n) => n.toJson()).toList());
    await prefs.setString(keyNodes, jsonString);
  }

  Future<List<MapNode>> getNodes() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyNodes);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MapNode.fromJson(j)).toList();
  }

  Future<void> saveEdges(List<MapEdge> edges) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(edges.map((e) => e.toJson()).toList());
    await prefs.setString(keyEdges, jsonString);
  }

  Future<List<MapEdge>> getEdges() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyEdges);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => MapEdge.fromJson(j)).toList();
  }

  Future<void> saveFloorPlans(List<FloorPlan> plans) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(plans.map((p) => p.toJson()).toList());
    await prefs.setString(keyFloorPlans, jsonString);
  }

  Future<List<FloorPlan>> getFloorPlans() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(keyFloorPlans);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => FloorPlan.fromJson(j)).toList();
  }

  Future<int?> getLastSync() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(keyLastSync);
  }

  Future<Map<String, dynamic>> syncAll(Function(int, String) onProgress) async {
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

      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(keyLastSync, DateTime.now().millisecondsSinceEpoch);

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
}
