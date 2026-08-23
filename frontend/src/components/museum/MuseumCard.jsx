import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Image as ImageIcon, Box } from 'lucide-react';

const MuseumCard = ({ museum }) => {
  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
      <div className="h-48 bg-neutral-200 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-300 to-neutral-100 flex items-center justify-center">
          <BuildingPlaceholder />
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
          {museum.category}
        </div>
        <h3 className="text-xl font-bold text-neutral-900 mb-1">{museum.name}</h3>
        <div className="flex items-center text-sm text-neutral-500 mb-4">
          <MapPin className="w-4 h-4 mr-1" />
          {museum.location}
        </div>
        <p className="text-neutral-600 text-sm mb-6 flex-grow line-clamp-3">
          {museum.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 mb-6">
          <div className="flex items-center text-sm text-neutral-600">
            <ImageIcon className="w-4 h-4 mr-2 text-neutral-400" />
            <span>{museum.galleryCount} Galleries</span>
          </div>
          <div className="flex items-center text-sm text-neutral-600">
            <Box className="w-4 h-4 mr-2 text-neutral-400" />
            <span>{museum.objectCount} Objects</span>
          </div>
        </div>

        <Link 
          to={`/museums/${museum.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors mt-auto"
        >
          EXPLORE MUSEUM
        </Link>
      </div>
    </div>
  );
};

const BuildingPlaceholder = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
    <path d="M9 22v-4h6v4"></path>
    <path d="M8 6h.01"></path>
    <path d="M16 6h.01"></path>
    <path d="M12 6h.01"></path>
    <path d="M12 10h.01"></path>
    <path d="M12 14h.01"></path>
    <path d="M16 10h.01"></path>
    <path d="M16 14h.01"></path>
    <path d="M8 10h.01"></path>
    <path d="M8 14h.01"></path>
  </svg>
);

export default MuseumCard;
