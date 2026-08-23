import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

const MuseumNotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold mb-4 text-neutral-900">Museum Not Found</h1>
      <p className="text-neutral-600 mb-8 max-w-md">
        We couldn't find the museum you're looking for. It may have been removed or the ID is incorrect.
      </p>
      <Link 
        to="/museums" 
        className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
      >
        Back to Museums
      </Link>
    </div>
  );
};

export default MuseumNotFound;
