import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getObject, getMuseum, getGallery } from '../services/api';
import { ChevronRight, ArrowLeft, RefreshCw, LayoutDashboard } from 'lucide-react';
import BookmarkButton from '../components/common/BookmarkButton';

import ObjectHero from '../components/object/ObjectHero';
import ObjectInfo from '../components/object/ObjectInfo';
import ObjectFacts from '../components/object/ObjectFacts';
import ImageGallery from '../components/object/ImageGallery';
import AudioPlayer from '../components/object/AudioPlayer';
import VideoPlayer from '../components/object/VideoPlayer';
import ModelViewer from '../components/object/ModelViewer';
import ObjectLocation from '../components/object/ObjectLocation';
import RelatedObjects from '../components/object/RelatedObjects';

const ObjectDetails = () => {
  const { objectId } = useParams();
  const audioRef = useRef(null);
  
  const [object, setObject] = useState(null);
  const [museum, setMuseum] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [relatedObjects, setRelatedObjects] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    
    try {
      const obj = await getObject(objectId);
      setObject(obj);
      
      // Fetch related entities if they exist
      if (obj.museumId) {
        try {
          const m = await getMuseum(obj.museumId);
          setMuseum(m);
        } catch (e) {
          console.error("Failed to load museum for object", e);
        }
      }
      
      if (obj.galleryId) {
        try {
          const g = await getGallery(obj.galleryId);
          setGallery(g);
        } catch (e) {
          console.error("Failed to load gallery for object", e);
        }
      }
      
      // Note: Full related objects implementation left for future phase, 
      // but we can pass an empty array or handle mock data if we want
      setRelatedObjects([]);
      
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setNotFound(true);
      } else {
        setError("Unable to load object.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [objectId]);

  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio playback prevented', e));
      audioRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading object...</p>
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

  if (notFound || !object) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Object Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">
          The object you're looking for could not be found.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/museums" 
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Back to Museums
          </Link>
          <Link 
            to="/scan"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Scan Another Object
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      {museum && (
        <nav className="flex text-sm text-neutral-500 mb-6" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2">
            <li className="inline-flex items-center">
              <Link to="/" className="hover:text-neutral-900 transition-colors hidden sm:block">Home</Link>
              <ChevronRight className="w-4 h-4 mx-1 hidden sm:block" />
            </li>
            <li className="inline-flex items-center">
              <Link to={`/museums/${museum.id}`} className="hover:text-neutral-900 transition-colors truncate max-w-[80px] sm:max-w-[120px]">{museum.name}</Link>
              <ChevronRight className="w-4 h-4 mx-1" />
            </li>
            {gallery && (
              <li>
                <div className="flex items-center">
                  <Link to={`/museum/${museum.id}/gallery/${gallery.id}`} className="hover:text-neutral-900 transition-colors truncate max-w-[100px] sm:max-w-[150px]">{gallery.name}</Link>
                  <ChevronRight className="w-4 h-4 mx-1" />
                </div>
              </li>
            )}
            <li>
              <div className="flex items-center">
                <span className="text-neutral-900 font-medium truncate max-w-[120px] sm:max-w-[200px]">{object.name}</span>
              </div>
            </li>
          </ol>
          <div className="ml-auto pl-4">
            <BookmarkButton contentType="object" contentId={object.id} />
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <ObjectHero objectData={object} onPlayAudio={handlePlayAudio} />

      {/* Info & Description */}
      <div className="grid lg:grid-cols-3 gap-12 mb-16">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">About This Object</h2>
          <p className="text-neutral-700 leading-relaxed text-lg mb-10">
            {object.longDescription || object.description}
          </p>

          {object.significance && (
            <>
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">Historical & Cultural Significance</h2>
              <p className="text-neutral-700 leading-relaxed text-lg">
                {object.significance}
              </p>
            </>
          )}
        </div>
        <div className="lg:col-span-1">
          <ObjectInfo objectData={object} />
        </div>
      </div>

      {/* Media & Content Sections */}
      {object.interestingFacts && object.interestingFacts.length > 0 && (
        <ObjectFacts facts={object.interestingFacts} />
      )}
      
      {object.images && object.images.length > 0 && (
        <ImageGallery images={object.images} />
      )}
      
      {object.audio && (
        <AudioPlayer audioSrc={object.audio} ref={audioRef} />
      )}
      
      {object.video && (
        <VideoPlayer videoSrc={object.video} />
      )}
      
      {object.model3d && (
        <ModelViewer modelSrc={object.model3d} />
      )}

      {museum && (
        <ObjectLocation museum={museum} gallery={gallery} />
      )}
      
      {relatedObjects.length > 0 && (
        <RelatedObjects relatedObjects={relatedObjects} />
      )}

      {/* Object Navigation */}
      <section className="py-8 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        {museum && gallery ? (
          <div className="flex gap-4">
            <Link 
              to={`/museum/${museum.id}/gallery/${gallery.id}`}
              className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gallery
            </Link>
            <Link 
              to="/scan"
              className="inline-flex items-center text-sm font-semibold text-neutral-500 hover:text-neutral-900 hover:underline ml-4"
            >
              Scan Another Object
            </Link>
          </div>
        ) : (
          <Link 
            to="/scan"
            className="inline-flex items-center text-sm font-semibold text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            Scan Another Object
          </Link>
        )}
        
        <div className="flex gap-4">
          <Link 
            to={`/objects/${object.id}/learn`}
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-4 text-sm font-bold text-neutral-900 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            LEARN MORE
          </Link>
          <Link 
            to={`/objects/${object.id}/explore`}
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-8 py-4 text-sm font-bold text-white hover:bg-neutral-800 transition-colors shadow-sm"
          >
            EXPLORE MORE
          </Link>
        </div>
      </section>

    </div>
  );
};

export default ObjectDetails;
