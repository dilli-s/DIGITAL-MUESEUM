import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

const ObjectLocation = ({ museum, gallery }) => {
  if (!museum || !gallery) return null;

  return (
    <section className="mb-16 bg-neutral-900 text-white rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-start">
        <div className="bg-neutral-800 p-3 rounded-full mr-6 hidden sm:block">
          <MapPin className="w-8 h-8 text-neutral-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Where to Find This Object</h2>
          <div className="space-y-2 text-neutral-300">
            <p><span className="text-neutral-500 w-20 inline-block">Museum:</span> <span className="font-medium text-white">{museum.name}</span></p>
            <p><span className="text-neutral-500 w-20 inline-block">Gallery:</span> <span className="font-medium text-white">{gallery.name}</span></p>
            <p><span className="text-neutral-500 w-20 inline-block">Location:</span> Floor 1 (Demo)</p>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        <Link 
          to={`/museum/${museum.id}/gallery/${gallery.id}`}
          className="inline-flex justify-center w-full sm:w-auto rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
        >
          VIEW GALLERY
        </Link>
      </div>
    </section>
  );
};

export default ObjectLocation;
