import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';

const GalleryCard = ({ gallery, museumId }) => {
  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
      <div className="h-48 bg-neutral-200 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-300 to-neutral-100 flex items-center justify-center">
          <ImageIcon className="w-16 h-16 text-neutral-400" />
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
          {gallery.period || gallery.theme || 'Gallery'}
        </div>
        <h3 className="text-xl font-bold text-neutral-900 mb-2">{gallery.name}</h3>
        <p className="text-neutral-600 text-sm mb-6 flex-grow line-clamp-3">
          {gallery.description}
        </p>
        <div className="flex items-center text-sm font-medium text-neutral-500 mb-6">
          <span>{gallery.objectCount} Objects</span>
        </div>
        <Link 
          to={`/museum/${museumId}/gallery/${gallery.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors mt-auto"
        >
          EXPLORE GALLERY
        </Link>
      </div>
    </div>
  );
};

export default GalleryCard;
