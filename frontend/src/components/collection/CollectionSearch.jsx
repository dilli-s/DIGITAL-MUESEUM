import React from 'react';
import { Search, X } from 'lucide-react';

const CollectionSearch = ({ searchTerm, setSearchTerm }) => {
  return (
    <div className="relative w-full max-w-xl">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-[#8f6826]" aria-hidden="true" />
      </div>
      <input
        type="text"
        className="block w-full pl-11 pr-10 py-3 rounded-full bg-[#fdfbf7] border-2 border-[#dfd2be] hover:border-[#8f6826] focus:border-[#8f6826] text-[#241a10] placeholder-[#8a7660] focus:outline-none focus:ring-4 focus:ring-[#8f6826]/15 sm:text-sm font-medium transition-all shadow-sm"
        placeholder="Search collections..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search collections"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#735a3e] hover:text-[#241a10]"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default CollectionSearch;
