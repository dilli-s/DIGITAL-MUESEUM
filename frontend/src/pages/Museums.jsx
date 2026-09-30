import React, { useState, useEffect, useMemo } from 'react';
import { getMuseums } from '../services/api';
import MuseumCard from '../components/museum/MuseumCard';
import MuseumSearch from '../components/museum/MuseumSearch';
import MuseumFilters from '../components/museum/MuseumFilters';
import MuseumStats from '../components/museum/MuseumStats';
import { Landmark, RefreshCw, Sparkles, Compass, ArrowRight } from 'lucide-react';

const Museums = () => {
  const [museums, setMuseums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchMuseums = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getMuseums({ per_page: 50 });
      setMuseums(response.data || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load museums.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMuseums();
  }, []);

  // Derive categories from data
  const categories = useMemo(() => {
    const cats = new Set(museums.filter(m => m.category).map(m => m.category));
    return ['All', ...Array.from(cats)].sort();
  }, [museums]);

  // Filter logic
  const filteredMuseums = useMemo(() => {
    return museums.filter(museum => {
      const matchCategory = selectedCategory === 'All' || museum.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (museum.name && museum.name.toLowerCase().includes(term)) ||
        (museum.location && museum.location.toLowerCase().includes(term)) ||
        (museum.description && museum.description.toLowerCase().includes(term)) ||
        (museum.category && museum.category.toLowerCase().includes(term));
        
      return matchCategory && matchSearch;
    });
  }, [museums, searchTerm, selectedCategory]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-[#8f6826] animate-spin mb-4" />
        <p className="text-lg text-[#5a4836] font-medium font-['Cinzel']">Opening Museum Archives...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <Landmark className="w-16 h-16 text-red-600 mb-6" />
        <h2 className="font-['Cinzel'] text-2xl font-bold text-[#241a10] mb-2">{error}</h2>
        <p className="text-[#6e5842] mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchMuseums}
          className="px-8 py-3 bg-[#8f6826] text-[#fff8ea] font-bold rounded-full hover:bg-[#a87d32] transition-colors uppercase tracking-wider text-xs shadow-md"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-10 pb-20">
      
      {/* Majestic Classical Hero Banner */}
      <section className="relative rounded-3xl overflow-hidden border-2 border-[#d8c8b0] shadow-xl bg-[#241a10] text-[#fdf8ee] p-8 sm:p-14 min-h-[280px] flex flex-col justify-between">
        {/* Full-res Classical Museum Art Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-100 opacity-55"
          style={{ backgroundImage: `url('/images/hero_museum_hall.jpg')` }}
        />
        
        {/* Warm Golden Lighting Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1c140d] via-[#1c140d]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c140d]/90 via-transparent to-transparent" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#8f6826]/40 border border-[#dfb758]/50 text-[#ffe29a] text-[11px] font-bold tracking-[0.25em] uppercase mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#ffe29a]" />
            GLOBAL REPOSITORY ARCHIVE
          </div>

          <h1 className="font-['Cinzel'] text-4xl sm:text-6xl font-extrabold tracking-tight text-[#fffdfa] mb-3 leading-tight drop-shadow-md">
            Explore Museums
          </h1>

          <p className="font-['Cormorant_Garamond'] italic text-xl sm:text-2xl text-[#f3e3cb] leading-relaxed max-w-2xl drop-shadow">
            Discover historic sanctuaries, opulent galleries, and interactive 3D collections across the globe.
          </p>
        </div>

        {/* Bottom Banner Bar */}
        <div className="relative z-10 pt-6 mt-6 border-t border-[#dfb758]/20 flex flex-wrap items-center justify-between gap-4 text-xs text-[#d4c4ac]">
          <div className="flex items-center gap-2 font-['Cinzel'] tracking-wider">
            <Compass className="w-4 h-4 text-[#dfb758]" />
            <span>CURATED HERITAGE • VIRTUAL & PHYSICAL</span>
          </div>
          <span className="italic font-['Cormorant_Garamond'] text-sm text-[#e8d6bd]">
            "Preserving human history for future generations."
          </span>
        </div>
      </section>

      {/* Discovery Search & Interactive Filters */}
      <section className="space-y-4">
        <MuseumSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <MuseumFilters 
          categories={categories} 
          selectedCategory={selectedCategory} 
          setSelectedCategory={setSelectedCategory} 
        />
      </section>

      {/* Museum Stats Medallions */}
      <section>
        <MuseumStats museums={museums} filteredCount={filteredMuseums.length} />
      </section>

      {/* Museum Grid Section */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-['Cinzel'] text-2xl sm:text-3xl font-bold text-[#241a10] tracking-wide flex items-center gap-3">
            <span>{filteredMuseums.length} {filteredMuseums.length === 1 ? 'Museum' : 'Museums'} Available</span>
            <div className="w-12 h-[2px] bg-[#8f6826]" />
          </h2>
        </div>

        {museums.length === 0 ? (
          <div className="text-center py-20 bg-[#fdfbf7] rounded-3xl border-2 border-[#dfd2be] border-dashed shadow-sm">
             <Landmark className="w-12 h-12 text-[#8f6826]/50 mx-auto mb-3" />
             <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] mb-2">No museums found in archive.</h3>
             <p className="text-sm text-[#6e5842]">The database currently has no records.</p>
          </div>
        ) : filteredMuseums.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredMuseums.map((museum, index) => (
              <MuseumCard key={museum.id} museum={museum} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#fdfbf7] rounded-3xl border-2 border-[#dfd2be] border-dashed shadow-sm">
            <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] mb-2">No museums match your filter</h3>
            <p className="text-sm text-[#6e5842] mb-6">Try searching for a different keyword or choosing "All" categories.</p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-[#fff8ea] bg-[#8f6826] hover:bg-[#a87d32] transition-colors shadow-md"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

    </div>
  );
};

export default Museums;
