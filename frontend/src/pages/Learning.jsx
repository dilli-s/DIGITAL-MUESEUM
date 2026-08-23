import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getLearning } from '../services/api';
import { stories } from '../data/stories';
import { activities } from '../data/activities';
import LearningCard from '../components/learning/LearningCard';
import { Search, RefreshCw } from 'lucide-react';

const Learning = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Difficulties');

  const [learningItems, setLearningItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLearning = () => {
    setIsLoading(true);
    setError(null);
    getLearning()
      .then(res => setLearningItems(res.data || []))
      .catch(err => {
        console.error(err);
        setError("Unable to load learning content.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchLearning();
  }, []);

  // Combine all items
  const allItems = useMemo(() => [
    ...learningItems.map(l => ({ ...l, itemType: 'learning' })),
    ...stories.map(s => ({ ...s, itemType: 'story' })),
    ...activities.map(a => ({ ...a, itemType: 'activity' }))
  ], [learningItems]);

  const types = ['All', 'Articles', 'Stories', 'Activities'];
  
  // Extract difficulties safely
  const difficulties = useMemo(() => {
    const diffs = new Set(allItems.map(i => i.difficulty).filter(Boolean));
    return ['All Difficulties', ...Array.from(diffs)];
  }, [allItems]);

  // Filter logic
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Filter by type
      let typeMatch = true;
      if (selectedType === 'Articles') typeMatch = item.itemType === 'learning';
      if (selectedType === 'Stories') typeMatch = item.itemType === 'story';
      if (selectedType === 'Activities') typeMatch = item.itemType === 'activity';
      
      // Filter by difficulty
      const diffMatch = selectedDifficulty === 'All Difficulties' || item.difficulty === selectedDifficulty;
      
      // Search logic
      const term = searchTerm.toLowerCase().trim();
      const searchMatch = term === '' || 
        item.title?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.summary?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term);

      return typeMatch && diffMatch && searchMatch;
    });
  }, [allItems, searchTerm, selectedType, selectedDifficulty]);

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
              <span className="mx-2 text-neutral-400">/</span>
              <span className="text-neutral-900 font-medium">Learning Library</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">Learn & Explore</h1>
          <p className="text-lg text-neutral-600">Discover stories, activities and learning resources inspired by museum objects.</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 flex flex-wrap gap-4 md:gap-8 flex-shrink-0 text-center">
          <div>
            <div className="text-2xl font-bold text-neutral-900">{learningItems.length}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider">Articles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">{stories.length}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider">Stories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">{activities.length}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider">Activities</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="mb-10 space-y-6">
        <div className="relative w-full max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg bg-white sm:text-sm focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
            placeholder="Search learning resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="space-y-4">
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  selectedType === type ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {difficulties.length > 1 && (
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
              {difficulties.map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    selectedDifficulty === diff ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="mb-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-neutral-900 mb-2" />
            <span className="sr-only">Loading learning...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">{error}</h3>
            <button
              onClick={fetchLearning}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-neutral-900 hover:bg-neutral-800"
            >
              TRY AGAIN
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No learning content found.</h3>
            <p className="text-neutral-500 mb-6">Try changing your search or filters.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedType('All'); setSelectedDifficulty('All Difficulties'); }}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-neutral-900 hover:bg-neutral-800"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map(item => (
              <LearningCard key={`${item.itemType}-${item.id}`} item={item} type={item.itemType} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Learning;
