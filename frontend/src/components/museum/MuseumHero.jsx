import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin } from 'lucide-react';

const MuseumHero = ({ museum }) => {
  return (
    <section className="bg-neutral-900 text-white rounded-2xl overflow-hidden mb-12 relative flex flex-col md:flex-row min-h-[400px]">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black pointer-events-none"></div>
      
      <div className="md:w-1/2 p-8 sm:p-12 flex flex-col justify-center z-10">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center">
          <Building2 className="w-4 h-4 mr-2" />
          {museum.category}
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">{museum.name}</h1>
        
        <div className="flex items-center text-neutral-300 mb-6">
          <MapPin className="w-5 h-5 mr-2 text-neutral-400" />
          {museum.location}
        </div>
        
        <p className="text-lg text-neutral-400 mb-8 max-w-xl">
          {museum.description}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-auto">
          <Link 
            to={`/museum/${museum.id}`} 
            className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
          >
            VIRTUAL MUSEUM
          </Link>
          <Link 
            to="/museums" 
            className="inline-flex items-center justify-center rounded-md border border-neutral-600 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            BACK TO MUSEUMS
          </Link>
        </div>
      </div>

      <div className="md:w-1/2 bg-neutral-800 relative min-h-[250px] flex items-center justify-center">
        {/* Placeholder for Museum Hero Image */}
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-800 to-neutral-700"></div>
        <Building2 className="w-24 h-24 text-neutral-600 relative z-10 opacity-50" />
      </div>
    </section>
  );
};

export default MuseumHero;
