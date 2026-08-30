import React, { useState, useEffect } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCollections } from '../../services/api';

const CollectionCategories = () => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCollections({ per_page: 6 })
      .then(res => {
        setCollections(res.data || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <section className="py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Explore Museum Collections</h2>
          <p className="mt-2 text-neutral-600">Browse artifacts by category and theme.</p>
        </div>
        <div className="flex justify-center items-center h-40">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
        </div>
      </section>
    );
  }

  if (collections.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Explore Museum Collections</h2>
        <p className="mt-2 text-neutral-600">Browse artifacts by category and theme.</p>
      </div>

      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-4 sm:gap-6 pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {collections.map((category) => (
          <Link 
            key={category.id} 
            to={`/search?q=${encodeURIComponent(category.name)}&tab=objects`}
            className="w-[140px] sm:w-auto shrink-0 snap-center group cursor-pointer bg-neutral-50 rounded-xl p-4 sm:p-6 border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all text-center flex flex-col items-center justify-center h-32 sm:h-40"
          >
            <Compass className="w-8 h-8 text-neutral-400 group-hover:text-neutral-300 mb-3" />
            <h3 className="font-semibold">{category.name}</h3>
            <p className="text-xs text-neutral-500 group-hover:text-neutral-400 mt-1 hidden sm:block line-clamp-2">
              {category.description || category.longDescription}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default CollectionCategories;
