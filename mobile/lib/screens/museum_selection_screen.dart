import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../config/api.dart';
import '../models/museum_provider.dart';
import '../models/models.dart';
import 'sync_screen.dart';

class MuseumSelectionScreen extends StatefulWidget {
  const MuseumSelectionScreen({super.key, this.showBackButton});
  final bool? showBackButton;

  @override
  State<MuseumSelectionScreen> createState() => _MuseumSelectionScreenState();
}

class _MuseumSelectionScreenState extends State<MuseumSelectionScreen> {
  bool isLoadingMuseums = false;
  bool isLoadingFloors = false;
  bool hasRequestedPermission = false;
  Museum? selectedMuseum;
  FloorInfo? selectedFloor;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMuseums();
      _requestLocationPermission();
    });
  }

  Future<void> _requestLocationPermission() async {
    final provider = context.read<MuseumProvider>();
    await provider.requestLocationPermission();
    if (provider.currentPosition == null && provider.locationPermissionGranted) {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.low,
            timeLimit: Duration(seconds: 5),
          ),
        );
        provider.updateCurrentPosition(position);
      } catch (_) {}
    }
    if (mounted) setState(() => hasRequestedPermission = true);
  }

  Future<void> _loadMuseums() async {
    final provider = context.read<MuseumProvider>();
    setState(() {
      isLoadingMuseums = true;
    });
    await provider.fetchMuseums();
    if (provider.museums.isNotEmpty) {
      selectedMuseum = provider.museums.first;
      provider.setSelectedMuseum(selectedMuseum!.id);
      if (provider.floorsByMuseum[selectedMuseum!.id] == null) {
        await _loadFloorsForMuseum(selectedMuseum!);
      } else if (mounted) {
        setState(() {
          selectedFloor =
              provider.floorsByMuseum[selectedMuseum!.id]!.isNotEmpty
              ? provider.floorsByMuseum[selectedMuseum!.id]!.first
              : null;
        });
      }
    }
    if (mounted) setState(() => isLoadingMuseums = false);
  }

  Future<void> _loadFloorsForMuseum(Museum museum) async {
    final provider = context.read<MuseumProvider>();
    setState(() => isLoadingFloors = true);
    final floors = await provider.fetchFloorsForMuseum(museum.id);
    if (!mounted) return;
    setState(() {
      selectedMuseum = museum;
      selectedFloor = floors.isNotEmpty ? floors.first : null;
      isLoadingFloors = false;
    });
  }

  Future<void> _selectMuseum(Museum museum) async {
    final provider = context.read<MuseumProvider>();
    provider.setSelectedMuseum(museum.id);
    setState(() {
      selectedMuseum = museum;
      selectedFloor = null;
    });
    await _loadFloorsForMuseum(museum);
  }

  Future<void> _selectFloor(FloorInfo floor) async {
    final provider = context.read<MuseumProvider>();
    provider.setSelectedFloor(
      floor.floorPlanId,
      floorData: {'id': floor.floorPlanId},
    );
    if (!mounted) return;
    final museumId = provider.selectedMuseumId ?? (selectedMuseum?.id ?? 1);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => SyncScreen(
          museumId: museumId,
          initialFloorPlanId: floor.floorPlanId,
          forceSync: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MuseumProvider>();
    final museumCards = provider.museums;

    final canGoBack = widget.showBackButton ?? Navigator.of(context).canPop();
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 22, 24, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (canGoBack)
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(LucideIcons.arrowLeft),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        visualDensity: VisualDensity.compact,
                        alignment: Alignment.centerLeft,
                      )
                    else
                      const SizedBox.shrink(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE7F1E9),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            LucideIcons.compass,
                            size: 15,
                            color: Color(0xFF46745B),
                          ),
                          SizedBox(width: 6),
                          Text(
                            'DIGITAL MUSEUM / EXPLORE',
                            style: TextStyle(
                              color: Color(0xFF46745B),
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Where will\nyour curiosity lead?',
                      style: TextStyle(
                        color: Color(0xFF17211F),
                        fontSize: 38,
                        height: 1.02,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.2,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Choose a museum to begin your self-guided journey.',
                      style: TextStyle(
                        color: Colors.blueGrey[600],
                        fontSize: 16,
                        height: 1.4,
                      ),
                    ),
                    if (hasRequestedPermission &&
                        !provider.locationPermissionGranted) ...[
                      const SizedBox(height: 22),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFE8D7),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              LucideIcons.navigation,
                              color: Color(0xFFB35637),
                              size: 19,
                            ),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Location helps us show nearby museums and guide you inside.',
                                style: TextStyle(
                                  color: Color(0xFF8A432B),
                                  fontSize: 13,
                                  height: 1.35,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (provider.isUsingCachedData) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              LucideIcons.cloudOff,
                              color: Color(0xFF2563EB),
                              size: 18,
                            ),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Showing saved data (offline mode) — may be outdated.',
                                style: TextStyle(
                                  color: Color(0xFF1E40AF),
                                  fontSize: 13,
                                  height: 1.3,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (isLoadingMuseums && museumCards.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.errorMessage != null && museumCards.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _EmptyState(
                  icon: LucideIcons.cloudOff,
                  title: 'The collection is taking a moment',
                  message: provider.errorMessage!,
                  action: ElevatedButton.icon(
                    onPressed: _loadMuseums,
                    icon: const Icon(LucideIcons.refreshCw, size: 17),
                    label: const Text('Try again'),
                  ),
                ),
              )
            else if (museumCards.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: _EmptyState(
                  icon: LucideIcons.landmark,
                  title: 'No museums nearby',
                  message: 'Try again when you are closer to a collection.',
                ),
              )
            else if (selectedMuseum != null &&
                provider.floorsByMuseum[selectedMuseum!.id] != null)
              _buildFloorSliver(provider)
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate((context, index) {
                    final museum = museumCards[index];
                    final floors =
                        provider.floorsByMuseum[museum.id] ?? const [];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _MuseumCard(
                        museum: museum,
                        distanceText: provider.getDistanceLabel(museum),
                        floorCount: floors.length,
                        onSelect: () => _selectMuseum(museum),
                      ),
                    );
                  }, childCount: museumCards.length),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloorSliver(MuseumProvider provider) {
    final floors = provider.floorsByMuseum[selectedMuseum!.id]!;
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          Row(
            children: [
              IconButton(
                onPressed: () => setState(() => selectedMuseum = null),
                icon: const Icon(LucideIcons.arrowLeft),
                padding: EdgeInsets.zero,
              ),
              const SizedBox(width: 8),
              const Text(
                'Pick a floor',
                style: TextStyle(
                  color: Color(0xFF17211F),
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 56.0),
            child: Text(
              selectedMuseum!.name,
              style: TextStyle(color: Colors.blueGrey[600], fontSize: 14),
            ),
          ),
          const SizedBox(height: 20),
          if (isLoadingFloors)
            const Center(child: CircularProgressIndicator())
          else if (floors.isEmpty)
            const _EmptyState(
              icon: LucideIcons.layers,
              title: 'No floors available',
              message: 'This museum does not have an indoor map yet.',
            )
          else
            ...floors.map(
              (floor) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _FloorCard(
                  floor: floor,
                  onSelect: () => _selectFloor(floor),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class _MuseumCard extends StatelessWidget {
  const _MuseumCard({
    required this.museum,
    required this.distanceText,
    required this.floorCount,
    required this.onSelect,
  });

  final Museum museum;
  final String distanceText;
  final int floorCount;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 156,
            width: double.infinity,
            child: museum.imageUrl != null && museum.imageUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: ApiConfig.getMediaUrl(museum.imageUrl!),
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => const _MuseumImageFallback(),
                  )
                : const _MuseumImageFallback(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        museum.name,
                        style: const TextStyle(
                          color: Color(0xFF17211F),
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const Icon(
                      LucideIcons.arrowUpRight,
                      color: Color(0xFFD65F45),
                      size: 20,
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                Text(
                  museum.address.isNotEmpty
                      ? museum.address
                      : 'Location unavailable',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.blueGrey[600], height: 1.3),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _InfoPill(icon: LucideIcons.mapPin, label: distanceText),
                    const SizedBox(width: 8),
                    _InfoPill(
                      icon: LucideIcons.layers,
                      label:
                          '$floorCount ${floorCount == 1 ? 'floor' : 'floors'}',
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: onSelect,
                    icon: const Icon(LucideIcons.arrowRight, size: 18),
                    label: const Text('Explore museum'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FloorCard extends StatelessWidget {
  const _FloorCard({required this.floor, required this.onSelect});

  final FloorInfo floor;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onSelect,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFE7F1E9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(LucideIcons.layers, color: Color(0xFF46745B)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      floor.floorName,
                      style: const TextStyle(
                        color: Color(0xFF17211F),
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      'Floor ${floor.floorNumber}  •  ${floor.hasArtifacts ? 'Exhibits mapped' : 'Map available'}',
                      style: TextStyle(
                        color: Colors.blueGrey[600],
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(LucideIcons.arrowRight, color: Color(0xFFD65F45)),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F1EC),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF66736F)),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF53615C),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MuseumImageFallback extends StatelessWidget {
  const _MuseumImageFallback();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFE7F1E9),
      child: Center(
        child: Icon(
          LucideIcons.landmark,
          size: 52,
          color: const Color(0xFF46745B).withValues(alpha: 0.75),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 42, color: const Color(0xFFD65F45)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.blueGrey[600], height: 1.4),
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}
