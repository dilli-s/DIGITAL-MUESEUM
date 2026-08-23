import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getGalleries, getCollections, getExhibitions } from '../services/api';

import MuseumHero from '../components/museum/MuseumHero';
import MuseumDetailStats from '../components/museum/MuseumDetailStats';
import MuseumNavigation from '../components/museum/MuseumNavigation';
import FeaturedExhibition from '../components/museum/FeaturedExhibition';
import GalleryPreview from '../components/museum/GalleryPreview';
import CollectionPreview from '../components/museum/CollectionPreview';
import MuseumInformation from '../components/museum/MuseumInformation';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import { RefreshCw, LayoutDashboard } from 'lucide-react';

const MuseumDetails = () => {
  const { museumId } = useParams();
  
  const [museum, setMuseum] = useState(null);
  const [galleries, setGalleries] = useState([]);
  const [collections, setCollections] = useState([]);
  const [featuredExhibition, setFeaturedExhibition] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const m = await getMuseum(museumId);
      setMuseum(m);

      // Fetch related data in parallel
      const [gRes, cRes, eRes] = await Promise.all([
        getGalleries({ museum_id: museumId, per_page: 5 }),
        getCollections({ museum_id: museumId, per_page: 5 }),
        getExhibitions({ museum_id: museumId, featured: 'true', per_page: 1 })
      ]);

      setGalleries(gRes.data || []);
      setCollections(cRes.data || []);
      setFeaturedExhibition(eRes.data && eRes.data.length > 0 ? eRes.data[0] : null);

    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setMuseum(null);
      } else {
        setError("Unable to load museum details.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading museum details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <LayoutDashboard className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <p className="text-neutral-500 mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchData}
          className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  if (!museum) {
    return <MuseumNotFound />;
  }

  return (
    <div className="w-full">
      <MuseumNavigation museumId={museumId} />
      
      <MuseumHero museum={museum} />
      
      <section className="mb-12 max-w-4xl">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">About the Museum</h2>
        <p className="text-neutral-600 leading-relaxed text-lg">
          {museum.longDescription || museum.description}
        </p>
      </section>

      <MuseumDetailStats museum={museum} />
      
      {featuredExhibition && (
        <FeaturedExhibition exhibition={featuredExhibition} museumId={museumId} />
      )}
      
      {galleries.length > 0 && (
        <GalleryPreview galleries={galleries} museumId={museumId} />
      )}
      
      {collections.length > 0 && (
        <CollectionPreview collections={collections} />
      )}
      
      <MuseumInformation museum={museum} />
      
      <section className="py-20 text-center border-t border-neutral-200 mt-12">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 mb-4">Ready to Explore?</h2>
          <p className="text-lg text-neutral-600 mb-8">
            Step inside the museum and discover its galleries, collections and objects.
          </p>
          <Link 
            to={`/museum/${museumId}/galleries`} 
            className="inline-flex justify-center rounded-md bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800 transition-colors shadow-sm"
          >
            EXPLORE GALLERIES
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MuseumDetails;
