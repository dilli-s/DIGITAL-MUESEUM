import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const ObjectCard = ({ objectData }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const rawImage = objectData.image || objectData.image_url || (objectData.images && objectData.images[0]);
  const imageUrl = rawImage ? getMediaUrl(rawImage) : null;

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
      <div className="h-40 bg-neutral-100 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        {imageUrl && !imageFailed ? (
          <img 
            src={imageUrl} 
            alt={objectData.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-200 flex items-center justify-center text-neutral-400">
             <ImageIcon className="w-8 h-8 text-neutral-400" />
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-neutral-900 mb-1 line-clamp-1">{objectData.name}</h3>
        <p className="text-xs text-neutral-500 mb-3">{objectData.period} • {objectData.origin}</p>
        <p className="text-neutral-600 text-sm mb-4 flex-grow line-clamp-2">
          {objectData.shortDescription}
        </p>
        <Link 
          to={`/objects/${objectData.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-100 transition-colors mt-auto"
        >
          VIEW OBJECT
        </Link>
      </div>
    </div>
  );
};

export default ObjectCard;
