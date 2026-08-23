import React from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';

const CollectionCard = ({ collection, museumId }) => {
  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
      <div className="h-48 bg-neutral-200 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-300 to-neutral-100 flex items-center justify-center">
          <Layers className="w-16 h-16 text-neutral-400" />
        </div>
        {collection.featured && (
          <div className="absolute top-4 right-4 bg-neutral-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Featured
          </div>
        )}
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
          {collection.category} {collection.period && `• ${collection.period}`}
        </div>
        <h3 className="text-xl font-bold text-neutral-900 mb-2">{collection.name}</h3>
        <p className="text-neutral-600 text-sm mb-6 flex-grow line-clamp-3">
          {collection.description}
        </p>
        <div className="flex items-center text-sm font-medium text-neutral-500 mb-6">
          <span>{collection.objectCount} Objects</span>
        </div>
        <Link 
          to={`/museum/${museumId}/collection/${collection.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors mt-auto"
        >
          EXPLORE COLLECTION
        </Link>
      </div>
    </div>
  );
};

export default CollectionCard;
