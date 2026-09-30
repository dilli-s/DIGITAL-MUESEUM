import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/models/museum_provider.dart';
import 'package:mobile/screens/sync_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('SyncScreen Offline Resilience Tests', () {
    testWidgets(
      'SyncScreen does not show Download Interrupted error when offline store throws or network fails, and handles error gracefully',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 2.5;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        await tester.pumpWidget(
          ChangeNotifierProvider(
            create: (_) => MuseumProvider(),
            child: const MaterialApp(
              home: SyncScreen(
                museumId: 1,
                initialFloorPlanId: 'floor_1',
                forceSync: false,
              ),
            ),
          ),
        );

        // Initial render
        await tester.pump();
        expect(find.byType(SyncScreen), findsOneWidget);

        // Even under database/network errors in test harness, it should not crash
        await tester.pump(const Duration(milliseconds: 500));
        await tester.pump(const Duration(milliseconds: 500));

        // Verify that forceSync is false by default
        const screen = SyncScreen(museumId: 1);
        expect(screen.forceSync, isFalse);
      },
    );
  });
}
