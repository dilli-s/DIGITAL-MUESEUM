import React from 'react';

const MuseumFilters = ({ categories, selectedCategory, setSelectedCategory }) => {
  return (
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
  );
};

export default MuseumFilters;
