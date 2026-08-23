import React from 'react';
import { Layers } from 'lucide-react';

const CollectionPreview = ({ collections }) => {
  if (!collections || collections.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Explore Collections</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {collections.map((collection) => (
          <div key={collection.id} className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 hover:border-neutral-900 transition-colors flex flex-col items-center text-center">
            <Layers className="w-8 h-8 text-neutral-400 mb-3" />
            <h3 className="font-semibold text-neutral-900 mb-1">{collection.name}</h3>
            <span className="text-xs text-neutral-500">{collection.objectCount} Objects</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CollectionPreview;
