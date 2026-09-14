import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { X, Play, Pause, SkipForward, ChevronRight, Info, Music, Video, Box, Calendar, MapPin } from 'lucide-react';
import '@google/model-viewer';

export default function ObjectInfoSheet({ object, onClose }) {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && object?.audio_url) {
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current.currentTime);
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      });
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    }
  }, [object]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 15;
    }
  };

  const handleScroll = (e) => {
    setIsScrolled(e.target.scrollTop > 50);
  };

  const handleExploreMore = () => {
    navigate(`/objects/${object.id}/explore`);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!object) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 pointer-events-auto transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Sheet Content */}
      <div className="relative w-full max-w-md h-[92vh] bg-surface rounded-t-3xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-bottom-[100%] duration-[260ms] ease-out">
        
        {/* Top Handle / Close Button */}
        <div className={`absolute top-0 left-0 right-0 z-20 flex justify-end p-4 transition-colors ${isScrolled ? 'bg-surface/90 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
          <button onClick={onClose} className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-32" onScroll={handleScroll}>
          {/* Hero Section (Collapses on Scroll visually via sticky/relative pushing) */}
          {object.glb_model_url ? (
            <div className="relative w-full h-[40vh] bg-neutral-900 shrink-0">
              <model-viewer 
                src={getMediaUrl(object.glb_model_url)}
                camera-controls 
                auto-rotate 
                shadow-intensity="1"
                style={{ width: '100%', height: '100%' }}
              ></model-viewer>
            </div>
          ) : object.image_url ? (
            <div className="relative w-full h-[40vh] shrink-0">
              <img src={getMediaUrl(object.image_url)} alt={object.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-90" />
            </div>
          ) : (
            <div className="w-full h-[15vh] shrink-0" />
          )}

          {/* Content Cards */}
          <div className="px-6 space-y-6 relative z-10 -mt-16">
            
            {/* Title Card */}
            <div className="bg-surface-elevated rounded-2xl p-6 shadow-xl border border-white/5">
              <h1 className="text-2xl font-serif font-bold text-text-primary mb-1">{object.title}</h1>
              {object.local_name && <p className="text-sm font-medium text-text-secondary italic mb-1">{object.local_name}</p>}
              {object.scientific_name && <p className="text-xs text-text-secondary opacity-75">{object.scientific_name}</p>}
            </div>

            {/* Meta Data Card */}
            {(object.creation_date || object.origin_location) && (
              <div className="flex items-center gap-4 text-sm text-text-secondary bg-surface border border-white/5 rounded-2xl p-4">
                {object.creation_date && (
                  <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-accent" /> {object.creation_date}</div>
                )}
                {object.origin_location && (
                  <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-accent" /> {object.origin_location}</div>
                )}
              </div>
            )}

            {/* Description */}
            {object.description && (
              <div className="bg-surface-elevated rounded-2xl p-6 shadow-md border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">Description</h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                  {object.description}
                </p>
              </div>
            )}

            {/* Significance */}
            {object.significance && (
              <div className="bg-surface-elevated rounded-2xl p-6 shadow-md border border-white/5">
                <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide mb-3">Cultural Significance</h3>
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                  {object.significance}
                </p>
              </div>
            )}

            {/* Interesting Facts */}
            {object.facts && object.facts.length > 0 && (
              <div className="bg-surface-elevated rounded-2xl p-6 shadow-md border border-white/5">
                <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide mb-3">Interesting Facts</h3>
                <ul className="list-disc list-outside ml-4 space-y-2 text-sm text-text-secondary">
                  {object.facts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Video embed */}
            {object.video_url && (
              <div className="bg-surface-elevated rounded-2xl p-6 shadow-md border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">Watch</h3>
                </div>
                <video controls className="w-full rounded-xl" src={getMediaUrl(object.video_url)} />
              </div>
            )}

            {/* 3D Model Fallback (if not used as hero) */}
            {object.glb_model_url && object.image_url && (
               <div className="bg-surface-elevated rounded-2xl p-6 shadow-md border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <Box className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">Interactive 3D</h3>
                </div>
                <div className="w-full h-64 rounded-xl overflow-hidden bg-neutral-900">
                  <model-viewer 
                    src={getMediaUrl(object.glb_model_url)}
                    camera-controls 
                    auto-rotate 
                    style={{ width: '100%', height: '100%' }}
                  ></model-viewer>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Sticky Audio Scrubber & CTA Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-surface-elevated/95 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
          
          {object.audio_url && (
            <div className="mb-4">
              <audio ref={audioRef} src={getMediaUrl(object.audio_url)} preload="metadata" className="hidden" />
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-bg flex-shrink-0 transition-transform active:scale-95">
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary mb-1">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-text-primary font-bold">Audio Guide</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
                    if (audioRef.current) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      audioRef.current.currentTime = (x / rect.width) * duration;
                    }
                  }}>
                    <div className="absolute top-0 left-0 h-full bg-accent transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <button onClick={skipForward} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <button onClick={handleExploreMore} className="w-full py-4 rounded-xl bg-surface border border-white/10 text-text-primary font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors active:scale-[0.98]">
            Explore More <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

      </div>
    </div>
  );
}
