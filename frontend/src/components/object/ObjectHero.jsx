import React from 'react';
import { Link } from 'react-router-dom';
import { Volume2, ArrowRight } from 'lucide-react';

const ObjectHero = ({ objectData, onPlayAudio }) => {
  return (
    <section className="bg-neutral-900 rounded-2xl overflow-hidden mb-12 flex flex-col md:flex-row shadow-sm text-white min-h-[500px]">
      <div className="md:w-1/2 bg-neutral-800 relative flex items-center justify-center overflow-hidden min-h-[300px]">
        {/* Placeholder for object image */}
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-800 to-neutral-700 opacity-60"></div>
        <div className="relative z-10 text-neutral-500 font-medium">
          [ {objectData.name} Image ]
        </div>
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
            {objectData.audio && (
              <button 
                onClick={onPlayAudio}
                className="inline-flex items-center justify-center rounded-md bg-neutral-800 border border-neutral-700 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
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
  );
};

export default ObjectHero;
