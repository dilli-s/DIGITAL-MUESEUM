import React, { useState, useEffect, useRef } from 'react';
import { PlayCircle, Pause, Volume2, Film } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

const VideoPlayer = ({ videoSrc, objectImage }) => {
  if (!videoSrc) return null;

  // Check if the source is a JSON metadata file (narrated slideshow)
  const isNarratedSlideshow = videoSrc && videoSrc.endsWith('.json');

  if (isNarratedSlideshow) {
    return <NarratedSlideshowPlayer metadataUrl={videoSrc} fallbackImage={objectImage} />;
  }

  // Standard video player for regular video files
  return (
    <section className="mb-16">
      <div className="flex items-center mb-6">
        <PlayCircle className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">Watch</h2>
      </div>
      <div className="relative bg-neutral-900 rounded-2xl overflow-hidden aspect-video border border-neutral-200 shadow-sm flex items-center justify-center">
        <video 
          controls 
          className="absolute inset-0 w-full h-full object-cover"
          preload="metadata"
        >
          <source src={getMediaUrl(videoSrc)} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </section>
  );
};


/**
 * A cinematic narrated slideshow player that combines:
 * - The artifact image as a visual backdrop
 * - AI-generated audio narration
 * - Scrolling narration text overlay
 */
const NarratedSlideshowPlayer = ({ metadataUrl, fallbackImage }) => {
  const [metadata, setMetadata] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Fetch the video metadata JSON
    const fetchMeta = async () => {
      try {
        const url = getMediaUrl(metadataUrl);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load video metadata');
        const data = await res.json();
        setMetadata(data);
      } catch (e) {
        console.error('VideoPlayer metadata fetch error:', e);
        setError(true);
      }
    };
    fetchMeta();
  }, [metadataUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.log('Playback prevented', e));
      setIsPlaying(true);
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
  };

  if (error || !metadata) {
    if (error) return null;
    // Loading state
    return (
      <section className="mb-16">
        <div className="flex items-center mb-6">
          <Film className="w-6 h-6 text-neutral-900 mr-3" />
          <h2 className="text-2xl font-bold text-neutral-900">AI Video Experience</h2>
        </div>
        <div className="bg-neutral-100 rounded-2xl aspect-video flex items-center justify-center">
          <div className="animate-pulse text-neutral-400">Loading video experience...</div>
        </div>
      </section>
    );
  }

  const imageUrl = metadata.image_url || fallbackImage;
  const audioUrl = metadata.audio_url;
  const narrationText = metadata.narration_text;

  return (
    <section className="mb-16">
      <div className="flex items-center mb-6">
        <Film className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">AI Video Experience</h2>
      </div>

      <div className="relative bg-neutral-900 rounded-2xl overflow-hidden aspect-video border border-neutral-200 shadow-lg group cursor-pointer" onClick={togglePlay}>
        {/* Background Image with Ken Burns effect */}
        {imageUrl && (
          <img
            src={getMediaUrl(imageUrl)}
            alt="Artifact"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-linear ${isPlaying ? 'scale-110' : 'scale-100'}`}
          />
        )}

        {/* Cinematic overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20"></div>

        {/* Play/Pause button */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {!isPlaying ? (
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all border border-white/30">
              <PlayCircle className="w-12 h-12 text-white" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-white/20">
              <Pause className="w-10 h-10 text-white" />
            </div>
          )}
        </div>

        {/* Narration text overlay */}
        {narrationText && (
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
            <div className={`transition-all duration-700 ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-2'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className={`w-4 h-4 text-white/70 ${isPlaying ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">AI Narration</span>
              </div>
              <p className="text-white/90 text-sm md:text-base leading-relaxed max-w-3xl line-clamp-4">
                {narrationText}
              </p>
            </div>
          </div>
        )}

        {/* Hidden audio element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={getMediaUrl(audioUrl)}
            preload="metadata"
            onEnded={handleAudioEnd}
          />
        )}
      </div>

      <p className="text-xs text-neutral-400 text-center mt-2">
        Click to {isPlaying ? 'pause' : 'play'} the AI-narrated exhibition video
      </p>
    </section>
  );
};

export default VideoPlayer;
