import React from 'react';
import { Landmark, Compass, Eye, BookOpen } from 'lucide-react';

const steps = [
  { 
    step: 'I', 
    icon: Landmark,
    title: 'Select a Sanctuary', 
    desc: 'Browse our curated global network of partner museums, heritage archives, and research institutes.' 
  },
  { 
    step: 'II', 
    icon: Compass,
    title: 'Navigate Galleries', 
    desc: 'Wander across virtual halls, explore architectural wings, and view thematic salons.' 
  },
  { 
    step: 'III', 
    icon: Eye,
    title: 'Examine Artifacts', 
    desc: 'Inspect high-resolution relics, 3D photogrammetry models, and curatorial provenance.' 
  },
  { 
    step: 'IV', 
    icon: BookOpen,
    title: 'Uncover Histories', 
    desc: 'Listen to expert audio guides, read archival stories, and test your knowledge.' 
  }
];

const HowItWorks = () => {
  return (
    <section className="py-12 sm:py-16 text-center relative">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="w-8 h-[1px] bg-[#c89b3c]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8f6826] font-['Cinzel']">
          Visitor Curatorial Guide
        </span>
        <span className="w-8 h-[1px] bg-[#c89b3c]" />
      </div>
      
      <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight mb-2">
        How the Virtual Journey Works
      </h2>
      <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6f5b45] max-w-xl mx-auto mb-10">
        Four simple steps to immerse yourself in centuries of preserved human history
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {steps.map((item, index) => {
          const Icon = item.icon;
          return (
            <div 
              key={index} 
              className="group bg-[#fdfbf7] border-2 border-[#d8c8b0] hover:border-[#c89b3c] p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 flex flex-col items-center text-center relative"
            >
              {/* Roman numeral wax stamp */}
              <div className="w-14 h-14 rounded-full bg-[#1e160e] border-2 border-[#c89b3c] text-[#e5c158] flex items-center justify-center font-['Cinzel'] font-bold text-lg mb-5 shadow-md group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-6 h-6" />
              </div>
              
              <span className="text-[10px] font-['Cinzel'] font-bold tracking-[0.2em] text-[#8f6826] uppercase mb-1">
                Phase {item.step}
              </span>
              
              <h3 className="font-['Cinzel'] font-bold text-base text-[#231a12] mb-2 group-hover:text-[#8f6826] transition-colors">
                {item.title}
              </h3>
              
              <p className="text-xs text-[#63513e] leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HowItWorks;
