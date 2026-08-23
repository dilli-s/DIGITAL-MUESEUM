import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getExhibition, getExhibitionObjects } from '../services/api';
import ObjectCard from '../components/object/ObjectCard';
import ExhibitionSearch from '../components/exhibition/ExhibitionSearch';
import ExhibitionFilters from '../components/exhibition/ExhibitionFilters';
import { ChevronRight, ArrowLeft, Calendar, Info, RefreshCw, LayoutDashboard } from 'lucide-react';

const ExhibitionDetails = () => {
  const { museumId, exhibitionId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [exhibition, setExhibition] = useState(null);
  const [exhibitionObjects, setExhibitionObjects] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    
    try {
      const [m, e, objs] = await Promise.all([
        getMuseum(museumId),
        getExhibition(exhibitionId),
        getExhibitionObjects(exhibitionId)
      ]);
      
      if (String(e.museumId) !== String(museumId)) {
        setNotFound(true);
      } else {
        setMuseum(m);
        setExhibition(e);
        // Only keep objects that belong to the museum
        setExhibitionObjects(objs.filter(o => String(o.museumId) === String(museumId)));
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setNotFound(true);
      } else {
        setError("Unable to load exhibition.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId, exhibitionId]);

  // Derive object categories
  const objectCategories = useMemo(() => {
    const cats = new Set(exhibitionObjects.map(o => o.category).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [exhibitionObjects]);

  // Object filter logic
  const filteredObjects = useMemo(() => {
    return exhibitionObjects.filter(object => {
      const matchCategory = selectedCategory === 'All' || object.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (object.name && object.name.toLowerCase().includes(term)) ||
        (object.localName && object.localName.toLowerCase().includes(term)) ||
        (object.scientificName && object.scientificName.toLowerCase().includes(term)) ||
        (object.description && object.description.toLowerCase().includes(term)) ||
        (object.period && object.period.toLowerCase().includes(term)) ||
        (object.origin && object.origin.toLowerCase().includes(term));
        
      return matchCategory && matchSearch;
    });
  }, [exhibitionObjects, searchTerm, selectedCategory]);

  const featuredObjects = filteredObjects.filter(o => o.featured);

  const scrollToObjectGrid = () => {
    const elem = document.getElementById('exhibition-objects');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading exhibition...</p>
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

  if (notFound || !museum || !exhibition) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Exhibition Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">
          This exhibition could not be found in this museum.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to={`/museum/${museumId}/exhibitions`} 
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Back to Exhibitions
          </Link>
          <Link 
            to={`/museums/${museumId}`}
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Back to Museum
          </Link>
        </div>
      </div>
    );
  }

  // Calculate status
  let status = "Permanent";
  let statusColor = "bg-neutral-600";
  
  if (exhibition.startDate && exhibition.endDate) {
    const now = new Date();
    const start = new Date(exhibition.startDate);
    const end = new Date(exhibition.endDate);
    if (now < start) { status = "Upcoming"; statusColor = "bg-blue-600"; }
    else if (now > end) { status = "Past"; statusColor = "bg-neutral-400"; }
    else { status = "Current"; statusColor = "bg-green-600"; }
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center hidden sm:block">
            <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4 mx-1 inline" />
          </li>
          <li className="inline-flex items-center">
            <Link to={`/museums/${museumId}`} className="hover:text-neutral-900 transition-colors truncate max-w-[80px] sm:max-w-xs">{museum.name}</Link>
            <ChevronRight className="w-4 h-4 mx-1" />
          </li>
          <li>
            <div className="flex items-center">
              <Link to={`/museum/${museumId}/exhibitions`} className="hover:text-neutral-900 transition-colors">Exhibitions</Link>
              <ChevronRight className="w-4 h-4 mx-1" />
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <span className="text-neutral-900 font-medium truncate max-w-[120px] sm:max-w-xs">{exhibition.title}</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Exhibition Hero */}
      <section className="bg-neutral-900 text-white rounded-2xl p-8 sm:p-12 mb-12 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 min-h-[400px]">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-t from-black to-neutral-900 pointer-events-none"></div>
        <div className="relative z-10 w-full md:w-2/3">
          <div className="flex items-center gap-4 mb-4">
            <span className={`text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusColor}`}>
              {status}
            </span>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              {exhibition.category} {exhibition.period && `• ${exhibition.period}`}
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-2 leading-tight">{exhibition.title}</h1>
          
          {exhibition.subtitle && (
            <h2 className="text-xl md:text-2xl font-medium text-neutral-300 mb-6 italic">{exhibition.subtitle}</h2>
          )}
          
          <p className="text-lg text-neutral-400 max-w-2xl mb-8">
            {museum.name}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button 
              onClick={scrollToObjectGrid}
              className="inline-flex justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors shadow-sm"
            >
              EXPLORE OBJECTS
            </button>
            <Link 
              to={`/museum/${museumId}/exhibitions`}
              className="inline-flex justify-center rounded-md border border-neutral-600 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
            >
              BACK TO EXHIBITIONS
            </Link>
          </div>
        </div>
        <div className="hidden md:flex relative z-10 w-1/3 justify-center items-center">
           <Calendar className="w-40 h-40 text-neutral-700 opacity-50" />
        </div>
      </section>

      {/* Exhibition Timeline & Info */}
      <div className="grid lg:grid-cols-3 gap-12 mb-16">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">About This Exhibition</h2>
          <p className="text-neutral-600 leading-relaxed text-lg mb-8">
            {exhibition.longDescription || exhibition.description}
          </p>

          {/* Timeline */}
          <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-neutral-500" />
              Exhibition Timeline
            </h3>
            {exhibition.startDate && exhibition.endDate ? (
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative">
                <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-neutral-200 -z-0 -translate-y-1/2"></div>
                
                <div className="relative z-10 bg-neutral-50 pr-4 py-2 md:py-0 text-center md:text-left w-full md:w-auto">
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Opening Date</div>
                  <div className="font-semibold text-neutral-900">{new Date(exhibition.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                
                <div className="relative z-10 bg-neutral-50 px-4 py-4 md:py-0 text-center w-full md:w-auto">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase text-white ${statusColor}`}>
                    {status}
                  </div>
                </div>

                <div className="relative z-10 bg-neutral-50 pl-4 py-2 md:py-0 text-center md:text-right w-full md:w-auto">
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Closing Date</div>
                  <div className="font-semibold text-neutral-900">{new Date(exhibition.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 font-medium text-neutral-600">
                Permanent Exhibition
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 self-start">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-neutral-500" /> Information
            </h3>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Museum</dt>
                <dd className="font-medium text-neutral-900 text-right">{museum.name}</dd>
              </div>
              {exhibition.category && (
                <div className="flex justify-between border-b border-neutral-200 pb-2">
                  <dt className="text-neutral-500">Category</dt>
                  <dd className="font-medium text-neutral-900">{exhibition.category}</dd>
                </div>
              )}
              {exhibition.theme && (
                <div className="flex justify-between border-b border-neutral-200 pb-2">
                  <dt className="text-neutral-500">Theme</dt>
                  <dd className="font-medium text-neutral-900">{exhibition.theme}</dd>
                </div>
              )}
              {exhibition.period && (
                <div className="flex justify-between border-b border-neutral-200 pb-2">
                  <dt className="text-neutral-500">Period</dt>
                  <dd className="font-medium text-neutral-900">{exhibition.period}</dd>
                </div>
              )}
              {exhibition.location && (
                <div className="flex justify-between border-b border-neutral-200 pb-2">
                  <dt className="text-neutral-500">Location</dt>
                  <dd className="font-medium text-neutral-900 text-right">{exhibition.location}</dd>
                </div>
              )}
              <div className="flex justify-between border-b border-neutral-200 pb-2 border-b-transparent">
                <dt className="text-neutral-500">Object Count</dt>
                <dd className="font-medium text-neutral-900">{exhibitionObjects.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Featured Objects (Optional) */}
      {featuredObjects.length > 0 && searchTerm === '' && selectedCategory === 'All' && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center">
            Featured Objects
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredObjects.map(object => (
              <ObjectCard key={object.id} objectData={object} />
            ))}
          </div>
        </section>
      )}

      {/* Object Browsing Section */}
      <section id="exhibition-objects" className="mb-16 scroll-mt-8">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">
          {searchTerm === '' && selectedCategory === 'All' ? 'All Exhibition Objects' : 'Search Results'}
        </h2>
        
        {/* Object Search and Filters */}
        <div className="space-y-6 mb-8">
          <ExhibitionSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search objects in this exhibition..." />
          
          <ExhibitionFilters 
            filters={objectCategories} 
            selectedFilter={selectedCategory} 
            setSelectedFilter={setSelectedCategory} 
          />
        </div>

        {/* Object Grid */}
        {exhibitionObjects.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No objects are currently associated with this exhibition.</h3>
          </div>
        ) : filteredObjects.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredObjects.map(object => (
              <ObjectCard key={object.id} objectData={object} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No objects found</h3>
            <p className="text-neutral-500 mb-6">Try changing your search or filters.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {/* Footer Navigation */}
      <section className="py-8 border-t border-neutral-200 flex items-center justify-between">
        <Link 
          to={`/museum/${museumId}/exhibitions`}
          className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Exhibitions
        </Link>
      </section>
    </div>
  );
};

export default ExhibitionDetails;
