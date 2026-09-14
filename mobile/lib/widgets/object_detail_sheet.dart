import 'dart:io';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audioplayers/audioplayers.dart';

import '../config/api.dart';
import '../models/models.dart';
import '../services/offline_store.dart';

/// Offline-aware image that checks local cached storage first,
/// falling back to cached network image or a graceful placeholder.
class OfflineAwareImage extends StatefulWidget {
  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const OfflineAwareImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  State<OfflineAwareImage> createState() => _OfflineAwareImageState();
}

class _OfflineAwareImageState extends State<OfflineAwareImage> {
  String? _localPath;

  @override
  void initState() {
    super.initState();
    _resolvePath();
  }

  @override
  void didUpdateWidget(OfflineAwareImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl) {
      _localPath = null;
      _resolvePath();
    }
  }

  Future<void> _resolvePath() async {
    final rawUrl = widget.imageUrl.trim();
    if (rawUrl.isEmpty) return;

    // 1. Direct local file path
    if (rawUrl.startsWith('/') || rawUrl.startsWith('file://')) {
      final clean = rawUrl.replaceFirst('file://', '');
      if (await File(clean).exists()) {
        if (mounted) setState(() => _localPath = clean);
        return;
      }
    }

    // 2. OfflineStore cached media check
    try {
      final cachedPath = await OfflineStore.instance.getLocalMediaPath(rawUrl);
      if (cachedPath != null && await File(cachedPath).exists()) {
        if (mounted) setState(() => _localPath = cachedPath);
        return;
      }
    } catch (_) {}

    if (mounted) setState(() {});
  }

  Widget _buildPlaceholder() {
    return Container(
      width: widget.width,
      height: widget.height,
      color: Colors.grey[100],
      child: Center(
        child: Icon(
          LucideIcons.image,
          color: Colors.grey[400],
          size: 32,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget content;
    if (_localPath != null && File(_localPath!).existsSync()) {
      content = Image.file(
        File(_localPath!),
        fit: widget.fit,
        width: widget.width,
        height: widget.height,
        errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
      );
    } else {
      final remoteUrl = ApiConfig.getMediaUrl(widget.imageUrl);
      if (remoteUrl.isEmpty) {
        content = _buildPlaceholder();
      } else {
        content = CachedNetworkImage(
          imageUrl: remoteUrl,
          fit: widget.fit,
          width: widget.width,
          height: widget.height,
          placeholder: (context, url) => Container(
            width: widget.width,
            height: widget.height,
            color: Colors.grey[100],
            child: const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          errorWidget: (context, url, error) => _buildPlaceholder(),
        );
      }
    }

    if (widget.borderRadius != null) {
      return ClipRRect(
        borderRadius: widget.borderRadius!,
        child: content,
      );
    }
    return content;
  }
}

class ObjectDetailSheet extends StatefulWidget {
  final MuseumObject obj;
  final VoidCallback onClose;
  final VoidCallback? onNavigate;
  final VoidCallback? onExploreMore;

  const ObjectDetailSheet({
    super.key,
    required this.obj,
    required this.onClose,
    this.onNavigate,
    this.onExploreMore,
  });

  @override
  State<ObjectDetailSheet> createState() => _ObjectDetailSheetState();
}

class _ObjectDetailSheetState extends State<ObjectDetailSheet> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool isPlaying = false;
  Duration duration = Duration.zero;
  Duration position = Duration.zero;
  bool isLocalAudio = false;

  @override
  void initState() {
    super.initState();
    _initAudio();
  }

  Future<void> _initAudio() async {
    final audioUrl = widget.obj.audioUrl;
    if (audioUrl == null || audioUrl.trim().isEmpty) return;

    _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) setState(() => isPlaying = state == PlayerState.playing);
    });
    _audioPlayer.onDurationChanged.listen((newDuration) {
      if (mounted) setState(() => duration = newDuration);
    });
    _audioPlayer.onPositionChanged.listen((newPosition) {
      if (mounted) setState(() => position = newPosition);
    });

    try {
      final localPath = await OfflineStore.instance.getLocalMediaPath(audioUrl.trim());
      if (localPath != null && await File(localPath).exists()) {
        isLocalAudio = true;
        await _audioPlayer.setSourceDeviceFile(localPath);
      } else {
        await _audioPlayer.setSourceUrl(ApiConfig.getMediaUrl(audioUrl.trim()));
      }
    } catch (e) {
      debugPrint('Audio initialization failed: $e');
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    // Graceful field extraction
    final hasLocalName = widget.obj.localName != null && widget.obj.localName!.trim().isNotEmpty;
    final hasCommonName = widget.obj.commonName != null && widget.obj.commonName!.trim().isNotEmpty;
    final hasScientificName = widget.obj.scientificName != null && widget.obj.scientificName!.trim().isNotEmpty;

    final hasPeriod = widget.obj.period != null && widget.obj.period!.trim().isNotEmpty;
    final hasOrigin = widget.obj.origin != null && widget.obj.origin!.trim().isNotEmpty;

    final hasDescription = widget.obj.description != null && widget.obj.description!.trim().isNotEmpty;
    final hasSignificance = widget.obj.significance != null && widget.obj.significance!.trim().isNotEmpty;

    final validFacts = widget.obj.facts.where((f) => f.trim().isNotEmpty).toList();
    final validImages = widget.obj.images.where((img) => img.trim().isNotEmpty).toList();

    final hasVideo = widget.obj.videoUrl != null && widget.obj.videoUrl!.trim().isNotEmpty;
    final hasModel3d = widget.obj.model3dUrl != null && widget.obj.model3dUrl!.trim().isNotEmpty;
    final hasAudio = widget.obj.audioUrl != null && widget.obj.audioUrl!.trim().isNotEmpty;

    return Container(
      color: Colors.black.withValues(alpha: 0.7),
      child: Column(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: widget.onClose,
              child: Container(color: Colors.transparent),
            ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SafeArea(
              top: false,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.85,
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 48,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: Colors.grey[300],
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),

                      // Hero Image (Offline-first)
                      if (widget.obj.image != null &&
                          widget.obj.image!.trim().isNotEmpty)
                        Container(
                          width: double.infinity,
                          height: 200,
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(16),
                          ),
                          clipBehavior: Clip.hardEdge,
                          child: OfflineAwareImage(
                            imageUrl: widget.obj.image!,
                            fit: BoxFit.cover,
                          ),
                        ),

                      // Category Pill
                      Text(
                        (widget.obj.category != null && widget.obj.category!.trim().isNotEmpty
                                ? widget.obj.category!.trim()
                                : 'Artifact')
                            .toUpperCase(),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[500],
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Name
                      Text(
                        widget.obj.name.trim().isNotEmpty
                            ? widget.obj.name.trim()
                            : 'Unnamed Exhibit',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),

                      // Naming Metadata
                      if (hasLocalName || hasCommonName || hasScientificName)
                        Padding(
                          padding: const EdgeInsets.only(top: 8, bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (hasLocalName)
                                Text(
                                  'Local name: ${widget.obj.localName!.trim()}',
                                  style: TextStyle(color: Colors.grey[700]),
                                ),
                              if (hasCommonName)
                                Text(
                                  'Common name: ${widget.obj.commonName!.trim()}',
                                  style: TextStyle(color: Colors.grey[700]),
                                ),
                              if (hasScientificName)
                                Text(
                                  'Scientific name: ${widget.obj.scientificName!.trim()}',
                                  style: TextStyle(
                                    color: Colors.grey[700],
                                    fontStyle: FontStyle.italic,
                                  ),
                                ),
                            ],
                          ),
                        ),

                      // Period & Origin
                      if (hasPeriod || hasOrigin)
                        Padding(
                          padding: const EdgeInsets.only(top: 4.0, bottom: 16.0),
                          child: Text(
                            [
                              if (hasPeriod) widget.obj.period!.trim(),
                              if (hasOrigin) widget.obj.origin!.trim(),
                            ].join(' · '),
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),

                      // Description
                      if (hasDescription)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20.0),
                          child: Text(
                            widget.obj.description!.trim(),
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[700],
                              height: 1.5,
                            ),
                          ),
                        ),

                      // Significance
                      if (hasSignificance)
                        _DetailSection(
                          title: 'Significance',
                          child: Text(
                            widget.obj.significance!.trim(),
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[700],
                              height: 1.5,
                            ),
                          ),
                        ),

                      // Interesting Facts
                      if (validFacts.isNotEmpty)
                        _DetailSection(
                          title: 'Interesting Facts',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: validFacts
                                .map(
                                  (fact) => Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: Text(
                                      '• ${fact.trim()}',
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.grey[700],
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),

                      // More Images (Offline-first gallery)
                      if (validImages.isNotEmpty)
                        _DetailSection(
                          title: 'More Images',
                          child: SizedBox(
                            height: 88,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: validImages.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(width: 8),
                              itemBuilder: (_, index) => ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: OfflineAwareImage(
                                  imageUrl: validImages[index],
                                  width: 112,
                                  height: 88,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Video Reference
                      if (hasVideo)
                        _MediaReference(
                          title: 'Video / Animation',
                          url: widget.obj.videoUrl!.trim(),
                        ),

                      // 3D Model Reference
                      if (hasModel3d)
                        _MediaReference(
                          title: '3D Model',
                          url: widget.obj.model3dUrl!.trim(),
                        ),

                      // Audio Guide (Offline-first player)
                      if (hasAudio)
                        Container(
                          padding: const EdgeInsets.all(16),
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.grey[200]!),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    LucideIcons.volume2,
                                    size: 16,
                                    color: Color(0xFF2E6A4B),
                                  ),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'Audio Guide',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF2E6A4B),
                                    ),
                                  ),
                                  const Spacer(),
                                  if (isLocalAudio)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFD1FAE5),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'Offline Ready',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Color(0xFF065F46),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  IconButton(
                                    icon: Icon(
                                      isPlaying
                                          ? LucideIcons.pause
                                          : LucideIcons.play,
                                      color: const Color(0xFF17211F),
                                    ),
                                    onPressed: () {
                                      if (isPlaying) {
                                        _audioPlayer.pause();
                                      } else {
                                        _audioPlayer.resume();
                                      }
                                    },
                                    style: IconButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      shadowColor: Colors.black12,
                                      elevation: 2,
                                    ),
                                  ),
                                  Expanded(
                                    child: Slider(
                                      min: 0,
                                      max: duration.inSeconds.toDouble() > 0
                                          ? duration.inSeconds.toDouble()
                                          : 1.0,
                                      value: position.inSeconds.toDouble().clamp(
                                        0.0,
                                        duration.inSeconds.toDouble() > 0
                                            ? duration.inSeconds.toDouble()
                                            : 1.0,
                                      ),
                                      activeColor: const Color(0xFF2E6A4B),
                                      inactiveColor: Colors.grey[300],
                                      onChanged: (val) {
                                        _audioPlayer.seek(
                                          Duration(seconds: val.toInt()),
                                        );
                                      },
                                    ),
                                  ),
                                  Text(
                                    _formatDuration(position),
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                      // Action Buttons
                      Column(
                        children: [
                          if (widget.onNavigate != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    widget.onNavigate!();
                                    widget.onClose();
                                  },
                                  icon: const Icon(
                                    LucideIcons.navigation,
                                    size: 18,
                                    color: Colors.white,
                                  ),
                                  label: const Text(
                                    'Start Navigation to Exhibit',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      fontSize: 15,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.indigo[600],
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 2,
                                  ),
                                ),
                              ),
                            ),

                          // Explore More Button (Vanalok Cultural Emerald)
                          if (widget.onExploreMore != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: widget.onExploreMore,
                                  icon: const Icon(
                                    LucideIcons.compass,
                                    size: 18,
                                    color: Colors.white,
                                  ),
                                  label: const Text(
                                    'Explore More',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      fontSize: 15,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2E6A4B),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 2,
                                  ),
                                ),
                              ),
                            ),

                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: widget.onClose,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.grey[900],
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 0,
                                  ),
                                  child: const Text(
                                    'Close',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  final String title;
  final Widget child;

  const _DetailSection({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey[500],
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _MediaReference extends StatelessWidget {
  final String title;
  final String url;

  const _MediaReference({required this.title, required this.url});

  @override
  Widget build(BuildContext context) {
    return _DetailSection(
      title: title,
      child: SelectableText(
        ApiConfig.getMediaUrl(url),
        style: TextStyle(fontSize: 12, color: Colors.indigo[700]),
      ),
    );
  }
}
