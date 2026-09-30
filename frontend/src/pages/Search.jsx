import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Landmark, Package, Map, Image as ImageIcon, Loader2, ChevronRight, X, Sparkles } from 'lucide-react';
import { getMuseums, getObjects, getGalleries, getExhibitions } from '../services/api';
import { getMediaUrl } from '../utils/media';

const TABS = [
  { id: 'all', label: 'All Results', icon: SearchIcon },
  { id: 'museums', label: 'Museums', icon: Landmark },
  { id: 'objects', label: 'Objects', icon: Package },
  { id: 'galleries', label: 'Galleries', icon: Map },
  { id: 'exhibitions', label: 'Exhibitions', icon: ImageIcon },
];

const POPULAR_SEARCHES = [
  'Louvre',
  'British Museum',
  'Sculpture',
  'Ancient Egypt',
  'Renaissance',
  'Gold Artifact',
  'Gallery'
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const activeTab = searchParams.get('tab') || 'all';

  const [inputValue, setInputValue] = useState(queryParam);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ museums: [], objects: [], galleries: [], exhibitions: [] });
  const [hasSearched, setHasSearched] = useState(Boolean(queryParam.trim()));

  // Fallback museum photos for artifacts/museums without images
  const fallbackPhotos = [
    '/images/louvre_pyramid.jpg',
    '/images/british_museum.jpg',
    '/images/hero_museum_hall.jpg',
    '/images/card_statue_bust.jpg',
  ];

  const getFallbackImage = (index) => fallbackPhotos[index % fallbackPhotos.length];

  // Execute search function
  const executeSearch = useCallback(async (queryText, currentTab) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setResults({ museums: [], objects: [], galleries: [], exhibitions: [] });
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const fetchers = [];
      const newResults = { museums: [], objects: [], galleries: [], exhibitions: [] };

      if (currentTab === 'all' || currentTab === 'museums') {
        fetchers.push(
          getMuseums({ search: trimmed, per_page: 8 })
            .then(res => { newResults.museums = res.data || []; })
            .catch(() => {})
        );
      }
      if (currentTab === 'all' || currentTab === 'objects') {
        fetchers.push(
          getObjects({ search: trimmed, per_page: 8 })
            .then(res => { newResults.objects = res.data || []; })
            .catch(() => {})
        );
      }
      if (currentTab === 'all' || currentTab === 'galleries') {
        fetchers.push(
          getGalleries({ search: trimmed, per_page: 8 })
            .then(res => { newResults.galleries = res.data || []; })
            .catch(() => {})
        );
      }
      if (currentTab === 'all' || currentTab === 'exhibitions') {
        fetchers.push(
          getExhibitions({ search: trimmed, per_page: 8 })
            .then(res => { newResults.exhibitions = res.data || []; })
            .catch(() => {})
        );
      }

      await Promise.allSettled(fetchers);
      setResults(newResults);
    } catch (error) {
      console.error("Automatic live search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Automatic live search when user types (debounced at 300ms)
  useEffect(() => {
    const trimmed = inputValue.trim();

    const timer = setTimeout(() => {
      if (trimmed) {
        setSearchParams({ q: trimmed, tab: activeTab }, { replace: true });
        executeSearch(trimmed, activeTab);
      } else {
        setSearchParams({ tab: activeTab }, { replace: true });
        setResults({ museums: [], objects: [], galleries: [], exhibitions: [] });
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, activeTab, executeSearch, setSearchParams]);

  // Sync if URL query changes externally
  useEffect(() => {
    if (queryParam !== inputValue && queryParam !== '') {
      setInputValue(queryParam);
    }
  }, [queryParam]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim(), tab: activeTab });
      executeSearch(inputValue.trim(), activeTab);
    }
  };

  const handleTabChange = (tabId) => {
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim(), tab: tabId });
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const handleQuickTagClick = (tag) => {
    setInputValue(tag);
  };

  const handleClear = () => {
    setInputValue('');
    setSearchParams({ tab: activeTab });
    setResults({ museums: [], objects: [], galleries: [], exhibitions: [] });
    setHasSearched(false);
  };

  const ResultCard = ({ item, type, icon: Icon, to, index }) => (
    <Link 
      to={to} 
      className="group flex gap-4 p-4 bg-[#fdfbf7] border-2 border-[#dfd2be] rounded-2xl hover:border-[#8f6826] hover:shadow-lg transition-all duration-300"
    >
      <div className="w-20 h-20 bg-[#ede3d1] rounded-xl overflow-hidden flex-shrink-0 relative border border-[#dfd2be]">
        {item.image || item.image_url ? (
          <img 
            src={getMediaUrl(item.image || item.image_url)} 
            alt={item.name || item.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.src = getFallbackImage(index);
            }}
          />
        ) : (
          <img 
            src={getFallbackImage(index)} 
            alt={item.name || item.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      <div className="flex flex-col justify-center flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f6826] bg-[#8f6826]/10 px-2 py-0.5 rounded border border-[#8f6826]/20">
            {type}
          </span>
          {item.city && (
            <span className="text-[10px] text-[#735a3e] font-medium">
              • {item.city}
            </span>
          )}
        </div>
        <h3 className="font-['Cinzel'] font-bold text-[#241a10] group-hover:text-[#8f6826] text-base sm:text-lg truncate transition-colors">
          {item.name || item.title}
        </h3>
        {item.description && (
          <p className="text-xs sm:text-sm text-[#5f4d39] line-clamp-1 mt-0.5 font-light">
            {item.description}
          </p>
        )}
      </div>
      <div className="flex items-center justify-center pr-2">
        <ChevronRight className="w-5 h-5 text-[#8f6826] group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );

  const Section = ({ title, items, type, icon, baseUrl }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-10">
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-['Cinzel'] text-xl sm:text-2xl font-bold text-[#241a10] flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ede3d1] text-[#8f6826] border border-[#dfd2be]">
              {items.length}
            </span>
          </h2>
          {activeTab === 'all' && items.length >= 6 && (
            <button 
              onClick={() => handleTabChange(type.toLowerCase())} 
              className="text-xs sm:text-sm font-bold text-[#8f6826] hover:text-[#241a10] flex items-center gap-1 uppercase tracking-wider"
            >
              See All <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item, idx) => (
            <ResultCard key={item.id || idx} item={item} type={type} icon={icon} to={`${baseUrl}/${item.id}`} index={idx} />
          ))}
        </div>
      </div>
    );
  };

  const totalResults = results.museums.length + results.objects.length + results.galleries.length + results.exhibitions.length;

  return (
    <div className="w-full max-w-5xl mx-auto min-h-[70vh] pb-16">
      
      {/* Search Header */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#8f6826]/10 border border-[#8f6826]/20 text-[#8f6826] text-[10px] font-bold tracking-widest uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#8f6826]" />
          GLOBAL ARCHIVE & REPOSITORY SEARCH
        </div>
        
        <h1 className="font-['Cinzel'] text-3xl sm:text-5xl font-bold text-[#241a10] mb-6">
          Discover the Collection
        </h1>

        {/* Live Search Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-[#8f6826] animate-spin" />
            ) : (
              <SearchIcon className="w-5 h-5 text-[#8f6826]" />
            )}
          </div>
          
          <input
            type="text"
            className="block w-full pl-14 pr-28 py-4 sm:py-5 bg-[#fdfbf7] border-2 border-[#dfd2be] rounded-full text-base sm:text-lg text-[#241a10] placeholder-[#8a7660] focus:outline-none focus:border-[#8f6826] focus:ring-4 focus:ring-[#8f6826]/15 transition-all shadow-md"
            placeholder="Search for museums, artifacts, galleries..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />

          <div className="absolute inset-y-2 right-2 flex items-center gap-1.5">
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-[#735a3e] hover:text-[#241a10] hover:bg-[#ede3d1] rounded-full transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] text-xs sm:text-sm uppercase font-bold tracking-wider rounded-full hover:from-[#a87d32] hover:to-[#dfb758] transition-all shadow-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-2xl mx-auto">
          <span className="text-[11px] font-bold text-[#735a3e] uppercase tracking-wider">Quick Suggestions:</span>
          {POPULAR_SEARCHES.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleQuickTagClick(tag)}
              className="px-3 py-1 rounded-full text-xs bg-[#fdfbf7] border border-[#dfd2be] text-[#5a4836] hover:border-[#8f6826] hover:text-[#8f6826] hover:bg-[#ede3d1] transition-all"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 border-b-2 border-[#dfd2be] pb-px">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold tracking-wide uppercase whitespace-nowrap border-b-2 -mb-[2px] transition-all ${
                isActive 
                  ? 'border-[#8f6826] text-[#8f6826] font-bold' 
                  : 'border-transparent text-[#6e5842] hover:text-[#241a10] hover:border-[#dfd2be]'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-[#8f6826]' : 'text-[#8a7660]'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Results Area */}
      <div>
        {isSearching && !hasSearched ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6e5842]">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#8f6826]" />
            <p className="font-['Cinzel'] text-base text-[#241a10]">Searching the archives...</p>
          </div>
        ) : !hasSearched ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6e5842] text-center bg-[#fdfbf7] rounded-3xl border-2 border-[#dfd2be] p-8">
            <SearchIcon className="w-16 h-16 mb-4 text-[#8f6826]/40" />
            <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] mb-2">Begin Your Exploration</h3>
            <p className="max-w-md text-xs sm:text-sm text-[#5f4d39] font-light">
              Start typing above — results will automatically appear as you type (e.g. try searching "Louvre", "Statue", or "Egypt").
            </p>
          </div>
        ) : isSearching ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6e5842]">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#8f6826]" />
            <p className="font-['Cinzel'] text-base text-[#241a10]">Searching matches for "{inputValue}"...</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6e5842] text-center bg-[#fdfbf7] rounded-3xl border-2 border-[#dfd2be] p-8">
            <SearchIcon className="w-16 h-16 mb-4 text-[#8a7660]" />
            <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] mb-2">No Results Found</h3>
            <p className="max-w-md text-xs sm:text-sm text-[#5f4d39] font-light">
              We couldn't find anything matching "{inputValue}". Try adjusting your keywords or select one of the suggestion tags above.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <Section title="Museums" items={results.museums} type="Museum" icon={Landmark} baseUrl="/museums" />
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
