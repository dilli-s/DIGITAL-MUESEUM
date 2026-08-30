import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/offline_store.dart';

class OfflineSyncPanel extends StatefulWidget {
  final Function(Map<String, dynamic>) onSyncComplete;

  const OfflineSyncPanel({super.key, required this.onSyncComplete});

  @override
  State<OfflineSyncPanel> createState() => _OfflineSyncPanelState();
}

class _OfflineSyncPanelState extends State<OfflineSyncPanel> {
  String status = 'idle';
  double progress = 0;
  String message = '';
  int? lastSync;
  final OfflineStore offlineStore = OfflineStore();

  @override
  void initState() {
    super.initState();
    _loadLastSync();
  }

  Future<void> _loadLastSync() async {
    final ls = await offlineStore.getLastSync();
    if (mounted) setState(() => lastSync = ls);
  }

  Future<void> _handleSync() async {
    setState(() {
      status = 'syncing';
      progress = 0;
    });

    try {
      final data = await offlineStore.syncAll((pct, msg) {
        if (mounted) {
          setState(() {
            progress = pct / 100.0;
            message = msg;
          });
        }
      });

      if (mounted) {
        setState(() {
          status = 'done';
          lastSync = DateTime.now().millisecondsSinceEpoch;
        });
        widget.onSyncComplete(data);
      }
    } catch (e) {
      if (mounted) setState(() => status = 'error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isSynced = lastSync != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isSynced ? Colors.green[50] : Colors.amber[50],
        border: Border.all(
          color: (isSynced ? Colors.green[200] : Colors.amber[200])!,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: isSynced ? Colors.green[100] : Colors.amber[100],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isSynced ? LucideIcons.wifiOff : LucideIcons.download,
                  color: isSynced ? Colors.green[600] : Colors.amber[600],
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isSynced
                          ? '✓ Offline Content Ready'
                          : 'Download Offline Content',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isSynced ? Colors.green[800] : Colors.amber[800],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isSynced
                          ? 'Last synced ${DateTime.fromMillisecondsSinceEpoch(lastSync!).toLocal().toString().split('.')[0]}'
                          : 'Tap to download museum data for offline use',
                      style: TextStyle(
                        fontSize: 12,
                        color: isSynced ? Colors.green[600] : Colors.amber[600],
                      ),
                    ),
                    if (status == 'syncing') ...[
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: progress,
                        backgroundColor: Colors.amber[200],
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Colors.amber[600]!,
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        message,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.amber[700],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (status != 'syncing')
                ElevatedButton(
                  onPressed: _handleSync,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isSynced
                        ? Colors.green[200]
                        : Colors.amber[600],
                    foregroundColor: isSynced
                        ? Colors.green[800]
                        : Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 0,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    isSynced ? 'Re-sync' : 'Download',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
          if (status == 'done')
            Padding(
              padding: const EdgeInsets.only(top: 8.0),
              child: Text(
                '✓ All content downloaded. You can now go offline!',
                style: TextStyle(
                  color: Colors.green[700],
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          if (status == 'error')
            const Padding(
              padding: EdgeInsets.only(top: 8.0),
              child: Text(
                'Sync failed. Please check connection.',
                style: TextStyle(color: Colors.red, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}
