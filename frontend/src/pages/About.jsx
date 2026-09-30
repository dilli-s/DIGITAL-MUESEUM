import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Landmark, 
  Globe, 
  Sparkles, 
  Compass, 
  CheckCircle2, 
  QrCode, 
  Bot, 
  Layers, 
  BookOpen,
  ArrowRight
} from 'lucide-react';
import VanalokLogo from '../components/common/VanalokLogo';

const About = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const useCases = [
    {
      icon: Globe,
      title: '360° Immersive Virtual Tours',
      desc: 'Enables remote visitors and researchers worldwide to wander through museum galleries, explore panoramic photospheres, and inspect historical monuments without geographical boundaries.'
    },
    {
      icon: QrCode,
      title: 'Physical In-Museum Smart Companion',
      desc: 'Visitors on-site scan QR badges beside physical exhibits using mobile camera to instantly access curated histories, high-res photos, audio guides, and related objects.'
    },
    {
      icon: Layers,
      title: '3D Interactive Artifact Inspection',
      desc: 'Users can rotate, zoom, and inspect precious artifacts in full 3D and Augmented Reality (AR), revealing microscopic engravings and angles impossible to view behind glass cases.'
    },
    {
      icon: Bot,
      title: 'AI Multi-Lingual Museum Assistant',
      desc: 'An interactive conversational AI guide capable of answering complex historical inquiries, interpreting artistic context, and providing narrations in multiple languages.'
    },
    {
      icon: Compass,
      title: 'Indoor Navigation & Wayfinding',
      desc: 'Smart floor-plan mapping and step-by-step route recalculation guiding visitors through complex multi-floor museum wings to find specific exhibits, elevators, and amenities.'
    },
    {
      icon: BookOpen,
      title: 'Educational Stories & Quizzes',
      desc: 'Structured learning modules, historical narratives, and interactive activities tailored for students, researchers, and history enthusiasts.'
    }
  ];

  const benefits = [
    {
      title: 'Global Heritage Democratization',
      desc: 'Brings world-renowned institutions (Louvre, British Museum, National Museum of India) to anyone with an internet connection, breaking socioeconomic and geographical barriers.'
    },
    {
      title: 'Multisensory & Deep Engagement',
      desc: 'Replaces flat placard texts with audio narrations, 3D manipulation, and interactive quizzes that increase knowledge retention and visitor enjoyment.'
    },
    {
      title: 'Offline-First Resilience',
      desc: 'Mobile app downloads museum datasets for offline execution, ensuring seamless navigation and object scanning inside thick stone museum walls without cellular reception.'
    },
    {
      title: 'Long-Term Digital Preservation',
      desc: 'Guarantees that vulnerable, fragile, or deteriorating historical artifacts are recorded in high-fidelity 3D and 360° panoramas for future generations.'
    },
    {
      title: 'Museum Analytics & Visitor Insights',
      desc: 'Provides curators with heatmaps and analytics on popular exhibits, dwell times, and bottleneck zones to optimize gallery curation.'
    }
  ];

  return (
    <div className="w-full flex flex-col gap-8 sm:gap-12 pb-16">
      
      {/* Hero Banner with Classical Museum Hall Artwork */}
      <section className="relative w-full rounded-3xl overflow-hidden border-2 border-[#dfd2be] shadow-xl bg-[#241a10] text-[#fdf8ee] p-8 sm:p-14 text-center">
        {/* Full-res Classical Museum Art Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-100 opacity-55"
          style={{ backgroundImage: `url('/images/hero_museum_hall.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c140d]/90 via-[#1c140d]/70 to-[#1c140d]/90" />
        
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <VanalokLogo className="justify-center mb-4" light={true} />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8f6826]/40 border border-[#dfb758]/50 text-[#ffe29a] text-[10px] font-bold tracking-[0.25em] uppercase mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#ffe29a]" />
            SYSTEM ARCHITECTURE & OVERVIEW
          </div>

          <h1 className="font-['Cinzel'] font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#fffdfa] tracking-tight mb-4 drop-shadow">
            About Digital Museum Platform
          </h1>

          <p className="font-['Cormorant_Garamond'] italic text-lg sm:text-2xl text-[#f3e3cb] leading-relaxed mb-6 drop-shadow">
            "Bridging the physical sanctuary of history with the boundless realm of digital heritage."
          </p>

          <p className="text-xs sm:text-base text-[#d4c4ac] leading-relaxed max-w-2xl font-light">
            Digital Museum is a comprehensive Smart Cultural Guide ecosystem engineered to transform how humanity experiences, navigates, and preserves cultural artifacts across Web and Mobile platforms.
          </p>
        </div>
      </section>

      {/* Navigation Pills for Quick Section Jumps */}
      <div className="flex justify-center flex-wrap gap-2.5 sm:gap-4">
        {[
          { id: 'overview', label: 'Platform Purpose' },
          { id: 'uses', label: 'Uses & Capabilities' },
          { id: 'benefits', label: 'Key Benefits' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-200 border-2 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] border-[#8f6826] shadow-md shadow-[#8f6826]/20 scale-105'
                : 'bg-[#fdfbf7] text-[#5a4836] border-[#dfd2be] hover:border-[#8f6826] hover:text-[#241a10] shadow-xs'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Platform Purpose & Architecture */}
      {(activeTab === 'overview' || activeTab === 'all') && (
        <section className="bg-gradient-to-b from-[#fdfbf7] to-[#faf4ea] rounded-3xl border-2 border-[#dfd2be] p-6 sm:p-10 lg:p-12 shadow-md text-[#241a10]">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#8f6826]" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-[#735a3e]">
                CORE PURPOSE
              </span>
            </div>

            <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-4xl text-[#241a10]">
              What is Digital Museum?
            </h2>

            <p className="text-sm sm:text-base leading-relaxed text-[#4d3d2c]">
              <strong>Digital Museum</strong> is an integrated museum technological ecosystem combining a responsive Web portal, an offline-ready Flutter mobile application, an AI-driven curator assistant, and a Flask microservice backend. It provides a dual-modality experience:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-2">
              <div className="p-6 rounded-2xl bg-[#fdfbf7] border-2 border-[#dfd2be] shadow-sm hover:border-[#8f6826] transition-colors">
                <div className="font-['Cinzel'] font-bold text-lg text-[#241a10] mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#8f6826]" />
                  Virtual Digital Museum (Web)
                </div>
                <p className="text-xs sm:text-sm text-[#5f4d39] leading-relaxed">
                  Allows global remote audiences to explore 360° spherical panoramic photo galleries, interact with 3D model artifacts, listen to multilingual voice guides, and query AI assistant curators.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#fdfbf7] border-2 border-[#dfd2be] shadow-sm hover:border-[#8f6826] transition-colors">
                <div className="font-['Cinzel'] font-bold text-lg text-[#241a10] mb-2 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#8f6826]" />
                  Smart Physical Guide (Mobile)
                </div>
                <p className="text-xs sm:text-sm text-[#5f4d39] leading-relaxed">
                  Operates on-site inside physical museums via camera QR code recognition, Wi-Fi fingerprint localization, floor plan pathfinding, and full offline caching for zero-cell-coverage environments.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: Uses & Capabilities */}
      {(activeTab === 'uses' || activeTab === 'all') && (
        <section className="bg-gradient-to-b from-[#fdfbf7] to-[#faf4ea] rounded-3xl border-2 border-[#dfd2be] p-6 sm:p-10 lg:p-12 shadow-md text-[#241a10]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-[#8f6826]">
                FUNCTIONAL SCOPE
              </span>
              <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-4xl text-[#241a10] mt-1 mb-3">
                Key Uses & Capabilities
              </h2>
              <p className="font-['Cormorant_Garamond'] italic text-base sm:text-xl text-[#6e5842]">
                Engineered for both on-site physical visitors and remote digital explorers
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {useCases.map((uc, index) => {
                const Icon = uc.icon;
                return (
                  <div 
                    key={index}
                    className="p-6 rounded-2xl bg-[#fdfbf7] border-2 border-[#dfd2be] hover:border-[#8f6826] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-[#ede3d1] border border-[#d4c4ac] flex items-center justify-center text-[#8f6826] mb-4 group-hover:scale-110 group-hover:bg-[#8f6826] group-hover:text-[#fff8ea] transition-all">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-['Cinzel'] font-bold text-base text-[#241a10] mb-2 group-hover:text-[#8f6826] transition-colors">
                        {uc.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#5f4d39] leading-relaxed font-light">
                        {uc.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: Benefits & Advantages */}
      {(activeTab === 'benefits' || activeTab === 'all') && (
        <section className="bg-gradient-to-b from-[#fdfbf7] to-[#faf4ea] rounded-3xl border-2 border-[#dfd2be] p-6 sm:p-10 lg:p-12 shadow-md text-[#241a10]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-[#8f6826]">
                SYSTEM VALUE
              </span>
              <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-4xl text-[#241a10] mt-1 mb-3">
                Key Benefits & Strengths
              </h2>
              <p className="font-['Cormorant_Garamond'] italic text-base sm:text-xl text-[#6e5842]">
                Why digital museum technology elevates visitor engagement and preservation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {benefits.map((b, index) => (
                <div 
                  key={index}
                  className="p-5 sm:p-6 rounded-2xl bg-[#fdfbf7] border-2 border-[#dfd2be] hover:border-[#8f6826] flex gap-4 items-start shadow-xs transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#8f6826] text-[#fff8ea] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#ffe29a]" />
                  </div>
                  <div>
                    <h3 className="font-['Cinzel'] font-bold text-sm sm:text-base text-[#241a10] mb-1">
                      {b.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5f4d39] leading-relaxed font-light">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom Call to Action */}
      <section className="rounded-3xl p-8 sm:p-12 text-center border-2 border-[#dfd2be] bg-gradient-to-b from-[#fdfbf7] to-[#faf4ea] shadow-md text-[#241a10] flex flex-col items-center">
        <h3 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#241a10] mb-2">
          Ready to Step Into History?
        </h3>
        <p className="font-['Cormorant_Garamond'] italic text-base sm:text-xl text-[#6e5842] max-w-xl mb-6">
          Experience world museum galleries or scan artifacts in person with Digital Museum.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/museums"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] text-xs sm:text-sm font-bold tracking-wider uppercase shadow-md hover:from-[#a87d32] hover:to-[#dfb758] transition-all"
          >
            <span>Explore Virtual Museums</span>
            <ArrowRight className="w-4 h-4 text-[#ffe6a4]" />
          </Link>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#fdfbf7] hover:bg-[#ede3d1] border-2 border-[#dfd2be] text-[#241a10] text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xs transition-all"
          >
            <span>Scan QR Code</span>
          </Link>
        </div>
      </section>

    </div>
  );
};

export default About;
