import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const ImageGallery = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);

  if (!images || images.length === 0) return null;

  const validImages = images.filter(Boolean);
  if (validImages.length === 0) return null;

  const handlePrev = () => {
    setLoadError(false);
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setLoadError(false);
    setCurrentIndex(prev => Math.min(validImages.length - 1, prev + 1));
  };

  const currentImageUrl = getMediaUrl(validImages[currentIndex]);

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Image Gallery</h2>
      
      {/* Main Image */}
      <div className="relative bg-neutral-900 rounded-2xl overflow-hidden aspect-video md:aspect-[21/9] flex items-center justify-center mb-4 border border-neutral-200 group">
        {currentImageUrl && !loadError ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl scale-110"
              style={{ backgroundImage: `url(${currentImageUrl})` }}
            ></div>
            <img 
              src={currentImageUrl} 
              alt={`Gallery image ${currentIndex + 1}`}
              className="relative z-10 w-full h-full object-contain transition-transform duration-300"
              onError={() => setLoadError(true)}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-neutral-400">
            <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
            <span className="text-sm font-medium">Image unavailable</span>
          </div>
        )}

        {validImages.length > 1 && (
          <div className="absolute inset-0 z-20 flex items-center justify-between p-4 pointer-events-none">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center shadow-lg disabled:opacity-20 disabled:cursor-not-allowed hover:bg-black/80 transition-colors text-white"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNext}
              disabled={currentIndex === validImages.length - 1}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center shadow-lg disabled:opacity-20 disabled:cursor-not-allowed hover:bg-black/80 transition-colors text-white"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Counter Badge */}
        {validImages.length > 1 && (
          <div className="absolute bottom-4 right-4 z-20 bg-black/70 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur">
            {currentIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          {validImages.map((img, idx) => {
            const thumbUrl = getMediaUrl(img);
            return (
              <button
                key={idx}
                onClick={() => {
                  setLoadError(false);
                  setCurrentIndex(idx);
                }}
                className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  currentIndex === idx 
                    ? 'border-neutral-900 opacity-100 ring-2 ring-neutral-900 ring-offset-2' 
                    : 'border-neutral-200 opacity-60 hover:opacity-100'
                }`}
                aria-label={`View image ${idx + 1}`}
              >
                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                  <img 
                    src={thumbUrl} 
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<span class="text-xs text-neutral-400">#${idx + 1}</span>';
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ImageGallery;
