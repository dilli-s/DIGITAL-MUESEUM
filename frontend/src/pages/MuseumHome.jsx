import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum } from '../services/api';
import MuseumNavigation from '../components/museum/MuseumNavigation';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import { MonitorPlay, Navigation, RefreshCw } from 'lucide-react';

const MuseumHome = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMuseum(museumId)
      .then(m => {
        setMuseum(m);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMuseum(null);
        setIsLoading(false);
      });
  }, [museumId]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
      </div>
    );
  }

  if (!museum) {
    return <MuseumNotFound />;
  }

  return (
    <div className="w-full">
      <MuseumNavigation museumId={museumId} />
      
      <section className="bg-neutral-900 text-white rounded-2xl p-12 mb-12 relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[500px]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black pointer-events-none"></div>
        
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <MonitorPlay className="w-10 h-10 text-neutral-300" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Virtual Museum Entrance</h1>
          <p className="text-xl text-neutral-400 mb-2">{museum.name}</p>
          <p className="text-neutral-500 max-w-xl mx-auto mb-10">
            Welcome to the virtual experience. Navigate through digital galleries, interact with 3D objects, and learn through curated stories.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              to={`/museum/${museumId}/galleries`} 
              className="inline-flex items-center justify-center rounded-md bg-white px-8 py-4 text-sm font-bold text-neutral-900 hover:bg-neutral-200 transition-colors"
            >
              <Navigation className="w-5 h-5 mr-2" />
              ENTER VIRTUAL GALLERIES
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MuseumHome;
