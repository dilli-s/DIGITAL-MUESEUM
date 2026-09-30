import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const CollectionCard = ({ collection, museumId }) => {
  const [imageError, setImageError] = useState(false);
  const rawImg = collection.image_url || collection.image;
  const imgUrl = rawImg ? getMediaUrl(rawImg) : null;

  return (
    <div className="group bg-[#1a1510] rounded-2xl overflow-hidden border border-[#382d1f] hover:border-[#c89b3c] shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col h-full">
      <div className="h-48 bg-[#120e0a] relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        {imgUrl && !imageError ? (
          <img 
            src={imgUrl} 
            alt={collection.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1f1913] to-[#2b2218] flex items-center justify-center">
            <Layers className="w-14 h-14 text-[#c89b3c]/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510] via-transparent to-transparent opacity-80" />

        {collection.featured && (
          <div className="absolute top-3 right-3 bg-[#c89b3c] text-[#0e0c0a] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
            Featured
          </div>
        )}
      </div>

      <div className="p-6 flex-grow flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-bold text-[#dfb758] uppercase tracking-widest mb-2">
            {collection.category || 'Archive'} {collection.period && `• ${collection.period}`}
          </div>
          <h3 className="font-['Cinzel'] text-lg sm:text-xl font-bold text-[#fcf8f0] group-hover:text-[#e5c158] transition-colors mb-2 line-clamp-1">
            {collection.name}
          </h3>
          <p className="text-xs sm:text-sm text-[#c4b5a2] mb-4 flex-grow line-clamp-3 leading-relaxed font-light">
            {collection.description}
          </p>
        </div>

        <div>
          <div className="flex items-center text-xs font-semibold text-[#d4c6b2] mb-4">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-[#c89b3c]" />
            <span>{collection.objectCount ?? collection.object_count ?? 0} {(collection.objectCount ?? collection.object_count) === 1 ? 'Object' : 'Objects'}</span>
          </div>

          <Link 
            to={`/museum/${museumId}/collection/${collection.id}`} 
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#be9141] px-4 py-2.5 text-xs sm:text-sm font-semibold tracking-wider uppercase text-[#fff8ea] shadow transition-all hover:scale-[1.01]"
          >
            <span>Explore Collection</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#ffe6a4]" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CollectionCard;
