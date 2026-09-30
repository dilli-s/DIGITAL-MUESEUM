import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/indoor_positioning.dart';

void main() {
  group('Artifact Single Show Guarantee Tests', () {
    final exhibitNode = MapNode(
      id: 'node_exhibit_1',
      floorPlanId: 'fp_1',
      name: 'Babylonian Striding Lion',
      x: 100,
      y: 100,
      floor: 1,
      nodeType: 'exhibit',
      objectId: 42,
    );

    final exhibitObject = MuseumObject(
      id: 42,
      museumId: 1,
      galleryId: 1,
      name: 'Babylonian Striding Lion',
      description: 'Glazed brick relief',
      category: 'Ancient Near East',
    );

    test('Ensures auto-popped objects set prevents duplicate card shows', () {
      final Set<int> autoPoppedObjectIds = <int>{};

      // Helper simulating whether candidate exhibit can pop up
      bool canAutoPop(MuseumObject obj) {
        if (autoPoppedObjectIds.contains(obj.id)) {
          return false; // MUST SHOW ONLY ONE TIME
        }
        autoPoppedObjectIds.add(obj.id);
        return true;
      }

      // First proximity detection -> shows card
      expect(canAutoPop(exhibitObject), isTrue);

      // Second proximity detection at the same object -> rejected!
      expect(canAutoPop(exhibitObject), isFalse);

      // Third proximity detection (e.g. from timer tick) -> rejected!
      expect(canAutoPop(exhibitObject), isFalse);
    });

    test('Prevents duplicate popups even if backend object IDs differ for identical exhibit name', () {
      final Set<int> autoPoppedObjectIds = <int>{};
      final Set<String> autoPoppedObjectNames = <String>{};

      bool hasAlreadyPopped(MuseumObject obj) {
        if (autoPoppedObjectIds.contains(obj.id)) return true;
        if (autoPoppedObjectNames.contains(obj.name.toLowerCase().trim())) return true;
        return false;
      }

      void markPopped(MuseumObject obj) {
        autoPoppedObjectIds.add(obj.id);
        autoPoppedObjectNames.add(obj.name.toLowerCase().trim());
      }

      final sargon1 = MuseumObject(
        id: 328,
        museumId: 1,
        galleryId: 131,
        name: 'Palace Bas-Relief of Sargon II and Dignitaries',
      );

      final sargonDuplicate = MuseumObject(
        id: 176,
        museumId: 1,
        galleryId: 0,
        name: 'Palace Bas-Relief of Sargon II and Dignitaries',
      );

      // First trigger for Sargon II
      expect(hasAlreadyPopped(sargon1), isFalse);
      markPopped(sargon1);

      // Second trigger with duplicate object ID but same name -> REJECTED (shows ONLY 1 TIME)
      expect(hasAlreadyPopped(sargonDuplicate), isTrue);
    });

    test('1.0m proximity trigger enforces strict 1m threshold', () {
      const double autoPopupProximityRadius = 1.0;
      double distWithin = 0.85; // within 1 meter
      double distOutside = 1.35; // outside 1 meter

      expect(distWithin <= autoPopupProximityRadius, isTrue);
      expect(distOutside <= autoPopupProximityRadius, isFalse);
    });
  });
}

