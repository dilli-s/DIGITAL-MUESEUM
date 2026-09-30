/**
 * TurntableViewer — drag-to-rotate artifact viewer from multi-angle photos.
 *
 * Preloads ALL frames before enabling interaction so no frame ever appears
 * blurry or half-loaded mid-drag. Shows a skeleton loader until ready.
 * Supports mouse drag, touch drag, and pointer events.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

const TurntableViewer = ({ photos = [], className = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [error, setError] = useState(null);

  const imagesRef = useRef([]);        // preloaded Image objects
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const accumulatedDelta = useRef(0);  // sub-frame accumulator for smooth drag

  // ── Preload all frames ────────────────────────────────────────────────────
  useEffect(() => {
    if (!photos || photos.length === 0) {
      setError('No angle photos available for this artifact.');
      return;
    }

    setLoaded(false);
    setLoadProgress(0);
    setCurrentFrame(0);
    imagesRef.current = [];

    let loadedCount = 0;
    const total = photos.length;
    const images = photos.map((src, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / total) * 100));
        if (loadedCount === total) {
          setLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / total) * 100));
        if (loadedCount === total) setLoaded(true);
      };
      img.src = src;
      return img;
    });
    imagesRef.current = images;
  }, [photos]);

  // ── Draw current frame to canvas ──────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imagesRef.current[currentFrame];
    if (!img || !img.complete) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Match canvas size to image aspect ratio
    const maxW = canvas.parentElement?.clientWidth || 400;
    const aspect = img.naturalHeight / img.naturalWidth;
    canvas.width = maxW;
    canvas.height = Math.round(maxW * aspect);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [loaded, currentFrame]);

  // ── Pointer event handlers ────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (!loaded) return;
    isDragging.current = true;
    lastX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    accumulatedDelta.current = 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [loaded]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current || !loaded) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const dx = clientX - lastX.current;
    lastX.current = clientX;

    // pixels per frame — larger = slower rotation, smaller = faster
    const PIXELS_PER_FRAME = 8;
    accumulatedDelta.current += dx;

    const frameShift = Math.trunc(accumulatedDelta.current / PIXELS_PER_FRAME);
    if (frameShift !== 0) {
      accumulatedDelta.current -= frameShift * PIXELS_PER_FRAME;
      setCurrentFrame(prev => {
        const total = imagesRef.current.length;
        return ((prev - frameShift) % total + total) % total;
      });
    }
  }, [loaded]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  if (error) {
    return (
      <div className="turntable-error" style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
        <span>⚠ {error}</span>
      </div>
    );
  }

  return (
    <div className={`turntable-wrapper ${className}`} style={{ position: 'relative', userSelect: 'none' }}>
      {/* Skeleton / loading state */}
      {!loaded && (
        <div className="turntable-skeleton" style={{
          width: '100%',
          paddingBottom: '75%',
          background: 'linear-gradient(90deg, #17171A 0%, #201F23 50%, #17171A 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeletonShimmer 1.4s infinite',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(201, 162, 75, 0.2)', borderTopColor: '#C9A24B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#A8A6A0', fontSize: '0.75rem', fontFamily: '"Inter", sans-serif' }}>
              Loading {loadProgress}% · {photos.length} frames
            </span>
          </div>
        </div>
      )}

      {/* Canvas — always mounted to avoid re-creation, hidden until loaded */}
      <canvas
        ref={canvasRef}
        style={{
          display: loaded ? 'block' : 'none',
          width: '100%',
          height: 'auto',
          borderRadius: '12px',
          cursor: isDragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Drag hint */}
      {loaded && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.7rem',
          padding: '3px 10px',
          borderRadius: 20,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
          whiteSpace: 'nowrap',
        }}>
          ← Drag to rotate →
        </div>
      )}
    </div>
  );
};

export default TurntableViewer;
