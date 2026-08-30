import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audioplayers/audioplayers.dart';

import '../config/api.dart';
import '../models/models.dart';

class ObjectDetailSheet extends StatefulWidget {
  final MuseumObject obj;
  final VoidCallback onClose;

  const ObjectDetailSheet({
    super.key,
    required this.obj,
    required this.onClose,
  });

  @override
  State<ObjectDetailSheet> createState() => _ObjectDetailSheetState();
}

class _ObjectDetailSheetState extends State<ObjectDetailSheet> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool isPlaying = false;
  Duration duration = Duration.zero;
  Duration position = Duration.zero;

  @override
  void initState() {
    super.initState();
    if (widget.obj.audioUrl != null && widget.obj.audioUrl!.isNotEmpty) {
      _audioPlayer.setSourceUrl(ApiConfig.getMediaUrl(widget.obj.audioUrl!));
      _audioPlayer.onPlayerStateChanged.listen((state) {
        if (mounted) setState(() => isPlaying = state == PlayerState.playing);
      });
      _audioPlayer.onDurationChanged.listen((newDuration) {
        if (mounted) setState(() => duration = newDuration);
      });
      _audioPlayer.onPositionChanged.listen((newPosition) {
        if (mounted) setState(() => position = newPosition);
      });
    }
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.7),
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

                        if (widget.obj.image != null &&
                            widget.obj.image!.isNotEmpty)
                          Container(
                            width: double.infinity,
                            height: 192,
                            margin: const EdgeInsets.only(bottom: 20),
                            decoration: BoxDecoration(
                              color: Colors.grey[100],
                              borderRadius: BorderRadius.circular(16),
                            ),
                            clipBehavior: Clip.hardEdge,
                            child: CachedNetworkImage(
                              imageUrl: ApiConfig.getMediaUrl(
                                widget.obj.image ?? "",
                              ),
                              fit: BoxFit.cover,
                            ),
                          ),

                        Text(
                          (widget.obj.category ?? 'Artifact').toUpperCase(),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[400],
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.obj.name,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),

                        if (widget.obj.period != null)
                          Padding(
                            padding: const EdgeInsets.only(
                              top: 4.0,
                              bottom: 16.0,
                            ),
                            child: Text(
                              '${widget.obj.period}${widget.obj.origin != null ? ' · ${widget.obj.origin}' : ''}',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                              ),
                            ),
                          ),

                        if (widget.obj.description != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 20.0),
                            child: Text(
                              widget.obj.description ?? "",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[700],
                                height: 1.5,
                              ),
                            ),
                          ),

                        if (widget.obj.audioUrl != null &&
                            widget.obj.audioUrl!.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 20),
                            decoration: BoxDecoration(
                              color: Colors.grey[50],
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      LucideIcons.volume2,
                                      size: 14,
                                      color: Colors.grey[500],
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Audio Guide',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.grey[500],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: Icon(
                                        isPlaying
                                            ? LucideIcons.pause
                                            : LucideIcons.play,
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
                                        value: position.inSeconds.toDouble(),
                                        activeColor: Colors.black,
                                        onChanged: (val) {
                                          _audioPlayer.seek(
                                            Duration(seconds: val.toInt()),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ],
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
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
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
      ),
    );
  }
}
