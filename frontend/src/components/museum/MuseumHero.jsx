import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Play, Compass, ArrowRight } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const MuseumHero = ({ museum }) => {
  const heroImage = museum.image || museum.image_url;
  const imageUrl = heroImage ? getMediaUrl(heroImage) : null;

  return (
    <section className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-[#16152b] text-white rounded-3xl overflow-hidden mb-12 relative flex flex-col md:flex-row min-h-[420px] border border-neutral-800 shadow-xl">
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-500/20 via-purple-500/10 to-transparent pointer-events-none"></div>
      
      <div className="md:w-7/12 p-8 sm:p-12 flex flex-col justify-center z-10">
        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <Building2 className="w-4 h-4" />
          <span>{museum.category || 'Museum Collection'}</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-white">
          {museum.name}
        </h1>
        
        <div className="flex items-center text-neutral-300 mb-5 text-sm font-medium">
          <MapPin className="w-4 h-4 mr-2 text-amber-400" />
          <span>{museum.location || 'Virtual Interactive Exhibition'}</span>
        </div>
        
        <p className="text-base sm:text-lg text-neutral-300 mb-8 max-w-xl leading-relaxed">
          {museum.description || 'Step inside our digital museum with 360° Google Street View virtual tours, curated artifact hotspots, and interactive gallery exhibitions.'}
        </p>
        
        <div className="flex flex-wrap items-center gap-3 mt-auto">
          <Link 
            to={`/museum/${museum.id}/tour`} 
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-3.5 text-sm font-bold text-neutral-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all hover:scale-105 active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START 360° TOUR</span>
          </Link>
          
          <Link 
            to={`/museum/${museum.id}/map`} 
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 px-5 py-3.5 text-sm font-semibold text-white transition-colors"
          >
            <Compass className="w-4 h-4 text-purple-400" />
            <span>Floor Map</span>
          </Link>

          <Link 
            to="/museums" 
            className="inline-flex items-center justify-center rounded-xl border border-neutral-700/80 px-4 py-3.5 text-xs font-semibold text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Right Visual Panel */}
      <div className="md:w-5/12 bg-neutral-950 relative min-h-[280px] flex items-center justify-center overflow-hidden border-t md:border-t-0 md:border-l border-neutral-800">
        {imageUrl ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-40 blur-md scale-110"
              style={{ backgroundImage: `url(${imageUrl})` }}
            ></div>
            <img 
              src={imageUrl} 
              alt={museum.name}
              className="relative z-10 w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Link
              to={`/museum/${museum.id}/tour`}
              className="absolute z-20 inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/90 text-neutral-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </Link>
          </>
        ) : (
          <Link
            to={`/museum/${museum.id}/tour`}
            className="group absolute inset-0 bg-gradient-to-br from-[#121124] via-[#1a1836] to-neutral-950 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(251,191,36,0.5)] group-hover:scale-110 transition-transform duration-300">
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </div>
            <span className="text-sm font-extrabold text-white tracking-wide uppercase mb-1">
              360° Virtual Experience
            </span>
            <span className="text-xs text-amber-300 flex items-center gap-1 group-hover:underline">
              <span>Click to Enter Panorama</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        )}
      </div>
    </section>
  );
};

export default MuseumHero;
