import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mobile/models/museum_provider.dart';
import 'package:mobile/screens/entry_qr_scanner_screen.dart';
import 'package:mobile/screens/museum_selection_screen.dart';
import 'package:mobile/screens/sync_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget createTestWidget({Function(String)? onScanned}) {
    return ChangeNotifierProvider(
      create: (_) => MuseumProvider(),
      child: MaterialApp(
        home: EntryQRScannerScreen(onScannedForTesting: onScanned),
      ),
    );
  }

  group('EntryQRScannerScreen Tests', () {
    testWidgets('renders QR scanner UI with title, camera, and secondary browse link', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());

      expect(find.text('Scan Museum QR'), findsOneWidget);
      expect(find.text('Scan at the entrance to begin tour'), findsOneWidget);
      expect(find.text('Align entrance QR code inside the box'), findsOneWidget);
      expect(find.text('Browse museums instead'), findsOneWidget);
    });

    testWidgets('tapping "Browse museums instead" pushes MuseumSelectionScreen', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());

      await tester.tap(find.text('Browse museums instead'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byType(MuseumSelectionScreen), findsOneWidget);
    });

    testWidgets('valid museum QR code scan routes to SyncScreen', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());

      final state = tester.state(find.byType(EntryQRScannerScreen)) as dynamic;
      state.handleScanForTesting('vanalok://museum/1?entrance=main_gate');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byType(SyncScreen), findsOneWidget);
    });
  });
}
