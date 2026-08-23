import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';

const GalleryPreview = ({ galleries, museumId }) => {
  if (!galleries || galleries.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">Explore Galleries</h2>
        <Link to={`/museum/${museumId}/galleries`} className="text-sm font-semibold text-neutral-900 hover:underline hidden sm:block">
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {galleries.slice(0, 3).map((gallery) => (
          <div key={gallery.id} className="group bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
            <div className="h-40 bg-neutral-100 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
               <ImageIcon className="w-12 h-12 text-neutral-300" />
            </div>
            <div className="p-5 flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-neutral-900 mb-2">{gallery.name}</h3>
              <p className="text-neutral-600 text-sm mb-4 flex-grow line-clamp-2">
                {gallery.description}
              </p>
              <div className="flex items-center text-xs font-medium text-neutral-500 mb-4">
                <span>{gallery.objectCount} Objects</span>
              </div>
              <Link 
                to={`/museum/${museumId}/galleries`} 
                className="w-full inline-flex justify-center rounded-md bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-900 border border-neutral-200 hover:bg-neutral-100 transition-colors mt-auto"
              >
                PREVIEW
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 sm:hidden text-center">
        <Link to={`/museum/${museumId}/galleries`} className="text-sm font-semibold text-neutral-900 hover:underline">
          View all galleries <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
};

export default GalleryPreview;
