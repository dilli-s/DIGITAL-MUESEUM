import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrViewfinder({ onScanSuccess, onError, children }) {
  const scannerRef = useRef(null);
  const isHandlingRef = useRef(false);
  // Generate a stable unique ID for this instance
  const [scannerId] = useState(() => "qr-" + Math.random().toString(36).substring(7));

  useEffect(() => {
    let isMounted = true;
    
    // Ensure the element exists in the DOM before initializing
    const container = document.getElementById(scannerId);
    if (!container) return;

    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    const startPromise = html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, aspectRatio: window.innerHeight / window.innerWidth },
      async (decodedText) => {
        if (!isMounted || isHandlingRef.current) return;
        isHandlingRef.current = true;
        try {
          await onScanSuccess(decodedText);
        } catch (e) {
          if (onError) onError(e);
        } finally {
          isHandlingRef.current = false;
        }
      },
      () => {} // Ignore scan failures
    );

    startPromise.catch(err => {
      console.error("Camera access denied or failed", err);
      if (onError && isMounted) onError(err);
    });

    return () => {
      isMounted = false;
      // We must wait for the scanner to fully start before we can stop it safely,
      // otherwise it throws "Cannot stop, scanner is not running or paused."
      startPromise.then(() => {
        if (scannerRef.current) {
          scannerRef.current.stop()
            .then(() => scannerRef.current.clear())
            .catch(() => {});
        }
      }).catch(() => {
        // If it failed to start, just clear any leftover UI state
        if (scannerRef.current) {
          try { scannerRef.current.clear(); } catch (e) {}
        }
      });
    };
  }, [onScanSuccess, onError, scannerId]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col min-h-[100dvh]">
      {/* Scanner Viewfinder */}
      <div id={scannerId} className="absolute inset-0 w-full h-full object-cover"></div>
      
      {/* Overlay Mask & Scan Frame */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        <div className="flex-1 bg-black/50"></div>
        <div className="flex justify-center items-center">
          <div className="w-[15vw] bg-black/50 h-[70vw]"></div>
          <div className="relative w-[70vw] h-[70vw] border-2 border-white/20 rounded-3xl overflow-hidden">
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-3xl -translate-x-0.5 -translate-y-0.5"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-3xl translate-x-0.5 -translate-y-0.5"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-3xl -translate-x-0.5 translate-y-0.5"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-3xl translate-x-0.5 translate-y-0.5"></div>
            
            {/* Animated Scan Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-accent shadow-[0_0_8px_2px_#C9A24B] opacity-70 animate-[scan_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="w-[15vw] bg-black/50 h-[70vw]"></div>
        </div>
        <div className="flex-1 bg-black/50"></div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(70vw); }
          100% { transform: translateY(0); }
        }
        [id^="qr-"] video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      {/* Bottom Sheet UI / Custom Children */}
      {children}
    </div>
  );
}
