/**
 * VirtualTour — Google Street View-style indoor panorama tour.
 *
 * Uses Photo Sphere Viewer (PSV) with:
 * - EquirectangularTilesAdapter for full-res panoramas
 * - MarkersPlugin for ground-plane directional arrows and artifact info hotspots
 * - GyroscopePlugin for mobile device-orientation look-around
 *
 * Key architecture decisions:
 * - PSV instance is never unmounted/remounted between rooms — only its
 *   panorama is smoothly transitioned with WebGL fade.
 * - Directional arrows are placed at precise yaw/pitch on the floor plane.
 * - Hardware-accelerated crossfade transitions mask panorama swapping.
 * - Camera dynamically glides towards the doorway and smoothly arrives at target_entry_yaw.
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

import { fetchTourStart, fetchTourNode, fetchTourObject } from '../services/tourApi';
import ArtifactCard from '../components/tour/ArtifactCard';
import axios from 'axios';
import API_BASE_URL from '../config/api';

// ── Constants ─────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;  // radians per degree
const ARROW_FLOOR_PITCH = -38 * DEG;   // fallback pitch below horizon

// ── Helpers ────────────────────────────────────────────────────────────────
function getFullUrl(url) {
  if (!url || typeof url !== 'string' || url.includes('undefined')) {
    return null;
  }

  // If already an absolute URL pointing to port 5000, convert to relative /uploads or /api
  // so Vite server proxies it directly on the same origin (no CORS/port mismatch).
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes(':5000/uploads/')) {
      return url.substring(url.indexOf('/uploads/'));
    }
    if (url.includes(':5000/api/')) {
      return url.substring(url.indexOf('/api/'));
    }
    return url;
  }

  // Relative path (e.g. /uploads/...)
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return cleanPath;
}

// ── Main Component ─────────────────────────────────────────────────────────
const VirtualTour = () => {
  const { museumId, nodeId } = useParams();
  const navigate = useNavigate();

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const markersRef = useRef(null);

  const [nodeData, setNodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState(null);

  // Artifact card state
  const [selectedObject, setSelectedObject] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);
  const savedCamera = useRef(null);

  // History for "Back" button
  const historyStack = useRef([]);
  // In-memory Node and Panorama Image Cache
  const nodeCache = useRef(new Map());
  const imageCache = useRef(new Set());
  const currentNodeIdRef = useRef(null);

  // iOS gyroscope permission
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroActive, setGyroActive] = useState(false);
  const [museumInfo, setMuseumInfo] = useState(null);

  // ── Load Museum Details ────────────────────────────────────────────────────
  useEffect(() => {
    if (!museumId) return;
    axios.get(`${API_BASE_URL}/museums/${museumId}`)
      .then(r => setMuseumInfo(r.data.data))
      .catch(() => {});
  }, [museumId]);

  // ── Preload adjacent rooms & 360 images for instant response ───────────────
  const preloadAdjacentNodes = useCallback((node) => {
    if (!node || !node.edges) return;
    node.edges.forEach(async (edge) => {
      try {
        let targetNode = nodeCache.current.get(edge.target_node_id);
        if (!targetNode) {
          targetNode = await fetchTourNode(edge.target_node_id);
          nodeCache.current.set(edge.target_node_id, targetNode);
        }
        if (targetNode?.panorama_url) {
          const imgUrl = getFullUrl(targetNode.panorama_url);
          if (imgUrl && !imageCache.current.has(imgUrl)) {
            imageCache.current.add(imgUrl);
            const img = new Image();
            img.src = imgUrl;
          }
        }
      } catch (e) {}
    });
  }, []);

  // ── Place floor-plane directional arrow hotspots & artifact dots ───────────
  const placeMarkers = useCallback((node) => {
    if (!markersRef.current || !node) return;
    try {
      markersRef.current.clearMarkers();
    } catch (e) {}

    // Directional arrows on the floor pointing toward connected rooms
    (node.edges || []).forEach((edge) => {
      const label = edge.target_node_name || 'Walkway';
      const arrowYawDeg = edge.yaw != null ? edge.yaw : 0;
      const arrowPitchRad = edge.pitch != null ? edge.pitch * DEG : ARROW_FLOOR_PITCH;

      try {
        markersRef.current.addMarker({
          id: `edge-${edge.id}`,
          html: `<div class="tour-nav-disk" aria-label="${label}">
            <div class="tour-nav-disk-inner">&#8593;</div>
            <div class="tour-nav-disk-ring"></div>
          </div>`,
          position: { yaw: arrowYawDeg * DEG, pitch: arrowPitchRad },
          anchor: 'center center',
          tooltip: { content: label, position: 'top center' },
          className: 'tour-arrow-marker',
          data: { type: 'edge', edge },
        });
      } catch (e) {
        console.warn('Failed nav disk marker:', e);
      }
    });

    // Object info-dot markers (in-place artifact hotspots)
    (node.objects || []).forEach((obj) => {
      try {
        markersRef.current.addMarker({
          id: `object-${obj.id}`,
          html: `<div class="tour-object-dot">
            <div class="tour-object-dot-inner">ℹ</div>
            <div class="tour-object-dot-pulse"></div>
          </div>`,
          position: { yaw: (obj.tour_yaw || 0) * DEG, pitch: (obj.tour_pitch || 0) * DEG },
          anchor: 'center center',
          tooltip: { content: obj.name, position: 'top center' },
          className: 'tour-object-marker',
          data: { type: 'object', object: obj },
        });
      } catch (e) {
        console.warn('Failed object marker:', e);
      }
    });

    // Room name label — floor plane text
    if (node.name) {
      try {
        markersRef.current.addMarker({
          id: 'room-label',
          html: `<div class="tour-room-label">${node.name}</div>`,
          position: { yaw: 0, pitch: -55 * DEG },
          anchor: 'center center',
          className: 'tour-room-label-marker',
        });
      } catch (e) {}
    }
  }, []);

  // ── Open artifact card ────────────────────────────────────────────────────
  const openArtifactCard = useCallback(async (objectId) => {
    if (!viewerRef.current) return;

    const pos = viewerRef.current.getPosition();
    const zoom = viewerRef.current.getZoomLevel();
    savedCamera.current = { ...pos, zoom };

    setCardLoading(true);
    setSelectedObject({ id: objectId });

    try {
      const detail = await fetchTourObject(objectId);
      setSelectedObject(detail);
    } catch (err) {
      console.error('Failed to load object:', err);
      setSelectedObject(null);
    } finally {
      setCardLoading(false);
    }
  }, []);

  // ── Close artifact card & restore camera ──────────────────────────────────
  const handleCloseCard = useCallback(() => {
    setSelectedObject(null);
    setCardLoading(false);

    if (viewerRef.current && savedCamera.current) {
      const { yaw, pitch, zoom } = savedCamera.current;
      viewerRef.current.rotate({ yaw, pitch });
      viewerRef.current.zoom(zoom);
    }
  }, []);

  // ── Room-to-Room Seamless Navigation ──────────────────────────────────────
  const navigateToNode = useCallback(async (edge) => {
    if (transitioning || !viewerRef.current || !edge) return;

    const targetId = edge.target_node_id;
    if (!targetId) return;

    if (nodeData) {
      historyStack.current.push(nodeData.id);
    }

    setTransitioning(true);
    // Mark target node ID right away so route change effects don't duplicate the fetch/setPanorama
    currentNodeIdRef.current = targetId;

    try {
      const arrowYaw = (edge.yaw != null ? edge.yaw : 0) * DEG;
      const arrowPitch = (edge.pitch != null ? edge.pitch : -10) * DEG;
      const targetEntryYaw = (edge.target_entry_yaw != null ? edge.target_entry_yaw : (edge.yaw != null ? edge.yaw : 0)) * DEG;

      // 1. Clear old room markers immediately so they do not linger during movement
      if (markersRef.current) {
        try { markersRef.current.clearMarkers(); } catch (e) {}
      }

      // 2. Smoothly animate camera in direction of travel
      try {
        viewerRef.current.animate({
          yaw: arrowYaw,
          pitch: arrowPitch,
          zoom: 65,
          speed: '250ms',
        });
      } catch (e) {}

      // 3. Fetch/retrieve destination node
      const fetchPromise = nodeCache.current.has(targetId)
        ? Promise.resolve(nodeCache.current.get(targetId))
        : fetchTourNode(targetId);

      const newNode = await fetchPromise;
      if (!newNode) throw new Error('Target node data not found');

      nodeCache.current.set(newNode.id, newNode);
      const newPanoUrl = getFullUrl(newNode.panorama_url);

      if (!newPanoUrl) throw new Error('Target panorama URL is invalid');

      // 4. Smooth WebGL cross-fade into new room
      await viewerRef.current.setPanorama(newPanoUrl, {
        transition: {
          effect: 'fade',
          speed: 400,
          rotation: true,
        },
        showLoader: false,
        position: {
          yaw: targetEntryYaw,
          pitch: 0,
        },
        zoom: 50,
      });

      // 5. Update state and place new markers
      setNodeData(newNode);
      placeMarkers(newNode);
      preloadAdjacentNodes(newNode);
      navigate(`/museum/${museumId}/tour/${targetId}`, { replace: true });
    } catch (err) {
      console.error('[VirtualTour] Navigation failed:', err);
      // Restore markers for current node if navigation failed
      if (nodeData) placeMarkers(nodeData);
    } finally {
      setTransitioning(false);
    }
  }, [transitioning, nodeData, museumId, navigate, preloadAdjacentNodes, placeMarkers]);

  // ── Back Navigation ───────────────────────────────────────────────────────
  const handleBack = useCallback(async () => {
    const prevId = historyStack.current.pop();
    if (!prevId || !viewerRef.current) return;

    setTransitioning(true);
    currentNodeIdRef.current = prevId;

    try {
      if (markersRef.current) {
        try { markersRef.current.clearMarkers(); } catch (e) {}
      }

      const fetchPromise = nodeCache.current.has(prevId)
        ? Promise.resolve(nodeCache.current.get(prevId))
        : fetchTourNode(prevId);

      const prevNode = await fetchPromise;
      if (!prevNode) throw new Error('Previous node data not found');

      nodeCache.current.set(prevNode.id, prevNode);
      const newPanoUrl = getFullUrl(prevNode.panorama_url);

      await viewerRef.current.setPanorama(newPanoUrl, {
        transition: {
          effect: 'fade',
          speed: 400,
          rotation: true,
        },
        showLoader: false,
        zoom: 50,
      });

      setNodeData(prevNode);
      placeMarkers(prevNode);
      preloadAdjacentNodes(prevNode);
      navigate(`/museum/${museumId}/tour/${prevId}`, { replace: true });
    } catch (err) {
      console.error('[VirtualTour] Back navigation failed:', err);
      if (nodeData) placeMarkers(nodeData);
    } finally {
      setTransitioning(false);
    }
  }, [nodeData, museumId, navigate, preloadAdjacentNodes, placeMarkers]);

  // ── Marker Selection Dispatcher ───────────────────────────────────────────
  const handleMarkerSelect = useCallback(({ marker }) => {
    const data = marker.config?.data;
    if (!data) return;

    if (data.type === 'edge' && data.edge) {
      navigateToNode(data.edge);
    } else if (data.type === 'object' && data.object) {
      openArtifactCard(data.object.id);
    }
  }, [navigateToNode, openArtifactCard]);

  // Attach marker listener
  useEffect(() => {
    if (!markersRef.current) return;
    try {
      markersRef.current.removeEventListener('select-marker', handleMarkerSelect);
    } catch (e) {}
    markersRef.current.addEventListener('select-marker', handleMarkerSelect);
    return () => {
      if (markersRef.current) {
        try {
          markersRef.current.removeEventListener('select-marker', handleMarkerSelect);
        } catch (e) {}
      }
    };
  }, [handleMarkerSelect]);

  // ── Load / Sync Node (Handles Initial Load & External URL Navigation) ───────
  useEffect(() => {
    const targetNodeId = nodeId ? parseInt(nodeId, 10) : null;
    if (targetNodeId && currentNodeIdRef.current === targetNodeId) {
      return;
    }

    let cancelled = false;
    const syncNode = async () => {
      try {
        setError(null);

        // If viewer is already initialized, do a smooth transition to this node
        if (viewerRef.current && nodeData) {
          setTransitioning(true);
          currentNodeIdRef.current = targetNodeId;
          if (markersRef.current) {
            try { markersRef.current.clearMarkers(); } catch (e) {}
          }

          let node = targetNodeId ? nodeCache.current.get(targetNodeId) : null;
          if (!node && targetNodeId) {
            node = await fetchTourNode(targetNodeId);
          } else if (!node) {
            node = await fetchTourStart(parseInt(museumId, 10));
          }

          if (!cancelled && node) {
            currentNodeIdRef.current = node.id;
            nodeCache.current.set(node.id, node);
            const panoUrl = getFullUrl(node.panorama_url);

            await viewerRef.current.setPanorama(panoUrl, {
              transition: { effect: 'fade', speed: 400, rotation: true },
              showLoader: false,
              position: { yaw: 0, pitch: 0 },
              zoom: 50,
            });

            setNodeData(node);
            placeMarkers(node);
            preloadAdjacentNodes(node);
          }
          if (!cancelled) setTransitioning(false);
          return;
        }

        // Initial setup load
        setLoading(true);
        let node;
        if (targetNodeId) {
          node = nodeCache.current.get(targetNodeId) || await fetchTourNode(targetNodeId);
        } else {
          node = await fetchTourStart(parseInt(museumId, 10));
        }

        if (!cancelled && node) {
          currentNodeIdRef.current = node.id;
          nodeCache.current.set(node.id, node);
          setNodeData(node);
          preloadAdjacentNodes(node);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Failed to load tour waypoint. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTransitioning(false);
        }
      }
    };

    syncNode();
    return () => { cancelled = true; };
  }, [museumId, nodeId, preloadAdjacentNodes, placeMarkers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialize PSV Viewer ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current || !nodeData || loading) return;
    if (viewerRef.current) return;

    let cancelled = false;
    const panoUrl = getFullUrl(nodeData.panorama_url);
    if (!panoUrl) {
      setError(`Invalid panorama URL: "${nodeData.panorama_url}"`);
      return;
    }

    const plugins = [[MarkersPlugin, {}]];
    if ('DeviceOrientationEvent' in window) {
      plugins.push([GyroscopePlugin, { touchmove: true, absolutePosition: false }]);
      setGyroAvailable(true);
    }

    let viewer;
    try {
      viewer = new Viewer({
        container: containerRef.current,
        panorama: panoUrl,
        withCredentials: false,
        rendererParameters: {
          preserveDrawingBuffer: true,
          antialias: true,
          powerPreference: 'high-performance',
        },
        defaultYaw: 0,
        defaultPitch: 0,
        minFov: 30,
        maxFov: 90,
        moveSpeed: 1.2,
        zoomSpeed: 1,
        mousewheelCtrlKey: false,
        navbar: false,
        plugins: plugins,
      });
    } catch (err) {
      if (cancelled) return;
      console.error('[VirtualTour] Viewer initialization failed:', err);
      setError(`Viewer failed to initialize: ${err.message}`);
      return;
    }

    if (cancelled) {
      try { viewer.destroy(); } catch (_) {}
      return;
    }

    viewerRef.current = viewer;
    markersRef.current = viewer.getPlugin(MarkersPlugin);

    viewer.addEventListener('panorama-load-error', (e) => {
      if (cancelled) return;
      console.error('[VirtualTour] Panorama failed to load:', panoUrl, e);
      setError(`Could not load panorama image. (${e?.message || 'Failed to fetch'})`);
    });

    const onReady = () => {
      if (cancelled) return;
      placeMarkers(nodeData);
    };
    viewer.addEventListener('ready', onReady, { once: true });

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch (_) {}
        viewerRef.current = null;
        markersRef.current = null;
      }
    };
  }, [nodeData, loading, placeMarkers]);

  // ── Gyroscope Toggle ──────────────────────────────────────────────────────
  const handleGyroToggle = useCallback(async () => {
    if (!viewerRef.current) return;
    const gyro = viewerRef.current.getPlugin(GyroscopePlugin);
    if (!gyro) return;

    if (!gyroActive) {
      if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') return;
      }
      gyro.start();
      setGyroActive(true);
    } else {
      gyro.stop();
      setGyroActive(false);
    }
  }, [gyroActive]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={styles.fullscreen}>
        <div style={styles.errorBox}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏛️</div>
          <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: '1.2rem', fontFamily: '"Inter", sans-serif' }}>Tour Not Available</h2>
          <p style={{ color: '#9ca3af', margin: '0 0 20px', fontSize: '0.9rem', lineHeight: 1.5 }}>{error}</p>
          <button
            onClick={() => navigate(`/museum/${museumId}`)}
            style={styles.btn}
          >
            ← Back to Museum
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.fullscreen}>

      {/* ── Transit Progress Line ─────────────────────────────────────── */}
      {transitioning && <div className="tour-transit-bar" />}

      {/* ── PSV Container ────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        id="tour-viewer-container"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ── Initial Loading Indicator ────────────────────────────────── */}
      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Entering Virtual Museum…</div>
        </div>
      )}

      {/* ── Top-left: Museum branding chip ──────────────────────────── */}
      <div style={styles.brandChip}>
        <span style={{ fontWeight: 700, color: '#C9A24B', marginRight: 6 }}>🏛</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F5F3EE', fontFamily: '"Inter", sans-serif' }}>
          {museumInfo?.name || 'Virtual Museum'}
        </span>
        {nodeData && (
          <span style={{ color: '#A8A6A0', marginLeft: 8, fontSize: '0.78rem' }}>
            · {nodeData.name}
          </span>
        )}
      </div>

      {/* ── Top-right: Controls & Navigation ─────────────────────────── */}
      <div style={styles.topRight}>
        <button
          onClick={() => navigate(`/museum/${museumId}/map?currentNode=${nodeData?.id || ''}`)}
          style={styles.iconBtn}
          title="Open Museum Floor Map"
        >
          🗺️
        </button>
        {gyroAvailable && (
          <button
            onClick={handleGyroToggle}
            style={{
              ...styles.iconBtn,
              background: gyroActive ? 'rgba(201, 162, 75, 0.25)' : 'rgba(23, 23, 26, 0.85)',
              borderColor: gyroActive ? 'rgba(201, 162, 75, 0.6)' : 'rgba(201, 162, 75, 0.25)',
            }}
            title={gyroActive ? 'Disable gyroscope' : 'Enable gyroscope'}
          >
            🧭
          </button>
        )}
        <button
          onClick={() => navigate(`/museum/${museumId}`)}
          style={styles.iconBtn}
          title="Exit tour"
        >
          🏠
        </button>
      </div>

      {/* ── Bottom-left: Back button ─────────────────────────────────── */}
      {historyStack.current.length > 0 && (
        <button
          onClick={handleBack}
          style={styles.backPill}
          disabled={transitioning}
        >
          ← Back
        </button>
      )}

      {/* ── Artifact card overlay ────────────────────────────────────── */}
      {selectedObject && (
        <ArtifactCard
          object={selectedObject}
          loading={cardLoading}
          onClose={handleCloseCard}
        />
      )}

      {/* ── Global tour styles ───────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes navRingPulse {
          0%   { transform: scale(1);   opacity: 0.65; }
          60%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes objectPulse {
          0%, 100% { transform: scale(1);   opacity: 0.85 }
          50%       { transform: scale(1.6); opacity: 0 }
        }
        @keyframes transitSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Sleek glowing top progress bar during room transitions */
        .tour-transit-bar {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #C9A24B, #EED28B, #C9A24B, transparent);
          z-index: 100;
          animation: transitSlide 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          box-shadow: 0 0 10px rgba(201, 162, 75, 0.8);
        }

        /* Disable default PSV spinners */
        .psv-loader,
        .psv-loader-canvas,
        .psv-loader-text,
        .psv-loader-image,
        .psv-loader-progress,
        #tour-viewer-container .psv-loader,
        #tour-viewer-container .psv-loader-canvas,
        #tour-viewer-container .psv-loader-text,
        #tour-viewer-container .psv-loader-image {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        /* PSV container styling */
        #tour-viewer-container .psv-container {
          background: #0B0B0C !important;
        }

        /* ── Navigation disk marker ────────────────────────────────────── */
        .tour-nav-disk {
          position: relative;
          width: 42px;
          height: 42px;
          cursor: pointer;
        }
        .tour-nav-disk-inner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(23, 23, 26, 0.92);
          backdrop-filter: blur(6px);
          border: 1.5px solid #C9A24B;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          color: #C9A24B;
          font-weight: 700;
          z-index: 2;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6), 0 0 12px rgba(201, 162, 75, 0.3);
          transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .tour-arrow-marker:hover .tour-nav-disk-inner {
          background: #C9A24B;
          color: #0B0B0C;
          box-shadow: 0 6px 20px rgba(201, 162, 75, 0.55);
          transform: scale(1.15);
        }
        .tour-nav-disk-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(201, 162, 75, 0.65);
          animation: navRingPulse 2.2s ease-out infinite;
        }

        /* ── Object info-dot marker ────────────────────────────────────── */
        .tour-object-dot {
          position: relative;
          width: 34px;
          height: 34px;
        }
        .tour-object-dot-inner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: #C9A24B;
          border: 2px solid #F5F3EE;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          color: #0B0B0C;
          font-weight: 700;
          z-index: 2;
          box-shadow: 0 2px 10px rgba(0,0,0,0.6), 0 0 12px rgba(201, 162, 75, 0.4);
          transition: transform 0.15s, background 0.2s;
        }
        .tour-object-marker:hover .tour-object-dot-inner {
          transform: scale(1.18);
          background: #dbb358;
        }
        .tour-object-dot-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: rgba(201, 162, 75, 0.45);
          animation: objectPulse 2s ease-in-out infinite;
        }

        /* Room label */
        .tour-room-label {
          background: rgba(23, 23, 26, 0.88);
          color: #F5F3EE;
          padding: 5px 16px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          backdrop-filter: blur(6px);
          white-space: nowrap;
          border: 1px solid rgba(201, 162, 75, 0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          letter-spacing: 0.02em;
        }

        /* PSV tooltip */
        .psv-tooltip {
          background: rgba(23, 23, 26, 0.95) !important;
          border: 1px solid rgba(201, 162, 75, 0.4) !important;
          color: #F5F3EE !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important;
          font-family: 'Inter', sans-serif !important;
        }
      `}</style>
    </div>
  );
};

// ── Inline styles ──────────────────────────────────────────────────────────
const styles = {
  fullscreen: {
    position: 'fixed',
    inset: 0,
    background: '#0B0B0C',
    zIndex: 1000,
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: '#0B0B0C',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 50,
    pointerEvents: 'none',
  },
  spinner: {
    width: 44,
    height: 44,
    border: '3px solid rgba(201, 162, 75, 0.2)',
    borderTopColor: '#C9A24B',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#A8A6A0',
    fontSize: '0.9rem',
    fontWeight: 500,
    fontFamily: '"Inter", sans-serif',
  },
  brandChip: {
    position: 'absolute',
    top: 16,
    left: 16,
    background: 'rgba(23, 23, 26, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(201, 162, 75, 0.3)',
    borderRadius: 24,
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
    zIndex: 20,
    maxWidth: '60vw',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  topRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    display: 'flex',
    gap: 8,
    zIndex: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(23, 23, 26, 0.85)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(201, 162, 75, 0.25)',
    color: '#F5F3EE',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  backPill: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    background: 'rgba(23, 23, 26, 0.88)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(201, 162, 75, 0.35)',
    color: '#F5F3EE',
    borderRadius: 24,
    padding: '8px 20px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: 20,
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    fontFamily: '"Inter", sans-serif',
  },
  btn: {
    background: 'rgba(201, 162, 75, 0.15)',
    border: '1px solid rgba(201, 162, 75, 0.4)',
    color: '#C9A24B',
    padding: '10px 24px',
    borderRadius: 24,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'all 0.2s',
    fontFamily: '"Inter", sans-serif',
  },
  errorBox: {
    textAlign: 'center',
    padding: 32,
    maxWidth: 400,
    margin: '0 auto',
  },
};

export default VirtualTour;
