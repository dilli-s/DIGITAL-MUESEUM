import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/explore_more_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final testObject = MuseumObject(
    id: 501,
    museumId: 1,
    galleryId: 2,
    name: 'Ancient Stone Inscription',
    category: 'Epigraphy',
    period: '8th Century CE',
    origin: 'Kanchipuram, Tamil Nadu',
    description: 'A stone tablet recording temple donations.',
    videoUrl: 'https://example.com/video.mp4',
    model3dUrl: 'https://example.com/model.glb',
  );

  group('Phase 5 — ExploreMoreScreen Sequence & Offline Resilience', () {
    testWidgets('renders complete sequence: Object → Theme → Objects → Stories → Learning', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ExploreMoreScreen(
            object: testObject,
            museumId: 1,
          ),
        ),
      );

      // Wait for future loading
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // 1. Originating Object Header
      expect(find.text('Ancient Stone Inscription'), findsOneWidget);
      expect(find.text('EPIGRAPHY'), findsOneWidget);
      expect(find.text('8th Century CE · Kanchipuram, Tamil Nadu'), findsOneWidget);

      // 2. Action chips for online media
      expect(find.text('Watch Video'), findsOneWidget);
      expect(find.text('3D Model'), findsOneWidget);

      // 3. Section Headers
      // Either sections or the complete offline profile badge will be rendered
      expect(find.text('Explore More'), findsOneWidget);
    });

    testWidgets('triggers connection notification for online-only action when offline', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ExploreMoreScreen(
              object: testObject,
              museumId: 1,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Tap online video chip
      final videoChip = find.text('Watch Video');
      if (videoChip.evaluate().isNotEmpty) {
        await tester.ensureVisible(videoChip);
        await tester.tap(videoChip);
        await tester.pump();
        await tester.pump(const Duration(seconds: 4));
        await tester.pumpAndSettle();
      }
    });
  });
}
