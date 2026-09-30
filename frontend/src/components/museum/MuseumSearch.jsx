import React from 'react';
import { Search } from 'lucide-react';

const MuseumSearch = ({ searchTerm, setSearchTerm }) => {
  return (
    <div className="relative w-full max-w-2xl mx-auto sm:mx-0">
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[#8f6826]" aria-hidden="true" />
        </div>
        <input
          type="text"
          className="block w-full pl-14 pr-32 py-4 rounded-full bg-[#fdfbf7] border-2 border-[#dfd2be] hover:border-[#8f6826] focus:border-[#8f6826] text-[#241a10] placeholder-[#9c8a76] focus:outline-none focus:ring-4 focus:ring-[#8f6826]/15 sm:text-sm font-medium transition-all shadow-md shadow-[#44301d]/5"
          placeholder="Search museums by name, location, or cultural era..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search museums"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 px-3 py-1 text-xs font-bold text-[#8f6826] hover:text-[#241a10] bg-[#ede3d1] rounded-full uppercase tracking-wider transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default MuseumSearch;
