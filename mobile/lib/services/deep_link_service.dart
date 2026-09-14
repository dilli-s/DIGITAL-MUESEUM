import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Parses deep link URIs from QR scans at museum entrances.
///
/// Supported formats:
/// - `https://vanalok.app/m/{museum_id}`
/// - `https://vanalok.app/m/{museum_id}?node={entrance_node_id}`
/// - `https://vanalok.app/museum/{museum_id}?node={entrance_node_id}`
/// - `vanalok://m/{museum_id}?node={entrance_node_id}`
/// - `vanalok://museum/{museum_id}?node={entrance_node_id}`
/// - Plain JSON: `{"museumId": 1, "startNodeId": "entrance_1"}`
/// - Plain integer museum ID
class DeepLinkService {
  static const _channel = MethodChannel('app.channel.shared.data');
  static const String _pendingMuseumKey = 'pending_deep_link_museum_id';
  static const String _pendingNodeKey = 'pending_deep_link_node_id';

  final _linkController = StreamController<DeepLinkPayload>.broadcast();

  Stream<DeepLinkPayload> get linkStream => _linkController.stream;

  DeepLinkService() {
    _init();
  }

  DeepLinkPayload? _cachedInitialPayload;
  bool _hasCheckedInitial = false;
  Future<DeepLinkPayload?>? _initialPayloadFuture;

  void _init() {
    // Check for incoming links while running
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onDeepLink') {
        final uri = call.arguments as String?;
        if (uri != null) {
          final payload = parseUri(uri);
          if (payload != null) {
            await persistPendingPayload(payload);
            _linkController.add(payload);
          }
        }
      }
    });
  }

  /// Check for an initial deep link from cold start or a deferred deep link.
  Future<DeepLinkPayload?> checkInitialPayload() async {
    if (_hasCheckedInitial) return _cachedInitialPayload;
    _initialPayloadFuture ??= _resolveInitialPayload();
    return await _initialPayloadFuture;
  }

  Future<DeepLinkPayload?> _resolveInitialPayload() async {
    try {
      final initialLink = await _channel
          .invokeMethod<String>('getInitialLink')
          .timeout(const Duration(milliseconds: 100));
      if (initialLink != null) {
        final payload = parseUri(initialLink);
        if (payload != null) {
          _cachedInitialPayload = payload;
          _hasCheckedInitial = true;
          return payload;
        }
      }
    } catch (_) {
      // No initial link or channel not available
    }

    try {
      _cachedInitialPayload = await consumePendingPayload().timeout(
        const Duration(milliseconds: 100),
      );
    } catch (_) {
      _cachedInitialPayload = null;
    }
    _hasCheckedInitial = true;
    return _cachedInitialPayload;
  }


  /// Persist a pending museum_id so first-time installs automatically open into it.
  static Future<void> persistPendingPayload(DeepLinkPayload payload) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_pendingMuseumKey, payload.museumId);
      if (payload.entranceNodeId != null) {
        await prefs.setString(_pendingNodeKey, payload.entranceNodeId!);
      } else {
        await prefs.remove(_pendingNodeKey);
      }
    } catch (e) {
      debugPrint('DeepLinkService.persistPendingPayload error: $e');
    }
  }

  /// Consume and clear the pending museum_id.
  static Future<DeepLinkPayload?> consumePendingPayload() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final mId = prefs.getInt(_pendingMuseumKey);
      if (mId != null && mId > 0) {
        final nId = prefs.getString(_pendingNodeKey);
        await prefs.remove(_pendingMuseumKey);
        await prefs.remove(_pendingNodeKey);
        return DeepLinkPayload(
          museumId: mId,
          entranceNodeId: nId,
          raw: 'persisted_deferred_link',
        );
      }
    } catch (e) {
      debugPrint('DeepLinkService.consumePendingPayload error: $e');
    }
    return null;
  }

  /// Parse a URI or raw QR string into a structured payload.
  /// Returns null if the format is unrecognized.
  static DeepLinkPayload? parseUri(String raw) {
    raw = raw.trim();
    if (raw.isEmpty) return null;

    // Try URI parsing first
    try {
      final uri = Uri.parse(raw);

      int? museumId;
      String? nodeId;
      String? roomId;

      // Handle custom scheme host (e.g., vanalok://museum/1 or vanalok://m/1)
      if ((uri.host == 'museum' || uri.host == 'm') && uri.pathSegments.isNotEmpty) {
        museumId = int.tryParse(uri.pathSegments.first);
      }

      // Handle path segments (e.g., https://vanalok.app/m/1 or https://vanalok.app/museum/1)
      if (museumId == null) {
        for (int i = 0; i < uri.pathSegments.length - 1; i++) {
          final seg = uri.pathSegments[i];
          if (seg == 'museum' || seg == 'm' || seg == 'museums') {
            museumId = int.tryParse(uri.pathSegments[i + 1]);
            if (museumId != null) break;
          }
        }
      }

      // Check for room path segment (e.g. /room/kitchen or /room/101)
      for (int i = 0; i < uri.pathSegments.length - 1; i++) {
        final seg = uri.pathSegments[i];
        if (seg == 'room' || seg == 'rooms' || seg == 'gallery') {
          roomId = uri.pathSegments[i + 1];
          break;
        }
      }
      roomId ??= uri.queryParameters['room'] ?? uri.queryParameters['room_id'] ?? uri.queryParameters['gallery'];

      // Also check if path is just /1 when host is 'm'
      if (museumId == null && uri.host == 'm' && uri.pathSegments.isNotEmpty) {
        museumId = int.tryParse(uri.pathSegments[0]);
      }

      // Check query parameter fallbacks (?museum_id=1 or ?museum=1 or ?id=1 or ?m=1)
      museumId ??= int.tryParse(uri.queryParameters['museum_id'] ?? '') ??
          int.tryParse(uri.queryParameters['museum'] ?? '') ??
          int.tryParse(uri.queryParameters['m'] ?? '') ??
          int.tryParse(uri.queryParameters['id'] ?? '');

      nodeId = uri.queryParameters['node'] ??
          uri.queryParameters['node_id'] ??
          uri.queryParameters['doorway'] ??
          uri.queryParameters['entrance'];

      final String qrType = roomId != null
          ? 'room_entrance'
          : (uri.host == 'object' || uri.path.contains('object'))
              ? 'exhibit'
              : 'museum_entrance';

      if (museumId != null) {
        return DeepLinkPayload(
          museumId: museumId,
          entranceNodeId: nodeId,
          roomId: roomId,
          doorwayNodeId: uri.queryParameters['doorway'] ?? nodeId,
          qrType: qrType,
          raw: raw,
        );
      }
    } catch (_) {}

    // Try JSON format: {"museumId": 1, "startNodeId": "entrance_1", "roomId": "kitchen"}
    if (raw.startsWith('{')) {
      try {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        final mId = data['museumId'] ?? data['museum_id'] ?? data['m'];
        final nId = data['startNodeId'] ?? data['nodeId'] ?? data['node_id'] ?? data['node'] ?? data['entrance'] ?? data['doorway'];
        final rId = data['roomId'] ?? data['room_id'] ?? data['room'];
        if (mId != null) {
          final museumId = mId is int ? mId : int.tryParse(mId.toString());
          if (museumId != null) {
            return DeepLinkPayload(
              museumId: museumId,
              entranceNodeId: nId?.toString(),
              roomId: rId?.toString(),
              doorwayNodeId: nId?.toString(),
              qrType: rId != null ? 'room_entrance' : 'museum_entrance',
              raw: raw,
            );
          }
        }
      } catch (_) {}
    }

    // Try plain museum ID
    final plainId = int.tryParse(raw);
    if (plainId != null && plainId > 0) {
      return DeepLinkPayload(museumId: plainId, qrType: 'museum_entrance', raw: raw);
    }

    return null;
  }

  void dispose() {
    _linkController.close();
  }
}

class DeepLinkPayload {
  final int museumId;
  final String? entranceNodeId;
  final String? roomId;
  final String? doorwayNodeId;
  final String qrType;
  final String raw;

  DeepLinkPayload({
    required this.museumId,
    this.entranceNodeId,
    this.roomId,
    this.doorwayNodeId,
    this.qrType = 'museum_entrance',
    this.raw = '',
  });

  @override
  String toString() =>
      'DeepLinkPayload(museumId: $museumId, entranceNodeId: $entranceNodeId, roomId: $roomId, qrType: $qrType)';
}
