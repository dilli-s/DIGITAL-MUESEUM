import React from 'react';
import HeroSection from '../components/home/HeroSection';
import ExperienceCards from '../components/home/ExperienceCards';
import FeaturedMuseums from '../components/home/FeaturedMuseums';
import FeaturedExhibitions from '../components/home/FeaturedExhibitions';
import CollectionCategories from '../components/home/CollectionCategories';
import PhysicalExperience from '../components/home/PhysicalExperience';
import HowItWorks from '../components/home/HowItWorks';
import DiscoverySection from '../components/home/DiscoverySection';
import FinalCTA from '../components/home/FinalCTA';

const Home = () => {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <ExperienceCards />
      <FeaturedMuseums />
      <FeaturedExhibitions />
      <CollectionCategories />
      <PhysicalExperience />
      <HowItWorks />
      <DiscoverySection />
      <FinalCTA />
    </div>
  );
};

export default Home;
