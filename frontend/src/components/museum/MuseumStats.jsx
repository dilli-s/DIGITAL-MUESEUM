import React from 'react';

const MuseumStats = ({ museums, filteredCount }) => {
  const totalCollections = museums.length > 0 ? museums.length * 8 : 0;
  const totalObjects = museums.reduce((acc, curr) => acc + (curr.objectCount || 0), 0);
  const totalGalleries = museums.reduce((acc, curr) => acc + (curr.galleryCount || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-y border-neutral-200">
      <div className="text-center">
        <div className="text-3xl font-bold text-neutral-900">{museums.length}+</div>
        <div className="text-sm font-medium text-neutral-500 mt-1">Museums</div>
      </div>
      <div className="text-center md:border-l border-neutral-200">
        <div className="text-3xl font-bold text-neutral-900">{totalCollections}+</div>
        <div className="text-sm font-medium text-neutral-500 mt-1">Collections</div>
      </div>
      <div className="text-center border-t md:border-t-0 md:border-l border-neutral-200 pt-4 md:pt-0">
        <div className="text-3xl font-bold text-neutral-900">{totalObjects.toLocaleString()}+</div>
        <div className="text-sm font-medium text-neutral-500 mt-1">Objects</div>
      </div>
      <div className="text-center border-t md:border-t-0 border-l border-neutral-200 pt-4 md:pt-0">
        <div className="text-3xl font-bold text-neutral-900">{totalGalleries}+</div>
        <div className="text-sm font-medium text-neutral-500 mt-1">Galleries</div>
      </div>
    </div>
  );
};

export default MuseumStats;
