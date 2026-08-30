import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Building2, Package, Map, Image as ImageIcon, Loader2, ChevronRight } from 'lucide-react';
import { getMuseums, getObjects, getGalleries, getExhibitions } from '../services/api';

const TABS = [
  { id: 'all', label: 'All Results', icon: SearchIcon },
  { id: 'museums', label: 'Museums', icon: Building2 },
  { id: 'objects', label: 'Objects', icon: Package },
  { id: 'galleries', label: 'Galleries', icon: Map },
  { id: 'exhibitions', label: 'Exhibitions', icon: ImageIcon },
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const activeTab = searchParams.get('tab') || 'all';

  const [inputValue, setInputValue] = useState(query);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ museums: [], objects: [], galleries: [], exhibitions: [] });
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced Search Effect
  useEffect(() => {
    if (!query) {
      setResults({ museums: [], objects: [], galleries: [], exhibitions: [] });
      setHasSearched(false);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const fetchers = [];
        const newResults = { museums: [], objects: [], galleries: [], exhibitions: [] };

        if (activeTab === 'all' || activeTab === 'museums') {
          fetchers.push(getMuseums({ search: query, per_page: 6 }).then(res => newResults.museums = res.data || []));
        }
        if (activeTab === 'all' || activeTab === 'objects') {
          fetchers.push(getObjects({ search: query, per_page: 6 }).then(res => newResults.objects = res.data || []));
        }
        if (activeTab === 'all' || activeTab === 'galleries') {
          fetchers.push(getGalleries({ search: query, per_page: 6 }).then(res => newResults.galleries = res.data || []));
        }
        if (activeTab === 'all' || activeTab === 'exhibitions') {
          fetchers.push(getExhibitions({ search: query, per_page: 6 }).then(res => newResults.exhibitions = res.data || []));
        }

        await Promise.allSettled(fetchers);
        setResults(newResults);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const delay = setTimeout(performSearch, 500);
    return () => clearTimeout(delay);
  }, [query, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim(), tab: activeTab });
    } else {
      setSearchParams({ tab: activeTab });
    }
  };

  const handleTabChange = (tabId) => {
    if (query) {
      setSearchParams({ q: query, tab: tabId });
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const ResultCard = ({ item, type, icon: Icon, to }) => (
    <Link to={to} className="group flex gap-4 p-4 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-900 hover:shadow-md transition-all">
      <div className="w-20 h-20 bg-neutral-100 rounded-xl overflow-hidden flex-shrink-0 relative">
        {item.image || item.image_url ? (
          <img src={item.image || item.image_url} alt={item.name || item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-100">
            <Icon className="w-8 h-8 text-neutral-300" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">{type}</span>
        </div>
        <h3 className="font-bold text-neutral-900 text-lg truncate">{item.name || item.title}</h3>
        {item.description && (
          <p className="text-sm text-neutral-500 line-clamp-1 mt-1">{item.description}</p>
        )}
      </div>
      <div className="flex items-center justify-center pr-2">
        <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
      </div>
    </Link>
  );

  const Section = ({ title, items, type, icon, baseUrl }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-10">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
          {activeTab === 'all' && items.length === 6 && (
            <button onClick={() => handleTabChange(type.toLowerCase())} className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
              See All <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map(item => (
            <ResultCard key={item.id} item={item} type={type} icon={icon} to={`${baseUrl}/${item.id}`} />
          ))}
        </div>
      </div>
    );
  };

  const totalResults = results.museums.length + results.objects.length + results.galleries.length + results.exhibitions.length;

  return (
    <div className="w-full max-w-5xl mx-auto min-h-[70vh]">
      
      {/* Search Header */}
      <div className="text-center mb-10 pt-8">
        <h1 className="text-4xl font-bold text-neutral-900 mb-6">Discover the Collection</h1>
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <SearchIcon className="w-6 h-6 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-4 py-5 bg-white border-2 border-neutral-200 rounded-2xl text-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-0 transition-all shadow-sm"
            placeholder="Search for museums, artifacts, galleries..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            className="absolute inset-y-2 right-2 px-6 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 border-b border-neutral-200 pb-px">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive 
                  ? 'border-neutral-900 text-neutral-900' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Results Area */}
      <div>
        {isSearching ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-neutral-300" />
            <p>Searching the archives...</p>
          </div>
        ) : !hasSearched ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400 text-center">
            <SearchIcon className="w-16 h-16 mb-4 text-neutral-200" />
            <h3 className="text-xl font-bold text-neutral-300 mb-2">Begin your exploration</h3>
            <p className="max-w-md">Enter a keyword above to search across our entire global museum network, artifacts, and galleries.</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400 text-center">
            <SearchIcon className="w-16 h-16 mb-4 text-neutral-200" />
            <h3 className="text-xl font-bold text-neutral-900 mb-2">No results found</h3>
            <p className="max-w-md">We couldn't find anything matching "{query}". Try adjusting your keywords or checking your spelling.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="Museums" items={results.museums} type="Museum" icon={Building2} baseUrl="/museums" />
            <Section title="Artifacts & Objects" items={results.objects} type="Object" icon={Package} baseUrl="/objects" />
            <Section title="Galleries" items={results.galleries} type="Gallery" icon={Map} baseUrl="/galleries" />
            <Section title="Exhibitions" items={results.exhibitions} type="Exhibition" icon={ImageIcon} baseUrl="/exhibitions" />
          </div>
        )}
      </div>

    </div>
  );
};

export default Search;
