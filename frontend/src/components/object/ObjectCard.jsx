import React from 'react';
import { Link } from 'react-router-dom';

const ObjectCard = ({ objectData }) => {
  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
      <div className="h-40 bg-neutral-100 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-neutral-200 flex items-center justify-center text-neutral-400">
           {/* Placeholder for object image */}
           Object Image
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-neutral-900 mb-1 line-clamp-1">{objectData.name}</h3>
        <p className="text-xs text-neutral-500 mb-3">{objectData.period} • {objectData.origin}</p>
        <p className="text-neutral-600 text-sm mb-4 flex-grow line-clamp-2">
          {objectData.shortDescription}
        </p>
        <Link 
          to={`/objects/${objectData.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-100 transition-colors mt-auto"
        >
          VIEW OBJECT
        </Link>
      </div>
    </div>
  );
};

export default ObjectCard;
