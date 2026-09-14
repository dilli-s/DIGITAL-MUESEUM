import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

const ImageGallery = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(images.length - 1, prev + 1));
  };

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Image Gallery</h2>
      
      {/* Main Image */}
      <div className="relative bg-neutral-100 rounded-2xl overflow-hidden aspect-video md:aspect-[21/9] flex items-center justify-center mb-4 border border-neutral-200">
        <ImageIcon className="w-16 h-16 text-neutral-300" />
        <div className="absolute inset-0 flex items-center justify-between p-4">
          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-colors text-neutral-900"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-colors text-neutral-900"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${currentIndex === idx ? 'border-neutral-900 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
            aria-label={`View image ${idx + 1}`}
          >
            <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
               <ImageIcon className="w-6 h-6 text-neutral-400" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ImageGallery;
