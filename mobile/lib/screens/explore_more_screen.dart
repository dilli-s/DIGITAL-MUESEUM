import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/explore_models.dart';
import '../models/models.dart';
import '../services/offline_store.dart';
import '../widgets/object_detail_sheet.dart';

/// Screen displaying deep cultural exploration content for an object:
/// Object Context → Related Theme/Exhibitions → Related Objects → Stories → Learning Content
class ExploreMoreScreen extends StatefulWidget {
  final MuseumObject object;
  final int museumId;
  final void Function(MuseumObject)? onNavigateToObject;

  const ExploreMoreScreen({
    super.key,
    required this.object,
    required this.museumId,
    this.onNavigateToObject,
  });

  @override
  State<ExploreMoreScreen> createState() => _ExploreMoreScreenState();
}

class _ExploreMoreScreenState extends State<ExploreMoreScreen> {
  bool isLoading = true;
  bool isOnline = true;
  StreamSubscription<List<ConnectivityResult>>? connectivitySub;

  List<Exhibition> relatedExhibitions = [];
  List<MuseumObject> relatedObjects = [];
  List<Story> relatedStories = [];
  List<LearningResource> relatedLearning = [];

  @override
  void initState() {
    super.initState();
    try {
      connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
        if (mounted) {
          setState(() {
            isOnline = results.any((r) => r != ConnectivityResult.none);
          });
        }
      });
    } catch (_) {}
    _initConnectivity();
    _loadExploreContent();
  }

  @override
  void dispose() {
    connectivitySub?.cancel();
    super.dispose();
  }

  Future<void> _initConnectivity() async {
    try {
      final results = await Connectivity().checkConnectivity();
      if (mounted) {
        setState(() {
          isOnline = results.any((r) => r != ConnectivityResult.none);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadExploreContent() async {
    final store = OfflineStore.instance;
    final obj = widget.object;

    try {
      // 1. Related Exhibitions / Themes
      final exForObj = await store.getExhibitionsForObject(obj.id);
      if (exForObj.isNotEmpty) {
        relatedExhibitions = exForObj;
      } else {
        final allEx = await store.getExhibitions();
        relatedExhibitions = allEx.take(2).toList();
      }

      // 2. Related Objects (same gallery or category)
      final allObjects = await store.getObjects();
      relatedObjects = allObjects.where((o) {
        if (o.id == obj.id) return false;
        final sameGal = o.galleryId == obj.galleryId;
        final sameCat = o.category != null &&
            obj.category != null &&
            o.category!.toLowerCase() == obj.category!.toLowerCase();
        return sameGal || sameCat;
      }).take(6).toList();

      // 3. Stories
      final objStories = await store.getStoriesForObject(obj.id);
      if (objStories.isNotEmpty) {
        relatedStories = objStories;
      } else {
        final allStories = await store.getStories();
        relatedStories = allStories.take(3).toList();
      }

      // 4. Learning Resources
      final objLearning = await store.getLearningForObject(obj.id);
      if (objLearning.isNotEmpty) {
        relatedLearning = objLearning;
      } else {
        final allLearning = await store.getLearning();
        relatedLearning = allLearning.take(3).toList();
      }
    } catch (e) {
      debugPrint('Error loading explore content: $e');
    }

    if (mounted) {
      setState(() => isLoading = false);
    }
  }

  void _handleOnlineAction(VoidCallback onOnlineAction, {String actionName = 'This feature'}) {
    if (!isOnline) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(LucideIcons.wifiOff, color: Colors.white, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '$actionName requires an active internet connection.',
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF991B1B), // Cultural crimson warning
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 3),
        ),
      );
      return;
    }
    onOnlineAction();
  }

  void _showStoryDetail(Story story) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    if (story.image != null && story.image!.isNotEmpty)
                      Container(
                        height: 180,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        clipBehavior: Clip.hardEdge,
                        child: OfflineAwareImage(
                          imageUrl: story.image!,
                          fit: BoxFit.cover,
                        ),
                      ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1FAE5),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            story.duration != null && story.duration!.isNotEmpty
                                ? '${story.duration} read'
                                : 'Story',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF065F46),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      story.title,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF17211F),
                      ),
                    ),
                    if (story.summary != null && story.summary!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          story.summary!,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                            height: 1.5,
                          ),
                        ),
                      ),
                    const Divider(height: 32),
                    if (story.content != null)
                      ...story.content!.map((section) {
                        final heading = section['heading']?.toString() ??
                            section['title']?.toString() ??
                            '';
                        final text = section['text']?.toString() ??
                            section['body']?.toString() ??
                            '';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (heading.isNotEmpty)
                                Text(
                                  heading,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF17211F),
                                  ),
                                ),
                              if (heading.isNotEmpty) const SizedBox(height: 6),
                              Text(
                                text,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[800],
                                  height: 1.6,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLearningDetail(LearningResource resource) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            (resource.type ?? 'MODULE').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (resource.difficulty != null &&
                            resource.difficulty!.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.grey[100],
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              resource.difficulty!,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey[700],
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      resource.title,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF17211F),
                      ),
                    ),
                    if (resource.description != null &&
                        resource.description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          resource.description!,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                            height: 1.5,
                          ),
                        ),
                      ),
                    const Divider(height: 32),
                    if (resource.content != null)
                      ...resource.content!.map((block) {
                        final title = block['title']?.toString() ??
                            block['heading']?.toString() ??
                            '';
                        final body = block['body']?.toString() ??
                            block['text']?.toString() ??
                            '';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (title.isNotEmpty)
                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF17211F),
                                  ),
                                ),
                              if (title.isNotEmpty) const SizedBox(height: 6),
                              Text(
                                body,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[800],
                                  height: 1.6,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final obj = widget.object;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F5F0), // Cultural parchment background
      appBar: AppBar(
        backgroundColor: const Color(0xFF17211F),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Explore More',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: isOnline ? const Color(0xFF2E6A4B) : const Color(0xFF475569),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isOnline ? LucideIcons.cloudCheck : LucideIcons.hardDrive,
                  size: 13,
                  color: Colors.white,
                ),
                const SizedBox(width: 5),
                Text(
                  isOnline ? 'Online Sync' : 'Offline Ready',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF2E6A4B)),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Originating Object Context Card
                  _buildObjectHeaderCard(obj),
                  const SizedBox(height: 24),

                  // 2. Related Theme / Exhibitions
                  if (relatedExhibitions.isNotEmpty) ...[
                    _buildSectionHeader(
                      'Related Themes & Exhibitions',
                      LucideIcons.landmark,
                    ),
                    const SizedBox(height: 12),
                    ...relatedExhibitions.map(_buildExhibitionCard),
                    const SizedBox(height: 24),
                  ],

                  // 3. Related Objects
                  if (relatedObjects.isNotEmpty) ...[
                    _buildSectionHeader(
                      'Related Objects in Collection',
                      LucideIcons.shapes,
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 170,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: relatedObjects.length,
                        separatorBuilder: (context, index) => const SizedBox(width: 12),
                        itemBuilder: (context, index) =>
                            _buildRelatedObjectCard(relatedObjects[index]),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // 4. Stories & Chronicles
                  if (relatedStories.isNotEmpty) ...[
                    _buildSectionHeader(
                      'Stories & Chronicles',
                      LucideIcons.bookOpen,
                    ),
                    const SizedBox(height: 12),
                    ...relatedStories.map(_buildStoryCard),
                    const SizedBox(height: 24),
                  ],

                  // 5. Educational / Learning Modules
                  if (relatedLearning.isNotEmpty) ...[
                    _buildSectionHeader(
                      'Educational Modules',
                      LucideIcons.graduationCap,
                    ),
                    const SizedBox(height: 12),
                    ...relatedLearning.map(_buildLearningCard),
                    const SizedBox(height: 24),
                  ],

                  if (relatedExhibitions.isEmpty &&
                      relatedObjects.isEmpty &&
                      relatedStories.isEmpty &&
                      relatedLearning.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Column(
                        children: [
                          const Icon(LucideIcons.sparkles, size: 36, color: Color(0xFF2E6A4B)),
                          const SizedBox(height: 12),
                          const Text(
                            'Complete Offline Profile Loaded',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'All cached metadata, audio guides, and imagery for this artifact are stored locally on your device.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFF2E6A4B)),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF17211F),
          ),
        ),
      ],
    );
  }

  Widget _buildObjectHeaderCard(MuseumObject obj) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (obj.image != null && obj.image!.trim().isNotEmpty)
            SizedBox(
              height: 180,
              width: double.infinity,
              child: OfflineAwareImage(
                imageUrl: obj.image!,
                fit: BoxFit.cover,
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (obj.category ?? 'Artifact').toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[500],
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  obj.name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF17211F),
                  ),
                ),
                if (obj.period != null || obj.origin != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      [obj.period, obj.origin].whereType<String>().join(' · '),
                      style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                    ),
                  ),
                const SizedBox(height: 12),
                // External media actions with offline fallback
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (obj.videoUrl != null && obj.videoUrl!.trim().isNotEmpty)
                      ActionChip(
                        avatar: const Icon(LucideIcons.play, size: 14, color: Color(0xFF2E6A4B)),
                        label: const Text('Watch Video', style: TextStyle(fontSize: 12)),
                        onPressed: () => _handleOnlineAction(
                          () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Streaming video guide...')),
                            );
                          },
                          actionName: 'Video streaming',
                        ),
                        backgroundColor: const Color(0xFFE8F5E9),
                      ),
                    if (obj.model3dUrl != null && obj.model3dUrl!.trim().isNotEmpty)
                      ActionChip(
                        avatar: const Icon(LucideIcons.box, size: 14, color: Color(0xFF1E3A8A)),
                        label: const Text('3D Model', style: TextStyle(fontSize: 12)),
                        onPressed: () => _handleOnlineAction(
                          () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Opening 3D viewer...')),
                            );
                          },
                          actionName: '3D model viewer',
                        ),
                        backgroundColor: const Color(0xFFDBEAFE),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExhibitionCard(Exhibition ex) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ex.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF17211F),
            ),
          ),
          if (ex.description != null && ex.description!.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                ex.description!.trim(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 13, color: Colors.grey[700]),
              ),
            ),
          if (ex.period != null && ex.period!.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Period: ${ex.period!.trim()}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF2E6A4B)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRelatedObjectCard(MuseumObject item) {
    return GestureDetector(
      onTap: () {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => ExploreMoreScreen(
              object: item,
              museumId: widget.museumId,
              onNavigateToObject: widget.onNavigateToObject,
            ),
          ),
        );
      },
      child: Container(
        width: 130,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[200]!),
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 90,
              width: 130,
              child: item.image != null && item.image!.trim().isNotEmpty
                  ? OfflineAwareImage(imageUrl: item.image!, fit: BoxFit.cover)
                  : Container(
                      color: Colors.grey[100],
                      child: Icon(LucideIcons.image, color: Colors.grey[400]),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF17211F),
                    ),
                  ),
                  if (item.category != null)
                    Text(
                      item.category!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStoryCard(Story story) {
    return GestureDetector(
      onTap: () => _showStoryDetail(story),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey[200]!),
        ),
        child: Row(
          children: [
            if (story.image != null && story.image!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: OfflineAwareImage(
                    imageUrl: story.image!,
                    fit: BoxFit.cover,
                  ),
                ),
              )
            else
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  LucideIcons.bookOpen,
                  color: Color(0xFF2E6A4B),
                ),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    story.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF17211F),
                    ),
                  ),
                  if (story.summary != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        story.summary!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                    ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildLearningCard(LearningResource resource) {
    return GestureDetector(
      onTap: () => _showLearningDetail(resource),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey[200]!),
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                LucideIcons.lightbulb,
                color: Color(0xFF92400E),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          (resource.type ?? 'MODULE').toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                      if (resource.difficulty != null &&
                          resource.difficulty!.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text(
                          '• ${resource.difficulty}',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    resource.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF17211F),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
