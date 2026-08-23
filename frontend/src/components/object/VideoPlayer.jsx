import React from 'react';
import { PlayCircle } from 'lucide-react';

const VideoPlayer = ({ videoSrc }) => {
  if (!videoSrc) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center mb-6">
        <PlayCircle className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">Watch</h2>
      </div>
      <div className="relative bg-neutral-900 rounded-2xl overflow-hidden aspect-video border border-neutral-200 shadow-sm flex items-center justify-center">
        {/* Placeholder for video */}
        <video 
          controls 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          preload="metadata"
        >
          <source src={videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <PlayCircle className="w-16 h-16 text-white opacity-50" />
        </div>
      </div>
    </section>
  );
};

export default VideoPlayer;
