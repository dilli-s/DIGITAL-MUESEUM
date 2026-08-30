import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, MapPin, Navigation, Scan, Camera, X, AlertCircle, RefreshCw, ArrowRight, CornerUpLeft, CornerUpRight, Globe } from 'lucide-react';
import { getNode, getNodes, getFloorPlan, getRoute, getNearbyNodes, getAbsoluteImageUrl, resolveQrLocation } from '../services/mapApi';
import { haversineDistance } from '../utils/geo';

import { usePedestrianDeadReckoning } from '../hooks/usePedestrianDeadReckoning';

import { Html5Qrcode } from 'html5-qrcode';
// ── QR Scanner (html5-qrcode) ──────────────────────────────────────
const InlineQRScanner = ({ onScan, onClose }) => {
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let isMounted = true;
    const html5QrCode = new Html5Qrcode("physical-museum-reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10 },
      (decodedText) => {
        if (isMounted) {
          onScanRef.current(decodedText);
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
        }
      },
      (err) => {
        // Ignore frequent frame decode errors
      }
    ).catch(err => {
      if (isMounted) setError('Camera access denied or unavailable.');
    });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          // html5-qrcode doesn't expose isScanning cleanly, just stop and catch
          scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(e => {});
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white z-50 absolute top-0 left-0 right-0">
        <h2 className="font-bold text-lg">Scan Checkpoint QR</h2>
        <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"><X className="w-5 h-5" /></button>
      </div>
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-white mt-16">
          <div><AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" /><p>{error}</p></div>
        </div>
      ) : (
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden">
          <style>{`
            #physical-museum-reader video {
              object-fit: cover !important;
              width: 100% !important;
              height: 100% !important;
            }
          `}</style>
          <div id="physical-museum-reader" className="absolute inset-0 w-full h-full"></div>
          {/* Overlay to enforce a scan area visually */}
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-black/30"></div>
            <div className="relative w-64 h-64 border-2 border-white/50 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl -translate-x-0.5 -translate-y-0.5"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl translate-x-0.5 -translate-y-0.5"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl -translate-x-0.5 translate-y-0.5"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl translate-x-0.5 translate-y-0.5"></div>
            </div>
            <p className="absolute bottom-12 text-white font-medium text-sm drop-shadow-md text-center px-4">
               Scan a Checkpoint QR code to update location
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const PhysicalMuseum = () => {
  const [currentNode, setCurrentNode] = useState(null);
  const [currentFloorPlan, setCurrentFloorPlan] = useState(null);
  const [destinationNode, setDestinationNode] = useState(null);
  
  const [route, setRoute] = useState(null);
  const [nearbyNodes, setNearbyNodes] = useState([]);
  
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  
  const [allNodes, setAllNodes] = useState([]);
  const canvasRef = useRef(null);
  
  // Outdoor / Handoff state
  const [outdoorMode, setOutdoorMode] = useState(true);
  const [outdoorPos, setOutdoorPos] = useState(null);
  const [entrances, setEntrances] = useState([]);
  const outdoorWatchRef = useRef(null);

  // PDR Integration
  const { position, heading, isTracking, requestPermissions, setManualPosition } = usePedestrianDeadReckoning({ currentFloorPlan });

  // Fetch all nodes to populate destination list and entrances
  useEffect(() => {
    getNodes().then(res => {
      if (res.data) {
        setAllNodes(res.data);
        setEntrances(res.data.filter(n => n.node_type === 'entrance' && n.latitude != null && n.longitude != null));
      }
    }).catch(console.error);
  }, []);

  // Persistent GPS tracking for handoff logic
  useEffect(() => {
    if (navigator.geolocation) {
      outdoorWatchRef.current = navigator.geolocation.watchPosition((pos) => {
        setOutdoorPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      }, console.error, { enableHighAccuracy: true });
    }
    return () => {
      if (outdoorWatchRef.current) navigator.geolocation.clearWatch(outdoorWatchRef.current);
    };
  }, []);

  // Handoff Trigger Logic
  useEffect(() => {
    if (outdoorMode && outdoorPos && entrances.length > 0) {
      let nearest = null;
      let minDist = Infinity;
      entrances.forEach(ent => {
        const d = haversineDistance(outdoorPos.lat, outdoorPos.lng, ent.latitude, ent.longitude);
        if (d < minDist) { minDist = d; nearest = ent; }
      });
      
      if (nearest && (minDist < 15 || outdoorPos.accuracy > 40)) {
        // Switch to indoor mode
        setOutdoorMode(false);
        setCurrentNode(nearest);
        alert("Scan the QR code at the entrance to begin indoor navigation");
      }
    } else if (!outdoorMode && currentNode?.node_type === 'exit' && outdoorPos && outdoorPos.accuracy < 20) {
      // Reverse handoff
      setOutdoorMode(true);
      setCurrentNode(null);
      alert("You've exited the building. Switching back to outdoor GPS.");
    }
  }, [outdoorPos, outdoorMode, entrances, currentNode]);

  // Sync PDR with currentNode on change
  useEffect(() => {
    if (currentNode) {
      setManualPosition(currentNode.x_coordinate, currentNode.y_coordinate, currentNode.floor_plan_id);
    }
  }, [currentNode]);

  // Update Floor Plan & Nearby when Node changes
  useEffect(() => {
    if (!currentNode) return;
    
    // Fetch floor plan if needed
    if (!currentFloorPlan || currentFloorPlan.id !== currentNode.floor_plan_id) {
      if (currentNode.floor_plan_id) {
        getFloorPlan(currentNode.floor_plan_id).then(res => {
          if (res.data) setCurrentFloorPlan(res.data);
        }).catch(console.error);
      }
    }
    
    // Fetch nearby
    getNearbyNodes(currentNode.id, null, 3).then(res => {
      if (res.data) setNearbyNodes(res.data);
    }).catch(console.error);
    
  }, [currentNode, currentFloorPlan]);

  // Update Route when Node or Destination changes
  useEffect(() => {
    if (!currentNode || !destinationNode) {
      setRoute(null);
      return;
    }
    
    getRoute(currentNode.id, destinationNode.id).then(res => {
      if (res.path) {
        setRoute(res);
      } else {
        setRoute(null);
      }
    }).catch(console.error);
  }, [currentNode, destinationNode]);

  // Live Auto-Advance and Reroute checking based on PDR position
  useEffect(() => {
    if (route && route.path && position) {
      // Check if we reached the end
      const dest = route.path[route.path.length - 1];
      if (dest.floor_plan_id === position.floor_plan_id) {
        const distToDest = Math.sqrt(Math.pow(dest.x_coordinate - position.x, 2) + Math.pow(dest.y_coordinate - position.y, 2));
        if (distToDest < 30) { // Arrival radius ~1.5m
           setRoute(null);
           setDestinationNode(null);
           setScanResult('arrived');
           setTimeout(() => setScanResult(null), 4000);
           return;
        }
      }
      
      // Auto-advance checking: if we reached the NEXT node in the path
      if (route.path.length > 1) {
        const nextNode = route.path[1];
        if (nextNode.floor_plan_id === position.floor_plan_id) {
          const distToNext = Math.sqrt(Math.pow(nextNode.x_coordinate - position.x, 2) + Math.pow(nextNode.y_coordinate - position.y, 2));
          if (distToNext < 30) {
            // Reached next node, update current node to this one so route recalculates
            setCurrentNode(nextNode);
          }
        }
      }
    }
  }, [position, route]);

  // Draw Map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFloorPlan?.image_url) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = getAbsoluteImageUrl(currentFloorPlan.image_url);
    
    img.onload = () => {
      // Fit to container width (simplistic scaling for mobile)
      const containerW = canvas.parentElement.clientWidth;
      const scale = containerW / currentFloorPlan.width_px;
      const containerH = currentFloorPlan.height_px * scale;
      
      canvas.width = containerW;
      canvas.height = containerH;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);
      
      // Draw map
      ctx.drawImage(img, 0, 0);
      
      // Draw route if exists
      if (route?.path?.length > 0) {
        ctx.beginPath();
        
        // Filter nodes to current floor
        const floorPath = route.path.filter(n => n.floor_plan_id === currentFloorPlan.id);
        
        if (floorPath.length > 0) {
          // If tracking, start route from current live position instead of first node
          if (position && position.floor_plan_id === currentFloorPlan.id) {
             ctx.moveTo(position.x, position.y);
             ctx.lineTo(floorPath[1]?.x_coordinate || floorPath[0].x_coordinate, floorPath[1]?.y_coordinate || floorPath[0].y_coordinate);
             for (let i = 2; i < floorPath.length; i++) {
               ctx.lineTo(floorPath[i].x_coordinate, floorPath[i].y_coordinate);
             }
          } else {
            ctx.moveTo(floorPath[0].x_coordinate, floorPath[0].y_coordinate);
            for (let i = 1; i < floorPath.length; i++) {
              ctx.lineTo(floorPath[i].x_coordinate, floorPath[i].y_coordinate);
            }
          }
          
          ctx.strokeStyle = '#4F46E5'; // indigo
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          
          // Draw dashed inner line
          ctx.strokeStyle = '#818CF8';
          ctx.lineWidth = 6;
          ctx.setLineDash([15, 15]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      // Draw current position (Live PDR if available, else static)
      const posToDraw = (position && position.floor_plan_id === currentFloorPlan.id) 
        ? { x: position.x, y: position.y }
        : (currentNode && currentNode.floor_plan_id === currentFloorPlan.id) 
          ? { x: currentNode.x_coordinate, y: currentNode.y_coordinate } 
          : null;

      if (posToDraw) {
        // Draw heading cone if tracking
        if (isTracking && position) {
           ctx.save();
           ctx.translate(posToDraw.x, posToDraw.y);
           // Convert compass heading to radians, note map rotation might vary. Adjust as needed.
           const rad = (heading) * (Math.PI / 180); 
           ctx.rotate(rad);
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.arc(0, 0, 40, -Math.PI/6, Math.PI/6);
           ctx.fillStyle = 'rgba(79, 70, 229, 0.3)';
           ctx.fill();
           ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(posToDraw.x, posToDraw.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#10B981'; // emerald
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      
      // Draw destination node
      if (destinationNode && destinationNode.floor_plan_id === currentFloorPlan.id) {
        ctx.beginPath();
        ctx.arc(destinationNode.x_coordinate, destinationNode.y_coordinate, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444'; // red
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      
      ctx.restore();
    };
  }, [currentFloorPlan, currentNode, destinationNode, route, position, heading, isTracking]);

  const handleQRScan = async (data) => {
    console.log("RAW_QR_PAYLOAD:", data);
    setShowScanner(false);
    
    // Determine payload: If the QR code is a URL (e.g., https://museum.app/checkpoint/1234)
    // we want just the last part. Otherwise use the raw string.
    let payload = data.trim();
    try {
       const url = new URL(data);
       payload = url.pathname.split('/').pop() || data;
    } catch(e) {
       // Not a URL, use raw string
    }
    
    try {
      const resData = await resolveQrLocation(payload);
      if (resData && resData.data) {
         const qrNode = resData.data;
         // Now fetch the actual map node to set as currentNode for route/nearby logic
         const nodeRes = await getNode(qrNode.node_id);
         if (nodeRes.data) {
             setCurrentNode(nodeRes.data);
             setScanResult('found');
         } else {
             setScanResult('not-found');
             console.error("QR Code valid, but map node missing from DB.");
         }
      }
    } catch (e) {
      if (e.response && e.response.status === 404) {
         setScanResult('not-found');
         console.error(`QR Code payload '${payload}' not found in the system.`);
      } else {
         setScanResult('error');
         console.error(`Network or fetching error during QR lookup:`, e);
      }
    }
    
    setTimeout(() => setScanResult(null), 3000);
  };

  // If a manual scan succeeds, we are indoors
  useEffect(() => {
    if (currentNode && outdoorMode) {
      setOutdoorMode(false);
    }
  }, [currentNode]);

  const getIconForInstruction = (inst) => {
    const text = inst.toLowerCase();
    if (text.includes('left')) return <CornerUpLeft className="w-8 h-8 text-white" />;
    if (text.includes('right')) return <CornerUpRight className="w-8 h-8 text-white" />;
    if (text.includes('u-turn')) return <RefreshCw className="w-8 h-8 text-white" />;
    if (text.includes('arrive')) return <MapPin className="w-8 h-8 text-white" />;
    return <Navigation className="w-8 h-8 text-white" />;
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-neutral-50 min-h-screen pb-24 relative flex flex-col">
      {/* Top Banner */}
      <div className="bg-neutral-900 text-white p-4 shadow-md z-10 sticky top-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Museum Navigator</h1>
          <button onClick={() => setShowScanner(true)} className="flex items-center bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-white/30 transition">
            <Camera className="w-4 h-4 mr-2" /> Scan Checkpoint
          </button>
        </div>
      </div>
      
      {scanResult === 'not-found' && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" /> Checkpoint QR not recognized in system.
        </div>
      )}
      {scanResult === 'error' && (
        <div className="m-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" /> Network or server error resolving QR.
        </div>
      )}

      {/* Main View */}
      {outdoorMode ? (
        <div className="flex-1 flex flex-col items-center p-8">
          <div className="w-full bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6 text-center shadow-sm">
            <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Outdoor Navigation</h2>
            <p className="text-neutral-600 text-sm mb-4">
              Navigating to the museum entrance...
            </p>
            {outdoorPos ? (
              <div className="bg-white rounded-lg p-3 inline-block shadow-inner text-xs text-neutral-500 font-mono">
                GPS active (Accuracy: {Math.round(outdoorPos.accuracy)}m)
              </div>
            ) : (
              <div className="bg-white rounded-lg p-3 inline-block shadow-inner text-xs text-amber-500 font-mono animate-pulse">
                Locating GPS...
              </div>
            )}
          </div>
          <div className="flex-1 w-full bg-neutral-200 rounded-2xl border-4 border-white shadow-lg overflow-hidden relative flex items-center justify-center">
             <div className="absolute inset-0 bg-[url('https://maps.wikimedia.org/osm-intl/14/4890/6249.png')] bg-cover bg-center opacity-50" />
             {outdoorPos && (
               <div className="relative z-10 w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-xl animate-bounce" />
             )}
             <div className="absolute bottom-4 left-0 right-0 text-center z-10">
               <span className="bg-neutral-900/80 text-white px-4 py-2 rounded-full text-xs font-bold">
                 Move toward the entrance...
               </span>
             </div>
          </div>
          <button onClick={() => setShowScanner(true)} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center">
            <Camera className="w-5 h-5 mr-2"/> Scan Checkpoint to force Indoor Mode
          </button>
        </div>
      ) : !currentNode ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-neutral-200 rounded-full flex items-center justify-center mb-4">
            <Scan className="w-10 h-10 text-neutral-500" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">You are indoors?</h2>
          <p className="text-neutral-500 mb-8">Scan a QR code at any museum junction to establish your location.</p>
          <button onClick={() => setShowScanner(true)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center">
            <Camera className="w-5 h-5 mr-2"/> Open Scanner
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative">
          {/* Instruction Banner */}
          {route && route.instructions && route.instructions.length > 0 && (
            <div className="absolute top-4 left-4 right-4 z-20">
              <div className="bg-indigo-600 rounded-2xl shadow-xl flex items-center overflow-hidden">
                <div className="bg-indigo-700 p-4 flex items-center justify-center">
                  {getIconForInstruction(route.instructions[1] || route.instructions[0])}
                </div>
                <div className="p-4 flex-1">
                  <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Next Step</p>
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {route.instructions[1] || route.instructions[0]}
                  </h3>
                </div>
              </div>
            </div>
          )}
          
          {/* Map Canvas */}
          <div className="w-full bg-neutral-200 flex-1 relative overflow-hidden">
            {currentFloorPlan ? (
               <canvas ref={canvasRef} className="w-full object-contain" />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center text-neutral-500">Loading map...</div>
            )}
            
            {/* Tracking & Navigation Controls */}
            {currentFloorPlan && (
              <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-20">
                <button 
                  onClick={requestPermissions}
                  className={`flex items-center shadow-lg px-4 py-2 rounded-full font-bold text-sm ${isTracking ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600'}`}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  {isTracking ? 'Live Tracking On' : 'Start Live Tracking'}
                </button>
                {isTracking && (
                   <button 
                     onClick={() => {
                        // Re-center/snap back to last known checkpoint if PDR drifted
                        if (currentNode) {
                           setManualPosition(currentNode.x_coordinate, currentNode.y_coordinate, currentNode.floor_plan_id);
                        }
                     }}
                     className="bg-white text-neutral-700 shadow-md p-2 rounded-full hover:bg-neutral-100"
                     title="Snap back to last checkpoint"
                   >
                     <MapPin className="w-5 h-5" />
                   </button>
                )}
              </div>
            )}

            {/* Floor Badge */}
            {currentFloorPlan && (
              <div className="absolute bottom-4 right-4 bg-white shadow-md rounded-lg px-3 py-2 font-bold text-neutral-800 text-sm z-20">
                Floor {currentFloorPlan.floor_number}
              </div>
            )}
          </div>
          
          {/* Nearby Panel */}
          <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 z-30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-neutral-900 text-lg">Nearby</h3>
              <p className="text-xs text-neutral-500 font-medium px-2 py-1 bg-neutral-100 rounded-full">
                At: {currentNode.name}
              </p>
            </div>
            
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide">
              {nearbyNodes.filter(n => n.id !== currentNode.id).slice(0, 8).map(n => {
                let emoji = '📍';
                if (n.node_type === 'restroom') emoji = '🚻';
                if (n.node_type === 'cafe') emoji = '☕';
                if (n.node_type === 'giftshop') emoji = '🛍️';
                if (n.node_type === 'elevator') emoji = '↕️';
                if (n.node_type === 'stairs') emoji = '📶';
                if (n.node_type === 'exhibit') emoji = '🖼️';
                if (n.node_type === 'exit') emoji = '🚪';
                
                return (
                  <button 
                    key={n.id} 
                    onClick={() => setDestinationNode(n)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition ${destinationNode?.id === n.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="font-semibold text-sm text-neutral-800">{n.name}</span>
                  </button>
                )
              })}
              {nearbyNodes.length <= 1 && (
                <div className="text-sm text-neutral-500 italic py-2">Nothing nearby.</div>
              )}
            </div>
            
            {/* Destination Search/Select */}
            <div className="mt-6 border-t pt-4">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">Find something else</label>
              <select 
                className="w-full border border-neutral-300 rounded-xl p-3 bg-neutral-50 font-medium text-neutral-900"
                value={destinationNode?.id || ''}
                onChange={e => {
                  const node = allNodes.find(n => n.id === e.target.value);
                  setDestinationNode(node || null);
                }}
              >
                <option value="">Select a destination...</option>
                {allNodes.filter(n => n.id !== currentNode.id).map(n => (
                  <option key={n.id} value={n.id}>{n.name} (Floor {n.floor})</option>
                ))}
              </select>
            </div>
            
            {destinationNode && route && (
              <div className="mt-4 flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase">Route active</p>
                  <p className="font-semibold text-emerald-900">{Math.round(route.distance)}m away</p>
                </div>
                <button onClick={() => setDestinationNode(null)} className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-sm font-medium hover:bg-emerald-200">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showScanner && <InlineQRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default PhysicalMuseum;
