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
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // Serve media files from the backend's root
    final host = baseUrl.replaceAll('/api', '');
    return '$host/uploads/$cleanPath';
  }

  static String getFloorPlanImageUrl(String path) {
    if (path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final mapHost = mapServiceUrl.replaceAll('/api', '');
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
