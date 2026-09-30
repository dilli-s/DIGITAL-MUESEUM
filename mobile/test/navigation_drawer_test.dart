import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile/models/navigation_models.dart';
import 'package:mobile/services/pathfinding.dart';
import 'package:mobile/widgets/navigation_route_panel.dart';
import 'package:mobile/widgets/nearby_attractions_panel.dart';

void main() {
  group('NavigationRoutePanel Drawer Tests', () {
    final destination = MapNode(
      id: 'node_dest',
      floorPlanId: 'fp_1',
      name: 'Oriental Institute Information & Interactive Center',
      x: 100,
      y: 200,
      floor: 1,
      nodeType: 'artifact',
      objectId: 1,
    );

    final startNode = MapNode(
      id: 'node_start',
      floorPlanId: 'fp_1',
      name: 'Main Entrance',
      x: 50,
      y: 50,
      floor: 1,
      nodeType: 'entrance',
    );

    final route = RouteResult(
      path: [startNode, destination],
      distance: 15.0,
      instructions: ['Turn right at Grand Lobby Reception Center'],
    );

    testWidgets('Renders in compact peek mode by default without blocking user map view', (WidgetTester tester) async {
      bool canceled = false;
      bool markVisitedCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NavigationRoutePanel(
              destinationNode: destination,
              currentRoute: route,
              startLocationText: 'Live Fused Position',
              onCancel: () => canceled = true,
              onEditStartNode: () {},
              onViewSteps: () {},
              onScanArtifact: () {},
              onMarkVisited: () => markVisitedCalled = true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Destination name is shown in peek view
      expect(find.text('Oriental Institute Information & Interactive Center'), findsOneWidget);
      expect(find.text('~1 min'), findsOneWidget);
      expect(find.text('15 m'), findsOneWidget);

      // Quick "Arrived" button is available in peek mode
      expect(find.text('Arrived'), findsOneWidget);

      // Full action buttons ("View steps", "Scan artifact") are hidden in peek mode
      expect(find.text('View steps'), findsNothing);
      expect(find.text('Scan artifact'), findsNothing);

      // Tap quick "Arrived" button directly from peek mode
      await tester.tap(find.text('Arrived'));
      await tester.pumpAndSettle();
      expect(markVisitedCalled, isTrue);
    });

    testWidgets('Expands smoothly when chevron or header is tapped, and collapses back', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NavigationRoutePanel(
              destinationNode: destination,
              currentRoute: route,
              startLocationText: 'Live Fused Position',
              onCancel: () {},
              onEditStartNode: () {},
              onViewSteps: () {},
              onScanArtifact: () {},
              onMarkVisited: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find expand button
      final expandBtn = find.byTooltip('Expand route details');
      expect(expandBtn, findsOneWidget);

      // Tap to expand
      await tester.tap(expandBtn);
      await tester.pumpAndSettle();

      // In expanded mode, full details and actions are visible
      expect(find.text('NAVIGATING TO'), findsOneWidget);
      expect(find.text('View steps'), findsOneWidget);
      expect(find.text('Scan artifact'), findsOneWidget);
      expect(find.text('Mark Visited'), findsOneWidget);
      expect(find.text('From: Live Fused Position'), findsOneWidget);
      expect(find.text('Edit'), findsOneWidget);

      // Find collapse button
      final collapseBtn = find.byTooltip('Collapse drawer');
      expect(collapseBtn, findsOneWidget);

      // Tap to collapse
      await tester.tap(collapseBtn);
      await tester.pumpAndSettle();

      // Detailed actions are hidden again
      expect(find.text('View steps'), findsNothing);
      expect(find.text('Scan artifact'), findsNothing);
      expect(find.text('Arrived'), findsOneWidget);
    });
  });

  group('NearbyAttractionsPanel Drawer Tests', () {
    final nearbyNode = MapNode(
      id: 'node_exhibit',
      floorPlanId: 'fp_1',
      name: 'Ancient Relief',
      x: 120,
      y: 180,
      floor: 1,
      nodeType: 'artifact',
      objectId: 2,
    );

    testWidgets('Renders in compact peek mode and expands on tap', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NearbyAttractionsPanel(
              nearbyNodes: [nearbyNode],
              hasPosition: true,
              onNodeTap: (_) {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Near You'), findsOneWidget);
      expect(find.text('Live Location'), findsOneWidget);

      // Exhibit card hidden initially in peek mode
      expect(find.text('Ancient Relief'), findsNothing);

      // Tap on Near You to expand
      await tester.tap(find.text('Near You'));
      await tester.pumpAndSettle();

      // Exhibit card visible in expanded mode
      expect(find.text('Ancient Relief'), findsOneWidget);
    });
  });
}
