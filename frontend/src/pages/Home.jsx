import React, { useState, useEffect, useRef } from 'react';
import HeroSection from '../components/home/HeroSection';
import ExperienceCards from '../components/home/ExperienceCards';
import FeaturedMuseums from '../components/home/FeaturedMuseums';
import FeaturedExhibitions from '../components/home/FeaturedExhibitions';
import CollectionCategories from '../components/home/CollectionCategories';
import PhysicalExperience from '../components/home/PhysicalExperience';
import HowItWorks from '../components/home/HowItWorks';
import DiscoverySection from '../components/home/DiscoverySection';
import FinalCTA from '../components/home/FinalCTA';
import LocationMuseumFinder from '../components/home/LocationMuseumFinder';
import MuseumAccessHub from '../components/home/MuseumAccessHub';
import FloatingMuseumAccess from '../components/home/FloatingMuseumAccess';
import { getMuseums } from '../services/api';

const Home = () => {
  const [allMuseums, setAllMuseums] = useState([]);
  const [heroLocation, setHeroLocation] = useState(null); // {lat, lng} from hero
  const [heroSearch, setHeroSearch] = useState('');       // search term from hero

  useEffect(() => {
    getMuseums({ per_page: 50 })
      .then(res => setAllMuseums(res.data || []))
      .catch(console.error);
  }, []);

  // Called when the hero "Use My Location" button succeeds
  const handleHeroLocationDetect = (coords) => {
    setHeroLocation(coords);
  };

  // Called when the hero search form is submitted
  const handleHeroSearch = (query) => {
    setHeroSearch(query);
  };

  return (
    <div className="flex flex-col w-full">
      <HeroSection
        onLocationDetect={handleHeroLocationDetect}
        onSearch={handleHeroSearch}
      />
      <ExperienceCards />

      {/* Museum Finder anchored for scroll-to target */}
      <div id="museum-finder">
        <LocationMuseumFinder
          allMuseums={allMuseums}
          initialLocation={heroLocation}
          initialSearch={heroSearch}
        />
      </div>

      <FeaturedMuseums />
      <FeaturedExhibitions />
      <CollectionCategories />
      <PhysicalExperience />
      <HowItWorks />
      <DiscoverySection />
      <MuseumAccessHub />
      <FinalCTA />
      <FloatingMuseumAccess />
    </div>
  );
};

export default Home;
