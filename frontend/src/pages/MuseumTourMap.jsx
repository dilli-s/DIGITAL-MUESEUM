import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { 
  ArrowLeft, 
  Compass, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Play, 
  Navigation, 
  MapPin, 
  Info, 
  Search, 
  X, 
  ChevronRight, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

const CANVAS_WIDTH = 832;
const CANVAS_HEIGHT = 1024;

const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/') || url.startsWith('/api/uploads/') || url.startsWith('/static/uploads/')) {
    const clean = url.replace(/^\/(api\/static|static|api)\//, '/');
    return `http://127.0.0.1:5000${clean}`;
  }
  return url;
};

const getFloorplanUrl = (rawUrl) => {
  if (!rawUrl) return '/oriental_institute_floorplan.png';
  if (rawUrl.includes('oriental_institute_floorplan')) {
    return '/oriental_institute_floorplan.png';
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  return `http://127.0.0.1:5000${rawUrl.replace(/^\/(api\/static|static|api)\//, '/')}`;
};

const MuseumTourMap = () => {
  const { museumId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialNodeId = searchParams.get('currentNode')
    ? parseInt(searchParams.get('currentNode'), 10)
    : null;

  const [museum, setMuseum] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Pan & Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const floorplanImgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // ── Load Data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [museumRes, nodesRes] = await Promise.all([
          api.get(`/museums/${museumId}`),
          api.get(`/tour/museums/${museumId}/nodes`),
        ]);
        if (!isMounted) return;
        setMuseum(museumRes.data.data);
        const fetchedNodes = nodesRes.data.data || [];
        setNodes(fetchedNodes);

        if (initialNodeId) {
          const match = fetchedNodes.find(n => n.id === initialNodeId);
          if (match) setSelectedNode(match);
        } else if (fetchedNodes.length > 0) {
          const startNode = fetchedNodes.find(n => n.is_start) || fetchedNodes[0];
          setSelectedNode(startNode);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load museum map data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [museumId, initialNodeId]);

  // ── Node coordinates helper ──────────────────────────────────────────────
  const getNodePos = useCallback((node) => {
    if (!node) return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    let x = node.pos_x ?? 416;
    let y = node.pos_y ?? 512;
    if (x <= 1.0) x = x * CANVAS_WIDTH;
    if (y <= 1.0) y = y * CANVAS_HEIGHT;
    return { x, y };
  }, []);

  // ── Build edge list ──────────────────────────────────────────────────────
  const edges = useMemo(() => {
    return nodes.flatMap((node) =>
      (node.outgoing_edges || []).map((edge) => ({
        ...edge,
        sourceNode: node,
        targetNode: nodes.find((n) => n.id === edge.target_node_id),
      })).filter((e) => e.targetNode)
    );
  }, [nodes]);

  // ── Center on specific node ──────────────────────────────────────────────
  const centerOnNode = useCallback((node) => {
    if (!containerRef.current || !node) return;
    const pos = getNodePos(node);
    const container = containerRef.current.getBoundingClientRect();
    
    const scale = 1.3;
    // Map SVG coordinate space to container center
    const svgAspect = CANVAS_WIDTH / CANVAS_HEIGHT;
    const containerAspect = container.width / container.height;
    
    let renderedW = container.width;
    let renderedH = container.height;
    if (containerAspect > svgAspect) {
      renderedW = container.height * svgAspect;
    } else {
      renderedH = container.width / svgAspect;
    }

    const normX = pos.x / CANVAS_WIDTH;
    const normY = pos.y / CANVAS_HEIGHT;

    const targetX = (container.width / 2) - (normX * renderedW * scale);
    const targetY = (container.height / 2) - (normY * renderedH * scale);

    setTransform({
      x: targetX + (renderedW * scale * 0.5) - (container.width * 0.5),
      y: targetY + (renderedH * scale * 0.5) - (container.height * 0.5),
      scale: scale,
    });
  }, [getNodePos]);

  // ── Pan & Zoom handlers ──────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only main left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setTransform(prev => {
      const nextScale = Math.min(Math.max(prev.scale * zoomFactor, 0.6), 4.0);
      return { ...prev, scale: nextScale };
    });
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const zoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.25, 4.0) }));
  };

  const zoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.6) }));
  };

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => 
      n.name.toLowerCase().includes(q) || 
      (n.description && n.description.toLowerCase().includes(q))
    );
  }, [nodes, searchQuery]);

  const floorplanSource = useMemo(() => {
    return getFloorplanUrl(museum?.floorplan_image);
  }, [museum]);

  const startTourAtNode = (node) => {
    if (!node) return;
    navigate(`/museum/${museumId}/tour/${node.id}`);
  };

  const startEntranceTour = () => {
    const entrance = nodes.find(n => n.is_start) || nodes[0];
    if (entrance) {
      navigate(`/museum/${museumId}/tour/${entrance.id}`);
    } else {
      navigate(`/museum/${museumId}/tour`);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0806] text-[#f4eee1] flex flex-col overflow-hidden select-none font-sans">
      
      {/* ── TOP LUXURY BAR ── */}
      <header className="relative z-30 h-16 bg-[#14100c]/90 backdrop-blur-md border-b border-[#dfb758]/20 px-4 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(`/museums/${museumId}`)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#241c14] border border-[#dfb758]/30 hover:border-[#dfb758] text-[#eeddc0] hover:text-[#fdf8ee] text-xs font-semibold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-[#c89b3c]" />
            <span className="hidden sm:inline">Museum Portal</span>
          </button>

          <div className="h-6 w-[1px] bg-[#dfb758]/20 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className="font-['Cinzel'] font-bold text-sm sm:text-base text-[#fcf8ee] tracking-wide">
                {museum?.name || 'Digital Museum Map'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c89b3c]/20 border border-[#c89b3c]/40 text-[#f5d98b] text-[10px] font-bold uppercase tracking-wider">
                <Compass className="w-3 h-3 text-[#c89b3c]" /> 2D Floor Plan
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#a89984] font-light hidden sm:block truncate max-w-md">
              {nodes.length} Interactive 360° Virtual Tour Galleries Available
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isSidebarOpen 
                ? 'bg-[#c89b3c] text-[#0e0c0a] border-[#c89b3c] font-bold shadow-md shadow-[#c89b3c]/20' 
                : 'bg-[#241c14] text-[#eeddc0] border-[#dfb758]/30 hover:border-[#dfb758]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#c89b3c]" />
            <span className="hidden md:inline">Gallery List</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#3d2e20] text-[#f5d98b] text-[10px] font-bold">
              {nodes.length}
            </span>
          </button>

          <button
            onClick={startEntranceTour}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8f6826] via-[#b58836] to-[#8f6826] hover:from-[#a87d32] hover:to-[#c89b3c] text-[#fff8ea] text-xs font-bold tracking-wider uppercase border border-[#dfb758]/50 shadow-lg shadow-[#8f6826]/30 transition-all hover:scale-105 active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#ffe6a4]" />
            <span>Start Virtual Tour</span>
          </button>
        </div>
      </header>

      {/* ── MAIN MAP CONTAINER ── */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-[#0c0a08] flex">
        
        {/* Visual Map Area */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-${isDragging ? 'grabbing' : 'grab'}`}
        >
          {/* Subtle Ambient Museum Hall Lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,155,60,0.08)_0%,rgba(14,12,10,0.95)_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          {loading && (
            <div className="relative z-20 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-3 border-[#c89b3c]/30 border-t-[#c89b3c] animate-spin shadow-lg shadow-[#c89b3c]/20" />
              <p className="font-['Cinzel'] text-sm tracking-widest text-[#dfb758] uppercase">
                Loading Floor Plan & Tour Graph...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="relative z-20 max-w-md p-6 rounded-2xl bg-[#1b140e] border-2 border-red-500/40 text-center space-y-3 shadow-2xl">
              <p className="text-sm font-semibold text-red-400">Map Loading Error</p>
              <p className="text-xs text-[#a89984]">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-xs font-bold uppercase tracking-wider text-red-200"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
              }}
              className="relative w-[832px] h-[1024px] max-w-none flex-shrink-0 shadow-2xl rounded-2xl overflow-hidden border-2 border-[#dfb758]/30 bg-[#16120e]"
            >
              {/* Actual Architectural Floor Plan Image */}
              <img
                ref={floorplanImgRef}
                src={floorplanSource}
                alt="Museum Floorplan"
                onLoad={() => { setImgLoaded(true); setImgError(false); }}
                onError={() => {
                  setImgError(true);
                  // Fallback to local public file
                  if (floorplanImgRef.current && !floorplanImgRef.current.src.endsWith('/oriental_institute_floorplan.png')) {
                    floorplanImgRef.current.src = '/oriental_institute_floorplan.png';
                  }
                }}
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-700 ${
                  imgLoaded ? 'opacity-90' : 'opacity-0'
                }`}
              />

              {/* Architectural Blueprint grid overlay if image is loading or fallback */}
              {(!imgLoaded || imgError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#15120e] text-center border border-[#dfb758]/20">
                  <Compass className="w-16 h-16 text-[#c89b3c]/40 animate-pulse mb-4" />
                  <h3 className="font-['Cinzel'] font-bold text-lg text-[#f4eee1] tracking-wider uppercase mb-1">
                    Museum Architectural Grid
                  </h3>
                  <p className="text-xs text-[#a89984] max-w-sm">
                    {museum?.name || 'Floor Plan Layout'}
                  </p>
                </div>
              )}

              {/* SVG Layer for Graph Edges, Nodes & Overlays */}
              <svg
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className="absolute inset-0 w-full h-full overflow-visible pointer-events-auto"
              >
                <defs>
                  {/* Glowing Edge Gradient */}
                  <linearGradient id="tourEdgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#dfb758" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#c89b3c" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#8f6826" stopOpacity="0.8" />
                  </linearGradient>

                  <linearGradient id="activeEdgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffe6a4" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#dfb758" stopOpacity="0.95" />
                  </linearGradient>

                  {/* Directional Arrowheads */}
                  <marker
                    id="tourArrow"
                    markerWidth="8"
                    markerHeight="6"
                    refX="18"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#dfb758" opacity="0.9" />
                  </marker>

                  <marker
                    id="activeTourArrow"
                    markerWidth="9"
                    markerHeight="7"
                    refX="20"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 9 3.5, 0 7" fill="#ffe6a4" />
                  </marker>

                  {/* Radial Node Glow */}
                  <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* ── 1. EDGES / CORRIDOR PATHS ── */}
                {showEdges && edges.map((edge, i) => {
                  const src = getNodePos(edge.sourceNode);
                  const tgt = getNodePos(edge.targetNode);

                  const isConnectedToSelected = 
                    selectedNode && 
                    (edge.sourceNode.id === selectedNode.id || edge.targetNode.id === selectedNode.id);

                  // Calculate subtle curve
                  const dx = tgt.x - src.x;
                  const dy = tgt.y - src.y;
                  const mx = (src.x + tgt.x) / 2 - dy * 0.08;
                  const my = (src.y + tgt.y) / 2 + dx * 0.08;

                  return (
                    <g key={`edge-${edge.id || i}`} className="transition-all duration-300">
                      {/* Underlying glow when active */}
                      {isConnectedToSelected && (
                        <path
                          d={`M ${src.x} ${src.y} Q ${mx} ${my} ${tgt.x} ${tgt.y}`}
                          fill="none"
                          stroke="#dfb758"
                          strokeWidth="6"
                          opacity="0.4"
                          filter="url(#nodeGlow)"
                        />
                      )}
                      
                      {/* Base path line */}
                      <path
                        d={`M ${src.x} ${src.y} Q ${mx} ${my} ${tgt.x} ${tgt.y}`}
                        fill="none"
                        stroke={isConnectedToSelected ? 'url(#activeEdgeGradient)' : 'url(#tourEdgeGradient)'}
                        strokeWidth={isConnectedToSelected ? "3.5" : "2"}
                        strokeDasharray={isConnectedToSelected ? "none" : "6 4"}
                        markerEnd={isConnectedToSelected ? "url(#activeTourArrow)" : "url(#tourArrow)"}
                        opacity={isConnectedToSelected ? 0.95 : 0.65}
                      />
                    </g>
                  );
                })}

                {/* ── 2. NODES / GALLERIES ── */}
                {nodes.map((node, idx) => {
                  const pos = getNodePos(node);
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isStart = node.is_start;
                  const sequenceNum = idx + 1;

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startTourAtNode(node);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      {/* Pulsing beacon for Start Node & Selected Node */}
                      {(isStart || isSelected) && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isSelected ? 36 : 28}
                          className="animate-ping opacity-30 fill-[#dfb758]"
                        />
                      )}

                      {/* Outer Selection Ring */}
                      {isSelected && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={28}
                          fill="rgba(223, 183, 88, 0.15)"
                          stroke="#dfb758"
                          strokeWidth="2.5"
                          strokeDasharray="4 3"
                          filter="url(#nodeGlow)"
                        />
                      )}

                      {/* Hover Halo */}
                      {isHovered && !isSelected && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={24}
                          fill="rgba(255, 255, 255, 0.12)"
                          stroke="#ffe6a4"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Main Node Body Circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? 19 : isStart ? 17 : 15}
                        fill={
                          isSelected 
                            ? '#dfb758' 
                            : isStart 
                            ? '#2e7d32' 
                            : '#2b2218'
                        }
                        stroke={
                          isSelected 
                            ? '#ffffff' 
                            : isStart 
                            ? '#81c784' 
                            : '#dfb758'
                        }
                        strokeWidth={isSelected ? 3 : 2}
                        className="transition-all duration-200 shadow-md"
                        filter={isSelected ? "url(#nodeGlow)" : "none"}
                      />

                      {/* Icon or Sequence Number */}
                      <text
                        x={pos.x}
                        y={pos.y + 4.5}
                        textAnchor="middle"
                        fontSize={isSelected ? "12" : "10"}
                        fontWeight="800"
                        fill={isSelected ? '#14100c' : '#fdf8ee'}
                        className="pointer-events-none font-mono"
                      >
                        {sequenceNum}
                      </text>

                      {/* Attached Label Badge */}
                      {showLabels && (
                        <g className="pointer-events-none transition-all duration-200">
                          {/* Label background plate */}
                          <rect
                            x={pos.x - 70}
                            y={pos.y + 22}
                            width="140"
                            height="22"
                            rx="11"
                            fill={isSelected ? 'rgba(20, 16, 12, 0.95)' : 'rgba(20, 16, 12, 0.82)'}
                            stroke={isSelected ? '#dfb758' : 'rgba(223, 183, 88, 0.35)'}
                            strokeWidth={isSelected ? 1.5 : 1}
                            backdropFilter="blur(4px)"
                          />
                          <text
                            x={pos.x}
                            y={pos.y + 36}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight={isSelected ? '700' : '600'}
                            fill={isSelected ? '#ffe6a4' : '#e6d8c3'}
                            className="font-sans tracking-wide"
                          >
                            {node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* ── MAP CONTROLS FLOATING TOOLBAR (BOTTOM LEFT) ── */}
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2 bg-[#1b1510]/90 backdrop-blur-md p-2 rounded-2xl border border-[#dfb758]/30 shadow-2xl">
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="w-9 h-9 rounded-xl bg-[#2a2118] hover:bg-[#c89b3c] hover:text-[#14100c] text-[#dfb758] flex items-center justify-center transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="w-9 h-9 rounded-xl bg-[#2a2118] hover:bg-[#c89b3c] hover:text-[#14100c] text-[#dfb758] flex items-center justify-center transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Reset Map Center"
            className="w-9 h-9 rounded-xl bg-[#2a2118] hover:bg-[#c89b3c] hover:text-[#14100c] text-[#dfb758] flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-full h-[1px] bg-[#dfb758]/20 my-0.5" />
          <button
            onClick={() => setShowLabels(!showLabels)}
            title={showLabels ? "Hide Labels" : "Show Labels"}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              showLabels ? 'bg-[#c89b3c]/20 text-[#ffe29a]' : 'bg-[#2a2118] text-[#7a6a58]'
            }`}
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* ── MAP LEGEND (BOTTOM CENTER) ── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-4 px-5 py-2.5 rounded-full bg-[#1b1510]/90 backdrop-blur-md border border-[#dfb758]/30 shadow-xl text-xs text-[#d8c8b0]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2e7d32] border border-[#81c784]" />
            <span>Entrance / Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2b2218] border border-[#dfb758]" />
            <span>Tour Gallery</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#dfb758] border border-white animate-pulse" />
            <span>Selected Room</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#dfb758]" />
            <span>Corridor Path</span>
          </div>
        </div>

        {/* ── SELECTED NODE FLOATING CARD (BOTTOM RIGHT) ── */}
        {selectedNode && (
          <div className="absolute bottom-6 right-6 z-20 w-80 sm:w-96 rounded-2xl bg-[#1b1510]/95 backdrop-blur-xl border-2 border-[#dfb758]/40 p-4 shadow-2xl text-[#f4eee1] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#c89b3c] text-[#14100c] flex items-center justify-center font-bold text-xs">
                  {nodes.findIndex(n => n.id === selectedNode.id) + 1}
                </div>
                <div>
                  <h4 className="font-['Cinzel'] font-bold text-sm text-[#fdf8ee] leading-tight">
                    {selectedNode.name}
                  </h4>
                  {selectedNode.is_start && (
                    <span className="text-[10px] text-[#81c784] font-semibold tracking-wider uppercase">
                      ★ Main Entrance Gallery
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 text-[#a89984] hover:text-[#fdf8ee] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panorama Preview Thumbnail if available */}
            {selectedNode.panorama_url && (
              <div className="relative w-full h-28 rounded-xl overflow-hidden mb-3 border border-[#dfb758]/30 bg-black">
                <img
                  src={getMediaUrl(selectedNode.panorama_url)}
                  alt={selectedNode.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] text-[#ffe6a4] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-[#dfb758]/30">
                  <Sparkles className="w-3 h-3 text-[#dfb758]" /> 360° Spherical Panoramic View
                </div>
              </div>
            )}

            <p className="text-xs text-[#c2b39d] leading-relaxed mb-3 line-clamp-2">
              {selectedNode.description || 'Explore high-resolution 3D artifacts and historical audio narratives in this museum hall.'}
            </p>

            {/* Connections */}
            <div className="flex items-center justify-between pt-2 border-t border-[#dfb758]/20 text-xs">
              <span className="text-[#a89984] text-[11px]">
                {(selectedNode.outgoing_edges || []).length} Connected Paths
              </span>
              <button
                onClick={() => startTourAtNode(selectedNode)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8f6826] to-[#c89b3c] hover:from-[#a87d32] hover:to-[#dfb758] text-[#fff8ea] font-bold text-xs uppercase tracking-wider shadow-md hover:scale-105 transition-transform"
              >
                <span>Enter 360° Tour</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── COLLAPSIBLE GALLERY DIRECTORY SIDEBAR ── */}
        {isSidebarOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-30 w-80 sm:w-96 bg-[#16120e]/98 backdrop-blur-2xl border-l-2 border-[#dfb758]/30 shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#dfb758]/20 flex items-center justify-between bg-[#1f1913]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#c89b3c]" />
                <h3 className="font-['Cinzel'] font-bold text-sm text-[#fdf8ee] tracking-wider uppercase">
                  Museum Galleries
                </h3>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-[#a89984] hover:text-[#fdf8ee] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-[#dfb758]/15 bg-[#14100c]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#a89984] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter galleries..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#241c14] border border-[#dfb758]/30 rounded-xl text-[#f4eee1] placeholder-[#7a6a58] focus:outline-none focus:border-[#c89b3c]"
                />
              </div>
            </div>

            {/* Gallery Item List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredNodes.map((node, idx) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSelectedNode(node);
                      centerOnNode(node);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#2b2218] border-[#dfb758] shadow-md shadow-[#c89b3c]/10'
                        : 'bg-[#1b1510] border-[#dfb758]/15 hover:border-[#dfb758]/50 hover:bg-[#231b14]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-[#c89b3c] text-[#14100c]' : 'bg-[#2f241a] text-[#dfb758]'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#fdf8ee]">
                          {node.name}
                        </div>
                        <div className="text-[10px] text-[#a89984] flex items-center gap-1 mt-0.5">
                          {node.is_start ? (
                            <span className="text-[#81c784] font-bold">● Start Entrance</span>
                          ) : (
                            <span>{(node.outgoing_edges || []).length} connected gates</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTourAtNode(node);
                      }}
                      className="p-1.5 rounded-lg bg-[#33261a] hover:bg-[#c89b3c] hover:text-[#14100c] text-[#dfb758] transition-colors"
                      title="Enter 360° Tour"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Start Full Tour Footer */}
            <div className="p-4 border-t border-[#dfb758]/20 bg-[#1f1913]">
              <button
                onClick={startEntranceTour}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8f6826] via-[#c89b3c] to-[#8f6826] text-[#fff8ea] text-xs font-bold tracking-wider uppercase shadow-lg shadow-[#8f6826]/30 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <Play className="w-4 h-4 fill-current text-[#ffe6a4]" />
                <span>Start Tour from Entrance</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MuseumTourMap;
