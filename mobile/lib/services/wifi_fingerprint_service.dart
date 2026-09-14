import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:wifi_scan/wifi_scan.dart';
import '../config/api.dart';

class WifiEstimateResult {
  final bool isConfident;
  final double? x;
  final double? y;
  final double confidence;
  final String status;
  final String? message;

  WifiEstimateResult({
    required this.isConfident,
    this.x,
    this.y,
    required this.confidence,
    required this.status,
    this.message,
  });
}

class WifiCoverageResult {
  final String roomId;
  final int count;
  final bool isSparse;
  final String status;
  final String message;

  WifiCoverageResult({
    required this.roomId,
    required this.count,
    required this.isSparse,
    required this.status,
    required this.message,
  });
}

class ScannedWifiNetwork {
  final String bssid;
  final String ssid;
  final int level; // dBm
  final int frequency; // MHz
  final String capabilities;

  const ScannedWifiNetwork({
    required this.bssid,
    required this.ssid,
    required this.level,
    this.frequency = 0,
    this.capabilities = '',
  });

  /// True if SSID is empty or blank
  bool get isHidden => ssid.trim().isEmpty;

  /// Human-friendly frequency band display
  String get frequencyBand {
    if (frequency >= 2400 && frequency <= 2500) return '2.4 GHz';
    if (frequency >= 4900 && frequency <= 5900) return '5 GHz';
    if (frequency >= 5925 && frequency <= 7125) return '6 GHz';
    return frequency > 0 ? '$frequency MHz' : '';
  }

  Map<String, dynamic> toReadingMap() {
    return {
      'bssid': bssid,
      'rssi': level,
      'ssid': ssid,
    };
  }
}

class WifiFingerprintService {
  static final WifiFingerprintService _instance = WifiFingerprintService._internal();
  factory WifiFingerprintService() => _instance;
  WifiFingerprintService._internal();

  /// Platform constraint: iOS strictly forbids scanning nearby WiFi networks.
  /// This feature is Android-only. Never fake or stub on iOS.
  bool get isSupported {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.android;
  }

  /// Check if device is allowed and able to scan WiFi
  Future<bool> canScan() async {
    if (!isSupported) return false;
    try {
      final can = await WiFiScan.instance.canStartScan(askPermissions: false);
      return can == CanStartScan.yes;
    } catch (e) {
      debugPrint('WifiFingerprintService.canScan error: $e');
      return false;
    }
  }

  /// Scan for nearby WiFi access points (Android only) and return rich network objects,
  /// sorted by signal strength (level in dBm) descending (strongest APs first).
  Future<List<ScannedWifiNetwork>> scanDetectedNetworks() async {
    if (!isSupported) return [];

    try {
      final can = await WiFiScan.instance.canStartScan(askPermissions: false);
      if (can == CanStartScan.yes) {
        await WiFiScan.instance.startScan();
      }

      final canGet = await WiFiScan.instance.canGetScannedResults(askPermissions: false);
      if (canGet != CanGetScannedResults.yes) {
        debugPrint('WifiFingerprintService: Cannot get scan results: $canGet');
        return [];
      }

      final accessPoints = await WiFiScan.instance.getScannedResults();
      final networks = <ScannedWifiNetwork>[];
      for (final ap in accessPoints) {
        if (ap.bssid.isNotEmpty) {
          networks.add(ScannedWifiNetwork(
            bssid: ap.bssid,
            ssid: ap.ssid,
            level: ap.level,
            frequency: ap.frequency,
            capabilities: ap.capabilities,
          ));
        }
      }
      // Sort by signal strength descending (e.g. -45 dBm before -80 dBm)
      networks.sort((a, b) => b.level.compareTo(a.level));
      return networks;
    } catch (e) {
      debugPrint('WifiFingerprintService.scanDetectedNetworks error: $e');
      return [];
    }
  }

  /// Scan for nearby WiFi access points (Android only).
  /// Returns empty list on iOS or if scanning fails.
  Future<List<Map<String, dynamic>>> scanCurrentReadings() async {
    final networks = await scanDetectedNetworks();
    return networks.map((n) => n.toReadingMap()).toList();
  }

  String? lastErrorMessage;

  /// Store one surveyed WiFi fingerprint for a room
  Future<bool> captureFingerprint({
    required String roomId,
    required double x,
    required double y,
    required List<Map<String, dynamic>> readings,
  }) async {
    lastErrorMessage = null;
    if (!isSupported) {
      lastErrorMessage = 'WiFi Scanning is not supported on iOS (Apple restricts WiFi network scanning).';
      debugPrint('WifiFingerprintService: Capture rejected - iOS / unsupported platform');
      return false;
    }

    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/fingerprints/capture');
      final resp = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'room_id': roomId,
          'x': x,
          'y': y,
          'readings': readings,
        }),
      ).timeout(const Duration(seconds: 10));

      if (resp.statusCode == 200 || resp.statusCode == 201) {
        return true;
      }

      try {
        final data = jsonDecode(resp.body);
        if (data is Map && data['error'] != null) {
          lastErrorMessage = data['error'].toString().trim();
        } else {
          lastErrorMessage = 'Server returned HTTP ${resp.statusCode}';
        }
      } catch (_) {
        lastErrorMessage = 'Server returned HTTP ${resp.statusCode}: ${resp.body}';
      }

      debugPrint('WifiFingerprintService.captureFingerprint error: $lastErrorMessage');
      return false;
    } catch (e) {
      lastErrorMessage = 'Network error: $e';
      debugPrint('WifiFingerprintService.captureFingerprint error: $e');
      return false;
    }
  }

  /// Fetch coverage check for a room
  Future<WifiCoverageResult?> checkCoverage(String roomId) async {
    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/fingerprints/coverage/$roomId');
      final resp = await http.get(url).timeout(const Duration(seconds: 8));

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        return WifiCoverageResult(
          roomId: roomId,
          count: (data['count'] as num?)?.toInt() ?? 0,
          isSparse: data['is_sparse'] == true,
          status: data['status']?.toString() ?? 'unknown',
          message: data['message']?.toString() ?? '',
        );
      }
    } catch (e) {
      debugPrint('WifiFingerprintService.checkCoverage error: $e');
    }
    return null;
  }

  /// Fetch list of surveyed fingerprints for a room
  Future<List<Map<String, dynamic>>> getRoomFingerprints(String roomId) async {
    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/fingerprints/room/$roomId');
      final resp = await http.get(url).timeout(const Duration(seconds: 8));

      if (resp.statusCode == 200) {
        final list = jsonDecode(resp.body);
        if (list is List) {
          return list.cast<Map<String, dynamic>>();
        }
      }
    } catch (e) {
      debugPrint('WifiFingerprintService.getRoomFingerprints error: $e');
    }
    return [];
  }

  /// Delete a fingerprint by ID
  Future<bool> deleteFingerprint(String fingerprintId) async {
    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/fingerprints/$fingerprintId');
      final resp = await http.delete(url).timeout(const Duration(seconds: 8));
      return resp.statusCode == 200;
    } catch (e) {
      debugPrint('WifiFingerprintService.deleteFingerprint error: $e');
      return false;
    }
  }

  /// Query live WiFi position estimate
  Future<WifiEstimateResult?> estimatePosition({
    required String roomId,
    required List<Map<String, dynamic>> readings,
    int k = 3,
  }) async {
    if (!isSupported || readings.isEmpty) return null;

    try {
      final url = Uri.parse('${ApiConfig.mapServiceUrl}/fingerprints/estimate');
      final resp = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'room_id': roomId,
          'readings': readings,
          'k': k,
        }),
      ).timeout(const Duration(seconds: 6));

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        final status = data['status']?.toString() ?? 'unknown';
        final confidence = (data['confidence'] as num?)?.toDouble() ?? 0.0;
        final coord = data['coordinate'] as Map<String, dynamic>?;

        if (status == 'ok' && coord != null && confidence >= 0.40) {
          return WifiEstimateResult(
            isConfident: true,
            x: (coord['x'] as num?)?.toDouble(),
            y: (coord['y'] as num?)?.toDouble(),
            confidence: confidence,
            status: status,
            message: data['message']?.toString(),
          );
        } else {
          return WifiEstimateResult(
            isConfident: false,
            confidence: confidence,
            status: status,
            message: data['message']?.toString(),
          );
        }
      }
    } catch (e) {
      debugPrint('WifiFingerprintService.estimatePosition error: $e');
    }
    return null;
  }
}
