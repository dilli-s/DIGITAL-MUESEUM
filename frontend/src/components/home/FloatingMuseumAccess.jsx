import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Compass, X } from 'lucide-react';

const FloatingMuseumAccess = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show the floating button after scrolling down 300px
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 hidden md:flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-neutral-200 p-4 flex flex-col gap-3 relative group min-w-[300px]">
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute -top-3 -right-3 bg-neutral-900 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-neutral-800 hover:scale-110 shadow-lg"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex justify-between items-center px-2 pt-1 pb-1">
          <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Quick Access</span>
        </div>

        <Link 
          to="/museums" 
          className="group/btn flex items-center gap-4 bg-neutral-50 hover:bg-neutral-900 text-neutral-900 hover:text-white px-5 py-4 rounded-2xl transition-all duration-300 border border-neutral-100 hover:border-transparent hover:shadow-xl transform hover:-translate-y-1"
        >
          <div className="bg-white group-hover/btn:bg-neutral-800 p-3 rounded-xl shadow-sm transition-colors">
            <Monitor className="w-6 h-6 text-neutral-700 group-hover/btn:text-neutral-100" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight mb-1">Virtual Museum</span>
            <span className="text-sm text-neutral-500 group-hover/btn:text-neutral-300 leading-tight">Explore online 3D exhibits</span>
          </div>
        </Link>
        
        <Link 
          to="/search" 
          className="group/btn flex items-center gap-4 bg-neutral-50 hover:bg-neutral-900 text-neutral-900 hover:text-white px-5 py-4 rounded-2xl transition-all duration-300 border border-neutral-100 hover:border-transparent hover:shadow-xl transform hover:-translate-y-1"
        >
          <div className="bg-white group-hover/btn:bg-neutral-800 p-3 rounded-xl shadow-sm transition-colors">
            <Compass className="w-6 h-6 text-neutral-700 group-hover/btn:text-neutral-100" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight mb-1">Explore & Search</span>
            <span className="text-sm text-neutral-500 group-hover/btn:text-neutral-300 leading-tight">Find objects and artifacts</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default FloatingMuseumAccess;
