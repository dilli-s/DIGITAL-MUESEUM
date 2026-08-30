import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMuseums } from '../../services/api';
import { MapPin, Image as ImageIcon, Box } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

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

const FeaturedMuseums = () => {
  const [museums, setMuseums] = useState([]);

  useEffect(() => {
    getMuseums({ per_page: 3 })
      .then(res => setMuseums(res.data || []))
      .catch(console.error);
  }, []);

  if (museums.length === 0) return null;

  return (
    <section className="py-16">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Featured Museums</h2>
          <p className="mt-2 text-neutral-600">Discover top cultural institutions.</p>
        </div>
        <Link to="/museums" className="hidden sm:block text-sm font-semibold text-neutral-900 hover:underline">
          View all <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      <div className="flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {museums.map((museum) => (
          <div key={museum.id} className="w-[85vw] sm:w-auto shrink-0 snap-center group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col">
            <div className="h-48 bg-neutral-200 relative overflow-hidden">
              {museum.image ? (
                <img src={getMediaUrl(museum.image)} alt={museum.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-tr from-neutral-300 to-neutral-100 flex items-center justify-center">
                  <BuildingPlaceholder />
                </div>
              )}
            </div>
            <div className="p-6 flex-grow flex flex-col">
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
                  <span>Galleries</span>
                </div>
                <div className="flex items-center text-sm text-neutral-600">
                  <Box className="w-4 h-4 mr-2 text-neutral-400" />
                  <span>Objects</span>
                </div>
              </div>

              <Link 
                to={`/museums/${museum.id}`} 
                className="w-full inline-flex justify-center rounded-md bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-100 transition-colors"
              >
                EXPLORE
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 sm:hidden flex justify-center">
        <Link to="/museums" className="text-sm font-semibold text-neutral-900 hover:underline">
          View all museums <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
};

export default FeaturedMuseums;
