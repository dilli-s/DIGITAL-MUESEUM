import React from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Globe, ArrowRight, QrCode, Compass, Sparkles } from 'lucide-react';

const ExperienceCards = () => {
  return (
    <section id="experience-section" className="py-8 sm:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Card 1: PHYSICAL MUSEUM ON-SITE EXPEDITION */}
        <div className="group relative rounded-2xl bg-[#fdfbf7] border-2 border-[#d8c8b0] p-6 sm:p-8 shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col justify-between text-[#2b2218] hover:-translate-y-1">
          {/* Subtle vintage parchment background glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(200,155,60,0.15),transparent_70%)] pointer-events-none" />
          
          {/* Decorative archival watermark stamp */}
          <div className="absolute top-4 right-4 text-[40px] font-['Cinzel'] font-bold text-[#c89b3c]/10 select-none pointer-events-none">
            MUSEUM
          </div>

          <div>
            {/* Top Category Badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#ede2cf] border border-[#c89b3c]/50 flex items-center justify-center text-[#8f6826] shadow-sm">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#8f6826] font-['Cinzel']">
                ON-SITE EXPEDITION
              </span>
            </div>

            {/* Title */}
            <h3 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight mb-2">
              Discover In Person
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#5f4d39] font-normal leading-relaxed mb-6 max-w-sm">
              Scan artifact QR codes, explore interactive floorplans, and unlock curated curator audio right in the galleries.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end mt-2">
            {/* Left Button */}
            <div className="sm:col-span-5 flex flex-col gap-2">
              <Link
                to="/scan"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#2a1e12] hover:bg-[#43311f] text-[#f7efe3] text-xs font-semibold tracking-wider uppercase shadow-md hover:shadow-lg transition-all duration-300"
              >
                <span>Launch Scanner</span>
                <QrCode className="w-3.5 h-3.5 text-[#e5c158]" />
              </Link>
            </div>

            {/* Right Image with clean gallery frame */}
            <div className="sm:col-span-7 relative">
              <div className="relative rounded-xl overflow-hidden border-2 border-[#d8c8b0] shadow-sm group-hover:scale-[1.02] transition-transform duration-500 bg-[#1e1710]">
                <img
                  src="/images/card_qr_scan.jpg"
                  alt="Scan QR Artifacts"
                  className="w-full h-36 sm:h-40 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1e1710]/70 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] text-[#f7efe3] font-['Cinzel'] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e5c158]" />
                  GALLERY SCANNER ACTIVE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: VIRTUAL MUSEUM GRAND TOUR */}
        <div className="group relative rounded-2xl bg-[#fdfbf7] border-2 border-[#d8c8b0] p-6 sm:p-8 shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col justify-between text-[#2b2218] hover:-translate-y-1">
          {/* Subtle vintage parchment background glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(200,155,60,0.15),transparent_70%)] pointer-events-none" />
          
          {/* Decorative archival watermark stamp */}
          <div className="absolute top-4 right-4 text-[40px] font-['Cinzel'] font-bold text-[#c89b3c]/10 select-none pointer-events-none">
            GALLERIA
          </div>

          <div>
            {/* Top Category Badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#ede2cf] border border-[#c89b3c]/50 flex items-center justify-center text-[#8f6826] shadow-sm">
                <Globe className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#8f6826] font-['Cinzel']">
                IMMERSIVE DIGITAL TOUR
              </span>
            </div>

            {/* Title */}
            <h3 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight mb-2">
              Explore From Anywhere
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#5f4d39] font-normal leading-relaxed mb-6 max-w-sm">
              Walk through 3D museum halls, examine ancient relics in high fidelity, and tour world sanctuaries digitally.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end mt-2">
            {/* Left Button */}
            <div className="sm:col-span-5 flex flex-col gap-2">
              <Link
                to="/museums"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#2a1e12] hover:bg-[#43311f] text-[#f7efe3] text-xs font-semibold tracking-wider uppercase shadow-md hover:shadow-lg transition-all duration-300"
              >
                <span>Enter Sanctuaries</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#e5c158]" />
              </Link>
            </div>

            {/* Right Image with clean gallery frame */}
            <div className="sm:col-span-7 relative">
              <div className="relative rounded-xl overflow-hidden border-2 border-[#d8c8b0] shadow-sm group-hover:scale-[1.02] transition-transform duration-500 bg-[#1e1710]">
                <img
                  src="/images/card_statue_bust.jpg"
                  alt="Virtual Museum Statue Tour"
                  className="w-full h-36 sm:h-40 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1e1710]/70 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] text-[#f7efe3] font-['Cinzel'] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e5c158]" />
                  3D VIRTUAL WINGS ONLINE
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ExperienceCards;
