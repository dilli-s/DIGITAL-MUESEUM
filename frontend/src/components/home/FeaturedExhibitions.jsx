import React, { useState, useEffect } from 'react';
import { getExhibitions } from '../../services/api';
import { Calendar } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const FeaturedExhibitions = () => {
  const [exhibitions, setExhibitions] = useState([]);

  useEffect(() => {
    getExhibitions({ featured: 'true', per_page: 3 })
      .then(res => setExhibitions(res.data || []))
      .catch(console.error);
  }, []);

  if (exhibitions.length === 0) return null;

  return (
    <section className="py-16 bg-neutral-900 text-white rounded-2xl px-6 sm:px-12 my-8">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Featured Exhibitions</h2>
        <p className="mt-2 text-neutral-400">Discover temporary and special collections.</p>
      </div>

      <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 md:gap-8 pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {exhibitions.map((exhibition) => (
          <div key={exhibition.id} className="w-[85vw] md:w-auto shrink-0 snap-center group relative bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 hover:border-neutral-500 transition-colors">
            <div className="h-40 bg-neutral-700 relative overflow-hidden">
              {exhibition.image ? (
                <img src={getMediaUrl(exhibition.image)} alt={exhibition.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-gradient-to-br from-neutral-400 to-neutral-800"></div>
              )}
            </div>
            <div className="p-6">
              {exhibition.period && (
                <div className="flex items-center text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wider">
                  <Calendar className="w-3 h-3 mr-1" />
                  {exhibition.period}
                </div>
              )}
              <h3 className="text-xl font-semibold mb-2">{exhibition.title}</h3>
              <p className="text-neutral-400 text-sm">
                {exhibition.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedExhibitions;
