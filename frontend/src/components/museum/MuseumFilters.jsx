import React from 'react';
import { Sparkles } from 'lucide-react';

const MuseumFilters = ({ categories, selectedCategory, setSelectedCategory }) => {
  return (
    <div className="flex flex-wrap items-center gap-2.5 pt-2">
      <span className="text-xs font-bold uppercase tracking-wider text-[#7a644e] mr-1 hidden sm:inline-flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5 text-[#8f6826]" />
        Filter By:
      </span>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => setSelectedCategory(category)}
          className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-200 border-2 ${
            selectedCategory === category
              ? 'bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] border-[#8f6826] shadow-md shadow-[#8f6826]/30 scale-105'
              : 'bg-[#fdfbf7] text-[#5a4836] border-[#dfd2be] hover:border-[#8f6826] hover:text-[#241a10] shadow-xs'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default MuseumFilters;
