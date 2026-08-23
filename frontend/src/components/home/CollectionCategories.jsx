import React from 'react';
import { Compass } from 'lucide-react';

const collectionCategories = [
  { id: 'history', name: "History", description: "Historical artifacts and documents" },
  { id: 'art', name: "Art", description: "Paintings, sculptures, and visual arts" },
  { id: 'archaeology', name: "Archaeology", description: "Ancient discoveries and ruins" },
  { id: 'culture', name: "Culture", description: "Cultural heritage and traditions" },
  { id: 'science', name: "Science", description: "Scientific instruments and discoveries" },
  { id: 'natural', name: "Natural Heritage", description: "Fossils, minerals, and biology" }
];

const CollectionCategories = () => {
  return (
    <section className="py-16">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Explore Museum Collections</h2>
        <p className="mt-2 text-neutral-600">Browse artifacts by category and theme.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {collectionCategories.map((category) => (
          <div 
            key={category.id} 
            className="group cursor-pointer bg-neutral-50 rounded-xl p-6 border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all text-center flex flex-col items-center justify-center h-40"
          >
            <Compass className="w-8 h-8 text-neutral-400 group-hover:text-neutral-300 mb-3" />
            <h3 className="font-semibold">{category.name}</h3>
            <p className="text-xs text-neutral-500 group-hover:text-neutral-400 mt-1 hidden sm:block">
              {category.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CollectionCategories;
