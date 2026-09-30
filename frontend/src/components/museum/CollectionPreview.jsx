import React from 'react';
import { Layers } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';
import { Link } from 'react-router-dom';

const CollectionPreview = ({ collections, museumId }) => {
  if (!collections || collections.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Explore Collections</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {collections.map((collection) => {
          const rawImg = collection.image_url || collection.image;
          const imgUrl = rawImg ? getMediaUrl(rawImg) : null;
          return (
            <Link key={collection.id} to={`/museum/${museumId}/collection/${collection.id}`} className="bg-neutral-50 rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-900 transition-colors flex flex-col items-center text-center group">
              <div className="w-full h-28 bg-neutral-200 relative overflow-hidden flex items-center justify-center">
                {imgUrl ? (
                  <img 
                    src={imgUrl} 
                    alt={collection.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 bg-neutral-100 flex items-center justify-center ${imgUrl ? 'hidden' : ''}`}>
                  <Layers className="w-8 h-8 text-neutral-400" />
                </div>
              </div>
              <div className="p-4 flex flex-col items-center">
                <h3 className="font-semibold text-neutral-900 mb-1">{collection.name}</h3>
                <span className="text-xs text-neutral-500">{collection.objectCount ?? collection.object_count ?? 0} {(collection.objectCount ?? collection.object_count) === 1 ? 'Object' : 'Objects'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default CollectionPreview;
