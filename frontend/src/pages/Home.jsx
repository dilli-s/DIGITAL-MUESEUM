import React, { useState, useEffect } from 'react';
import HeroSection from '../components/home/HeroSection';
import ExperienceCards from '../components/home/ExperienceCards';
import FeaturedMuseums from '../components/home/FeaturedMuseums';
import CollectionCategories from '../components/home/CollectionCategories';
import FeaturedExhibitions from '../components/home/FeaturedExhibitions';
import HowItWorks from '../components/home/HowItWorks';
import LocationMuseumFinder from '../components/home/LocationMuseumFinder';
import MuseumAccessHub from '../components/home/MuseumAccessHub';
import { getMuseums } from '../services/api';

const Home = () => {
  const [allMuseums, setAllMuseums] = useState([]);
  const [heroLocation, setHeroLocation] = useState(null);
  const [heroSearch, setHeroSearch] = useState('');

  useEffect(() => {
    getMuseums({ per_page: 50 })
      .then(res => setAllMuseums(res.data || []))
      .catch(console.error);
  }, []);

  const handleHeroLocationDetect = (coords) => {
    setHeroLocation(coords);
  };

  const handleHeroSearch = (query) => {
    setHeroSearch(query);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Full-Bleed Grand Hero Section */}
      <HeroSection
        onLocationDetect={handleHeroLocationDetect}
        onSearch={handleHeroSearch}
      />

      {/* Main Warm Parchment Heritage Section */}
      <section className="relative w-full parchment-bg py-8 sm:py-12">
        {/* Subtle Antique Motif */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none bg-repeat"
          style={{
            backgroundImage: `radial-gradient(circle at center, #241a10 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex flex-col gap-10 sm:gap-14">
          {/* Dual Experience Cards: Physical vs Virtual */}
          <ExperienceCards />

          {/* Featured Museums Grid */}
          <FeaturedMuseums />

          {/* Featured Collections Gallery */}
          <CollectionCategories />

          {/* Interactive Museum Finder & Distance Explorer */}
          <div id="museum-finder" className="w-full">
            <LocationMuseumFinder
              allMuseums={allMuseums}
              initialLocation={heroLocation}
              initialSearch={heroSearch}
            />
          </div>

          {/* Exhibitions, Guides & Hub */}
          <FeaturedExhibitions userLocation={heroLocation} />
          <HowItWorks />
          <MuseumAccessHub />
        </div>
      </section>
    </div>
  );
};

export default Home;
