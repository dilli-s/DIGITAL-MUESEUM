class ApiConfig {
  // Production backend URL with environment overrides
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    // Physical USB devices use adb reverse with 127.0.0.1; emulators can override this with
    // --dart-define=API_BASE_URL=http://10.0.2.2:5000/api.
    defaultValue: 'http://127.0.0.1:5000/api',
  );

  static String get mapServiceUrl {
    const envUrl = String.fromEnvironment('MAP_SERVICE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    
    // Derive host from baseUrl to support physical devices
    try {
      final baseUri = Uri.parse(baseUrl);
      if (baseUri.hasPort) {
        return baseUri.replace(port: 5001).toString();
      }
    } catch (_) {}
    
    return 'http://127.0.0.1:5001/api';
  }

  static String getMediaUrl(String path) {
    if (path.isEmpty) return '';
    final host = baseUrl.replaceAll('/api', '');
    if (path.startsWith('http://localhost:5000') || path.startsWith('http://127.0.0.1:5000')) {
      final sub = path.replaceFirst(RegExp(r'^http:\/\/(localhost|127\.0\.0\.1):5000'), '');
      return '$host$sub';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    var cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring(8);
    }
    // Serve media files from the backend's root
    return '$host/uploads/$cleanPath';
  }

  static String getFloorPlanImageUrl(String path) {
    if (path.isEmpty) return '';
    final mapHost = mapServiceUrl.replaceAll('/api', '');
    if (path.startsWith('http://localhost:5001') || path.startsWith('http://127.0.0.1:5001')) {
      final sub = path.replaceFirst(RegExp(r'^http:\/\/(localhost|127\.0\.0\.1):5001'), '');
      return '$mapHost$sub';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/api/')) {
      return '$mapHost$path';
    }
    final cleanPath = path.startsWith('/') ? path : '/$path';
    if (cleanPath.startsWith('/static/uploads/')) {
      return '$mapHost/api$cleanPath';
    }
    return '$mapHost/api/static/uploads$cleanPath';
  }
}
