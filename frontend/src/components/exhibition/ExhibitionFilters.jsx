import React from 'react';

const ExhibitionFilters = ({ filters, selectedFilter, setSelectedFilter }) => {
  if (!filters || filters.length <= 1) return null;
  
  return (
    <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => setSelectedFilter(filter)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            selectedFilter === filter
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
};

export default ExhibitionFilters;
