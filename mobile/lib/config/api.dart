class ApiConfig {
  // Production backend URL
  static const String baseUrl = 'https://vanalok.onrender.com/api';
  static const String mapServiceUrl = String.fromEnvironment('MAP_SERVICE_URL', defaultValue: 'http://127.0.0.1:5001/api');

  static String getMediaUrl(String path) {
    if (path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // Serve media files from the backend's root
    final host = baseUrl.replaceAll('/api', '');
    return '$host/uploads/$cleanPath';
  }
}

