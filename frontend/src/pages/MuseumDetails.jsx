import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuseum, getGalleries, getCollections, getExhibitions } from '../services/api';

import MuseumHero from '../components/museum/MuseumHero';
import VirtualTourShowcase from '../components/museum/VirtualTourShowcase';
import MuseumDetailStats from '../components/museum/MuseumDetailStats';
import MuseumNavigation from '../components/museum/MuseumNavigation';
import FeaturedExhibition from '../components/museum/FeaturedExhibition';
import GalleryPreview from '../components/museum/GalleryPreview';
import CollectionPreview from '../components/museum/CollectionPreview';
import MuseumInformation from '../components/museum/MuseumInformation';
import MuseumNotFound from '../components/museum/MuseumNotFound';
import { RefreshCw, Landmark, ArrowRight } from 'lucide-react';

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
        <RefreshCw className="w-10 h-10 text-[#c89b3c] animate-spin mb-4" />
        <p className="text-lg text-[#d4c6b2] font-medium font-['Cinzel']">Loading Museum Archives...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <Landmark className="w-16 h-16 text-[#e57373] mb-6" />
        <h2 className="font-['Cinzel'] text-2xl font-bold text-[#fcf8f0] mb-2">{error}</h2>
        <p className="text-[#d4c6b2] mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchData}
          className="px-8 py-3 bg-[#c89b3c] text-[#0e0c0a] font-bold rounded-full hover:bg-[#dfb758] transition-colors uppercase tracking-wider text-xs"
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
    <div className="w-full flex flex-col gap-8 pb-16">
      <MuseumNavigation museumId={museumId} />
      
      <MuseumHero museum={museum} />
      
      <VirtualTourShowcase museumId={museumId} museumName={museum.name} />
      
      <section className="max-w-4xl p-6 sm:p-8 rounded-2xl bg-[#18130e] border border-[#382d1f] shadow-lg">
        <h2 className="font-['Cinzel'] text-xl sm:text-2xl font-bold text-[#fcf8f0] mb-3">
          About the Museum
        </h2>
        <p className="text-sm sm:text-base text-[#d4c6b2] leading-relaxed font-light">
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
        <CollectionPreview collections={collections} museumId={museumId} />
      )}

      <MuseumInformation museum={museum} />
      
      {/* Ready to Explore CTA */}
      <section className="py-12 sm:py-16 text-center border-t border-[#382d1f] mt-8 bg-[#18130e]/60 rounded-2xl p-6 sm:p-10">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-['Cinzel'] text-2xl sm:text-4xl font-bold text-[#fcf8f0] mb-3">
            Ready to Explore?
          </h2>
          <p className="font-['Cormorant_Garamond'] italic text-lg sm:text-xl text-[#d4c6b2] mb-6">
            Step inside the museum and discover its galleries, collections and objects.
          </p>
          <Link 
            to={`/museum/${museumId}/galleries`} 
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#dfb758] px-8 py-3.5 text-xs sm:text-sm font-semibold tracking-wider uppercase text-[#fff8ea] shadow-lg transition-all"
          >
            <span>Explore Galleries</span>
            <ArrowRight className="w-4 h-4 text-[#ffe6a4]" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MuseumDetails;
