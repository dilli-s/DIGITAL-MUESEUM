import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getObject } from '../services/api';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import RelatedLearning from '../components/learning/RelatedLearning';
import { getMediaUrl } from '../utils/media';

const ObjectLearning = () => {
  const { objectId } = useParams();
  const [object, setObject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getObject(objectId)
      .then(setObject)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [objectId]);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-neutral-600 font-medium">Loading learning resources...</p>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="py-32 text-center">
        <h2 className="text-2xl font-bold mb-4">Object Not Found</h2>
        <Link to="/learning" className="text-sm font-semibold hover:underline">
          Back to Learning Hub
        </Link>
      </div>
    );
  }

  const objImgUrl = (object.image || object.image_url) ? getMediaUrl(object.image || object.image_url) : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Navigation */}
      <nav className="mb-8">
        <Link to={`/objects/${object.id}`} className="hover:text-neutral-900 transition-colors flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Object
        </Link>
      </nav>

      {/* Hero */}
      <div className="bg-neutral-900 text-white rounded-2xl p-8 md:p-12 mb-12 flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-1/3">
          {objImgUrl ? (
            <img src={objImgUrl} alt={object.name} className="w-full aspect-square object-cover rounded-xl" />
          ) : (
            <div className="w-full aspect-square bg-neutral-800 rounded-xl flex items-center justify-center">
              <span className="text-neutral-500">No image</span>
            </div>
          )}
        </div>
        <div className="w-full md:w-2/3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Learn About</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{object.name}</h1>
          <p className="text-lg text-neutral-300">
            Explore the history, meaning and stories behind this object through interactive learning materials.
          </p>
        </div>
      </div>

      <RelatedLearning objectId={object.id} />
    </div>
  );
};

export default ObjectLearning;
