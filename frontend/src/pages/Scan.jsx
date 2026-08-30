import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractQRCode } from '../utils/qrParser';
import { getObject, getMuseum } from '../services/api';
import QRScanner from '../components/qr/QRScanner';
import ManualObjectLookup from '../components/qr/ManualObjectLookup';
import { ArrowLeft, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const Scan = () => {
  const navigate = useNavigate();
  const [scanStatus, setScanStatus] = useState('idle'); // idle, loading, success, invalid, not-found
  const [scannedId, setScannedId] = useState(null);

  const handleScanSuccess = async (payload) => {
    // Prevent duplicate processing
    if (scanStatus === 'success' || scanStatus === 'loading') return;

    const qrData = extractQRCode(payload);

    if (!qrData) {
      setScanStatus('invalid');
      return;
    }

    setScanStatus('loading');
    
    try {
      if (qrData.type === 'object') {
        const object = await getObject(qrData.id);
        setScanStatus('success');
        setScannedId(object.id);
        setTimeout(() => navigate(`/objects/${object.id}`), 1000);
      } else if (qrData.type === 'museum') {
        const museum = await getMuseum(qrData.id);
        setScanStatus('success');
        setScannedId(museum.id);
        setTimeout(() => navigate(`/museums/${museum.id}`), 1000);
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setScanStatus('not-found');
      } else {
        setScanStatus('invalid'); // Just show invalid/error for other DB errors
      }
    }
  };

  const handleScanAgain = () => {
    setScanStatus('idle');
    setScannedId(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-8" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center">
            <Link to="/" className="hover:text-neutral-900 transition-colors flex items-center">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-4">Scan QR Code</h1>
        <p className="text-lg text-neutral-600 max-w-xl mx-auto">
          Point your camera at the QR code displayed near a museum or object to explore its digital counterpart.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start mb-16">
        
        {/* Scanner Column */}
        <div className="order-1 lg:order-none">
          {scanStatus === 'idle' && (
            <QRScanner onScanSuccess={handleScanSuccess} />
          )}
          
          {scanStatus === 'loading' && (
            <div className="bg-neutral-50 rounded-3xl p-12 text-center border border-neutral-200 aspect-square flex flex-col items-center justify-center">
              <RefreshCw className="w-16 h-16 text-neutral-900 animate-spin mb-6 mx-auto" />
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">Looking up item...</h2>
            </div>
          )}

          {scanStatus === 'success' && (
            <div className="bg-green-50 rounded-3xl p-12 text-center border border-green-200 aspect-square flex flex-col items-center justify-center">
              <CheckCircle className="w-20 h-20 text-green-500 mb-6 mx-auto" />
              <h2 className="text-2xl font-bold text-green-900 mb-2">Item Found!</h2>
              <p className="text-green-700">Opening details...</p>
            </div>
          )}

          {scanStatus === 'invalid' && (
            <div className="bg-red-50 rounded-3xl p-12 text-center border border-red-200 aspect-square flex flex-col items-center justify-center">
              <AlertCircle className="w-20 h-20 text-red-500 mb-6 mx-auto" />
              <h2 className="text-2xl font-bold text-red-900 mb-2">Invalid QR Code</h2>
              <p className="text-red-700 mb-8">That QR code is not a valid museum or object code.</p>
              <button 
                onClick={handleScanAgain}
                className="px-8 py-3 bg-red-900 text-white font-bold rounded-lg hover:bg-red-800 transition-colors"
              >
                SCAN AGAIN
              </button>
            </div>
          )}

          {scanStatus === 'not-found' && (
            <div className="bg-amber-50 rounded-3xl p-12 text-center border border-amber-200 aspect-square flex flex-col items-center justify-center">
              <AlertCircle className="w-20 h-20 text-amber-500 mb-6 mx-auto" />
              <h2 className="text-2xl font-bold text-amber-900 mb-2">Item Not Found</h2>
              <p className="text-amber-700 mb-8">The QR code does not correspond to an item in this system.</p>
              <button 
                onClick={handleScanAgain}
                className="px-8 py-3 bg-amber-900 text-white font-bold rounded-lg hover:bg-amber-800 transition-colors"
              >
                SCAN AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Instructions & Manual Input Column */}
        <div className="order-2 lg:order-none space-y-12">
          
          <ManualObjectLookup />

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">How to scan</h3>
            <ol className="list-decimal list-inside space-y-3 text-neutral-600">
              <li>Find the QR code near a museum object.</li>
              <li>Tap <span className="font-semibold text-neutral-900">Start Scanner</span>.</li>
              <li>Allow camera access if prompted.</li>
              <li>Point your camera at the QR code.</li>
              <li>The object's digital page will open automatically.</li>
            </ol>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Scan;
