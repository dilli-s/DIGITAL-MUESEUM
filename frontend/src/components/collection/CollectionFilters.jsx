import React from 'react';

const CollectionFilters = ({ categories, selectedCategory, setSelectedCategory }) => {
  return (
    <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => setSelectedCategory(category)}
          className={`whitespace-nowrap px-5 py-2 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase transition-all duration-200 border-2 ${
            selectedCategory === category
              ? 'bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] border-[#8f6826] shadow-md shadow-[#8f6826]/20 font-bold scale-105'
              : 'bg-[#fdfbf7] text-[#5a4836] border-[#dfd2be] hover:border-[#8f6826] hover:text-[#241a10]'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default CollectionFilters;
