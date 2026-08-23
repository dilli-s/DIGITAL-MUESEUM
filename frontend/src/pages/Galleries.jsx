import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getGalleries } from '../services/api';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import GalleryCard from '../components/gallery/GalleryCard';
import GallerySearch from '../components/gallery/GallerySearch';
import GalleryFilters from '../components/gallery/GalleryFilters';
import { ChevronRight, LayoutDashboard, RefreshCw } from 'lucide-react';

const Galleries = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [museumGalleries, setMuseumGalleries] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [museumRes, galleriesRes] = await Promise.all([
        getMuseum(museumId),
        getGalleries({ museum_id: museumId, per_page: 50 })
      ]);
      setMuseum(museumRes);
      setMuseumGalleries(galleriesRes.data || []);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setMuseum(null);
      } else {
        setError("Unable to load galleries.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId]);

  // Derive categories from museum galleries (themes or periods)
  const categories = useMemo(() => {
    const cats = new Set(museumGalleries.map(g => g.period || g.theme).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [museumGalleries]);

  // Filter logic
  const filteredGalleries = useMemo(() => {
    return museumGalleries.filter(gallery => {
      const matchCategory = selectedCategory === 'All' || gallery.period === selectedCategory || gallery.theme === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (gallery.name && gallery.name.toLowerCase().includes(term)) ||
        (gallery.description && gallery.description.toLowerCase().includes(term)) ||
        (gallery.period && gallery.period.toLowerCase().includes(term)) ||
        (gallery.theme && gallery.theme.toLowerCase().includes(term));
        
      return matchCategory && matchSearch;
    });
  }, [museumGalleries, searchTerm, selectedCategory]);

  const totalObjects = museumGalleries.reduce((acc, curr) => acc + (curr.objectCount || 0), 0);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading galleries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <LayoutDashboard className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <p className="text-neutral-500 mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchData}
          className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  if (!museum) {
    return <MuseumNotFound />;
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center">
            <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <Link to="/museums" className="hover:text-neutral-900 transition-colors">Museums</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <Link to={`/museums/${museumId}`} className="hover:text-neutral-900 transition-colors">{museum.name}</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <span className="text-neutral-900 font-medium">Galleries</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Museum Header */}
      <div className="mb-10 pb-6 border-b border-neutral-200">
        <h2 className="text-xl font-medium text-neutral-500 mb-1">{museum.name}</h2>
        <div className="flex items-center text-sm text-neutral-400">
          <span>{museum.location}</span>
          <span className="mx-2">•</span>
          <span>{museum.category}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">Explore Galleries</h1>
          <p className="text-lg text-neutral-600">Explore the museum's galleries and discover the collections within them.</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 text-center flex-shrink-0 md:w-48">
          <div className="text-2xl font-bold text-neutral-900">{museumGalleries.length} Galleries</div>
          <div className="text-sm text-neutral-500">{totalObjects.toLocaleString()} Objects</div>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="mb-10 space-y-6">
        <GallerySearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <GalleryFilters 
          categories={categories} 
          selectedCategory={selectedCategory} 
          setSelectedCategory={setSelectedCategory} 
        />
      </section>

      {/* Gallery Grid */}
      <section className="mb-16">
        {museumGalleries.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No galleries available</h3>
            <p className="text-neutral-500 mb-6">This museum does not have any gallery information available yet.</p>
          </div>
        ) : filteredGalleries.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGalleries.map(gallery => (
              <GalleryCard key={gallery.id} gallery={gallery} museumId={museumId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No galleries match your filters</h3>
            <p className="text-neutral-500 mb-6">Try changing your search or category filter.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-neutral-200">
        <Link 
          to={`/museums/${museumId}`}
          className="text-sm font-semibold text-neutral-900 hover:underline inline-flex items-center"
        >
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Back to Museum Overview
        </Link>
      </div>
    </div>
  );
};

export default Galleries;
