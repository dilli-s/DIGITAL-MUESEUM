import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';

const HeroSection = ({ onLocationDetect, onSearch }) => {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

  const handleExploreClick = () => {
    const el = document.getElementById('experience-section') || document.getElementById('museum-finder');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/museums');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    if (onSearch) onSearch(searchInput.trim());
    navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
  };

  return (
    <section className="relative w-full min-h-[calc(100vh-5rem)] flex flex-col justify-between overflow-hidden bg-[#0c0a08]">
      {/* Full-bleed Grand Museum Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000"
        style={{
          backgroundImage: `url('/images/hero_museum_hall.jpg')`,
        }}
      />

      {/* Atmospheric Vignette & Warm Golden Shadows */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c0a] via-[#0e0c0a]/45 to-[#0e0c0a]/75" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0c0a]/90 via-[#0e0c0a]/40 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(14,12,10,0.85)_100%)]" />

      {/* Top spacer */}
      <div className="relative z-10 pt-8 sm:pt-16" />

      {/* Hero Content container - responsive across all devices */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-8 sm:pb-12 text-left">
        <div className="max-w-3xl">
          {/* Category / Badge */}
          <div className="inline-flex items-center gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-[1px] bg-[#c89b3c]" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-[0.3em] uppercase text-[#dfb758]">
              SMART CULTURAL GUIDE
            </span>
          </div>

          {/* Main Title */}
          <h1 className="font-['Cinzel'] font-bold text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-[#fdf8ee] tracking-tight uppercase leading-[1.02] drop-shadow-lg">
            DIGITAL MUSEUM
          </h1>

          {/* Italic Graceful Subheading */}
          <p className="font-['Cormorant_Garamond'] italic text-2xl sm:text-4xl md:text-5xl text-[#eeddc0] font-normal mt-1 sm:mt-2 mb-4 sm:mb-6 leading-tight tracking-wide drop-shadow">
            Your Window to the Past
          </p>

          {/* Supporting description */}
          <p className="text-sm sm:text-base md:text-lg text-[#c2b39d] max-w-2xl font-light leading-relaxed mb-8 sm:mb-10 drop-shadow-sm">
            Step into a world of art, history and culture — where every artifact tells a story.
          </p>

          {/* Action Button & Search */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleExploreClick}
              className="group inline-flex items-center gap-2.5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#be9141] text-[#fff8ea] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-xl shadow-[#8f6826]/30 border border-[#dfb758]/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Museums</span>
              <ChevronRight className="w-4 h-4 text-[#ffe6a4] group-hover:translate-x-1 transition-transform" />
            </button>

            <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center bg-[#171410]/80 backdrop-blur-md border border-[#4a3d2c] rounded-full px-4 py-3 focus-within:border-[#c89b3c] transition-colors w-72 md:w-80 shadow-md">
              <Search className="w-4 h-4 text-[#a89984] mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search artifacts, galleries..."
                className="bg-transparent text-xs sm:text-sm text-[#f4eee1] placeholder-[#8a7c6a] focus:outline-none w-full"
              />
            </form>
          </div>
        </div>
      </div>

      {/* Scroll indicator with antique mouse glyph */}
      <div className="relative z-10 pb-6 sm:pb-8 flex flex-col items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
        <button 
          onClick={handleExploreClick}
          className="flex flex-col items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase text-[#b0a08b] hover:text-[#dfb758] transition-colors"
        >
          <div className="w-4 h-7 border border-[#b0a08b]/70 rounded-full flex justify-center pt-1">
            <div className="w-1 h-1.5 bg-[#dfb758] rounded-full animate-bounce" />
          </div>
          <span>Scroll</span>
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
