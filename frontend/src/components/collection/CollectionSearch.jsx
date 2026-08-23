import React from 'react';
import { Search } from 'lucide-react';

const CollectionSearch = ({ searchTerm, setSearchTerm }) => {
  return (
    <div className="relative w-full max-w-xl">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-neutral-400" aria-hidden="true" />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm transition-colors shadow-sm"
        placeholder="Search collections..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search collections"
      />
    </div>
  );
};

export default CollectionSearch;
