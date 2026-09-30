import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorPlay, QrCode, ChevronRight, Landmark, Download, Smartphone, Maximize2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const MuseumAccessHub = () => {
  const [showQRModal, setShowQRModal] = useState(false);
  const downloadUrl = typeof window !== 'undefined' ? `${window.location.origin}/download` : 'https://play.google.com/store/apps/details?id=com.vanalok.mobile';

  return (
    <section className="py-12 sm:py-16 relative">
      {/* Section Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-[#c89b3c]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8f6826] font-['Cinzel']">
            Grand Gateway
          </span>
          <span className="w-8 h-[1px] bg-[#c89b3c]" />
        </div>
        <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight mb-2">
          Choose Your Museum Experience
        </h2>
        <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6f5b45] max-w-xl mx-auto">
          Explore world heritage digitally from your browser, or use our mobile app for interactive on-site expeditions.
        </p>
      </div>

      {/* Two Primary Museum Portal Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">

        {/* Virtual Museum Portal Card */}
        <div className="group relative bg-[#18120b] text-[#f7efe3] rounded-3xl overflow-hidden shadow-xl border-2 border-[#d8c8b0]/70 hover:border-[#c89b3c] transition-all duration-500">
          {/* Spotlight & subtle grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,155,60,0.25),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#241a10]/80 via-[#18120b] to-[#100b07]" />

          <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full min-h-[420px] justify-between">
            <div>
              <div className="w-14 h-14 bg-[#231a10] border border-[#c89b3c] rounded-2xl flex items-center justify-center mb-6 shadow-md text-[#e5c158]">
                <MonitorPlay className="w-7 h-7" />
              </div>
              <div className="text-[10px] font-['Cinzel'] font-bold tracking-[0.25em] text-[#c89b3c] uppercase mb-1">
                WEB GALLERIA
              </div>
              <h3 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#fbf7ee] mb-3">
                Virtual Museum
              </h3>
              <p className="text-xs sm:text-sm text-[#baa48c] leading-relaxed mb-6 max-w-sm">
                Browse galleries, explore 3D photogrammetry objects, read curatorial stories, and experience curated exhibitions from anywhere in the world.
              </p>
              <ul className="space-y-2.5 mb-8">
                {['Browse all galleries & permanent collections', 'View high-resolution 3D artifacts & media', 'Listen to curatorial stories & historical facts', 'Save favorites & track exploratory progress'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-xs text-[#d9c7b0]">
                    <div className="w-1.5 h-1.5 bg-[#e5c158] rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#c89b3c]/30">
              <Link
                to="/museums"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#c89b3c] hover:bg-[#dfb758] text-[#18120b] font-['Cinzel'] font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
              >
                <Landmark className="w-4 h-4" />
                <span>Browse All Museums</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Flutter Mobile App Card with Assigned QR Code */}
        <div className="group relative bg-[#18120b] text-[#f7efe3] rounded-3xl overflow-hidden shadow-xl border-2 border-[#d8c8b0]/70 hover:border-[#c89b3c] transition-all duration-500">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(180,120,40,0.2),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#241a10]/80 via-[#18120b] to-[#100b07]" />

          <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full min-h-[420px] justify-between">
            <div>
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-[#231a10] border border-[#c89b3c] rounded-2xl flex items-center justify-center shadow-md text-[#e5c158]">
                  <Smartphone className="w-7 h-7" />
                </div>

                {/* Embedded Scannable QR Code Badge */}
                <div 
                  onClick={() => setShowQRModal(true)}
                  className="p-2 bg-white rounded-xl shadow-md border border-[#c89b3c]/60 cursor-pointer hover:scale-105 transition-transform flex flex-col items-center group/qr"
                  title="Click to enlarge QR Code"
                >
                  <QRCodeSVG
                    value={downloadUrl}
                    size={80}
                    level="M"
                  />
                  <span className="text-[8px] font-bold text-[#241a10] mt-1 uppercase tracking-tight flex items-center gap-0.5">
                    <QrCode className="w-2.5 h-2.5 text-[#8f6826]" /> Scan App QR
                  </span>
                </div>
              </div>

              <div className="text-[10px] font-['Cinzel'] font-bold tracking-[0.25em] text-[#c89b3c] uppercase mb-1">
                ON-SITE EXPEDITION
              </div>
              <h3 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#fbf7ee] mb-3">
                Mobile Companion App
              </h3>
              <p className="text-xs sm:text-sm text-[#baa48c] leading-relaxed mb-4 max-w-sm">
                Visiting in person? Scan the QR code with your phone to download the mobile guide for on-site scanning, indoor maps, and turn-by-turn routing.
              </p>
              <ul className="space-y-2.5 mb-6">
                {['Scan physical QR checkpoints on museum exhibit cases', 'Turn-by-turn indoor map navigation & routing', 'Multilingual audio guides with offline vault execution'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-xs text-[#d9c7b0]">
                    <div className="w-1.5 h-1.5 bg-[#e5c158] rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#c89b3c]/30">
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#c89b3c] hover:bg-[#dfb758] text-[#18120b] font-['Cinzel'] font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
              >
                <Download className="w-4 h-4" />
                <span>Get Mobile App</span>
              </Link>

              <button
                onClick={() => setShowQRModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-[#2a1f14] hover:bg-[#3d2c1c] border border-[#c89b3c]/60 text-[#f3d37c] font-['Cinzel'] font-semibold rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Show QR Code</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Enlarged Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] border-2 border-[#d8c8b0] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#ede2cf] text-[#241a10] hover:bg-[#dfd2be] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-full bg-[#8f6826]/15 text-[#8f6826] flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="font-['Cinzel'] font-bold text-xl text-[#241a10] mb-1">
              Download Mobile App
            </h3>
            <p className="text-xs text-[#6e5842] mb-6">
              Scan this QR code with your mobile camera to download the Android/iOS application.
            </p>

            <div className="p-5 bg-white rounded-2xl border-2 border-[#c89b3c]/40 shadow-inner inline-block mb-6">
              <QRCodeSVG
                value={downloadUrl}
                size={190}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Link
                to="/download"
                onClick={() => setShowQRModal(false)}
                className="w-full py-2.5 px-4 bg-[#8f6826] hover:bg-[#a87d32] text-[#fff8ea] rounded-xl text-xs font-bold uppercase tracking-wider shadow"
              >
                Open Download Page
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MuseumAccessHub;
