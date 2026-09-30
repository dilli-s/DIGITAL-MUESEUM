import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMuseums } from '../../services/api';
import { MapPin, ArrowUpRight, Landmark } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const FeaturedMuseums = () => {
  const [museums, setMuseums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMuseums({ per_page: 8 })
      .then(res => {
        setMuseums(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching museums:', err);
        setMuseums([]);
        setLoading(false);
      });
  }, []);

  if (!loading && museums.length === 0) {
    return null;
  }

  return (
    <section className="py-8 sm:py-12 relative">
      {/* Header with Museum Filigree */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 sm:mb-10 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8f6826] font-['Cinzel']">
              Sanctuaries of Heritage
            </span>
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
          </div>
          <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight flex items-center gap-2.5">
            Featured Museums
          </h2>
          <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6f5b45] mt-1">
            Step inside the world's most renowned architectural vaults and research repositories
          </p>
        </div>

        <Link 
          to="/museums" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#bfae95] bg-[#fbf7ee] hover:bg-[#35281b] hover:border-[#35281b] text-[#5c462e] hover:text-[#f7efe3] text-xs font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 group self-start sm:self-auto"
        >
          <span>View All Sanctuaries</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#c89b3c] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {/* Grid of Refined Heritage Museum Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {museums.map((museum, idx) => {
          const imgSrc = museum.image 
            ? (museum.image.startsWith('http') ? museum.image : getMediaUrl(museum.image))
            : '/images/hero_museum_hall.jpg';

          const hallCode = `Wing ${['I', 'II', 'III', 'IV', 'V', 'VI'][idx % 6]}`;
          const curationTag = museum.category || 'Permanent Archive';

          return (
            <Link
              key={museum.id}
              to={`/museums/${museum.id}`}
              className="group relative rounded-2xl overflow-hidden bg-[#fdfbf7] border-2 border-[#d8c8b0] hover:border-[#8f6826] shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between text-left"
            >
              {/* Card Image Area */}
              <div className="relative h-52 sm:h-56 overflow-hidden bg-[#241a10]">
                <img
                  src={imgSrc}
                  alt={museum.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  loading="lazy"
                />

                {/* Soft Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1b140c]/80 via-[#1b140c]/20 to-transparent" />

                {/* Wing Badge on Top Left */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1b140c]/85 border border-[#c89b3c]/50 text-[#f7efe3] text-[10px] font-['Cinzel'] font-bold tracking-wider uppercase">
                  <Landmark className="w-3 h-3 text-[#e5c158]" />
                  <span>{hallCode}</span>
                </div>

                {/* Subtle Hover Action Pill Top Right */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#1b140c]/80 border border-[#c89b3c]/40 flex items-center justify-center text-[#e5c158] group-hover:bg-[#8f6826] group-hover:text-[#fff8ea] group-hover:scale-110 transition-all duration-300 shadow-md">
                  <ArrowUpRight className="w-4 h-4" />
                </div>

                {/* Bottom Tag on Image */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono tracking-wider uppercase text-[#fdfbf7] drop-shadow">
                  <span className="flex items-center gap-1.5 bg-[#1b140c]/70 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c89b3c]" />
                    {curationTag}
                  </span>
                  <span className="text-[#dfb758] font-bold">EST. ARCHIVE</span>
                </div>
              </div>

              {/* Museum Info Details Base */}
              <div className="p-5 flex flex-col justify-between flex-grow">
                <div>
                  {/* Museum Name */}
                  <h3 className="font-['Cinzel'] font-bold text-base sm:text-lg text-[#241a10] group-hover:text-[#8f6826] transition-colors leading-snug line-clamp-2 min-h-[3rem]">
                    {museum.name}
                  </h3>

                  {/* Location with Pin */}
                  <div className="flex items-center text-xs text-[#6e5842] mt-2">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#8f6826] flex-shrink-0" />
                    <span className="truncate">{museum.location || 'Heritage Gallery'}</span>
                  </div>
                </div>

                {/* Bottom Footer Accent */}
                <div className="mt-4 pt-3 border-t border-[#ede3d1] flex items-center justify-between text-xs font-semibold text-[#8f6826] group-hover:text-[#241a10] transition-colors">
                  <span className="font-['Cinzel'] tracking-wider uppercase text-[11px]">Enter Sanctuary</span>
                  <span className="text-[#c89b3c] font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturedMuseums;
