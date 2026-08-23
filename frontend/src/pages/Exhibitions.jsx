import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getExhibitions } from '../services/api';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import ExhibitionCard from '../components/exhibition/ExhibitionCard';
import ExhibitionSearch from '../components/exhibition/ExhibitionSearch';
import ExhibitionFilters from '../components/exhibition/ExhibitionFilters';
import { ChevronRight, RefreshCw, LayoutDashboard } from 'lucide-react';

const Exhibitions = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [museumExhibitions, setMuseumExhibitions] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, e] = await Promise.all([
        getMuseum(museumId),
        getExhibitions({ museum_id: museumId, per_page: 50 })
      ]);
      setMuseum(m);
      setMuseumExhibitions(e.data || []);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setMuseum(null);
      } else {
        setError("Unable to load exhibitions.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId]);

  // Determine exhibition status wrapper
  const getExhibitionStatus = (exhibition) => {
    if (!exhibition.startDate || !exhibition.endDate) return "Permanent";
    const now = new Date();
    const start = new Date(exhibition.startDate);
    const end = new Date(exhibition.endDate);
    if (now < start) return "Upcoming";
    if (now > end) return "Past";
    return "Current";
  };

  // Derive categories and statuses
  const categories = useMemo(() => {
    const cats = new Set(museumExhibitions.map(e => e.category).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [museumExhibitions]);

  const statuses = useMemo(() => {
    const sts = new Set(museumExhibitions.map(e => getExhibitionStatus(e)));
    return ['All Statuses', ...Array.from(sts)];
  }, [museumExhibitions]);

  // Filter logic
  const filteredExhibitions = useMemo(() => {
    return museumExhibitions.filter(exhibition => {
      const matchCategory = selectedCategory === 'All' || exhibition.category === selectedCategory;
      const matchStatus = selectedStatus === 'All Statuses' || getExhibitionStatus(exhibition) === selectedStatus;
      
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (exhibition.title && exhibition.title.toLowerCase().includes(term)) ||
        (exhibition.subtitle && exhibition.subtitle.toLowerCase().includes(term)) ||
        (exhibition.description && exhibition.description.toLowerCase().includes(term)) ||
        (exhibition.theme && exhibition.theme.toLowerCase().includes(term)) ||
        (exhibition.period && exhibition.period.toLowerCase().includes(term));
        
      return matchCategory && matchStatus && matchSearch;
    });
  }, [museumExhibitions, searchTerm, selectedCategory, selectedStatus]);

  const featuredExhibitions = filteredExhibitions.filter(e => e.featured);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading exhibitions...</p>
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
              <span className="text-neutral-900 font-medium">Exhibitions</span>
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
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">Explore Exhibitions</h1>
          <p className="text-lg text-neutral-600">Discover curated exhibitions bringing museum objects, stories and themes together.</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 text-center flex-shrink-0 md:w-64 flex justify-around">
          <div>
             <div className="text-2xl font-bold text-neutral-900">{museumExhibitions.length}</div>
             <div className="text-xs text-neutral-500 uppercase tracking-wider">Exhibitions</div>
          </div>
          <div>
             <div className="text-2xl font-bold text-neutral-900">{museumExhibitions.filter(e => getExhibitionStatus(e) === 'Current').length}</div>
             <div className="text-xs text-neutral-500 uppercase tracking-wider">Current</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="mb-10 space-y-6">
        <ExhibitionSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search exhibitions..." />
        
        <div className="space-y-4">
          <ExhibitionFilters 
            filters={categories} 
            selectedFilter={selectedCategory} 
            setSelectedFilter={setSelectedCategory} 
          />
          <ExhibitionFilters 
            filters={statuses} 
            selectedFilter={selectedStatus} 
            setSelectedFilter={setSelectedStatus} 
          />
        </div>
      </section>

      {/* Featured Exhibitions */}
      {featuredExhibitions.length > 0 && searchTerm === '' && selectedCategory === 'All' && selectedStatus === 'All Statuses' && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center">
            Featured Exhibitions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredExhibitions.map(exhibition => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} museumId={museumId} />
            ))}
          </div>
        </section>
      )}

      {/* Exhibition Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">
          {searchTerm === '' && selectedCategory === 'All' && selectedStatus === 'All Statuses' ? 'All Exhibitions' : 'Search Results'}
        </h2>
        {museumExhibitions.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No exhibitions available</h3>
            <p className="text-neutral-500 mb-6">This museum does not have any exhibitions available yet.</p>
          </div>
        ) : filteredExhibitions.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredExhibitions.map(exhibition => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} museumId={museumId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No exhibitions found</h3>
            <p className="text-neutral-500 mb-6">Try changing your search or filters.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedStatus('All Statuses'); }}
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

export default Exhibitions;
