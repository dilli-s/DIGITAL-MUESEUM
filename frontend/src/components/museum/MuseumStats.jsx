import React from 'react';
import { Landmark, Compass, Box, Image as ImageIcon, Sparkles } from 'lucide-react';

const MuseumStats = ({ museums, filteredCount }) => {
  const totalCollections = museums.length > 0 ? museums.length * 8 : 0;
  const totalObjects = museums.reduce((acc, curr) => acc + (curr.objectCount || 0), 0);
  const totalGalleries = museums.reduce((acc, curr) => acc + (curr.galleryCount || 0), 0);

  const stats = [
    { label: 'Museums', value: `${museums.length}+`, icon: Landmark, desc: 'World Institutions' },
    { label: 'Collections', value: `${totalCollections}+`, icon: Compass, desc: 'Curated Archives' },
    { label: 'Objects', value: `${totalObjects.toLocaleString()}+`, icon: Box, desc: 'Digital Artifacts' },
    { label: 'Galleries', value: `${totalGalleries}+`, icon: ImageIcon, desc: 'Virtual Wings' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div 
            key={idx}
            className="group relative rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-[#fdfbf7] to-[#f7efe1] border-2 border-[#dfd2be] hover:border-[#8f6826] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            {/* Subtle background medal glow */}
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#8f6826]/10 rounded-full blur-xl group-hover:bg-[#8f6826]/20 transition-colors" />

            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#ede3d1] border border-[#d4c4ac] flex items-center justify-center text-[#8f6826] group-hover:scale-110 group-hover:bg-[#8f6826] group-hover:text-[#fff8ea] transition-all shadow-xs">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c8a76]">
                VAULT #{idx + 1}
              </span>
            </div>

            <div>
              <div className="font-['Cinzel'] text-3xl sm:text-4xl font-extrabold text-[#241a10] group-hover:text-[#8f6826] transition-colors tracking-tight">
                {stat.value}
              </div>
              <div className="font-bold text-xs uppercase tracking-wider text-[#6e5842] mt-0.5">
                {stat.label}
              </div>
              <div className="text-[11px] text-[#8a7660] italic font-['Cormorant_Garamond'] mt-1">
                {stat.desc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MuseumStats;
