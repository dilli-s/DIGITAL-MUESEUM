import React, { useState, useEffect, useRef } from 'react';
import { 
  getFloorPlans, createFloorPlan, updateFloorPlan, georeferenceFloorPlan, uploadMapImage,
  getNodes, createNode, getEdges, createEdge, getAbsoluteImageUrl
} from '../../services/mapApi';
import { getAdminObjects } from '../../services/api';
import { Plus, Move, Scaling, Navigation, Save, ArrowRight, Globe, MapPin } from 'lucide-react';
import { latlngToPixel } from '../../utils/geo';

const NODE_TYPES = [
  'exhibit', 'junction', 'entrance', 'exit', 'amenity', 
  'restroom', 'cafe', 'giftshop', 'elevator', 'stairs'
];

const AdminMapEditor = () => {
  const canvasRef = useRef(null);
  
  const [floorPlans, setFloorPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [objects, setObjects] = useState([]);
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState('select'); // 'select', 'place_node', 'draw_edge', 'calibrate'
  
  // Canvas State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Interaction State
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [drawingEdgeFrom, setDrawingEdgeFrom] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeForm, setNodeForm] = useState({ name: '', node_type: 'junction', object_id: '' });
  const [pendingNodePos, setPendingNodePos] = useState(null);
  
  // Calibrate
  const [calibratePoints, setCalibratePoints] = useState([]);
  const [isCalibrateModalOpen, setIsCalibrateModalOpen] = useState(false);
  const [calibrateDistance, setCalibrateDistance] = useState('');

  // Georeference
  const [georefPoints, setGeorefPoints] = useState([]);
  const [isGeorefModalOpen, setIsGeorefModalOpen] = useState(false);
  const [georefForm, setGeorefForm] = useState({ lat1: '', lng1: '', lat2: '', lng2: '' });
  const [isCapturingGPS, setIsCapturingGPS] = useState(null); // 1 or 2 to indicate which button is loading

  // Live GPS Test
  const [liveTestPos, setLiveTestPos] = useState(null);
  const watchIdRef = useRef(null);

  // Stop watching GPS when unmounting or changing plans
  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [plansRes, objsRes] = await Promise.all([
        getFloorPlans(),
        getAdminObjects()
      ]);
      setFloorPlans(plansRes.data || []);
      setObjects(objsRes.data || []);
      
      if (plansRes.data?.length > 0) {
        selectPlan(plansRes.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlan = async (plan) => {
    setActivePlan(plan);
    setMode('select');
    setOffset({ x: 0, y: 0 });
    setScale(1);
    
    try {
      const [nRes, eRes] = await Promise.all([
        getNodes(plan.id),
        getEdges()
      ]);
      setNodes(nRes.data || []);
      // Filter edges that connect to our nodes
      const nodeIds = new Set((nRes.data || []).map(n => n.id));
      const relevantEdges = (eRes.data || []).filter(e => nodeIds.has(e.from_node_id) || nodeIds.has(e.to_node_id));
      setEdges(relevantEdges);
    } catch (err) {
      console.error(err);
    }
  };

  // --- CANVAS DRAWING ---
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePlan?.image_url) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = getAbsoluteImageUrl(activePlan.image_url);
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);
      
      // Draw map
      ctx.drawImage(img, 0, 0);
      
      // Draw edges
      ctx.lineWidth = 2 / scale;
      edges.forEach(edge => {
        const from = nodes.find(n => n.id === edge.from_node_id);
        const to = nodes.find(n => n.id === edge.to_node_id);
        
        if (from && to) {
          ctx.beginPath();
          ctx.moveTo(from.x_coordinate, from.y_coordinate);
          ctx.lineTo(to.x_coordinate, to.y_coordinate);
          ctx.strokeStyle = '#4F46E5';
          ctx.stroke();
        } else if (from) {
          // Edge goes to another floor
          ctx.beginPath();
          ctx.arc(from.x_coordinate, from.y_coordinate, 8 / scale, 0, Math.PI * 2);
          ctx.strokeStyle = '#EF4444';
          ctx.stroke();
        }
      });
      
      // Draw active drawing edge
      if (mode === 'draw_edge' && drawingEdgeFrom && mousePos) {
        ctx.beginPath();
        ctx.moveTo(drawingEdgeFrom.x_coordinate, drawingEdgeFrom.y_coordinate);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = '#10B981';
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw calibrate line
      if (mode === 'calibrate' && calibratePoints.length > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(calibratePoints[0].x, calibratePoints[0].y, 4 / scale, 0, Math.PI * 2);
        ctx.fill();
        
        if (calibratePoints.length === 1 && mousePos) {
          ctx.beginPath();
          ctx.moveTo(calibratePoints[0].x, calibratePoints[0].y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.strokeStyle = '#EF4444';
          ctx.stroke();
        } else if (calibratePoints.length === 2) {
          ctx.beginPath();
          ctx.arc(calibratePoints[1].x, calibratePoints[1].y, 4 / scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(calibratePoints[0].x, calibratePoints[0].y);
          ctx.lineTo(calibratePoints[1].x, calibratePoints[1].y);
          ctx.strokeStyle = '#EF4444';
          ctx.stroke();
        }
      }
      
      // Draw Georef Points
      if (mode === 'georef' && georefPoints.length > 0) {
        ctx.fillStyle = '#8B5CF6'; // purple
        georefPoints.forEach((pt, idx) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6 / scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = `${14 / scale}px sans-serif`;
          ctx.fillText(`Anchor ${idx + 1}`, pt.x + (10 / scale), pt.y);
        });
      }

      // Draw nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x_coordinate, node.y_coordinate, 6 / scale, 0, Math.PI * 2);
        
        if (selectedNode?.id === node.id) {
          ctx.fillStyle = '#F59E0B'; // yellow
        } else if (hoverNode?.id === node.id) {
          ctx.fillStyle = '#10B981'; // green
        } else if (node.node_type === 'entrance') {
          ctx.fillStyle = '#EC4899'; // pink for entrance
        } else {
          ctx.fillStyle = '#3B82F6'; // blue
        }
        
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
        
        // Label
        ctx.font = `${12 / scale}px sans-serif`;
        ctx.fillStyle = '#111827';
        ctx.fillText(node.name, node.x_coordinate + (10 / scale), node.y_coordinate + (4 / scale));
      });
      
      // Draw live test marker
      if (liveTestPos && activePlan) {
        const pxPos = latlngToPixel(liveTestPos.lat, liveTestPos.lng, activePlan);
        if (pxPos) {
          ctx.beginPath();
          ctx.arc(pxPos.x, pxPos.y, 8 / scale, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444'; // Red live dot
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3 / scale;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(pxPos.x, pxPos.y, 16 / scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fill();
        }
      }

      ctx.restore();
    };
  }, [activePlan, nodes, edges, scale, offset, hoverNode, selectedNode, mode, drawingEdgeFrom, mousePos, calibratePoints, liveTestPos]);

  // --- INTERACTION ---
  
  const getMouseCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    return { x, y };
  };
  
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 5);
    
    // Zoom around mouse
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
    const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);
    
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };
  
  const handleMouseDown = (e) => {
    const coords = getMouseCoords(e);
    
    if (e.button === 1 || (e.button === 0 && mode === 'select')) {
      // Middle click or select mode: Pan
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    if (e.button !== 0) return; // Only left click
    
    if (mode === 'place_node') {
      setPendingNodePos(coords);
      setNodeForm({ name: 'New Node', node_type: 'junction', object_id: '' });
      setIsNodeModalOpen(true);
      setMode('select');
    } else if (mode === 'draw_edge') {
      if (hoverNode) {
        if (!drawingEdgeFrom) {
          setDrawingEdgeFrom(hoverNode);
        } else {
          // Finish drawing edge
          if (drawingEdgeFrom.id !== hoverNode.id) {
            handleCreateEdge(drawingEdgeFrom.id, hoverNode.id);
          }
          setDrawingEdgeFrom(null);
        }
      } else {
        setDrawingEdgeFrom(null); // click empty space cancels
      }
    } else if (mode === 'calibrate') {
      if (calibratePoints.length < 2) {
        const newPts = [...calibratePoints, coords];
        setCalibratePoints(newPts);
        if (newPts.length === 2) {
          setIsCalibrateModalOpen(true);
        }
      }
    } else if (mode === 'georef') {
      if (georefPoints.length < 2) {
        const newPts = [...georefPoints, coords];
        setGeorefPoints(newPts);
        if (newPts.length === 2) {
          setIsGeorefModalOpen(true);
        }
      }
    }
  };
  
  const handleMouseMove = (e) => {
    const coords = getMouseCoords(e);
    setMousePos(coords);
    
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }
    
    // Find hover node
    const hitRadius = 10 / scale;
    const hitNode = nodes.find(n => {
      const dx = n.x_coordinate - coords.x;
      const dy = n.y_coordinate - coords.y;
      return Math.sqrt(dx*dx + dy*dy) <= hitRadius;
    });
    
    setHoverNode(hitNode || null);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // --- ACTIONS ---
  
  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!activePlan || !pendingNodePos) return;
    
    try {
      const payload = {
        name: nodeForm.name,
        floor: activePlan.floor_number,
        x_coordinate: pendingNodePos.x,
        y_coordinate: pendingNodePos.y,
        node_type: nodeForm.node_type,
        floor_plan_id: activePlan.id,
        object_id: nodeForm.object_id ? parseInt(nodeForm.object_id) : null
      };
      
      const res = await createNode(payload);
      if (res.data) {
        setNodes([...nodes, res.data]);
      }
      setIsNodeModalOpen(false);
      setPendingNodePos(null);
    } catch (err) {
      alert("Failed to create node");
    }
  };
  
  const handleCreateEdge = async (fromId, toId) => {
    try {
      const from = nodes.find(n => n.id === fromId);
      const to = nodes.find(n => n.id === toId);
      
      if (!from || !to) return;
      
      // Calculate distance in pixels
      const dx = from.x_coordinate - to.x_coordinate;
      const dy = from.y_coordinate - to.y_coordinate;
      const distPx = Math.sqrt(dx*dx + dy*dy);
      
      // Convert to meters if scale is set
      const scale = activePlan.scale_meters_per_px || 1.0; // fallback 1px = 1m
      const distMeters = distPx * scale;
      
      const res = await createEdge({
        from_node_id: fromId,
        to_node_id: toId,
        distance: distMeters
      });
      
      if (res.data) {
        setEdges([...edges, res.data]);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create edge");
    }
  };
  
  const handleCalibrateSave = async () => {
    if (calibratePoints.length !== 2 || !calibrateDistance || !activePlan) return;
    
    const distPx = Math.sqrt(
      Math.pow(calibratePoints[1].x - calibratePoints[0].x, 2) + 
      Math.pow(calibratePoints[1].y - calibratePoints[0].y, 2)
    );
    
    const scale = parseFloat(calibrateDistance) / distPx;
    
    try {
      const res = await updateFloorPlan(activePlan.id, { scale_meters_per_px: scale });
      if (res.data) {
        setActivePlan(res.data);
        const newPlans = floorPlans.map(p => p.id === res.data.id ? res.data : p);
        setFloorPlans(newPlans);
      }
      setIsCalibrateModalOpen(false);
      setCalibratePoints([]);
      setMode('select');
    } catch (err) {
      alert("Failed to save calibration");
    }
  };

  const handleGeorefSave = async () => {
    if (georefPoints.length !== 2 || !activePlan) return;
    try {
      const payload = {
        anchor_1_x_px: georefPoints[0].x,
        anchor_1_y_px: georefPoints[0].y,
        anchor_1_lat: parseFloat(georefForm.lat1),
        anchor_1_lng: parseFloat(georefForm.lng1),
        anchor_2_x_px: georefPoints[1].x,
        anchor_2_y_px: georefPoints[1].y,
        anchor_2_lat: parseFloat(georefForm.lat2),
        anchor_2_lng: parseFloat(georefForm.lng2),
      };
      
      const res = await georeferenceFloorPlan(activePlan.id, payload);
      if (res.data) {
        setActivePlan(res.data);
        const newPlans = floorPlans.map(p => p.id === res.data.id ? res.data : p);
        setFloorPlans(newPlans);
        
        // Auto-start live test preview to show the user it worked!
        if (!watchIdRef.current) {
          toggleLiveTest();
        }
      }
      setIsGeorefModalOpen(false);
      setGeorefPoints([]);
      setMode('select');
    } catch (err) {
      alert("Failed to save georeferencing");
    }
  };

  const toggleLiveTest = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setLiveTestPos(null);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
        setLiveTestPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      }, (err) => {
        console.error("GPS Watch error", err);
      }, { enableHighAccuracy: true });
    }
  };

  const captureGPS = (pointNumber) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setIsCapturingGPS(pointNumber);
    navigator.geolocation.getCurrentPosition((pos) => {
      setGeorefForm(prev => ({
        ...prev,
        [`lat${pointNumber}`]: pos.coords.latitude,
        [`lng${pointNumber}`]: pos.coords.longitude
      }));
      setIsCapturingGPS(null);
    }, (err) => {
      setIsCapturingGPS(null);
      alert(`GPS Error: ${err.message}`);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  const handleCoordPaste = (e, pointNumber) => {
    const pastedData = e.clipboardData.getData('Text');
    // Match common coordinate formats (e.g., "51.5074, -0.1278" or "51.5074 -0.1278")
    const match = pastedData.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (match) {
      e.preventDefault();
      setGeorefForm(prev => ({
        ...prev,
        [`lat${pointNumber}`]: match[1],
        [`lng${pointNumber}`]: match[2]
      }));
    }
  };

  // Create Floor Plan form state
  const [newPlanForm, setNewPlanForm] = useState({ name: '', floor_number: 0, file: null, is_outdoor: false });
  const [isUploading, setIsUploading] = useState(false);
  
  const handleCreateFloorPlan = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = null;
      if (newPlanForm.file) {
        const upRes = await uploadMapImage(newPlanForm.file);
        imageUrl = upRes.url;
      }
      
      const payload = {
        name: newPlanForm.name,
        floor_number: parseInt(newPlanForm.floor_number),
        image_url: imageUrl,
        is_outdoor: Boolean(newPlanForm.is_outdoor)
      };
      
      const res = await createFloorPlan(payload);
      if (res.data) {
        setFloorPlans([...floorPlans, res.data]);
        selectPlan(res.data);
      }
      setIsPlanModalOpen(false);
    } catch (err) {
      alert("Failed to create floor plan");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-100">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold text-neutral-900">Map Editor</h1>
        
        <div className="flex items-center space-x-4">
          <select 
            value={activePlan?.id || ''} 
            onChange={e => selectPlan(floorPlans.find(p => p.id === e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            {floorPlans.map(p => <option key={p.id} value={p.id}>{p.name} (Floor {p.floor_number})</option>)}
          </select>
          
          <button onClick={() => setIsPlanModalOpen(true)} className="flex items-center px-3 py-1.5 bg-neutral-900 text-white rounded-md text-sm">
            <Plus className="w-4 h-4 mr-1" /> New Floor Plan
          </button>
        </div>
      </div>
      
      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 bg-white border-r flex flex-col items-center py-4 space-y-4 z-10">
          <button onClick={() => setMode('select')} className={`p-3 rounded-xl transition ${mode === 'select' ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Select/Pan">
            <Navigation className="w-6 h-6" />
          </button>
          <button onClick={() => setMode('place_node')} className={`p-3 rounded-xl transition ${mode === 'place_node' ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Place Node">
            <Plus className="w-6 h-6" />
          </button>
          <button onClick={() => setMode('draw_edge')} className={`p-3 rounded-xl transition ${mode === 'draw_edge' ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Draw Edge">
            <Move className="w-6 h-6" />
          </button>
          <button onClick={() => { setMode('calibrate'); setCalibratePoints([]); }} className={`p-3 rounded-xl transition ${mode === 'calibrate' ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Calibrate Scale">
            <Scaling className="w-6 h-6" />
          </button>
          <button onClick={() => { setMode('georef'); setGeorefPoints([]); }} className={`p-3 rounded-xl transition ${mode === 'georef' ? 'bg-purple-100 text-purple-600' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Georeference Floor">
            <Globe className="w-6 h-6" />
          </button>
          <button onClick={toggleLiveTest} className={`p-3 rounded-xl transition ${watchIdRef.current ? 'bg-red-100 text-red-600 animate-pulse' : 'text-neutral-500 hover:bg-neutral-100'}`} title="Live GPS Test">
            <MapPin className="w-6 h-6" />
          </button>
        </div>
        
        {/* Canvas Area */}
        <div className="flex-1 relative bg-neutral-200 overflow-hidden" style={{ cursor: mode === 'select' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair' }}>
          {!activePlan ? (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
              Select or create a floor plan to begin mapping.
            </div>
          ) : (
            <>
              <canvas 
                ref={canvasRef} 
                width={window.innerWidth - 64} 
                height={window.innerHeight - 64}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={e => e.preventDefault()}
                className="absolute inset-0"
              />
              
              {/* Overlays */}
              <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-2 rounded shadow text-xs font-mono text-neutral-600">
                Mode: {mode.toUpperCase()} | Scale: {Math.round(scale*100)}% | Px: {Math.round(mousePos.x)}, {Math.round(mousePos.y)}
                <br/>
                {activePlan.scale_meters_per_px ? `Map Scale: ${activePlan.scale_meters_per_px.toFixed(4)} m/px` : 'Map Scale: Uncalibrated (1m/px)'}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Create Node Modal */}
      {isNodeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h2 className="text-lg font-bold mb-4">Add Node</h2>
            <form onSubmit={handleCreateNode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input type="text" required value={nodeForm.name} onChange={e => setNodeForm({...nodeForm, name: e.target.value})} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium">Type</label>
                <select value={nodeForm.node_type} onChange={e => setNodeForm({...nodeForm, node_type: e.target.value})} className="w-full border rounded p-2 mt-1">
                  {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {nodeForm.node_type === 'exhibit' && (
                <div>
                  <label className="block text-sm font-medium">Linked Museum Object</label>
                  <select value={nodeForm.object_id} onChange={e => setNodeForm({...nodeForm, object_id: e.target.value})} className="w-full border rounded p-2 mt-1">
                    <option value="">None</option>
                    {objects.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setIsNodeModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-neutral-900 text-white rounded">Save Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Create Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h2 className="text-lg font-bold mb-4">New Floor Plan</h2>
            <form onSubmit={handleCreateFloorPlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input type="text" required value={newPlanForm.name} onChange={e => setNewPlanForm({...newPlanForm, name: e.target.value})} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium">Floor Number</label>
                <input type="number" required value={newPlanForm.floor_number} onChange={e => setNewPlanForm({...newPlanForm, floor_number: e.target.value})} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium">Map Image</label>
                <input type="file" accept="image/*" onChange={e => setNewPlanForm({...newPlanForm, file: e.target.files[0]})} className="w-full mt-1" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium">
                  <input type="checkbox" checked={newPlanForm.is_outdoor} onChange={e => setNewPlanForm({...newPlanForm, is_outdoor: e.target.checked})} className="mr-2" />
                  Is Outdoor/GPS Enabled Area?
                </label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={isUploading} className="px-4 py-2 bg-neutral-900 text-white rounded disabled:opacity-50">
                  {isUploading ? 'Uploading...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Calibrate Modal */}
      {isCalibrateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h2 className="text-lg font-bold mb-4">Calibrate Map Scale</h2>
            <p className="text-sm text-neutral-600 mb-4">You selected two points on the map. What is the real-world distance between them?</p>
            <form onSubmit={(e) => { e.preventDefault(); handleCalibrateSave(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Distance (in meters)</label>
                <input type="number" step="0.01" required value={calibrateDistance} onChange={e => setCalibrateDistance(e.target.value)} className="w-full border rounded p-2 mt-1" />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => { setIsCalibrateModalOpen(false); setCalibratePoints([]); setMode('select'); }} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-neutral-900 text-white rounded">Save Scale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Georeference Modal */}
      {isGeorefModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] p-6 max-h-screen overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Georeference Map</h2>
            <p className="text-sm text-neutral-600 mb-4">Assign real-world GPS coordinates to the two anchor points you just selected.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleGeorefSave(); }} className="space-y-6">
              {/* Anchor 1 */}
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-neutral-800 text-sm">Anchor 1</h3>
                  <button type="button" onClick={() => captureGPS(1)} disabled={isCapturingGPS === 1} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium flex items-center hover:bg-purple-200 disabled:opacity-50">
                    <Globe className="w-3 h-3 mr-1" /> {isCapturingGPS === 1 ? 'Locating...' : 'Use My GPS Location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">Latitude</label>
                    <input type="text" inputMode="decimal" required value={georefForm.lat1} onChange={e => setGeorefForm({...georefForm, lat1: e.target.value})} onPaste={e => handleCoordPaste(e, 1)} className="w-full border rounded p-1.5 mt-1 text-sm" placeholder="e.g. 51.5074" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">Longitude</label>
                    <input type="text" inputMode="decimal" required value={georefForm.lng1} onChange={e => setGeorefForm({...georefForm, lng1: e.target.value})} onPaste={e => handleCoordPaste(e, 1)} className="w-full border rounded p-1.5 mt-1 text-sm" placeholder="e.g. -0.1278" />
                  </div>
                </div>
              </div>

              {/* Anchor 2 */}
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-neutral-800 text-sm">Anchor 2</h3>
                  <button type="button" onClick={() => captureGPS(2)} disabled={isCapturingGPS === 2} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium flex items-center hover:bg-purple-200 disabled:opacity-50">
                    <Globe className="w-3 h-3 mr-1" /> {isCapturingGPS === 2 ? 'Locating...' : 'Use My GPS Location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">Latitude</label>
                    <input type="text" inputMode="decimal" required value={georefForm.lat2} onChange={e => setGeorefForm({...georefForm, lat2: e.target.value})} onPaste={e => handleCoordPaste(e, 2)} className="w-full border rounded p-1.5 mt-1 text-sm" placeholder="e.g. 51.5074" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">Longitude</label>
                    <input type="text" inputMode="decimal" required value={georefForm.lng2} onChange={e => setGeorefForm({...georefForm, lng2: e.target.value})} onPaste={e => handleCoordPaste(e, 2)} className="w-full border rounded p-1.5 mt-1 text-sm" placeholder="e.g. -0.1278" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => { setIsGeorefModalOpen(false); setGeorefPoints([]); setMode('select'); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-bold">Save Georeference</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminMapEditor;
