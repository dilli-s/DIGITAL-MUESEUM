import React, { useState, useEffect, useMemo } from 'react';
import { getMuseums } from '../services/api';
import MuseumCard from '../components/museum/MuseumCard';
import MuseumSearch from '../components/museum/MuseumSearch';
import MuseumFilters from '../components/museum/MuseumFilters';
import MuseumStats from '../components/museum/MuseumStats';
import { Building2, RefreshCw } from 'lucide-react';

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
      // For now, load all museums to do local filtering as requested by existing UI,
      // or we could use the API search/filters, but we'll stick to local filtering to avoid changing UI behavior 
      // unless specified. The API supports pagination, so let's get a large page or just 50.
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
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading museums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <Building2 className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <p className="text-neutral-500 mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchMuseums}
          className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page Hero */}
      <section className="bg-neutral-900 text-white rounded-2xl p-8 sm:p-12 mb-8 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">Explore Museums</h1>
          <p className="text-lg text-neutral-400">Discover museums, collections and exhibitions from one digital platform.</p>
        </div>
        <div className="relative z-10 hidden sm:flex items-center justify-center p-6 bg-neutral-800 rounded-full border border-neutral-700">
          <Building2 className="w-16 h-16 text-neutral-400" />
        </div>
      </section>

      {/* Discovery Controls */}
      <section className="mb-8 space-y-6">
        <MuseumSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <MuseumFilters 
          categories={categories} 
          selectedCategory={selectedCategory} 
          setSelectedCategory={setSelectedCategory} 
        />
      </section>

      {/* Museum Stats */}
      <section className="mb-12">
        <MuseumStats museums={museums} filteredCount={filteredMuseums.length} />
      </section>

      {/* Museum Grid */}
      <section className="mb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900">
            {filteredMuseums.length} {filteredMuseums.length === 1 ? 'Museum' : 'Museums'} Found
          </h2>
        </div>

        {museums.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
             <h3 className="text-lg font-medium text-neutral-900 mb-2">No museums found.</h3>
             <p className="text-neutral-500 mb-6">The database currently has no records.</p>
          </div>
        ) : filteredMuseums.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredMuseums.map(museum => (
              <MuseumCard key={museum.id} museum={museum} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No museums match your filters</h3>
            <p className="text-neutral-500 mb-6">Try changing your search or category filter.</p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none"
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
