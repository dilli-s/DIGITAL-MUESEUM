import React from 'react';

const MuseumDetailStats = ({ museum }) => {
  return (
    <section className="mb-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-y border-neutral-200 bg-white rounded-xl shadow-sm px-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-neutral-900">{museum.galleryCount || 0}</div>
          <div className="text-sm font-medium text-neutral-500 mt-1">Galleries</div>
        </div>
        <div className="text-center border-l border-neutral-200">
          <div className="text-3xl font-bold text-neutral-900">{museum.collectionCount || 0}</div>
          <div className="text-sm font-medium text-neutral-500 mt-1">Collections</div>
        </div>
        <div className="text-center border-t md:border-t-0 md:border-l border-neutral-200 pt-4 md:pt-0">
          <div className="text-3xl font-bold text-neutral-900">{museum.objectCount?.toLocaleString() || 0}</div>
          <div className="text-sm font-medium text-neutral-500 mt-1">Objects</div>
        </div>
        <div className="text-center border-t md:border-t-0 border-l border-neutral-200 pt-4 md:pt-0">
          <div className="text-3xl font-bold text-neutral-900">{museum.exhibitionCount || 0}</div>
          <div className="text-sm font-medium text-neutral-500 mt-1">Exhibitions</div>
        </div>
      </div>
    </section>
  );
};

export default MuseumDetailStats;
