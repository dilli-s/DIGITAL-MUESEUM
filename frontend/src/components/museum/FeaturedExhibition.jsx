import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

const FeaturedExhibition = ({ exhibition, museumId }) => {
  if (!exhibition) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Featured Exhibition</h2>
      <div className="bg-neutral-900 text-white rounded-2xl overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-2/5 bg-neutral-800 min-h-[250px] relative">
           <div className="absolute inset-0 bg-gradient-to-tr from-neutral-800 to-neutral-700 opacity-80 mix-blend-overlay"></div>
        </div>
        <div className="md:w-3/5 p-8 flex flex-col justify-center">
          <div className="flex items-center text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wider">
            <Calendar className="w-4 h-4 mr-2" />
            {exhibition.period}
          </div>
          <h3 className="text-3xl font-bold mb-4">{exhibition.title}</h3>
          <p className="text-neutral-400 mb-8 max-w-lg">
            {exhibition.description}
          </p>
          <Link 
            to={`/museum/${museumId}`}
            className="inline-flex items-center text-sm font-semibold text-white hover:text-neutral-300 transition-colors w-max"
          >
            EXPLORE EXHIBITION <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedExhibition;
