#!/bin/bash
# Remove all ! operators that could throw null check exceptions in dart files

sed -i 's/selectedMuseum!.id/selectedMuseum?.id/g' lib/screens/physical_museum_screen.dart
sed -i 's/selectedGallery!.id/selectedGallery?.id/g' lib/screens/physical_museum_screen.dart
sed -i 's/selectedGallery!.description!/selectedGallery?.description ?? ""/g' lib/screens/physical_museum_screen.dart
sed -i 's/selectedGallery!.name/selectedGallery?.name ?? ""/g' lib/screens/physical_museum_screen.dart
sed -i 's/selectedObject!/selectedObject/g' lib/screens/physical_museum_screen.dart
sed -i 's/obj.image!/obj.image ?? ""/g' lib/widgets/offline_object_card.dart
sed -i 's/obj.period!/obj.period ?? ""/g' lib/widgets/offline_object_card.dart
sed -i 's/widget.obj.audioUrl!/widget.obj.audioUrl ?? ""/g' lib/widgets/object_detail_sheet.dart
sed -i 's/widget.obj.image!/widget.obj.image ?? ""/g' lib/widgets/object_detail_sheet.dart
sed -i 's/widget.obj.description!/widget.obj.description ?? ""/g' lib/widgets/object_detail_sheet.dart
