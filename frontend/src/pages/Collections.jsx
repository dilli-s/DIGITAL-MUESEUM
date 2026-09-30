import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getCollections } from '../services/api';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import CollectionCard from '../components/collection/CollectionCard';
import CollectionSearch from '../components/collection/CollectionSearch';
import CollectionFilters from '../components/collection/CollectionFilters';
import { ChevronRight, RefreshCw, Layers, Landmark } from 'lucide-react';

const Collections = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [museumCollections, setMuseumCollections] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, c] = await Promise.all([
        getMuseum(museumId),
        getCollections({ museum_id: museumId, per_page: 50 })
      ]);
      setMuseum(m);
      setMuseumCollections(c.data || []);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setMuseum(null);
      } else {
        setError("Unable to load collections.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId]);

  // Derive categories from museum collections
  const categories = useMemo(() => {
    const cats = new Set(museumCollections.map(c => c.category).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [museumCollections]);

  // Filter logic
  const filteredCollections = useMemo(() => {
    return museumCollections.filter(collection => {
      const matchCategory = selectedCategory === 'All' || collection.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (collection.name && collection.name.toLowerCase().includes(term)) ||
        (collection.description && collection.description.toLowerCase().includes(term)) ||
        (collection.category && collection.category.toLowerCase().includes(term));
        
      return matchCategory && matchSearch;
    });
  }, [museumCollections, searchTerm, selectedCategory]);

  const featuredCollections = useMemo(() => {
    return museumCollections.filter(c => c.featured);
  }, [museumCollections]);

  const totalObjects = useMemo(() => {
    return museumCollections.reduce((acc, curr) => acc + (curr.objectCount || curr.object_count || 0), 0);
  }, [museumCollections]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-[#c89b3c] animate-spin mb-4" />
        <p className="text-lg text-[#d4c6b2] font-medium font-['Cinzel']">Accessing Museum Collections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <Layers className="w-16 h-16 text-[#e57373] mb-6" />
        <h2 className="font-['Cinzel'] text-2xl font-bold text-[#fcf8f0] mb-2">{error}</h2>
        <p className="text-[#d4c6b2] mb-8 max-w-md text-center">There was a problem loading collections.</p>
        <button 
          onClick={fetchData}
          className="px-8 py-3 bg-[#c89b3c] text-[#0e0c0a] font-bold rounded-full hover:bg-[#dfb758] transition-colors uppercase tracking-wider text-xs"
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
    <div className="w-full flex flex-col gap-6 pb-16">
      {/* Breadcrumb */}
      <nav className="flex text-xs sm:text-sm text-[#a89984]" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center">
            <Link to="/" className="hover:text-[#e5c158] transition-colors">Home</Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#6b5c4c]" />
              <Link to="/museums" className="hover:text-[#e5c158] transition-colors">Museums</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#6b5c4c]" />
              <Link to={`/museums/${museumId}`} className="hover:text-[#e5c158] transition-colors truncate max-w-[150px] sm:max-w-none">{museum.name}</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#6b5c4c]" />
              <span className="text-[#e5c158] font-semibold">Collections</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Museum Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#18130e] border border-[#382d1f] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c89b3c]/15 border border-[#c89b3c]/30 text-[#e5c158] text-[10px] font-semibold tracking-widest uppercase mb-2">
            <Landmark className="w-3 h-3" />
            {museum.category || 'MUSEUM ARCHIVE'}
          </div>
          <h1 className="font-['Cinzel'] text-2xl sm:text-4xl font-bold tracking-tight text-[#fcf8f0] mb-2">
            Explore Collections
          </h1>
          <p className="text-xs sm:text-base text-[#d4c6b2] max-w-xl font-light">
            Browse curated collections and discover objects connected by history, culture, and themes.
          </p>
        </div>

        <div className="bg-[#1f1913] rounded-xl p-4 border border-[#382d1f] text-center flex-shrink-0 md:w-56 flex justify-around shadow-inner">
          <div className="px-3">
             <div className="font-['Cinzel'] text-2xl font-bold text-[#e5c158]">{museumCollections.length}</div>
             <div className="text-[10px] font-bold text-[#d4c6b2] uppercase tracking-wider mt-0.5">Collections</div>
          </div>
          <div className="w-px bg-[#382d1f]" />
          <div className="px-3">
             <div className="font-['Cinzel'] text-2xl font-bold text-[#e5c158]">{totalObjects.toLocaleString()}</div>
             <div className="text-[10px] font-bold text-[#d4c6b2] uppercase tracking-wider mt-0.5">Objects</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="space-y-4">
        <CollectionSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <CollectionFilters 
          categories={categories} 
          selectedCategory={selectedCategory} 
          setSelectedCategory={setSelectedCategory} 
        />
      </section>

      {/* Featured Collections */}
      {featuredCollections.length > 0 && searchTerm === '' && selectedCategory === 'All' && (
        <section>
          <h2 className="font-['Cinzel'] text-xl sm:text-2xl font-bold text-[#fcf8f0] mb-6 flex items-center gap-2">
            <span>Featured Collections</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCollections.map(collection => (
              <CollectionCard key={collection.id} collection={collection} museumId={museumId} />
            ))}
          </div>
        </section>
      )}

      {/* Collection Grid */}
      <section>
        <h2 className="font-['Cinzel'] text-xl sm:text-2xl font-bold text-[#fcf8f0] mb-6">
          {searchTerm === '' && selectedCategory === 'All' ? 'All Collections' : 'Search Results'}
        </h2>
        {museumCollections.length === 0 ? (
          <div className="text-center py-20 bg-[#17130e] rounded-2xl border border-[#382d1f] border-dashed">
            <h3 className="font-['Cinzel'] text-lg font-bold text-[#fcf8f0] mb-2">No collections available</h3>
            <p className="text-sm text-[#d4c6b2]">This museum does not have any collections uploaded yet.</p>
          </div>
        ) : filteredCollections.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map(collection => (
              <CollectionCard key={collection.id} collection={collection} museumId={museumId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#17130e] rounded-2xl border border-[#382d1f] border-dashed">
            <h3 className="font-['Cinzel'] text-lg font-bold text-[#fcf8f0] mb-2">No collections found</h3>
            <p className="text-sm text-[#d4c6b2] mb-6">Try changing your search keywords or filter category.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-[#0e0c0a] bg-[#c89b3c] hover:bg-[#dfb758] transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {/* Navigation */}
      <div className="mt-8 pt-6 border-t border-[#2d2419]">
        <Link 
          to={`/museums/${museumId}`}
          className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-[#c89b3c] hover:text-[#dfb758] inline-flex items-center gap-1 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Museum Overview
        </Link>
      </div>
    </div>
  );
};

export default Collections;
