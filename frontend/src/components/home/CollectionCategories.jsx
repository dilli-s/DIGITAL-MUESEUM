import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCollections, getMuseums } from '../../services/api';
import { Landmark, ArrowRight, Layers, Box, MapPin } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const fallbackCollectionImages = [
  '/uploads/museum_1_oriental_institute.jpg',
  '/uploads/museum_2_moma.jpg',
  '/uploads/museum_3_louvre.jpg',
  '/uploads/museum_4_acropolis.jpg',
  '/uploads/museum_5_natural_history.jpg',
  '/uploads/museum_6_kyoto.jpg',
];

const CollectionCategories = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCollections({ per_page: 20 }),
      getMuseums({ per_page: 50 }),
    ])
      .then(([collectionsRes, museumsRes]) => {
        const rawCollections = collectionsRes.data || [];
        const museumsList = museumsRes.data || [];
        const museumMap = new Map(museumsList.map((m) => [m.id, m]));

        // Enrich collections with museum details
        const enriched = rawCollections.map((col, idx) => {
          const museum = col.museum || museumMap.get(col.museum_id || col.museumId);
          const museumName = museum?.name || col.museum_name || 'Museum Sanctuary';
          const museumLocation = museum?.location || col.museum_location || 'Heritage Gallery';
          
          let colImage = col.image;
          if (!colImage && museum?.image) {
            colImage = museum.image;
          }
          if (!colImage) {
            colImage = fallbackCollectionImages[idx % fallbackCollectionImages.length];
          }

          const imgSrc = colImage.startsWith('http') || colImage.startsWith('/')
            ? (colImage.startsWith('http') ? colImage : getMediaUrl(colImage))
            : getMediaUrl(colImage);

          return {
            ...col,
            museum,
            museumName,
            museumLocation,
            imgSrc,
            code: `ARC-0${idx + 1}`,
          };
        });

        setCollections(enriched);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching museum collections:', err);
        setLoading(false);
      });
  }, []);

  if (!loading && collections.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 relative">
      {/* Section Header with Museum Filigree */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 sm:mb-10 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8f6826] font-['Cinzel']">
              Curatorial Archives by Museum
            </span>
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
          </div>
          <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight flex items-center gap-2.5">
            Museum Collections
          </h2>
          <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6f5b45] mt-1 max-w-xl">
            Discover prestigious permanent archives, specialized galleries, and historical vaults housed within each sanctuary
          </p>
        </div>

        <Link 
          to="/search?tab=collections" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#bfae95] bg-[#fbf7ee] hover:bg-[#35281b] hover:border-[#35281b] text-[#5c462e] hover:text-[#f7efe3] text-xs font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 group self-start sm:self-auto"
        >
          <span>Explore All Museum Collections</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#c89b3c] group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Museum Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {collections.map((item) => {
          const targetLink = item.museum_id
            ? `/museum/${item.museum_id}/collection/${item.id}`
            : `/museums`;

          return (
            <Link
              key={item.id}
              to={targetLink}
              className="group relative flex flex-col justify-between rounded-2xl overflow-hidden bg-[#fdfbf7] border-2 border-[#d8c8b0] hover:border-[#8f6826] shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 text-left"
            >
              {/* Museum Photography */}
              <div className="relative h-44 overflow-hidden bg-[#241a10]">
                <img
                  src={item.imgSrc}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  loading="lazy"
                />

                {/* Soft Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1b140c]/85 via-[#1b140c]/25 to-transparent" />

                {/* Museum Pill Badge Top Left */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1b140c]/85 border border-[#c89b3c]/50 text-[#f7efe3] text-[9px] font-['Cinzel'] font-bold tracking-wider uppercase truncate max-w-[75%] backdrop-blur-xs shadow-xs">
                    <Landmark className="w-3 h-3 text-[#e5c158] flex-shrink-0" />
                    <span className="truncate">{item.museumName}</span>
                  </span>
                  <span className="text-[9px] font-mono text-[#dfb758] font-bold bg-[#1b140c]/70 px-2 py-0.5 rounded-full border border-white/10">
                    {item.code}
                  </span>
                </div>

                {/* Bottom on Image: Location Pin */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-[#fdfbf7] drop-shadow">
                  <div className="flex items-center text-[10px] text-[#f7efe3]">
                    <MapPin className="w-3 h-3 mr-1 text-[#dfb758] flex-shrink-0" />
                    <span className="truncate">{item.museumLocation.split(',')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#ffe29a] bg-[#1b140c]/70 px-2 py-0.5 rounded-full">
                    <Box className="w-2.5 h-2.5 text-[#e5c158]" />
                    <span>{item.objectCount || item.object_count || 0} Objects</span>
                  </div>
                </div>
              </div>

              {/* Information Base */}
              <div className="p-4 flex flex-col justify-between flex-grow bg-[#fdfbf7]">
                <div>
                  <h3 className="font-['Cinzel'] font-bold text-sm text-[#241a10] group-hover:text-[#8f6826] transition-colors leading-snug line-clamp-1">
                    {item.name}
                  </h3>
                  
                  <p className="text-xs text-[#6e5842] mt-1 line-clamp-2 leading-relaxed font-normal">
                    {item.description || `Curated archives and historical artifacts preserved in ${item.museumName}.`}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#ede3d1] flex items-center justify-between text-[11px] font-semibold text-[#8f6826] group-hover:text-[#241a10] transition-colors">
                  <span className="font-['Cinzel'] tracking-wider uppercase text-[10px]">View Collection</span>
                  <span className="group-hover:translate-x-1 transition-transform text-[#c89b3c] font-bold">&rarr;</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Decorative Archival Arch Separator */}
      <div className="mt-10 pt-5 flex items-center justify-between border-t border-[#d8c8b0]/70 text-[#7a644e]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-[1px] bg-[#bfae95]" />
          <Landmark className="w-3.5 h-3.5 text-[#8f6826]" />
          <span className="font-['Cormorant_Garamond'] italic text-sm sm:text-base text-[#5c462e]">
            "A museum is a place where one should lose one's head and find one's heritage."
          </span>
        </div>
        <div className="text-[10px] tracking-[0.25em] uppercase font-bold text-[#8a7258] font-['Cinzel'] hidden sm:block">
          CURATORIAL VAULT
        </div>
      </div>
    </section>
  );
};

export default CollectionCategories;
