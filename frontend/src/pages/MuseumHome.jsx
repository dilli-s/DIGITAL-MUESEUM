import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum } from '../services/api';
import MuseumNavigation from '../components/museum/MuseumNavigation';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import { Play, Navigation, RefreshCw, Sparkles, MapPin, ArrowRight } from 'lucide-react';

const MuseumHome = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMuseum(museumId)
      .then(m => {
        setMuseum(m);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMuseum(null);
        setIsLoading(false);
      });
  }, [museumId]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
      </div>
    );
  }

  if (!museum) {
    return <MuseumNotFound />;
  }

  return (
    <div className="w-full">
      <MuseumNavigation museumId={museumId} />
      
      {/* Hero Welcome Banner */}
      <section className="bg-gradient-to-br from-neutral-950 via-[#0d0d16] to-[#121124] text-white rounded-3xl p-8 sm:p-12 mb-12 relative overflow-hidden shadow-2xl border border-neutral-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>Digital Portal & Virtual Experience</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-white">
            {museum.name}
          </h1>
          <p className="text-sm font-medium text-neutral-400 mb-4 flex items-center justify-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>{museum.location || 'Interactive Virtual Museum'}</span>
          </p>
          <p className="text-neutral-300 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Choose your preferred way to experience the museum. Take a full 360° Street View walk or explore curated digital galleries.
          </p>
          
          {/* Dual Experience Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
            {/* 360 Virtual Tour Card */}
            <Link
              to={`/museum/${museumId}/tour`}
              className="group p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-white/[0.03] border border-amber-500/30 hover:border-amber-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.25)] hover:scale-[1.02] flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center shadow-lg font-bold">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30">
                    Recommended
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                  360° Virtual Walkthrough
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 mb-6 leading-relaxed">
                  Walk through physical hallways and rooms using Street View arrows, turn 360°, and inspect tagged artifacts.
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-amber-400 group-hover:underline">
                <span>Start 360° Tour Now</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Gallery Explorer Card */}
            <Link
              to={`/museum/${museumId}/galleries`}
              className="group p-6 sm:p-8 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all duration-300 hover:bg-white/[0.07] hover:scale-[1.02] flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-neutral-300 text-[10px] font-semibold uppercase tracking-wider">
                    Catalog
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                  Curated Galleries & Exhibits
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 mb-6 leading-relaxed">
                  Browse categorized collections, historical stories, artifact details, and 3D models at your own pace.
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-indigo-300 group-hover:underline">
                <span>Browse Galleries</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MuseumHome;
