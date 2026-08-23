import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getCollection, getObjects } from '../services/api';
import ObjectCard from '../components/object/ObjectCard';
import { ChevronRight, ArrowLeft, Layers, Search, RefreshCw, LayoutDashboard } from 'lucide-react';

const CollectionDetails = () => {
  const { museumId, collectionId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [collection, setCollection] = useState(null);
  const [collectionObjects, setCollectionObjects] = useState([]);
  
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
      const [m, c, objs] = await Promise.all([
        getMuseum(museumId),
        getCollection(collectionId),
        getObjects({ collection_id: collectionId, per_page: 50 })
      ]);
      
      if (String(c.museumId) !== String(museumId)) {
        setNotFound(true);
      } else {
        setMuseum(m);
        setCollection(c);
        setCollectionObjects(objs.data || []);
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setNotFound(true);
      } else {
        setError("Unable to load collection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId, collectionId]);

  // Derive categories from collection objects
  const categories = useMemo(() => {
    const cats = new Set(collectionObjects.map(o => o.category).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [collectionObjects]);

  // Object filter logic
  const filteredObjects = useMemo(() => {
    return collectionObjects.filter(object => {
      const matchCategory = selectedCategory === 'All' || object.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = term === '' || 
        (object.name && object.name.toLowerCase().includes(term)) ||
        (object.description && object.description.toLowerCase().includes(term)) ||
        (object.period && object.period.toLowerCase().includes(term)) ||
        (object.origin && object.origin.toLowerCase().includes(term));
        
      return matchCategory && matchSearch;
    });
  }, [collectionObjects, searchTerm, selectedCategory]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading collection...</p>
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

  if (notFound || !museum || !collection) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Collection Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">
          This collection could not be found in this museum.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to={`/museum/${museumId}/collections`} 
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Back to Collections
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
              <Link to={`/museum/${museumId}/collections`} className="hover:text-neutral-900 transition-colors">Collections</Link>
              <ChevronRight className="w-4 h-4 mx-1" />
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <span className="text-neutral-900 font-medium truncate max-w-[120px] sm:max-w-xs">{collection.name}</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Collection Hero */}
      <section className="bg-neutral-900 text-white rounded-2xl p-8 sm:p-12 mb-12 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 min-h-[350px]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black pointer-events-none"></div>
        <div className="relative z-10 md:w-2/3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
            {collection.category} {collection.period && collection.period !== 'Unknown' && `• ${collection.period}`}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">{collection.name}</h1>
          <p className="text-lg text-neutral-300 mb-6">{museum.name}</p>
          <p className="text-lg text-neutral-400 max-w-2xl mb-8">
            {collection.description}
          </p>
        </div>
        <div className="hidden md:flex relative z-10 w-1/3 justify-center items-center">
           <Layers className="w-32 h-32 text-neutral-700 opacity-50" />
        </div>
      </section>

      {/* Collection Info & Description */}
      <div className="grid md:grid-cols-3 gap-12 mb-16">
        <div className="md:col-span-2">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">About This Collection</h2>
          <p className="text-neutral-600 leading-relaxed text-lg">
            {collection.longDescription || collection.description}
          </p>
        </div>
        <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 self-start">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Collection Information</h3>
          <dl className="space-y-4 text-sm">
            {collection.category && collection.category !== 'Uncategorized' && (
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Category</dt>
                <dd className="font-medium text-neutral-900">{collection.category}</dd>
              </div>
            )}
            {collection.period && collection.period !== 'Unknown' && (
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Period</dt>
                <dd className="font-medium text-neutral-900">{collection.period}</dd>
              </div>
            )}
            {collection.location && collection.location !== 'Unknown' && (
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Location</dt>
                <dd className="font-medium text-neutral-900">{collection.location}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-neutral-200 pb-2 border-b-transparent">
              <dt className="text-neutral-500">Objects in Collection</dt>
              <dd className="font-medium text-neutral-900">{collectionObjects.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Object Browsing Section */}
      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold text-neutral-900">Browse Collection Objects</h2>
        </div>
        
        {/* Object Search and Filters */}
        <div className="space-y-6 mb-8">
          <div className="relative w-full max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm transition-colors shadow-sm"
              placeholder="Search objects in this collection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search objects"
            />
          </div>
          
          {categories.length > 1 && (
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    selectedCategory === category
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Object Grid */}
        {collectionObjects.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No objects in this collection yet.</h3>
            <p className="text-neutral-500">Objects for this collection will be added later.</p>
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
          to={`/museum/${museumId}/collections`}
          className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Collections
        </Link>
      </section>
    </div>
  );
};

export default CollectionDetails;
