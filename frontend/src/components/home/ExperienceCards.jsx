import React from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Smartphone } from 'lucide-react';

const ExperienceCards = () => {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Explore Online or on Mobile</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
          <div className="w-10 h-10 sm:w-16 sm:h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3 sm:mb-6">
            <Monitor className="w-5 h-5 sm:w-8 sm:h-8 text-neutral-700" />
          </div>
          <h3 className="text-sm sm:text-2xl font-semibold mb-2 sm:mb-4 text-neutral-900">Virtual Museum</h3>
          <p className="text-[11px] leading-relaxed sm:text-base text-neutral-600 mb-4 sm:mb-8 flex-grow">
            Explore museum collections from anywhere. Browse galleries, discover objects and experience digital exhibits online.
          </p>
          <Link 
            to="/museums" 
            className="w-full inline-flex justify-center rounded-md bg-neutral-900 px-2 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            EXPLORE VIRTUAL
          </Link>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
          <div className="w-10 h-10 sm:w-16 sm:h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3 sm:mb-6">
            <Smartphone className="w-5 h-5 sm:w-8 sm:h-8 text-neutral-700" />
          </div>
          <h3 className="text-sm sm:text-2xl font-semibold mb-2 sm:mb-4 text-neutral-900">Mobile Application</h3>
          <p className="text-[11px] leading-relaxed sm:text-base text-neutral-600 mb-4 sm:mb-8 flex-grow">
            Visiting in person? Use our Flutter mobile app for QR object discovery, interactive indoor floor plans, and step-by-step tour navigation.
          </p>
          <div className="w-full inline-flex justify-center items-center rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-sm font-semibold">
            EXPLORE ON MOBILE APP
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExperienceCards;
