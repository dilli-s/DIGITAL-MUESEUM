import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

const QRScanner = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef(null);
  const [scannerInstance, setScannerInstance] = useState(null);
  const [permissionState, setPermissionState] = useState('idle'); // idle, loading, granted, denied
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (scannerInstance) {
        scannerInstance.stop().then(() => {
          scannerInstance.clear();
        }).catch(err => console.log('Cleanup error', err));
      }
    };
  }, [scannerInstance]);

  const startScanner = async () => {
    setPermissionState('loading');
    setCameraError('');
    
    try {
      const html5QrCode = new Html5Qrcode("reader");
      setScannerInstance(html5QrCode);
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          setIsScanning(false);
          onScanSuccess(decodedText);
          
          // Stop scanner immediately after success
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
        },
        (errorMessage) => {
          // Ignore frequent decode errors (e.g. no QR detected yet)
        }
      );
      
      setPermissionState('granted');
      setIsScanning(true);
    } catch (err) {
      console.error("Camera error:", err);
      if (err?.name === "NotAllowedError" || String(err).includes("permission")) {
        setPermissionState('denied');
        setCameraError("Camera access is required to scan QR codes.");
      } else if (err?.name === "NotFoundError" || String(err).includes("Requested device not found")) {
        setPermissionState('unavailable');
        setCameraError("Camera scanning is unavailable on this device.");
      } else {
        setPermissionState('denied');
        setCameraError("Could not initialize camera.");
      }
    }
  };

  const stopScanner = () => {
    if (scannerInstance && isScanning) {
      scannerInstance.stop().then(() => {
        scannerInstance.clear();
        setIsScanning(false);
        setPermissionState('idle');
      }).catch(console.error);
    } else {
      setIsScanning(false);
      setPermissionState('idle');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Scanner Wrapper */}
      <div className="bg-neutral-900 rounded-3xl overflow-hidden shadow-xl aspect-square relative flex items-center justify-center">
        
        {permissionState === 'idle' && (
          <div className="text-center p-8 text-white z-10 flex flex-col items-center">
            <Camera className="w-16 h-16 text-neutral-500 mb-4" />
            <p className="text-lg font-medium mb-6">Allow camera access to scan an object QR code.</p>
            <button 
              onClick={startScanner}
              className="px-6 py-3 bg-white text-neutral-900 font-bold rounded-lg hover:bg-neutral-200 transition-colors"
            >
              START SCANNER
            </button>
          </div>
        )}

        {permissionState === 'loading' && (
          <div className="text-center p-8 text-white z-10 flex flex-col items-center">
            <RefreshCw className="w-12 h-12 text-neutral-500 mb-4 animate-spin" />
            <p className="text-lg font-medium">Starting camera...</p>
          </div>
        )}

        {(permissionState === 'denied' || permissionState === 'unavailable') && (
          <div className="text-center p-8 text-white z-10 flex flex-col items-center">
            <CameraOff className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-lg font-medium text-red-100 mb-2">{cameraError}</p>
            <button 
              onClick={startScanner}
              className="mt-6 px-6 py-3 border border-neutral-600 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* The actual video element container */}
        <div 
          id="reader" 
          ref={scannerRef}
          className={`absolute inset-0 w-full h-full ${permissionState === 'granted' ? 'block' : 'hidden'}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        ></div>

        {/* Overlay frame for visual guidance */}
        {permissionState === 'granted' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
            {/* Dark overlay with clear center */}
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative w-64 h-64 border-2 border-white/50 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl -translate-x-0.5 -translate-y-0.5"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl translate-x-0.5 -translate-y-0.5"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl -translate-x-0.5 translate-y-0.5"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl translate-x-0.5 translate-y-0.5"></div>
            </div>
            <p className="absolute bottom-8 text-white font-medium text-sm drop-shadow-md text-center px-4">
              Position the QR code inside the scanning area.
            </p>
          </div>
        )}
      </div>

      {/* Stop scanning button */}
      {permissionState === 'granted' && (
        <div className="mt-6 text-center">
          <button 
            onClick={stopScanner}
            className="text-sm font-semibold text-neutral-500 hover:text-neutral-900"
          >
            Cancel Scanning
          </button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
