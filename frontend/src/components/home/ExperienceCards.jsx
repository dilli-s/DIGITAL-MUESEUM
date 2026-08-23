import React from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Smartphone } from 'lucide-react';

const ExperienceCards = () => {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Two Ways to Experience the Museum</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
            <Monitor className="w-8 h-8 text-neutral-700" />
          </div>
          <h3 className="text-2xl font-semibold mb-4 text-neutral-900">Virtual Museum</h3>
          <p className="text-neutral-600 mb-8 flex-grow">
            Explore museum collections from anywhere. Browse galleries, discover objects and experience digital exhibits online.
          </p>
          <Link 
            to="/museum/1" 
            className="w-full sm:w-auto inline-flex justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            EXPLORE VIRTUAL MUSEUM
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
            <Smartphone className="w-8 h-8 text-neutral-700" />
          </div>
          <h3 className="text-2xl font-semibold mb-4 text-neutral-900">Physical Museum</h3>
          <p className="text-neutral-600 mb-8 flex-grow">
            Enhance your museum visit with QR-based object discovery, digital information and museum navigation.
          </p>
          <Link 
            to="/physical" 
            className="w-full sm:w-auto inline-flex justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            EXPLORE PHYSICAL MUSEUM
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ExperienceCards;
