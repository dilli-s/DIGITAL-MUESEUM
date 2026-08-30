import React, { forwardRef } from 'react';
import { Headphones } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const AudioPlayer = forwardRef(({ audioSrc }, ref) => {
  if (!audioSrc) return null;

  return (
    <section className="mb-16 bg-neutral-50 rounded-2xl p-8 border border-neutral-200">
      <div className="flex items-center mb-6">
        <Headphones className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">Listen to the Object</h2>
      </div>
      <div className="w-full">
        {/* Placeholder for native audio player since mock URL won't play */}
        <audio 
          ref={ref}
          controls 
          className="w-full"
          src={getMediaUrl(audioSrc)}
          preload="metadata"
        >
          Your browser does not support the audio element.
        </audio>
        <p className="text-xs text-neutral-500 mt-2">Audio narration and descriptions.</p>
      </div>
    </section>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
