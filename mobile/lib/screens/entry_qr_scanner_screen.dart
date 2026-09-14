import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/deep_link_service.dart';
import 'museum_selection_screen.dart';
import 'sync_screen.dart';

class EntryQRScannerScreen extends StatefulWidget {
  final Function(String)? onScannedForTesting;

  const EntryQRScannerScreen({
    super.key,
    this.onScannedForTesting,
  });

  @override
  State<EntryQRScannerScreen> createState() => _EntryQRScannerScreenState();
}

class _EntryQRScannerScreenState extends State<EntryQRScannerScreen> {
  final MobileScannerController _cameraController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _hasNavigated = false;
  bool _isTorchOn = false;

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  @visibleForTesting
  void handleScanForTesting(String val) => _handleScan(val);

  void _handleScan(String rawData) {
    if (_hasNavigated) return;

    if (widget.onScannedForTesting != null) {
      widget.onScannedForTesting!(rawData);
    }

    final payload = DeepLinkService.parseUri(rawData);
    if (payload != null && payload.museumId > 0) {
      _hasNavigated = true;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => SyncScreen(
            museumId: payload.museumId,
            entranceNodeId: payload.entranceNodeId,
          ),
        ),
      );
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF1E293B),
            content: Text('Unrecognized museum QR. Please scan the entrance code.'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // 1. Camera Viewfinder
          Positioned.fill(
            child: MobileScanner(
              controller: _cameraController,
              onDetect: (capture) {
                if (_hasNavigated) return;
                final barcodes = capture.barcodes;
                if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                  _handleScan(barcodes.first.rawValue!);
                }
              },
            ),
          ),

          // 2. Scanner Dark Overlay Frame
          Positioned.fill(
            child: Container(
              color: Colors.black.withValues(alpha: 0.45),
            ),
          ),

          // 3. Central Target Box Cutout
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 260,
                  height: 260,
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: const Color(0xFFD65F45),
                      width: 3.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFD65F45).withValues(alpha: 0.35),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      // Subtle scanline indicator
                      Positioned(
                        top: 125,
                        left: 16,
                        right: 16,
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            color: const Color(0xFFD65F45).withValues(alpha: 0.8),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0xFFD65F45),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Align entrance QR code inside the box',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),

          // 4. Header Section
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Scan Museum QR',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Scan at the entrance to begin tour',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Torch Toggle Button
                  IconButton(
                    icon: Icon(
                      _isTorchOn ? LucideIcons.zap : LucideIcons.zapOff,
                      color: _isTorchOn ? Colors.amber : Colors.white70,
                    ),
                    onPressed: () {
                      _cameraController.toggleTorch();
                      setState(() {
                        _isTorchOn = !_isTorchOn;
                      });
                    },
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 5. Bottom Secondary Navigation: "Browse museums instead"
          Positioned(
            left: 0,
            right: 0,
            bottom: 40,
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const MuseumSelectionScreen(showBackButton: true),
                        ),
                      );
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    child: const Text(
                      'Browse museums instead',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.white70,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
