import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, ArrowRight, ZoomIn, X } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const ObjectHero = ({ objectData, onPlayAudio }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Close modal on escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isImageExpanded) {
        setIsImageExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageExpanded]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isImageExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isImageExpanded]);

  const hasImage = objectData.image || objectData.image_url;
  const imageUrl = hasImage ? getMediaUrl(objectData.image || objectData.image_url) : null;

  return (
    <>
      <section className="bg-neutral-900 rounded-2xl overflow-hidden mb-12 flex flex-col md:flex-row shadow-sm text-white min-h-[500px]">
        <div 
          className={`md:w-1/2 relative flex items-center justify-center overflow-hidden min-h-[300px] group ${hasImage ? 'cursor-pointer bg-black' : 'bg-neutral-800'}`}
          onClick={() => hasImage && setIsImageExpanded(true)}
        >
          {hasImage ? (
            <>
              {/* Blurred background to fill the box without letterboxing */}
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110"
                style={{ backgroundImage: `url(${imageUrl})` }}
              ></div>
              <img 
                src={imageUrl} 
                alt={objectData.name} 
                className="relative z-10 w-full h-full object-contain transition-transform duration-700 ease-in-out group-hover:scale-105" 
              />
              <div className="absolute inset-0 z-20 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-100 scale-90 backdrop-blur-sm shadow-lg">
                  <ZoomIn className="w-8 h-8" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-tr from-neutral-800 to-neutral-700 opacity-60"></div>
              <div className="relative z-10 text-neutral-500 font-medium">
                [ {objectData.name} Image ]
              </div>
            </>
          )}
        </div>
        
        <div className="md:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              {objectData.category || 'Museum Object'}
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">{objectData.name}</h1>
            
            {(objectData.localName || objectData.scientificName) && (
              <div className="text-lg text-neutral-400 mb-6 italic">
                {objectData.localName} {objectData.localName && objectData.scientificName && '•'} {objectData.scientificName}
              </div>
            )}

            <div className="space-y-2 mb-8 text-neutral-300">
              {objectData.period && (
                <p><span className="font-semibold text-neutral-500 mr-2">Period:</span> {objectData.period}</p>
              )}
              {objectData.origin && (
                <p><span className="font-semibold text-neutral-500 mr-2">Origin:</span> {objectData.origin}</p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              {(objectData.audio || objectData.audio_url) && (
                <button 
                  onClick={onPlayAudio}
                  className="inline-flex items-center justify-center rounded-md bg-neutral-800 border border-neutral-700 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 mr-2" /> LISTEN
                </button>
              )}
              <Link 
                to={`/objects/${objectData.id}/explore`} 
                className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
              >
                EXPLORE MORE <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {isImageExpanded && hasImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setIsImageExpanded(false)}
        >
          <button 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setIsImageExpanded(false); }}
          >
            <X className="w-8 h-8" />
          </button>
          
          <img 
            src={imageUrl} 
            alt={objectData.name} 
            className="max-w-full max-h-[90vh] object-contain select-none cursor-default shadow-2xl rounded-lg border border-neutral-800" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ObjectHero;
