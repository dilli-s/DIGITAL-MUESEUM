import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import '../config/api.dart';
import 'models.dart';
import '../services/offline_store.dart';

class FloorInfo {
  final String id;
  final String floorName;
  final int floorNumber;
  final String floorPlanId;
  final bool hasArtifacts;

  FloorInfo({
    required this.id,
    required this.floorName,
    required this.floorNumber,
    required this.floorPlanId,
    required this.hasArtifacts,
  });

  factory FloorInfo.fromJson(Map<String, dynamic> json) {
    return FloorInfo(
      id: json['id']?.toString() ?? '',
      floorName:
          json['name'] ??
          json['floor_name'] ??
          'Floor ${json['floor_number'] ?? 0}',
      floorNumber: (json['floor_number'] ?? json['floorNumber'] ?? 0) is int
          ? (json['floor_number'] ?? json['floorNumber'] ?? 0)
          : int.tryParse(
                  (json['floor_number'] ?? json['floorNumber'] ?? '0')
                      .toString(),
                ) ??
                0,
      floorPlanId:
          json['floor_plan_id']?.toString() ?? json['id']?.toString() ?? '',
      hasArtifacts: json['has_artifacts'] ?? json['artifact_count'] != null
          ? (json['artifact_count'] ?? 0) > 0
          : false,
    );
  }
}

class MuseumProvider extends ChangeNotifier {
  List<Museum> museums = [];
  Map<int, List<FloorInfo>> floorsByMuseum = {};
  int? selectedMuseumId;
  String? selectedFloorPlanId;
  bool isLoadingMuseums = false;
  bool isLoadingFloors = false;
  bool isUsingCachedData = false;
  String? errorMessage;
  bool locationPermissionGranted = false;
  Position? currentPosition;
  final OfflineStore _offlineStore = OfflineStore();

  Future<bool> _checkIfOffline() async {
    try {
      final results = await Connectivity().checkConnectivity();
      return !results.any((r) => r != ConnectivityResult.none);
    } catch (_) {
      return false;
    }
  }

  Future<void> fetchMuseums() async {
    isLoadingMuseums = true;
    errorMessage = null;
    notifyListeners();

    // Render the last successful dataset immediately while the API refreshes.
    try {
      final cachedMuseums = await _offlineStore.getMuseums();
      if (cachedMuseums.isNotEmpty) {
        museums = cachedMuseums;
        isUsingCachedData = true;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Unable to read cached museums: $e');
    }

    try {
      final isOffline = await _checkIfOffline();
      if (isOffline) {
        if (museums.isEmpty) {
          errorMessage = "You're offline. Check your connection.";
        }
        isLoadingMuseums = false;
        notifyListeners();
        return;
      }

      final response = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/museums?per_page=50'))
          .timeout(const Duration(seconds: 12));

      if (response.statusCode >= 500 && response.statusCode < 600) {
        throw HttpException(
          'Server error (${response.statusCode}). Try again shortly.',
        );
      } else if (response.statusCode != 200) {
        throw HttpException('Unable to load museums (${response.statusCode})');
      }

      final decoded = jsonDecode(response.body);
      final items = (decoded['data'] as List?) ?? [];
      museums = items.map((e) => Museum.fromJson(e)).toList();
      isUsingCachedData = false;
      await _offlineStore.saveMuseums(museums);

      if (museums.isNotEmpty) {
        await Future.wait(
          museums.map((museum) => fetchFloorsForMuseum(museum.id)),
        );
      }
    } on TimeoutException catch (e) {
      debugPrint('Timeout fetching museums: $e');
      if (museums.isEmpty) {
        errorMessage =
            'Connection timed out. Please check your network and try again.';
      }
    } on SocketException catch (e) {
      debugPrint('Network error fetching museums: $e');
      final isOffline = await _checkIfOffline();
      if (museums.isEmpty) {
        errorMessage = isOffline
            ? "You're offline. Check your connection."
            : 'Unable to connect to server (${e.message.isNotEmpty ? e.message : 'network error'}).';
      }
    } on http.ClientException catch (e) {
      debugPrint('ClientException fetching museums: $e');
      final isOffline = await _checkIfOffline();
      if (museums.isEmpty) {
        errorMessage = isOffline
            ? "You're offline. Check your connection."
            : 'Network connection failed: ${e.message}';
      }
    } catch (e) {
      debugPrint('Unexpected error fetching museums: $e');
      if (museums.isEmpty) {
        if (e is HttpException) {
          errorMessage = e.message;
        } else {
          errorMessage = 'Unable to load museums right now. Please try again.';
        }
      }
    } finally {
      isLoadingMuseums = false;
      notifyListeners();
    }
  }

  Future<List<FloorInfo>> fetchFloorsForMuseum(int museumId) async {
    isLoadingFloors = true;
    notifyListeners();

    try {
      final response = await http
          .get(
            Uri.parse(
              '${ApiConfig.mapServiceUrl}/floor-plans?museum_id=$museumId',
            ),
          )
          .timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final rows = (decoded['data'] as List?) ?? (decoded as List?) ?? [];
        final floors = rows.map((e) => FloorInfo.fromJson(e)).toList();
        floorsByMuseum[museumId] = floors;
        return floors;
      }
      floorsByMuseum[museumId] = [];
      return [];
    } catch (e) {
      debugPrint('ERROR fetching floors for museum $museumId from ${ApiConfig.mapServiceUrl}/floor-plans?museum_id=$museumId: $e');
      
      // Offline fallback
      try {
        final cachedPlans = await _offlineStore.getFloorPlans();
        if (cachedPlans.isNotEmpty) {
          // All cached plans are from the sync which is scoped to the museum
          final floors = cachedPlans.map((p) => FloorInfo(
            id: p.id,
            floorName: p.name,
            floorNumber: p.floorNumber,
            floorPlanId: p.id,
            hasArtifacts: true, // Safe fallback value
          )).toList();
          floorsByMuseum[museumId] = floors;
          return floors;
        }
      } catch (cacheError) {
        debugPrint('Unable to read cached floor plans: $cacheError');
      }
      
      floorsByMuseum[museumId] = [];
      return [];
    } finally {
      isLoadingFloors = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> fetchFloorPlanMetadata(
    String floorPlanId,
  ) async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.mapServiceUrl}/floor-plans/$floorPlanId'),
      );
      if (response.statusCode != 200) return null;
      final decoded = jsonDecode(response.body);
      return decoded['data'] ?? decoded;
    } catch (_) {
      return null;
    }
  }

  void setSelectedMuseum(int museumId) {
    selectedMuseumId = museumId;
    selectedFloorPlanId = null;
    notifyListeners();
  }

  void setSelectedFloor(String floorPlanId, {Map<String, dynamic>? floorData}) {
    selectedFloorPlanId = floorPlanId;
    notifyListeners();
  }

  Future<void> requestLocationPermission() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      locationPermissionGranted =
          permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always;
    } catch (e) {
      debugPrint('Location permission check failed: $e');
      locationPermissionGranted = false;
    }
    notifyListeners();
  }

  void updateCurrentPosition(Position? position) {
    currentPosition = position;
    notifyListeners();
  }

  String getDistanceLabel(Museum museum) {
    if (!locationPermissionGranted ||
        currentPosition == null ||
        museum.latitude == null ||
        museum.longitude == null) {
      return '—';
    }

    final meters = Geolocator.distanceBetween(
      currentPosition!.latitude,
      currentPosition!.longitude,
      museum.latitude!,
      museum.longitude!,
    );
    if (meters < 1000) {
      return '${meters.round()} m away';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km away';
  }

  double haversineDistanceKm(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const earthRadius = 6371.0;
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);
    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(_degToRad(lat1)) *
            cos(_degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    return 2 * earthRadius * asin(sqrt(a));
  }

  double _degToRad(double deg) => deg * (pi / 180);
}
