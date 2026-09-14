import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Navigation, MapPin } from 'lucide-react';

const HeroSection = ({ onLocationDetect, onSearch }) => {
  const [searchInput, setSearchInput] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationName, setLocationName] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    if (onSearch) onSearch(searchInput.trim());
    document.getElementById('museum-finder')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        setLocationGranted(true);
        setLocationName('Detecting...');
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            'your area';
          setLocationName(city);
        } catch {
          setLocationName('your area');
        }
        if (onLocationDetect) onLocationDetect({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setTimeout(() => {
          document.getElementById('museum-finder')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <section className="bg-neutral-900 text-white rounded-2xl my-2 sm:my-6 px-4 sm:px-6 py-10 sm:py-28 relative overflow-hidden">
      {/* Subtle dot grid — same as the old hero */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase mb-3 sm:mb-4">
          Welcome to the Digital Museum
        </p>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight mb-3 sm:mb-4">
          Experience History, Reimagined.
        </h1>

        <p className="text-neutral-400 text-sm sm:text-base mb-6 sm:mb-10 leading-relaxed">
          A next-generation platform for virtual museum exploration. Discover nearby exhibitions, interact with AI-generated 3D artifacts, and listen to immersive multi-lingual audio narrations.
        </p>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-xl mx-auto mb-4">
          <div className="flex-1 flex items-center bg-white/10 border border-white/20 rounded-lg overflow-hidden focus-within:border-white/50 transition-colors">
            <Search className="w-4 h-4 text-neutral-400 ml-4 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search city or museum..."
              className="flex-1 bg-transparent text-white placeholder-neutral-500 px-3 py-3 text-sm focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!searchInput.trim()}
            className="px-5 py-3 bg-white text-neutral-900 text-sm font-semibold rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4 max-w-xl mx-auto">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-neutral-500 text-xs">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Location button */}
        {!locationGranted ? (
          <button
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-2 px-5 py-3 border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/10 disabled:opacity-60 transition-colors"
          >
            <Navigation className={`w-4 h-4 text-neutral-300 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Getting location...' : 'Use My Location'}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/20 rounded-lg text-sm text-neutral-300">
            <MapPin className="w-4 h-4 text-neutral-400" />
            {locationName} — <span className="text-white font-medium">see museums below ↓</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
