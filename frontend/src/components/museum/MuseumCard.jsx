import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Image as ImageIcon, Box, ArrowRight, Landmark, Compass } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const fallbackImages = [
  '/images/louvre_pyramid.jpg',
  '/images/british_museum.jpg',
  '/images/hero_museum_hall.jpg',
];

const MuseumCard = ({ museum, index = 0 }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const rawImage = museum.image || museum.image_url;
  const isCustomUrl = rawImage && (rawImage.startsWith('http') || rawImage.startsWith('/'));
  const imageUrl = isCustomUrl ? (rawImage.startsWith('http') ? rawImage : getMediaUrl(rawImage)) : null;

  // Pick deterministic beautiful fallback
  const fallbackImg = fallbackImages[index % fallbackImages.length];
  const finalSrc = (!imageFailed && imageUrl) ? imageUrl : fallbackImg;

  return (
    <div className="group rounded-2xl overflow-hidden bg-gradient-to-b from-[#fdfbf7] to-[#faf4ea] border-2 border-[#dfd2be] hover:border-[#8f6826] shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col h-full hover:-translate-y-1">
      {/* Museum Photography */}
      <div className="h-56 bg-[#ede3d1] relative overflow-hidden flex-shrink-0">
        <img 
          src={finalSrc} 
          alt={museum.name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
          onError={() => setImageFailed(true)}
        />
        
        {/* Subtle Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#241a10]/70 via-transparent to-transparent" />

        {/* Category Pill Tag */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#fdfbf7]/95 backdrop-blur-md border border-[#dfd2be] text-[#8f6826] shadow-sm">
          <Compass className="w-3 h-3" />
          <span>{museum.category || 'MUSEUM VAULT'}</span>
        </div>

        {/* Location Badge */}
        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-white drop-shadow">
          <div className="flex items-center text-xs font-semibold tracking-wide">
            <MapPin className="w-3.5 h-3.5 mr-1 text-[#dfb758]" />
            <span className="line-clamp-1">{museum.location || 'Heritage Gallery'}</span>
          </div>
        </div>
      </div>

      {/* Museum Info Details */}
      <div className="p-6 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] group-hover:text-[#8f6826] transition-colors mb-2 line-clamp-1">
            {museum.name}
          </h3>

          <p className="text-xs sm:text-sm text-[#5a4836] mb-6 line-clamp-3 leading-relaxed font-light">
            {museum.description || 'Explore extraordinary historic collections, preserved archives, and immersive virtual wings.'}
          </p>
        </div>
        
        <div>
          <div className="grid grid-cols-2 gap-3 border-t-2 border-[#ede3d1] pt-4 mb-5">
            <div className="flex items-center text-xs font-semibold text-[#6e5842] bg-[#f7efe1] px-3 py-2 rounded-xl border border-[#dfd2be]">
              <ImageIcon className="w-3.5 h-3.5 mr-2 text-[#8f6826]" />
              <span>{museum.galleryCount || 8} Galleries</span>
            </div>
            <div className="flex items-center text-xs font-semibold text-[#6e5842] bg-[#f7efe1] px-3 py-2 rounded-xl border border-[#dfd2be]">
              <Box className="w-3.5 h-3.5 mr-2 text-[#8f6826]" />
              <span>{museum.objectCount || 24} Objects</span>
            </div>
          </div>

          <Link 
            to={`/museums/${museum.id}`} 
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#be9141] px-5 py-3.5 text-xs sm:text-sm font-bold tracking-wider uppercase text-[#fff8ea] shadow-md hover:shadow-lg transition-all"
          >
            <span>Explore Museum</span>
            <ArrowRight className="w-4 h-4 text-[#ffe6a4] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MuseumCard;
