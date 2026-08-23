import React from 'react';
import { Link } from 'react-router-dom';
import { Building, MonitorPlay, QrCode } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative bg-neutral-900 text-white overflow-hidden rounded-2xl my-6">
      {/* Abstract background gradient placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      </div>
      
      <div className="relative z-10 px-6 py-24 sm:py-32 lg:px-8 text-center max-w-4xl mx-auto">
        <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase mb-4">Digital Museum</h2>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl text-white">
          Explore History. Discover Culture. Experience Museums Anywhere.
        </h1>
        <p className="mt-6 text-lg leading-8 text-neutral-300">
          Explore museum collections digitally or enhance your physical museum visit with interactive guides, exhibits and stories.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6 flex-wrap gap-y-4">
          <Link
            to="/museums"
            className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white flex items-center gap-2"
          >
            <Building className="w-4 h-4" />
            EXPLORE MUSEUMS
          </Link>
          <Link
            to="/museum/1"
            className="rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-neutral-500 hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <MonitorPlay className="w-4 h-4" />
            VIRTUAL MUSEUM
          </Link>
          <Link
            to="/physical"
            className="text-sm font-semibold leading-6 text-white hover:text-neutral-300 transition-colors flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            VISIT PHYSICAL MUSEUM <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
