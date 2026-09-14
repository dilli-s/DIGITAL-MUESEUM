import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:mobile/main.dart';
import 'package:mobile/models/museum_provider.dart';
import 'package:mobile/screens/entry_qr_scanner_screen.dart';
import 'package:mobile/screens/museum_selection_screen.dart';
import 'package:mobile/screens/sync_screen.dart';
import 'package:mobile/services/deep_link_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('app.channel.shared.data');

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('Part B: QR-First Entry Flow vs Manual Selection Fallback', () {
    testWidgets(
      '1. Opening via QR deep link skips selection screen and goes straight to SyncScreen',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 2.5;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        // Mock a pending QR deep link
        await DeepLinkService.persistPendingPayload(
          DeepLinkPayload(museumId: 42, entranceNodeId: 'gate_alpha'),
        );

        await tester.pumpWidget(const MyApp());
        // Allow checkInitialPayload async future to complete
        await tester.pump();
        await tester.pump();

        // SyncScreen must be present
        expect(find.byType(SyncScreen), findsOneWidget);
        // MuseumSelectionScreen must be skipped
        expect(find.byType(MuseumSelectionScreen), findsNothing);
        expect(find.text('Where will\nyour curiosity lead?'), findsNothing);
      },
    );

    testWidgets(
      '2. Opening app cold (no QR) shows EntryQRScannerScreen and gates MuseumSelectionScreen',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 2.5;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        // No pending deep link in shared preferences (cold launch)
        await tester.pumpWidget(const MyApp());
        await tester.pump();
        await tester.pump();

        // EntryQRScannerScreen must be rendered
        expect(find.byType(EntryQRScannerScreen), findsOneWidget);
        expect(find.text('Scan Museum QR'), findsOneWidget);
        expect(find.text('Browse museums instead'), findsOneWidget);

        // MuseumSelectionScreen must NOT be shown by default
        expect(find.byType(MuseumSelectionScreen), findsNothing);
        expect(find.text('Where will\nyour curiosity lead?'), findsNothing);
        expect(find.byType(SyncScreen), findsNothing);

        // Tapping the secondary text button opens MuseumSelectionScreen
        await tester.tap(find.text('Browse museums instead'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));

        expect(find.byType(MuseumSelectionScreen), findsOneWidget);
      },
    );

    testWidgets(
      '3. MuseumSelectionScreen shows back button when showBackButton is true or can pop',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 2.5;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        // Case A: showBackButton explicitly true
        await tester.pumpWidget(
          ChangeNotifierProvider(
            create: (_) => MuseumProvider(),
            child: const MaterialApp(
              home: MuseumSelectionScreen(showBackButton: true),
            ),
          ),
        );
        await tester.pump();

        expect(find.byIcon(LucideIcons.arrowLeft), findsOneWidget);

        // Case B: root route without showBackButton
        await tester.pumpWidget(
          ChangeNotifierProvider(
            create: (_) => MuseumProvider(),
            child: const MaterialApp(
              home: MuseumSelectionScreen(showBackButton: false),
            ),
          ),
        );
        await tester.pump();

        expect(find.byIcon(LucideIcons.arrowLeft), findsNothing);
      },
    );
  });
}
