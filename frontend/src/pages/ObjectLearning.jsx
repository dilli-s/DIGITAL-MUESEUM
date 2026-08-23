import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getObject } from '../services/api';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import RelatedLearning from '../components/learning/RelatedLearning';

const ObjectLearning = () => {
  const { objectId } = useParams();
  const [object, setObject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchObj = async () => {
      try {
        const obj = await getObject(objectId);
        setObject(obj);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchObj();
  }, [objectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Object Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">The object you're looking for could not be found.</p>
        <Link to="/learning" className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
          Back to Learning
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-8" aria-label="Breadcrumb">
        <Link to={`/objects/${object.id}`} className="hover:text-neutral-900 transition-colors flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Object
        </Link>
      </nav>

      {/* Hero */}
      <div className="bg-neutral-900 text-white rounded-2xl p-8 md:p-12 mb-12 flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-1/3">
          {object.image ? (
            <img src={object.image} alt={object.name} className="w-full aspect-square object-cover rounded-xl" />
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
