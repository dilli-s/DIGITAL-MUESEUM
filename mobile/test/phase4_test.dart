import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/widgets/object_detail_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final fullObject = MuseumObject(
    id: 101,
    museumId: 1,
    galleryId: 1,
    name: 'Chola Bronze Nataraja',
    category: 'Bronze Sculpture',
    period: '11th Century CE',
    origin: 'Thanjavur, Tamil Nadu',
    localName: 'ஆடவல்லான்',
    commonName: 'Dancing Shiva',
    scientificName: 'Cast Cu-Sn-Pb bronze alloy',
    description: 'A masterpiece representing the cosmic dance of creation and destruction.',
    significance: 'Exemplifies the artistic pinnacle of Chola metalwork and lost-wax casting.',
    facts: [
      'Cast using the cire perdue (lost-wax) technique',
      'The ring of fire represents the cycle of cosmic time',
    ],
    images: ['uploads/nataraja_side.jpg', 'uploads/nataraja_back.jpg'],
    image: 'uploads/nataraja_main.jpg',
    audioUrl: 'static/audio/nataraja.mp3',
    videoUrl: 'static/video/nataraja_reel.mp4',
    model3dUrl: 'models/nataraja.glb',
  );

  final emptyObject = MuseumObject(
    id: 102,
    museumId: 1,
    galleryId: 1,
    name: 'Minimal Artifact',
    category: '',
    period: null,
    origin: '   ',
    localName: null,
    commonName: '  ',
    scientificName: null,
    description: '  ',
    significance: null,
    facts: const [],
    images: const [],
    image: null,
    audioUrl: null,
    videoUrl: null,
    model3dUrl: null,
  );

  group('Phase 4 — ObjectDetailSheet Field Resilience', () {
    testWidgets('renders all available metadata for full object', (tester) async {
      bool exploreMorePressed = false;
      bool closePressed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ObjectDetailSheet(
              obj: fullObject,
              onClose: () => closePressed = true,
              onExploreMore: () => exploreMorePressed = true,
            ),
          ),
        ),
      );

      // Verify title, category, metadata
      expect(find.text('Chola Bronze Nataraja'), findsOneWidget);
      expect(find.text('BRONZE SCULPTURE'), findsOneWidget);
      expect(find.text('11th Century CE · Thanjavur, Tamil Nadu'), findsOneWidget);
      expect(find.textContaining('ஆடவல்லான்'), findsOneWidget);
      expect(find.textContaining('Dancing Shiva'), findsOneWidget);
      expect(find.textContaining('Cast Cu-Sn-Pb bronze alloy'), findsOneWidget);

      // Verify sections
      expect(find.text('Significance'), findsOneWidget);
      expect(find.text('Interesting Facts'), findsOneWidget);
      expect(find.text('• Cast using the cire perdue (lost-wax) technique'), findsOneWidget);

      // Verify Explore More button
      expect(find.text('Explore More'), findsOneWidget);
      await tester.ensureVisible(find.text('Explore More'));
      await tester.tap(find.text('Explore More'));
      expect(exploreMorePressed, isTrue);

      // Verify Close button
      expect(find.text('Close'), findsOneWidget);
      await tester.ensureVisible(find.text('Close'));
      await tester.tap(find.text('Close'));
      expect(closePressed, isTrue);
    });

    testWidgets('gracefully omits empty sections for minimal object', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ObjectDetailSheet(
              obj: emptyObject,
              onClose: () {},
            ),
          ),
        ),
      );

      expect(find.text('Minimal Artifact'), findsOneWidget);
      expect(find.text('ARTIFACT'), findsOneWidget); // Default fallback category

      // None of the empty sections should appear
      expect(find.text('Significance'), findsNothing);
      expect(find.text('Interesting Facts'), findsNothing);
      expect(find.text('More Images'), findsNothing);
      expect(find.text('Audio Guide'), findsNothing);
      expect(find.text('Video / Animation'), findsNothing);
      expect(find.text('3D Model'), findsNothing);
      expect(find.text('Close'), findsOneWidget);
    });
  });
}
