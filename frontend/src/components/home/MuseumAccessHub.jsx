import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MonitorPlay, MapPin, QrCode, Navigation, ChevronRight, Building2 } from 'lucide-react';
import { getMuseums } from '../../services/api';

const MuseumAccessHub = () => {
  const [museums, setMuseums] = useState([]);

  useEffect(() => {
    getMuseums({ per_page: 6 })
      .then(res => setMuseums(res.data || []))
      .catch(console.error);
  }, []);

  return (
    <section className="py-20">
      {/* Section Header */}
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-1.5 bg-neutral-100 text-neutral-600 text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
          Start Exploring
        </span>
        <h2 className="text-4xl font-bold tracking-tight text-neutral-900 mb-3">
          Choose Your Museum Experience
        </h2>
        <p className="text-lg text-neutral-500 max-w-xl mx-auto">
          Explore the world's culture digitally from your screen, or use our Flutter mobile app for on-site interactive visits.
        </p>
      </div>

      {/* Two Primary Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">

        {/* Virtual Museum Card */}
        <div className="group relative bg-neutral-900 text-white rounded-3xl overflow-hidden shadow-xl">
          {/* Decorative grid background */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-neutral-900/30 to-neutral-900" />

          <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full min-h-[400px]">
            <div className="flex-grow">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 ring-1 ring-white/20">
                <MonitorPlay className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-3">Virtual Museum</h3>
              <p className="text-neutral-400 text-base leading-relaxed mb-6 max-w-sm">
                Browse galleries, explore 3D objects, read stories, and experience curated exhibitions — all from anywhere in the world.
              </p>
              <ul className="space-y-2 mb-8">
                {['Browse all galleries & collections', 'View 3D objects & media', 'Read cultural stories & facts', 'Save favourites & track progress'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-neutral-300">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/museums"
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-neutral-900 font-bold rounded-xl hover:bg-neutral-100 transition-all group-hover:shadow-lg text-sm"
              >
                <Building2 className="w-4 h-4" />
                Browse All Museums
                <ChevronRight className="w-4 h-4" />
              </Link>
              {museums.length > 0 && (
                <Link
                  to={`/museum/${museums[0].id}`}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm ring-1 ring-white/20"
                >
                  Enter Museum
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Flutter Mobile App Card */}
        <div className="group relative bg-gradient-to-br from-stone-800 to-stone-950 text-white rounded-3xl overflow-hidden shadow-xl">
          {/* Decorative dots */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-stone-900/30 to-stone-950" />

          <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full min-h-[400px]">
            <div className="flex-grow">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 ring-1 ring-white/20">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-3">Flutter Mobile App</h3>
              <p className="text-neutral-400 text-base leading-relaxed mb-6 max-w-sm">
                Visiting in person? Use our Flutter mobile application for interactive on-site QR checkpoint scanning, indoor maps, and turn-by-turn routing.
              </p>
              <ul className="space-y-2 mb-8">
                {['Scan QR codes on museum exhibits', 'Turn-by-turn indoor map navigation', 'Audio guides with speed & language control', 'Offline capability during your visit'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-neutral-300">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-neutral-900 font-bold rounded-xl text-sm shadow-sm">
                <Navigation className="w-4 h-4" />
                Available on Mobile (Flutter)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Museum Links Strip */}
      {museums.length > 0 && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-widest">Quick Access — Museums</h4>
            <Link to="/museums" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {museums.map(museum => (
              <Link
                key={museum.id}
                to={`/museum/${museum.id}`}
                className="group flex flex-col items-center text-center p-3 bg-white rounded-xl border border-neutral-200 hover:border-neutral-900 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-neutral-900 transition-colors">
                  <Building2 className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-semibold text-neutral-700 group-hover:text-neutral-900 line-clamp-2 leading-tight">
                  {museum.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MuseumAccessHub;
