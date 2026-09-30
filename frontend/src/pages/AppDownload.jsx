import React from 'react';
import { Smartphone, Download, CheckCircle2, QrCode, Shield, Zap, Compass, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const AppDownload = () => {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://play.google.com/store/apps/details?id=com.vanalok.mobile';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.vanalok.mobile';

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8f6826]/15 border border-[#8f6826]/30 text-[#8f6826] text-xs font-bold uppercase tracking-widest mb-3">
          <Smartphone className="w-3.5 h-3.5" />
          <span>On-Site Smart Guide</span>
        </div>
        <h1 className="font-['Cinzel'] text-3xl sm:text-5xl font-extrabold text-[#241a10] tracking-tight mb-4">
          Download the Digital Museum App
        </h1>
        <p className="font-['Cormorant_Garamond'] italic text-lg sm:text-xl text-[#6e5842] leading-relaxed">
          Your personal curator, offline indoor navigator, and high-speed QR scanner in your pocket.
        </p>
      </div>

      {/* Main Download Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#fdfbf7] border-2 border-[#d8c8b0] rounded-3xl p-6 sm:p-10 shadow-lg">
        {/* Left Column: QR Code Container */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 sm:p-8 bg-[#f4ede1] border-2 border-[#c89b3c]/40 rounded-2xl shadow-inner text-center">
          <div className="p-4 bg-white rounded-2xl shadow-md border border-[#d8c8b0] mb-4">
            <QRCodeSVG
              value={currentUrl}
              size={200}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: '/favicon.ico',
                x: undefined,
                y: undefined,
                height: 32,
                width: 32,
                excavate: true,
              }}
            />
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-[#8f6826] uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Scan with Phone Camera</span>
          </div>
          <p className="text-[11px] text-[#7a654f]">
            Point your mobile camera at this QR code to download & install immediately.
          </p>
        </div>

        {/* Right Column: App Features & Direct Actions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="font-['Cinzel'] font-bold text-2xl text-[#241a10] mb-2">
              Why Install the Mobile Companion?
            </h2>
            <p className="text-xs sm:text-sm text-[#5c4935] leading-relaxed mb-6">
              Specifically optimized for visitors walking through physical museum galleries and halls.
            </p>

            {/* Feature List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {[
                {
                  title: 'Instant QR Scanning',
                  desc: 'Scan exhibit QR tags for rich audio guides & deep history.',
                  icon: QrCode,
                },
                {
                  title: 'Indoor Turn-by-Turn',
                  desc: 'Navigate museum wings, washrooms & cafes without getting lost.',
                  icon: Compass,
                },
                {
                  title: 'Offline Vault Sync',
                  desc: 'Pre-download museum data to explore without internet connection.',
                  icon: Zap,
                },
                {
                  title: 'Multilingual Audio',
                  desc: 'Listen to native audio narrations with variable playback speeds.',
                  icon: Shield,
                },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} className="p-3.5 rounded-xl bg-[#fbf7ee] border border-[#d8c8b0] flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#8f6826]/15 text-[#8f6826] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#241a10]">{feat.title}</h4>
                      <p className="text-[11px] text-[#6e5842] mt-0.5 leading-snug">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#ede3d1]">
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#be9141] text-[#fff8ea] text-xs font-bold tracking-wider uppercase shadow-md hover:shadow-lg transition-all"
            >
              <Download className="w-4 h-4 text-[#ffe6a4]" />
              <span>Download for Android / iOS</span>
            </a>

            <a
              href="vanalok://m/1"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#fbf7ee] hover:bg-[#35281b] border border-[#bfae95] text-[#5c462e] hover:text-[#f7efe3] text-xs font-semibold tracking-wider uppercase transition-all"
            >
              <Smartphone className="w-4 h-4 text-[#8f6826]" />
              <span>Launch Installed App</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppDownload;
