import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Map, { Marker as MapLibreMarker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { QrCode, MapPin, Navigation, Scan, Camera, X, AlertCircle, RefreshCw, ArrowRight, CornerUpLeft, CornerUpRight, Globe, Maximize, Minimize, Search, Compass, MoreHorizontal, Info, Sparkles } from 'lucide-react';
import { getNode, getNodes, getFloorPlan, getFloorPlans, getRoute, getNearbyNodes, getAbsoluteImageUrl, resolveQrLocation } from '../services/mapApi';
import { getMuseums, getObjects, getGalleries } from '../services/api';
import { haversineDistance, formatDistance } from '../utils/geo';
import ErrorBoundary from '../components/ErrorBoundary';
import NavigationResultScreen from '../components/navigation/NavigationResultScreen';
import OfflineSyncPanel from '../components/shell/OfflineSyncPanel';
import { useSyncStatus } from '../hooks/useSyncStatus';
import offlineStore from '../services/offlineStore';

const isEntrance = (n) => n?.node_type?.split(',').map(s => s.trim()).includes('entrance');
const isExit = (n) => n?.node_type?.split(',').map(s => s.trim()).includes('exit');

const blankMapStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#f8fafc'
      }
    }
  ]
};

const isPointInPolygon = (lat, lng, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat, yi = polygon[i].lng;
    let xj = polygon[j].lat, yj = polygon[j].lng;
    let intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

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
          scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(e => { });
        } catch (e) { }
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
  const [floorPlans, setFloorPlans] = useState([]);
  const [destinationNode, setDestinationNode] = useState(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeTourMode, setActiveTourMode] = useState('single-artifact');

  const [museums, setMuseums] = useState([]);
  const [selectedMuseumId, setSelectedMuseumId] = useState('');

  const [route, setRoute] = useState(null);
  const [nearbyNodes, setNearbyNodes] = useState([]);

  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const [allNodes, setAllNodes] = useState([]);
  const [allObjects, setAllObjects] = useState([]);
  const [allGalleries, setAllGalleries] = useState([]);

  // Requirement 1: Search & Artifact Info Card State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showOfflineSync, setShowOfflineSync] = useState(false);

  const mapContainerStyle = { width: '100%', height: '100%' };
  const mapRef = useRef(null);

  // PDR Integration - only active when NOT in route navigation mode (NavigationResultScreen handles its own PDR)
  const isNavigating = Boolean(destinationNode || isTourActive);
  const {
    position,
    heading,
    stepCount,
    isTracking,
    sensorStatus,
    requestPermissions,
    SetManualPosition
  } = usePedestrianDeadReckoning({
    currentFloorPlan,
    autoStart: !isNavigating,
    enabled: !isNavigating
  });
  const { status: syncStatus, isReady: offlineReady, syncProgress, startSync } = useSyncStatus();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.error(e));
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fetch all nodes, objects, and galleries
  useEffect(() => {
    getMuseums().then(res => {
      if (res.data) setMuseums(res.data);
    }).catch(async error => {
      console.error(error);
      try { setMuseums(await offlineStore.getMuseums()); } catch (_) { /* cache may not exist yet */ }
    });

    getNodes().then(res => {
      if (res.data) {
        setAllNodes(res.data);
      }
    }).catch(console.error);

    getObjects({ per_page: 100 }).then(res => {
      if (res.data) setAllObjects(res.data);
    }).catch(console.error);

    getGalleries({ per_page: 50 }).then(res => {
      if (res.data) setAllGalleries(res.data);
    }).catch(console.error);

    // Initial floor plans fetch
    getFloorPlans(1).then(res => {
      if (res.data && res.data.length > 0) {
        setFloorPlans(res.data);
        if (!currentFloorPlan) setCurrentFloorPlan(res.data[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedMuseumId) {
      getFloorPlans(selectedMuseumId).then(res => {
        if (res.data && res.data.length > 0) {
          setFloorPlans(res.data);
          setCurrentFloorPlan(res.data[0]);
        }
      }).catch(console.error);
    }
  }, [selectedMuseumId]);

  // UX Spec States
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [accuracyRadius, setAccuracyRadius] = useState(10); // Confidence halo in meters
  const [showGraphOverlay, setShowGraphOverlay] = useState(true); // Layer visibility toggle

  // Search Results Filtering
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allObjects.filter(obj => {
      const titleMatch = (obj.title || obj.name || '').toLowerCase().includes(q);
      const creatorMatch = (obj.creator || '').toLowerCase().includes(q);
      const mediumMatch = (obj.medium || '').toLowerCase().includes(q);
      return titleMatch || creatorMatch || mediumMatch;
    });
  }, [searchQuery, allObjects]);

  // Requirement 3: Room Highlighting computation (Pink for destination room)
  const highlightedGalleriesGeoJSON = useMemo(() => {
    if (!allGalleries || allGalleries.length === 0) return null;

    const destLat = destinationNode?.latitude ? parseFloat(destinationNode.latitude) : null;
    const destLng = destinationNode?.longitude ? parseFloat(destinationNode.longitude) : null;

    const musId = selectedMuseumId || currentFloorPlan?.museum_id;

    // Filter galleries by active museum and floor
    const validGalleries = allGalleries.filter(g => {
      const matchMus = !musId || String(g.museum_id) === String(musId);
      const matchFloor = !currentFloorPlan?.floor_number || String(g.floor) === String(currentFloorPlan.floor_number);
      return matchMus && matchFloor && Array.isArray(g.boundary_polygon) && g.boundary_polygon.length >= 3;
    });

    if (validGalleries.length === 0) return null;

    const features = validGalleries.map(g => {
      let coords = g.boundary_polygon.map(p => Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p.lng), Number(p.lat)]);
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push([...coords[0]]); // close polygon loop
      }

      let isDestination = false;
      if (destLat && destLng) {
        const polyPoints = g.boundary_polygon.map(p => Array.isArray(p) ? { lng: Number(p[0]), lat: Number(p[1]) } : { lng: Number(p.lng), lat: Number(p.lat) });
        if (isPointInPolygon(destLat, destLng, polyPoints)) {
          isDestination = true;
        }
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        },
        properties: {
          id: g.id,
          name: g.name,
          isDestination
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }, [allGalleries, selectedMuseumId, currentFloorPlan, destinationNode]);

  // Centroid room label markers
  const roomLabelMarkers = useMemo(() => {
    if (!highlightedGalleriesGeoJSON?.features) return [];
    return highlightedGalleriesGeoJSON.features.map(f => {
      const coords = f.geometry.coordinates[0];
      if (!coords || coords.length === 0) return null;
      let sumLng = 0, sumLat = 0;
      coords.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
      const centerLng = sumLng / coords.length;
      const centerLat = sumLat / coords.length;
      return {
        id: f.properties.id,
        name: f.properties.name,
        lng: centerLng,
        lat: centerLat,
        isDestination: f.properties.isDestination
      };
    }).filter(Boolean);
  }, [highlightedGalleriesGeoJSON]);

  // Breadcrumbs Trail & Accuracy Halo tracking
  useEffect(() => {
    const lat = position?.latitude || currentNode?.latitude;
    const lng = position?.longitude || currentNode?.longitude;
    if (!lat || !lng) return;

    setBreadcrumbs(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = haversineDistance(last.lat, last.lng, Number(lat), Number(lng));
        if (dist < 0.3) return prev; // Ignore micro-jitter (<30cm)
      }
      return [...prev, { lat: Number(lat), lng: Number(lng), time: Date.now() }].slice(-30);
    });

    // Expand accuracy confidence halo slightly during movement (max 15m)
    setAccuracyRadius(r => Math.min(15, r + 0.05));
  }, [position, currentNode]);

  // Breadcrumbs GeoJSON Feature
  const breadcrumbsGeoJSON = useMemo(() => {
    if (!breadcrumbs || breadcrumbs.length < 2) return null;
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: breadcrumbs.map(b => [Number(b.lng), Number(b.lat)])
      }
    };
  }, [breadcrumbs]);

  const handleManualEntry = async (targetMusId = selectedMuseumId) => {
    const musId = targetMusId || selectedMuseumId;
    if (!musId) return alert("Please select a museum first.");

    try {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const plans = isOffline
        ? await offlineStore.getFloorPlans(musId)
        : (await getFloorPlans(musId)).data || [];
      setFloorPlans(plans);

      if (plans.length > 0) {
        const targetFp = plans[0];
        setCurrentFloorPlan(targetFp);

        const nodesRes = await getNodes(targetFp.id);
        const floorNodes = nodesRes.data || [];
        setAllNodes(floorNodes);

        const entrance = floorNodes.find(n => isEntrance(n)) || floorNodes[0];
        if (entrance) {
          setCurrentNode(entrance);
          setManualPosition({
            x: entrance.x_coordinate,
            y: entrance.y_coordinate,
            latitude: entrance.latitude,
            longitude: entrance.longitude,
            floor_plan_id: targetFp.id
          });
        }
      }
    } catch (err) {
      console.error("Manual entry failed:", err);
    }
  };
    // Update Floor Plan & Nearby when Node changes
    useEffect(() => {
      if (!currentNode) return;

      // Fetch floor plan if needed
      if (!currentFloorPlan || currentFloorPlan.id !== currentNode?.floor_plan_id) {
        if (currentNode?.floor_plan_id) {
          getFloorPlan(currentNode.floor_plan_id).then(res => {
            if (res.data) setCurrentFloorPlan(res.data);
          }).catch(console.error);
        }
      }
    }, [currentNode, currentFloorPlan]);

    const navigate = useNavigate();
    const lastAutoTriggerRef = useRef(0);

    // Live Nearby (8m) and Auto-Trigger (1m) based on position
    useEffect(() => {
      if (!position || !position.latitude || allNodes.length === 0) return;

      // 1. Calculate Nearby (8m radius)
      const nearby = allNodes.filter(n => {
        if (!n) return false;
        if (position?.floor_plan_id && n.floor_plan_id && n.floor_plan_id !== position.floor_plan_id) return false;
        if (!n.latitude || !n.longitude) return false;
        if (n.node_type === 'junction' || n.node_type === 'waypoint') return false; // hide boring nodes
        const d = haversineDistance(position.latitude, position.longitude, n.latitude, n.longitude);
        n._tempDist = d;
        return d <= 8; // 8 meters
      }).sort((a, b) => a._tempDist - b._tempDist);

      setNearbyNodes(nearby);

      // 2. Auto-Trigger Info (1m radius for exhibits)
      const now = Date.now();
      if (now - lastAutoTriggerRef.current > 3000) { // 3s debounce
        const nearestExhibit = nearby.find(n => n.node_type === 'exhibit' && n._tempDist <= 1.0 && n.object_id);
        if (nearestExhibit) {
          lastAutoTriggerRef.current = now;
          // Trigger artifact info automatically
          navigate(`/objects/${nearestExhibit.object_id}`);
        }
      }
    }, [position, allNodes, navigate]);

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
      if (route && route.path && Array.isArray(route.path) && position) {
        // Check if we reached the end
        const dest = route.path[route.path.length - 1];
        if (dest && dest.floor_plan_id && position.floor_plan_id && dest.floor_plan_id === position.floor_plan_id && dest.latitude && position.latitude) {
          const distToDest = haversineDistance(position.latitude, position.longitude, dest.latitude, dest.longitude);
          if (distToDest < 1.5) { // Arrival radius ~1.5m
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
          if (nextNode && nextNode.floor_plan_id && position.floor_plan_id && nextNode.floor_plan_id === position.floor_plan_id && nextNode.latitude && position.latitude) {
            const distToNext = haversineDistance(position.latitude, position.longitude, nextNode.latitude, nextNode.longitude);
            if (distToNext < 1.5) {
              // Reached next node, update current node to this one so route recalculates
              setCurrentNode(nextNode);
            }
          }
        }
      }
    }, [position, route]);

    // Center map on user, current node, or first room polygon of loaded museum
    const [mapCenter, setMapCenter] = useState({ lat: 13.0719, lng: 77.6554 });
    useEffect(() => {
      if (position && position.latitude) {
        setMapCenter({ lat: position.latitude, lng: position.longitude });
      } else if (currentNode && currentNode.latitude) {
        setMapCenter({ lat: Number(currentNode.latitude), lng: Number(currentNode.longitude) });
      } else if (allNodes && allNodes.length > 0 && allNodes[0].latitude) {
        setMapCenter({ lat: Number(allNodes[0].latitude), lng: Number(allNodes[0].longitude) });
      } else if (highlightedGalleriesGeoJSON?.features?.length > 0) {
        const firstCoords = highlightedGalleriesGeoJSON.features[0].geometry.coordinates[0];
        if (firstCoords && firstCoords.length > 0) {
          setMapCenter({ lat: Number(firstCoords[0][1]), lng: Number(firstCoords[0][0]) });
        }
      }
    }, [position, currentNode, allNodes, highlightedGalleriesGeoJSON]);

    const handleQRScan = async (data) => {
      console.log("RAW_QR_PAYLOAD:", data);
      setShowScanner(false);

      // Determine payload: If the QR code is a URL (e.g., https://museum.app/checkpoint/1234)
      // we want just the last part. Otherwise use the raw string.
      let payload = data.trim();
      try {
        const url = new URL(data);
        payload = url.pathname.split('/').pop() || data;
      } catch (e) {
        // Not a URL, use raw string
      }

      try {
        const resData = await resolveQrLocation(payload);
        if (resData && resData.data) {
          const qrNode = resData.data;
          // Now fetch the actual map node to set as currentNode for route/nearby logic
          const nodeRes = await getNode(qrNode.node_id);
          if (nodeRes.data) {
            const qrNodeData = nodeRes.data;
            setCurrentNode(qrNodeData);
            setScanResult('found');
            setAccuracyRadius(2); // Ground-truth reset
            setBreadcrumbs([]);   // Clear trail on QR reset

            // If scanned node is an artifact, show info immediately
            if (qrNodeData.node_type === 'exhibit' && qrNodeData.object_id) {
              navigate(`/objects/${qrNodeData.object_id}`);
            }
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



    const getIconForInstruction = (inst) => {
      const text = inst.toLowerCase();
      if (text.includes('left')) return <CornerUpLeft className="w-8 h-8 text-white" />;
      if (text.includes('right')) return <CornerUpRight className="w-8 h-8 text-white" />;
      if (text.includes('u-turn')) return <RefreshCw className="w-8 h-8 text-white" />;
      if (text.includes('arrive')) return <MapPin className="w-8 h-8 text-white" />;
      return <Navigation className="w-8 h-8 text-white" />;
    };

    let dynamicDistanceText = "";
    if (route && destinationNode) {
      let dist = route.distance || 0;

      if (position && route.path && route.path.length > 0) {
        let minDist = Infinity;
        let bestT = 0;
        let bestIdx = 0;

        for (let i = 0; i < route.path.length - 1; i++) {
          let u = route.path[i];
          let v = route.path[i + 1];
          if (u.floor_plan_id !== position.floor_plan_id || v.floor_plan_id !== position.floor_plan_id) continue;

          let l2 = Math.pow(u.x_coordinate - v.x_coordinate, 2) + Math.pow(u.y_coordinate - v.y_coordinate, 2);
          if (l2 === 0) continue;

          let t = ((position.x - u.x_coordinate) * (v.x_coordinate - u.x_coordinate) + (position.y - u.y_coordinate) * (v.y_coordinate - u.y_coordinate)) / l2;
          t = Math.max(0, Math.min(1, t));

          let projX = u.x_coordinate + t * (v.x_coordinate - u.x_coordinate);
          let projY = u.y_coordinate + t * (v.y_coordinate - u.y_coordinate);

          let d2 = Math.pow(position.x - projX, 2) + Math.pow(position.y - projY, 2);
          if (d2 < minDist) {
            minDist = d2;
            bestT = t;
            bestIdx = i;
          }
        }

        if (minDist !== Infinity) {
          let u = route.path[bestIdx];
          let v = route.path[bestIdx + 1];

          if (u.latitude && v.latitude && u.longitude && v.longitude) {
            let bestLat = u.latitude + bestT * (v.latitude - u.latitude);
            let bestLng = u.longitude + bestT * (v.longitude - u.longitude);

            let distToNext = haversineDistance(bestLat, bestLng, v.latitude, v.longitude);
            let remaining = distToNext;
            for (let i = bestIdx + 1; i < route.path.length - 1; i++) {
              let n1 = route.path[i];
              let n2 = route.path[i + 1];
              if (n1.latitude && n2.latitude) {
                remaining += haversineDistance(n1.latitude, n1.longitude, n2.latitude, n2.longitude);
              }
            }
            dist = remaining;
          }
        }
      }
      dynamicDistanceText = `${formatDistance(dist)}m away`;
    }

    if (destinationNode || isTourActive) {
      return (
        <NavigationResultScreen
          initialStartNode={currentNode || (allNodes.find(n => isEntrance(n)) || allNodes[0])}
          destinationNode={destinationNode}
          destinationArtifact={selectedArtifact}
          initialFloorPlan={currentFloorPlan}
          allNodes={allNodes}
          initialNavMode={activeTourMode}
          onBack={() => {
            setDestinationNode(null);
            setIsTourActive(false);
            setRoute(null);
          }}
          onArrival={() => {
            setScanResult('arrived');
            setTimeout(() => setScanResult(null), 3000);
          }}
          onResumeTour={() => {
            setActiveTourMode('full-tour');
            setIsTourActive(true);
          }}
        />
      );
    }

    return (
      <div className={`w-full mx-auto bg-neutral-50 min-h-screen relative flex flex-col ${isFullscreen ? 'max-w-full h-screen overflow-hidden' : 'max-w-lg pb-24'}`}>
        <OfflineSyncPanel
          open={showOfflineSync}
          onClose={() => setShowOfflineSync(false)}
          onSync={startSync}
          syncProgress={syncProgress}
        />
        {/* Top Bar with Back Button, Search & Museum Badge (Spec Item 5) */}
        {!isFullscreen && (
          <div className="bg-neutral-900/80 backdrop-blur-xl text-white p-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] z-30 sticky top-0 flex flex-col gap-2 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/museums')}
                className="p-2 hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-neutral-300 hover:text-white"
                title="Back to Museums"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search exhibits, artworks, rooms..."
                  className="w-full bg-white/10 border border-white/10 rounded-full pl-9 pr-8 py-2.5 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-indigo-400 focus:bg-white/20 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={() => setShowScanner(true)} className="flex items-center bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 p-2.5 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95" title="Scan QR Code">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.trim() && (
              <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden max-h-72 overflow-y-auto z-50 text-neutral-900">
                {filteredObjects.length > 0 ? (
                  filteredObjects.map(obj => {
                    const room = allGalleries.find(g => String(g.id) === String(obj.gallery_id));
                    return (
                      <button
                        key={obj.id}
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedArtifact(obj);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0 text-left transition"
                      >
                        {obj.image_url ? (
                          <img src={getAbsoluteImageUrl(obj.image_url)} alt={obj.title || obj.name} className="w-10 h-10 object-cover rounded-lg border border-neutral-200 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">🖼️</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-neutral-900 truncate">{obj.title || obj.name}</p>
                          <p className="text-xs text-neutral-500 truncate">{room ? room.name : 'Museum Gallery'}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-400" />
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-500">No matching exhibits found.</div>
                )}
              </div>
            )}

            {selectedMuseumId && (
              <div className="flex items-center justify-between text-xs text-neutral-400 px-2 font-medium">
                <span>{museums.find(m => String(m.id) === String(selectedMuseumId))?.name || 'Museum Navigation'}</span>
                {currentFloorPlan && <span className="bg-neutral-800 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">Floor {currentFloorPlan.floor_number}</span>}
              </div>
            )}
          </div>
        )}

        {/* Artifact Info Card Modal */}
        {selectedArtifact && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
              <div className="relative h-48 bg-neutral-900">
                {selectedArtifact.image_url ? (
                  <img src={getAbsoluteImageUrl(selectedArtifact.image_url)} alt={selectedArtifact.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 font-bold">No Image Available</div>
                )}
                <button onClick={() => setSelectedArtifact(null)} className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black/80">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5">
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                  {allGalleries.find(g => String(g.id) === String(selectedArtifact.gallery_id))?.name || 'Museum Exhibit'}
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-1">{selectedArtifact.title || selectedArtifact.name}</h3>
                {selectedArtifact.creator && <p className="text-xs text-neutral-500 mb-3">{selectedArtifact.creator} ({selectedArtifact.creation_date || 'Date unknown'})</p>}
                {selectedArtifact.description && <p className="text-xs text-neutral-600 line-clamp-3 mb-5 leading-relaxed">{selectedArtifact.description}</p>}

                <button
                  onClick={() => {
                    let targetNode = allNodes.find(n => n.object_id === selectedArtifact.id ||
                      (n.latitude && selectedArtifact.latitude &&
                        Math.abs(parseFloat(n.latitude) - parseFloat(selectedArtifact.latitude)) < 0.0005 &&
                        Math.abs(parseFloat(n.longitude) - parseFloat(selectedArtifact.longitude)) < 0.0005));

                    if (!targetNode && allNodes.length > 0 && selectedArtifact.latitude && selectedArtifact.longitude) {
                      // Snap to the absolute closest physical graph node to allow A* routing to work
                      let minDist = Infinity;
                      for (const n of allNodes) {
                        if (n.latitude && n.longitude && n.node_type !== 'waypoint') {
                          const dist = haversineDistance(
                            parseFloat(selectedArtifact.latitude),
                            parseFloat(selectedArtifact.longitude),
                            parseFloat(n.latitude),
                            parseFloat(n.longitude)
                          );
                          if (dist < minDist) {
                            minDist = dist;
                            targetNode = n;
                          }
                        }
                      }
                    }

                    // Extreme fallback if no coordinates exist or no nodes found
                    if (!targetNode && allNodes.length > 0) {
                      targetNode = allNodes.find(n => n.node_type === 'exhibit' || n.node_type === 'room') || allNodes[0];
                    }

                    if (!currentNode && allNodes.length > 0) {
                      const startNode = allNodes.find(n => isEntrance(n)) || allNodes[0];
                      setCurrentNode(startNode);
                    }

                    if (targetNode) {
                      setActiveTourMode('single-artifact');
                      setIsTourActive(false);
                      setDestinationNode(targetNode);
                    }
                    setSelectedArtifact(null);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Navigation className="w-4 h-4" /> Start Navigation to Exhibit
                </button>
              </div>
            </div>
          </div>
        )}

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
        {!currentNode ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Scan className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-600 mb-3">You are indoors?</h2>
            <p className="text-neutral-500 mb-8 max-w-xs mx-auto leading-relaxed">Scan a QR code at any museum junction to establish your location precisely.</p>
            <button onClick={() => { requestPermissions(); setShowScanner(true); }} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center">
              <Camera className="w-5 h-5 mr-2" /> Open Scanner
            </button>

            <div className="w-full mt-10 border-t border-neutral-200 pt-8">
              <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3">Or enter manually</p>
              <select
                value={selectedMuseumId}
                onChange={e => setSelectedMuseumId(e.target.value)}
                className="w-full bg-white/50 backdrop-blur-sm border border-neutral-300 p-3.5 rounded-xl mb-4 text-neutral-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
              >
                <option value="">Select your museum...</option>
                {museums.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={() => { requestPermissions(); handleManualEntry(); }}
                disabled={!selectedMuseumId}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center ${selectedMuseumId ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
              >
                <Navigation className="w-5 h-5 mr-2" /> Start Navigation
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative">
            {/* Requirement 3: Active Route Top Banner with Cancel Control */}
            {destinationNode && (
              <div className="absolute top-4 left-4 right-4 z-20">
                <div className="bg-neutral-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-xl border border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-pink-500/20 border border-pink-500 flex items-center justify-center text-pink-400 flex-shrink-0">
                      <Navigation className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">Directions to</p>
                      <h4 className="font-bold text-sm text-white truncate">{destinationNode.name || 'Destination Exhibit'}</h4>
                      {dynamicDistanceText && <p className="text-xs text-neutral-400 font-mono">{dynamicDistanceText}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDestinationNode(null);
                      setRoute(null);
                    }}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition flex-shrink-0"
                    title="Cancel Navigation"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Map Canvas - Basemap-Free Schematic MapLibre */}
            <div className="w-full bg-slate-50 flex-1 relative overflow-hidden flex items-center justify-center">
              <Map
                initialViewState={{
                  latitude: mapCenter.lat,
                  longitude: mapCenter.lng,
                  zoom: 19
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle={blankMapStyle}
              >
                {/* Room Polygons with Spec Maroon/Slate Outlines & Pink Destination Highlight */}
                {highlightedGalleriesGeoJSON && (
                  <Source id="galleries-source" type="geojson" data={highlightedGalleriesGeoJSON}>
                    <Layer
                      id="galleries-fill"
                      type="fill"
                      paint={{
                        'fill-color': [
                          'case',
                          ['get', 'isDestination'], '#fbcfe8',
                          '#ffffff'
                        ],
                        'fill-opacity': [
                          'case',
                          ['get', 'isDestination'], 0.8,
                          0.6
                        ]
                      }}
                    />
                    <Layer
                      id="galleries-line"
                      type="line"
                      paint={{
                        'line-color': [
                          'case',
                          ['get', 'isDestination'], '#f472b6',
                          '#475569'
                        ],
                        'line-width': [
                          'case',
                          ['get', 'isDestination'], 2.5,
                          1.5
                        ]
                      }}
                    />
                  </Source>
                )}

                {/* Requirement 2: Fading Breadcrumb Trail Line */}
                {breadcrumbsGeoJSON && (
                  <Source id="breadcrumbs-source" type="geojson" data={breadcrumbsGeoJSON}>
                    <Layer id="breadcrumbs-line" type="line" paint={{
                      'line-color': '#3b82f6',
                      'line-width': 4,
                      'line-dasharray': [1, 2],
                      'line-opacity': 0.65
                    }} />
                  </Source>
                )}

                {/* Dotted Route Polyline */}
                {route?.path?.length > 1 && (
                  <Source id="route-source" type="geojson" data={{
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: route.path.filter(n => n.latitude && n.longitude).map(n => [Number(n.longitude), Number(n.latitude)])
                    }
                  }}>
                    <Layer id="route-line" type="line" paint={{
                      'line-color': '#4F46E5',
                      'line-width': 5,
                      'line-dasharray': [2, 2]
                    }} />
                  </Source>
                )}

                {/* Room Centroid Labels */}
                {roomLabelMarkers.map(lbl => (
                  <MapLibreMarker key={`lbl-${lbl.id}`} longitude={lbl.lng} latitude={lbl.lat} anchor="center">
                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs pointer-events-none transition ${lbl.isDestination ? 'bg-pink-600 text-white shadow-pink-300' : 'bg-white/85 text-slate-700 border border-slate-300'}`}>
                      {lbl.name}
                    </div>
                  </MapLibreMarker>
                ))}

                {/* Entrance/Exit Pill Markers (Controlled by Graph Overlay Toggle) */}
                {showGraphOverlay && allNodes.filter(n => n.latitude && n.longitude).map(n => {
                  const nIsEnt = isEntrance(n);
                  const nIsExt = isExit(n);
                  const isDest = destinationNode?.id === n.id;

                  if (nIsEnt && nIsExt) {
                    return (
                      <MapLibreMarker key={n.id} longitude={Number(n.longitude)} latitude={Number(n.latitude)} anchor="center">
                        <div className="flex rounded-full overflow-hidden shadow-md border border-white font-bold text-[10px]">
                          <span className="bg-emerald-600 text-white px-2 py-0.5">ENTRANCE</span>
                          <span className="bg-red-600 text-white px-2 py-0.5">EXIT</span>
                        </div>
                      </MapLibreMarker>
                    );
                  }
                  if (nIsEnt) {
                    return (
                      <MapLibreMarker key={n.id} longitude={Number(n.longitude)} latitude={Number(n.latitude)} anchor="center">
                        <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide">
                          ENTRANCE
                        </div>
                      </MapLibreMarker>
                    );
                  }
                  if (nIsExt) {
                    return (
                      <MapLibreMarker key={n.id} longitude={Number(n.longitude)} latitude={Number(n.latitude)} anchor="center">
                        <div className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide">
                          EXIT
                        </div>
                      </MapLibreMarker>
                    );
                  }
                  if (isDest) {
                    return (
                      <MapLibreMarker key={n.id} longitude={Number(n.longitude)} latitude={Number(n.latitude)} anchor="center">
                        <div className="w-6 h-6 rounded-full bg-pink-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">
                          ★
                        </div>
                      </MapLibreMarker>
                    );
                  }
                  return null;
                })}

                {/* Requirement 1: Live Position Marker with Directional Cone & Accuracy Halo */}
                {(position?.latitude || currentNode?.latitude) && (
                  <MapLibreMarker
                    longitude={Number(position?.longitude || currentNode?.longitude)}
                    latitude={Number(position?.latitude || currentNode?.latitude)}
                    anchor="center"
                  >
                    <div className="relative flex items-center justify-center pointer-events-none">
                      {/* Soft Semi-Transparent Accuracy Halo (Reflects confidence, shrinks on QR reset) */}
                      <div
                        className="absolute rounded-full border border-blue-400/60 bg-blue-500/15 transition-all duration-500 animate-pulse"
                        style={{
                          width: `${Math.max(32, accuracyRadius * 6)}px`,
                          height: `${Math.max(32, accuracyRadius * 6)}px`
                        }}
                      />

                      {/* Rotating Teardrop / Directional Cone Fan (Points in visitor's heading direction) */}
                      <div
                        className="absolute w-32 h-32 flex items-center justify-center transition-transform duration-150 ease-out"
                        style={{ transform: `rotate(${heading || 0}deg)` }}
                      >
                        <svg width="128" height="128" viewBox="0 0 100 100" fill="none">
                          <path d="M50 50 L15 0 A50 50 0 0 1 85 0 Z" fill="url(#coneGrad)" fillOpacity="0.45" />
                          <defs>
                            <linearGradient id="coneGrad" x1="50" y1="50" x2="50" y2="0" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.1" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.75" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>

                      {/* Teardrop / Solid Blue Position Dot */}
                      <div className="relative z-10 w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      </div>
                    </div>
                  </MapLibreMarker>
                )}
              </Map>

              {/* Requirement 4: Bottom Control Bar (3-Icon Layout) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-slate-200">
                {/* 1. Recenter / Locate Button */}
                <button
                  onClick={() => {
                    const lat = position?.latitude || currentNode?.latitude;
                    const lng = position?.longitude || currentNode?.longitude;
                    if (lat && lng) {
                      setMapCenter({ lat: Number(lat), lng: Number(lng) });
                    }
                  }}
                  className="p-2.5 hover:bg-slate-100 rounded-full transition text-indigo-600 flex items-center justify-center"
                  title="Recenter Map"
                >
                  <Compass className="w-5 h-5" />
                </button>

                <div className="w-px h-5 bg-slate-300" />

                {/* 2. Layer Visibility Toggle Button */}
                <button
                  onClick={() => setShowGraphOverlay(!showGraphOverlay)}
                  className={`p-2.5 rounded-full transition flex items-center justify-center ${showGraphOverlay ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-100'}`}
                  title={showGraphOverlay ? 'Hide Graph Overlay' : 'Show Graph Overlay'}
                >
                  <Globe className="w-5 h-5" />
                </button>

                <div className="w-px h-5 bg-slate-300" />

                {/* 3. More Options Menu Button */}
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="p-2.5 hover:bg-slate-100 rounded-full transition text-slate-700 flex items-center justify-center"
                  title="More Options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Options Slide-up Overlay Menu */}
              {showOptionsMenu && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-3 w-64 z-40 text-xs font-semibold text-neutral-800 space-y-2 animate-in fade-in slide-in-from-bottom duration-150">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2">Floor Selector</div>
                  <div className="flex flex-col gap-1.5 px-1 max-h-40 overflow-y-auto">
                    {(floorPlans.length > 0 ? floorPlans : [{ id: 'f1', name: 'Floor 1', floor_number: 1 }, { id: 'f2', name: 'Apartment Gallery', floor_number: 2 }]).map(fp => (
                      <button
                        key={fp.id}
                        onClick={async () => {
                          setCurrentFloorPlan(fp);
                          setShowOptionsMenu(false);
                          try {
                            const res = await getNodes(fp.id);
                            if (res.data && res.data.length > 0) {
                              setAllNodes(res.data);
                              const ent = res.data.find(n => isEntrance(n)) || res.data[0];
                              if (ent) {
                                setCurrentNode(ent);
                                setManualPosition({
                                  x: ent.x_coordinate,
                                  y: ent.y_coordinate,
                                  latitude: ent.latitude,
                                  longitude: ent.longitude,
                                  floor_plan_id: fp.id
                                });
                              }
                            }
                          } catch (e) {
                            console.error("Failed to switch floor:", e);
                          }
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-left font-bold transition flex items-center justify-between text-xs ${currentFloorPlan?.id === fp.id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
                      >
                        <span className="truncate">{fp.name || `Floor ${fp.floor_number}`}</span>
                        <span className="text-[10px] opacity-75 font-mono">F{fp.floor_number}</span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-neutral-100 pt-2 space-y-1">
                    <button
                      onClick={() => { toggleFullscreen(); setShowOptionsMenu(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-100 rounded-lg flex items-center gap-2"
                    >
                      <Maximize className="w-4 h-4 text-neutral-600" /> Toggle Fullscreen
                    </button>
                    <button
                      onClick={() => { requestPermissions(); setShowOptionsMenu(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-100 rounded-lg flex items-center gap-2"
                    >
                      <Navigation className="w-4 h-4 text-emerald-600" /> {isTracking ? 'Live PDR Gyro Active' : 'Enable PDR Gyro Sensors'}
                    </button>
                    <button
                      onClick={() => { setBreadcrumbs([]); setShowOptionsMenu(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-100 rounded-lg flex items-center gap-2 text-amber-700"
                    >
                      <RefreshCw className="w-4 h-4 text-amber-600" /> Reset Breadcrumb Trail
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Overlay Instructions */}
            {isFullscreen && route && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-indigo-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-2xl shadow-2xl z-30 flex items-center gap-4 w-[90%] max-w-sm">
                <div className="bg-white/20 p-2 rounded-full">
                  <Navigation className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-200 uppercase">{dynamicDistanceText}</p>
                  <p className="font-bold text-lg">{route.instructions[1] || route.instructions[0]}</p>
                </div>
              </div>
            )}

            {/* Nearby Panel */}
            {!isFullscreen && (
              <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 z-30 flex-shrink-0">
                {/* Full Room Tour CTA Button */}
                <button
                  onClick={() => {
                    setActiveTourMode('full-tour');
                    setDestinationNode(null);
                    setIsTourActive(true);
                  }}
                  className="w-full py-3.5 px-4 mb-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.01] active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Start Full Room Tour (All Exhibits)</span>
                </button>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-neutral-900 text-lg">Nearby Points</h3>
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
                        onClick={() => {
                          setActiveTourMode('single-artifact');
                          setIsTourActive(false);
                          setDestinationNode(n);
                        }}
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
                      if (node) {
                        setActiveTourMode('single-artifact');
                        setIsTourActive(false);
                      }
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
                      <p className="font-semibold text-emerald-900">{dynamicDistanceText}</p>
                    </div>
                    <button onClick={() => setDestinationNode(null)} className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-sm font-medium hover:bg-emerald-200">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showScanner && <InlineQRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}
      </div>
    );
  };

export default PhysicalMuseum;

