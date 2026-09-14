import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models/museum_provider.dart';
import 'screens/entry_qr_scanner_screen.dart';
import 'screens/physical_museum_screen.dart';
import 'screens/sync_screen.dart';
import 'services/deep_link_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  late final DeepLinkService _deepLinkService;
  StreamSubscription<DeepLinkPayload>? _deepLinkSubscription;
  DeepLinkPayload? _initialPayload;
  bool _isCheckingDeepLink = true;

  @override
  void initState() {
    super.initState();
    _deepLinkService = DeepLinkService();
    _deepLinkSubscription = _deepLinkService.linkStream.listen(_handleDeepLink);
    _checkInitialDeepLink();
  }

  Future<void> _checkInitialDeepLink() async {
    try {
      final payload = await _deepLinkService.checkInitialPayload();
      if (mounted) {
        setState(() {
          _initialPayload = payload;
          _isCheckingDeepLink = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isCheckingDeepLink = false;
        });
      }
    }
  }

  void _handleDeepLink(DeepLinkPayload payload) {
    debugPrint('Received entrance deep link: $payload');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final nav = _navigatorKey.currentState;
      if (nav != null) {
        nav.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => SyncScreen(
              museumId: payload.museumId,
              entranceNodeId: payload.entranceNodeId,
            ),
          ),
          (route) => false,
        );
      }
    });
  }

  @override
  void dispose() {
    _deepLinkSubscription?.cancel();
    _deepLinkService.dispose();
    super.dispose();
  }

  Widget _buildHome(bool hasSelectedContext) {
    if (_isCheckingDeepLink) {
      return const Scaffold(
        backgroundColor: Color(0xFFF7F5F0),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(0xFFD65F45),
          ),
        ),
      );
    }

    if (_initialPayload != null) {
      return SyncScreen(
        museumId: _initialPayload!.museumId,
        entranceNodeId: _initialPayload!.entranceNodeId,
      );
    }

    return hasSelectedContext
        ? const PhysicalMuseumScreen()
        : const EntryQRScannerScreen();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => MuseumProvider(),
      child: Consumer<MuseumProvider>(
        builder: (context, provider, _) {
          final hasSelectedContext =
              provider.selectedMuseumId != null &&
              provider.selectedFloorPlanId != null;

          return MaterialApp(
            navigatorKey: _navigatorKey,
            title: 'Digital Museum',
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(
                seedColor: const Color(0xFFD65F45),
                brightness: Brightness.light,
                surface: const Color(0xFFF7F5F0),
              ),
              scaffoldBackgroundColor: const Color(0xFFF7F5F0),
              fontFamily: 'sans',
              appBarTheme: const AppBarTheme(
                backgroundColor: Color(0xFFF7F5F0),
                foregroundColor: Color(0xFF17211F),
                elevation: 0,
                centerTitle: false,
              ),
              cardTheme: CardThemeData(
                color: Colors.white,
                elevation: 0,
                margin: EdgeInsets.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                  side: const BorderSide(color: Color(0xFFE6E2D9)),
                ),
              ),
              elevatedButtonTheme: ElevatedButtonThemeData(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD65F45),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  textStyle: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              useMaterial3: true,
            ),
            home: _buildHome(hasSelectedContext),
          );
        },
      ),
    );
  }
}
