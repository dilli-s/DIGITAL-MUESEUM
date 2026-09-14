import React, { useState } from 'react';
import { extractQRCode } from '../utils/qrParser';
import { getObject } from '../services/api';
import QrViewfinder from '../components/qr/QrViewfinder';
import ObjectInfoSheet from '../components/object/ObjectInfoSheet';
import { RefreshCw, AlertCircle } from 'lucide-react';

const Scan = () => {
  const [scanStatus, setScanStatus] = useState('idle'); // idle, loading, success, invalid, not-found
  const [scannedObject, setScannedObject] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleScanSuccess = async (decodedText) => {
    if (scanStatus === 'success' || scanStatus === 'loading') return;

    const qrData = extractQRCode(decodedText);

    if (!qrData || qrData.type !== 'object') {
      setScanStatus('invalid');
      setErrorMessage('That QR code is not a valid object code.');
      setTimeout(() => setScanStatus('idle'), 3000);
      return;
    }

    setScanStatus('loading');
    
    try {
      const object = await getObject(qrData.id);
      setScannedObject(object);
      setScanStatus('success');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setScanStatus('not-found');
        setErrorMessage('Object not found in database.');
      } else {
        setScanStatus('invalid');
        setErrorMessage('Failed to load object data.');
      }
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  const handleScanError = (err) => {
    // We ignore normal frame errors in QrViewfinder, this is for camera failure
  };

  const closeSheet = () => {
    setScanStatus('idle');
    setScannedObject(null);
  };

  return (
    <div className="w-full h-[100dvh] bg-black">
      {scanStatus === 'idle' || scanStatus === 'loading' || scanStatus === 'invalid' || scanStatus === 'not-found' ? (
        <QrViewfinder onScanSuccess={handleScanSuccess} onError={handleScanError}>
          {/* Overlays for loading/error states */}
          {scanStatus === 'loading' && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <RefreshCw className="w-12 h-12 text-accent animate-spin mb-4" />
              <p className="text-white font-bold text-lg font-serif">Identifying Object...</p>
            </div>
          )}
          
          {(scanStatus === 'invalid' || scanStatus === 'not-found') && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
              <AlertCircle className="w-16 h-16 text-danger mb-4" />
              <p className="text-white font-bold text-lg font-serif">{errorMessage}</p>
            </div>
          )}

          {/* Bottom helper text */}
          <div className="absolute bottom-10 left-0 right-0 z-30 text-center pointer-events-none">
             <p className="text-white/80 font-medium text-sm drop-shadow-md">
                Point at any object QR code to learn more
             </p>
          </div>
        </QrViewfinder>
      ) : null}

      {scanStatus === 'success' && scannedObject && (
        <ObjectInfoSheet object={scannedObject} onClose={closeSheet} />
      )}
    </div>
  );
};

export default Scan;
