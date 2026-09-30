import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MapPin, 
  Layers, 
  Compass, 
  Eye, 
  Maximize2, 
  Minimize2,
  ChevronRight,
  Target,
  Sparkles,
  Info
} from 'lucide-react';
import { getMediaUrl } from '../../utils/media';
import { gpsToMapXy } from '../../utils/geo';

/**
 * Resolves floor plan image URL from backend static/uploads
 */
export const getFloorPlanImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const clean = url.replace(/^\/api\/static\/uploads\//, '').replace(/^\/api\/uploads\//, '').replace(/^\/uploads\//, '');
  return `http://${window.location.hostname}:5000/uploads/${clean.split('?')[0]}`;
};

/**
 * Exact Architectural Floor Map Component
 * Renders the museum's authentic floor plan image with exact room boundary polygons
 * highlighting the active gallery room and placing exhibit artifacts at their exact spots.
 */
const GalleryFloorMap = ({ 
  museum, 
  gallery, 
  museumGalleries = [], 
  galleryObjects = [], 
  floorPlan = null,
  museumId
}) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Pan and Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Floor plan image source
  const rawImageUrl = floorPlan?.image_url || museum?.floorplan_image || '';
  const floorPlanImageUrl = useMemo(() => getFloorPlanImageUrl(rawImageUrl), [rawImageUrl]);

  // Reset view when gallery changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedArtifact(null);
    setImageError(false);
  }, [gallery?.id]);

  // Process room polygon boundaries for all galleries
  const processedGalleries = useMemo(() => {
    return museumGalleries.map(g => {
      const isCurrent = String(g.id) === String(gallery?.id);
      const rawPoly = g.boundary_polygon || [];

      // Convert raw boundary points to SVG 0..100 percentage coordinates
      let svgPoints = [];
      if (Array.isArray(rawPoly) && rawPoly.length >= 3) {
        svgPoints = rawPoly.map(p => {
          let x = p.x != null ? Number(p.x) : null;
          let y = p.y != null ? Number(p.y) : null;

          // If only GPS is provided, convert using floorPlan
          if ((x == null || y == null) && p.lat != null && p.lng != null && floorPlan) {
            const mapped = gpsToMapXy(Number(p.lat), Number(p.lng), floorPlan);
            if (mapped && mapped.x != null && mapped.y != null) {
              x = mapped.x;
              y = mapped.y;
            }
          }

          if (x == null || y == null) return null;

          // Normalize to 0..100
          const normX = x <= 1.0 ? x * 100 : (x / (floorPlan?.width_px || 1000)) * 100;
          const normY = y <= 1.0 ? y * 100 : (y / (floorPlan?.height_px || 1000)) * 100;
          return { x: normX, y: normY };
        }).filter(Boolean);
      }

      // Compute centroid
      let centroid = null;
      if (svgPoints.length >= 3) {
        const sumX = svgPoints.reduce((acc, pt) => acc + pt.x, 0);
        const sumY = svgPoints.reduce((acc, pt) => acc + pt.y, 0);
        centroid = {
          x: sumX / svgPoints.length,
          y: sumY / svgPoints.length
        };
      }

      const pointsString = svgPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

      return {
        ...g,
        isCurrent,
        svgPoints,
        pointsString,
        centroid,
        objectCount: g.objectCount ?? g.object_count ?? 0
      };
    });
  }, [museumGalleries, gallery?.id, floorPlan]);

  // Current active gallery data
  const currentGalleryData = useMemo(() => {
    return processedGalleries.find(g => g.isCurrent) || null;
  }, [processedGalleries]);

  // Map and place objects inside the active room
  const placedArtifacts = useMemo(() => {
    if (!galleryObjects || galleryObjects.length === 0) return [];
    const activeCentroid = currentGalleryData?.centroid || { x: 50, y: 50 };

    return galleryObjects.map((obj, idx) => {
      let posX = null;
      let posY = null;

      // 1. Try GPS conversion to floor plan normalized coordinates
      if (floorPlan && obj.latitude && obj.longitude) {
        const mapped = gpsToMapXy(parseFloat(obj.latitude), parseFloat(obj.longitude), floorPlan);
        if (mapped && mapped.x != null && mapped.y != null) {
          posX = mapped.x * 100;
          posY = mapped.y * 100;
        }
      }

      // 2. Fallback: Position cleanly within active room around centroid
      if (posX == null || posY == null) {
        const total = galleryObjects.length;
        const spreadX = Math.min(10, (total - 1) * 3);
        const offset = total > 1 ? (idx - (total - 1) / 2) * (spreadX / (total - 1 || 1)) : 0;
        posX = activeCentroid.x + offset;
        posY = activeCentroid.y + 4;
      }

      return {
        ...obj,
        index: idx + 1,
        pinX: posX,
        pinY: posY
      };
    });
  }, [galleryObjects, currentGalleryData, floorPlan]);

  // Center view on the current active room
  const centerOnCurrentRoom = () => {
    if (!currentGalleryData?.centroid) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const { x, y } = currentGalleryData.centroid;
    // The centroid is in 0..100 percentage space
    // Center of container is 50%, 50%
    const targetZoom = 1.35;
    const targetPanX = ((50 - x) / 100) * (containerRef.current?.clientWidth || 800) * targetZoom;
    const targetPanY = ((50 - y) / 100) * (containerRef.current?.clientHeight || 600) * targetZoom;

    setZoom(targetZoom);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Pan controls
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setHasDragged(true);
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom(prev => Math.min(Math.max(0.6, prev + delta), 3.0));
  };

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.6));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedArtifact(null);
  };

  // Handle room click to navigate to that gallery
  const handleRoomClick = (targetGallery) => {
    if (hasDragged) return; // Prevent navigation when user was dragging map
    if (String(targetGallery.id) !== String(gallery?.id)) {
      navigate(`/museum/${museumId || museum?.id}/gallery/${targetGallery.id}`);
    }
  };

  return (
    <div className={`relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none transition-all ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl' : ''}`}>
      {/* Top Header Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md px-6 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 z-20 relative">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Architectural Floor Plan
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {floorPlan?.name || `${museum?.name || 'Museum'} • Floor ${gallery?.floor || 1}`}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2.5">
            <span>{gallery?.name}</span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              YOU ARE HERE
            </span>
          </h3>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-5 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-600/40 border-2 border-blue-500 shadow-sm shadow-blue-500/50"></span>
            <span className="font-medium text-white">Active Room</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-800/80 border border-slate-600"></span>
            <span>Other Galleries</span>
          </div>
          {placedArtifacts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-sm"></span>
              <span className="text-amber-300 font-semibold">{placedArtifacts.length} Exhibits on Display</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/70 shadow-inner">
          <button 
            onClick={zoomIn} 
            title="Zoom In" 
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={zoomOut} 
            title="Zoom Out" 
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            onClick={resetView} 
            title="Reset Zoom & Pan" 
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button 
            onClick={centerOnCurrentRoom} 
            title="Center on This Room" 
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50 transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Center Room</span>
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'} 
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Floor Map Canvas Area */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative w-full h-[540px] md:h-[620px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Subtle Architectural Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Pan & Zoom Transform Container */}
        <div 
          className="transition-transform duration-75 ease-out select-none inline-block relative max-w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
        >
          {/* Floor Plan Image Frame */}
          <div className="relative inline-block rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-white">
            {/* The Actual Architectural Floor Plan Image */}
            {floorPlanImageUrl && !imageError ? (
              <img
                ref={imageRef}
                src={floorPlanImageUrl}
                alt={floorPlan?.name || museum?.name || 'Floor Plan'}
                onError={() => setImageError(true)}
                className="block max-w-[840px] max-h-[580px] w-auto h-auto select-none pointer-events-none"
                draggable={false}
              />
            ) : (
              /* Fallback Vector Architectural Blueprint if image fails */
              <svg 
                viewBox="0 0 1000 750" 
                className="w-[840px] h-[580px] bg-slate-900 block"
              >
                <rect x="0" y="0" width="1000" height="750" fill="#0f172a" />
                {processedGalleries.map((g, idx) => {
                  if (!g.svgPoints || g.svgPoints.length < 3) return null;
                  const ptsStr = g.svgPoints.map(p => `${p.x * 10},${p.y * 7.5}`).join(' ');
                  return (
                    <polygon
                      key={`fallback-poly-${g.id}`}
                      points={ptsStr}
                      fill={g.isCurrent ? 'rgba(37, 99, 235, 0.35)' : 'rgba(30, 41, 59, 0.6)'}
                      stroke={g.isCurrent ? '#3b82f6' : '#475569'}
                      strokeWidth={g.isCurrent ? 3 : 1.5}
                    />
                  );
                })}
              </svg>
            )}

            {/* SVG OVERLAY: Exactly covers the floor plan image */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Active Room Glow Filter */}
                <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                {/* Active Room Pulse Animation Pattern */}
                <radialGradient id="activeGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.25" />
                </radialGradient>
              </defs>

              {/* 1. Render All Non-Active Gallery Room Boundaries (Clickable) */}
              {processedGalleries
                .filter(g => !g.isCurrent && g.svgPoints.length >= 3)
                .map(g => {
                  const isHovered = hoveredRoom === g.id;
                  return (
                    <g 
                      key={`other-room-${g.id}`}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredRoom(g.id)}
                      onMouseLeave={() => setHoveredRoom(null)}
                      onClick={() => handleRoomClick(g)}
                    >
                      <polygon
                        points={g.pointsString}
                        fill={isHovered ? 'rgba(59, 130, 246, 0.22)' : 'rgba(15, 23, 42, 0.05)'}
                        stroke={isHovered ? '#3b82f6' : 'rgba(100, 116, 139, 0.55)'}
                        strokeWidth={isHovered ? 1.2 : 0.6}
                        strokeDasharray={isHovered ? 'none' : '2 1'}
                        className="transition-all duration-150"
                      />
                      {/* Room label at centroid */}
                      {g.centroid && (
                        <g transform={`translate(${g.centroid.x}, ${g.centroid.y})`}>
                          <rect
                            x="-10"
                            y="-2.4"
                            width="20"
                            height="4.8"
                            rx="1"
                            fill={isHovered ? '#1e3a8a' : '#0f172a'}
                            fillOpacity={isHovered ? 0.95 : 0.75}
                            stroke={isHovered ? '#60a5fa' : '#475569'}
                            strokeWidth="0.3"
                          />
                          <text
                            x="0"
                            y="0.9"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="2.1"
                            fontWeight={isHovered ? 'bold' : 'normal'}
                            className="pointer-events-none select-none"
                          >
                            {g.name.length > 12 ? `${g.name.substring(0, 11)}…` : g.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              {/* 2. Render Active Gallery Room with Radiant Highlight */}
              {currentGalleryData && currentGalleryData.svgPoints.length >= 3 && (
                <g key={`active-room-${currentGalleryData.id}`} filter="url(#activeGlow)">
                  {/* Outer pulsating glow border */}
                  <polygon
                    points={currentGalleryData.pointsString}
                    fill="url(#activeGradient)"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                    className="drop-shadow-lg"
                  />
                  <polygon
                    points={currentGalleryData.pointsString}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="0.8"
                    strokeDasharray="2 1"
                  />

                  {/* Prominent Architectural Centroid Badge: YOU ARE HERE */}
                  {currentGalleryData.centroid && (
                    <g transform={`translate(${currentGalleryData.centroid.x}, ${currentGalleryData.centroid.y - 2})`}>
                      {/* Badge Background */}
                      <rect
                        x="-16"
                        y="-4.2"
                        width="32"
                        height="8.4"
                        rx="2"
                        fill="#090d16"
                        fillOpacity="0.96"
                        stroke="#3b82f6"
                        strokeWidth="0.6"
                      />
                      {/* Green Radar Dot */}
                      <circle cx="-12" cy="0" r="1" fill="#10b981" />
                      <circle cx="-12" cy="0" r="1.8" fill="none" stroke="#34d399" strokeWidth="0.4" opacity="0.8" />
                      
                      {/* Active Gallery Name */}
                      <text
                        x="-9.5"
                        y="-0.4"
                        fill="#ffffff"
                        fontSize="2.5"
                        fontWeight="800"
                        letterSpacing="0.1"
                        className="select-none"
                      >
                        {currentGalleryData.name.length > 15 ? `${currentGalleryData.name.substring(0, 14)}…` : currentGalleryData.name}
                      </text>

                      {/* Sub-label */}
                      <text
                        x="-9.5"
                        y="2.4"
                        fill="#34d399"
                        fontSize="1.7"
                        fontWeight="700"
                        letterSpacing="0.2"
                        className="select-none"
                      >
                        YOU ARE HERE • {placedArtifacts.length} EXHIBITS
                      </text>
                    </g>
                  )}
                </g>
              )}
            </svg>

            {/* 3. HTML Overlaid Artifact Pins on the Active Room */}
            {placedArtifacts.map(art => (
              <div
                key={`artifact-pin-${art.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedArtifact(art);
                }}
                title={`${art.name} (${art.category || 'Exhibit'})`}
                className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group z-20 transition-transform duration-200 hover:scale-125"
                style={{
                  left: `${art.pinX}%`,
                  top: `${art.pinY}%`
                }}
              >
                {/* Pin Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-slate-900/95 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg border border-amber-500/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>{art.name}</span>
                </div>

                {/* Pin Teardrop Marker */}
                <div className="relative flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-[10px] flex items-center justify-center border-2 border-white shadow-md shadow-amber-500/40">
                    {art.index}
                  </div>
                  <div className="w-1 h-1.5 bg-amber-600 rounded-b"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Artifact Detail Popover / Drawer */}
        {selectedArtifact && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-88 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-4 text-white z-30 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700 shadow-inner flex items-center justify-center">
                  {(selectedArtifact.image || selectedArtifact.image_url) ? (
                    <img 
                      src={getMediaUrl(selectedArtifact.image || selectedArtifact.image_url)} 
                      alt={selectedArtifact.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MapPin className="w-7 h-7 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Exhibit #{selectedArtifact.index}
                    </span>
                    {selectedArtifact.category && (
                      <span className="text-[10px] text-slate-400 truncate">
                        {selectedArtifact.category}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-white truncate mt-1">
                    {selectedArtifact.name}
                  </h4>
                  {selectedArtifact.period && (
                    <p className="text-xs text-slate-400 truncate">{selectedArtifact.period}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedArtifact(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {selectedArtifact.description && (
              <p className="text-xs text-slate-300 line-clamp-2 mt-2.5 pt-2 border-t border-slate-800/80">
                {selectedArtifact.description}
              </p>
            )}
            
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-between items-center">
              <Link 
                to={`/museum/${museumId || museum?.id}/object/${selectedArtifact.id}`}
                className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                View Full Exhibit Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Interactive Bottom Help Bar */}
        <div className="absolute bottom-3 left-4 pointer-events-none text-[11px] text-slate-400 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2 shadow-md">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Click any room to navigate • Drag to pan • Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
};

export default GalleryFloorMap;
