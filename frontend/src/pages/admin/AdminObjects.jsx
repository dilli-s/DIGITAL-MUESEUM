import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAdminObjects, createAdminObject, updateAdminObject, deleteAdminObject, getAdminMuseums, getAdminGalleries, getAdminCollections, uploadFile } from '../../services/api';
import { getNodes, getEdges, getFloorPlans } from '../../services/mapApi';
import { mapXyToGps, gpsToMapXy } from '../../utils/geo';
import ErrorBoundary from '../../components/ErrorBoundary';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Edit, Trash2, X, AlertTriangle, Search, MapPin, CheckCircle, Upload, LayoutGrid, Globe, Layers } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import GenericCsvImporter from '../../components/admin/GenericCsvImporter';

const getFloorPlanImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const mapApiBase = import.meta.env.VITE_MAP_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:5001/api` : 'http://127.0.0.1:5001/api');
  const host = mapApiBase.replace(/\/api\/?$/, '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${host}${cleanUrl}`;
};

const schematicMapStyle = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#f8fafc'
      }
    },
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const getPolygonCentroid = (points) => {
  if (!points || points.length === 0) return null;
  const validPoints = points.filter(p => p && p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng));
  if (validPoints.length === 0) return null;
  let sumLat = 0, sumLng = 0;
  validPoints.forEach(p => { sumLat += Number(p.lat); sumLng += Number(p.lng); });
  return { lat: sumLat / validPoints.length, lng: sumLng / validPoints.length };
};

const isWithinMuseumBounds = (lat, lng, museum) => {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  
  const mLat = museum && museum.latitude ? parseFloat(museum.latitude) : 13.073226;
  const mLng = museum && museum.longitude ? parseFloat(museum.longitude) : 80.257045;
  
  return Math.abs(lat - mLat) <= 0.005 && Math.abs(lng - mLng) <= 0.005;
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

const AdminObjects = () => {
  const [objects, setObjects] = useState([]);
  const [museums, setMuseums] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [collections, setCollections] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all'); // 'all', 'unplaced', 'placed'
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', description: '', museum_id: '', gallery_id: '', collection_id: '',
    creator: '', creation_date: '', medium: '', dimensions: '',
    image_url: '', model_3d_url: '', audio_url: '', latitude: '', longitude: ''
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [mapViewState, setMapViewState] = useState({ latitude: 13.073226, longitude: 80.257045, zoom: 17 });
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [mapViewMode, setMapViewMode] = useState('floorplan'); // 'floorplan' (default) or 'geo'
  const [imageLoadError, setImageLoadError] = useState(false);
  const [clickPinXy, setClickPinXy] = useState(null);
  const floorPlanContainerRef = useRef(null);
  const floorPlanImageRef = useRef(null);

  const handleUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.data && res.data.url) {
        setFormData(prev => ({ ...prev, [field]: res.data.url }));
      }
    } catch (err) {
      console.log('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchObjects();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [objsRes, musRes, galsRes, colsRes, nodesRes, edgesRes, fpsRes] = await Promise.all([
        getAdminObjects(),
        getAdminMuseums(),
        getAdminGalleries(),
        getAdminCollections(),
        getNodes().catch(() => ({ data: [] })),
        getEdges().catch(() => ({ data: [] })),
        getFloorPlans().catch(() => ({ data: [] }))
      ]);
      setObjects(objsRes.data || (Array.isArray(objsRes) ? objsRes : []));
      setMuseums(musRes.data || (Array.isArray(musRes) ? musRes : []));
      setGalleries(galsRes.data || (Array.isArray(galsRes) ? galsRes : []));
      setCollections(colsRes.data || (Array.isArray(colsRes) ? colsRes : []));
      setNodes(nodesRes.data || (Array.isArray(nodesRes) ? nodesRes : []));
      setEdges(edgesRes.data || (Array.isArray(edgesRes) ? edgesRes : []));
      setFloorPlans(fpsRes.data || (Array.isArray(fpsRes) ? fpsRes : []));
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeFloorPlan = useMemo(() => {
    if (!floorPlans.length) return null;
    const selectedGal = galleries.find(g => String(g.id) === String(formData.gallery_id));
    if (selectedGal && selectedGal.floor_plan_id) {
      const match = floorPlans.find(fp => String(fp.id) === String(selectedGal.floor_plan_id));
      if (match) return match;
    }
    if (selectedGal && selectedGal.floor != null) {
      const match = floorPlans.find(fp => String(fp.museum_id) === String(formData.museum_id) && fp.floor_number === selectedGal.floor);
      if (match) return match;
    }
    if (formData.museum_id) {
      const match = floorPlans.find(fp => String(fp.museum_id) === String(formData.museum_id));
      if (match) return match;
    }
    return floorPlans[0] || null;
  }, [formData.museum_id, formData.gallery_id, floorPlans, galleries]);

  useEffect(() => {
    setImageLoadError(false);
  }, [activeFloorPlan]);

  const currentPinXy = useMemo(() => {
    if (clickPinXy) return clickPinXy;
    if (!formData.latitude || !formData.longitude) return null;
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (!activeFloorPlan) return null;
    const pt = gpsToMapXy(lat, lng, activeFloorPlan);
    if (pt && pt.x != null && pt.y != null) {
      return { x: pt.x, y: pt.y };
    }
    return null;
  }, [clickPinXy, formData.latitude, formData.longitude, activeFloorPlan]);

  const handleFloorPlanClick = (e) => {
    const el = floorPlanImageRef.current || floorPlanContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const selectedMus = museums.find(m => m.id === parseInt(formData.museum_id));
    const gps = mapXyToGps(normX, normY, activeFloorPlan, selectedMus);

    if (gps && gps.lat != null && gps.lng != null) {
      setClickPinXy({ x: normX, y: normY });
      setFormData(prev => ({
        ...prev,
        latitude: gps.lat.toFixed(6),
        longitude: gps.lng.toFixed(6)
      }));
    }
  };

  const getPointSvgCoords = (p) => {
    if (!p) return null;
    if (p.x != null && p.y != null) {
      const x = p.x <= 1.0 ? p.x * 100 : p.x;
      const y = p.y <= 1.0 ? p.y * 100 : p.y;
      return { x, y };
    }
    if (p.lat != null && p.lng != null && activeFloorPlan) {
      const pt = gpsToMapXy(Number(p.lat), Number(p.lng), activeFloorPlan);
      if (pt && pt.x != null && pt.y != null) {
        return { x: pt.x * 100, y: pt.y * 100 };
      }
    }
    return null;
  };

  const getRoomSvgCentroid = (pts) => {
    if (!pts || pts.length < 3) return null;
    let sumX = 0, sumY = 0, count = 0;
    pts.forEach(p => {
      const coord = getPointSvgCoords(p);
      if (coord) {
        sumX += coord.x;
        sumY += coord.y;
        count++;
      }
    });
    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  };

  const getGalleryGpsPolygon = (gallery, fp = activeFloorPlan, mus = null) => {
    if (!gallery || !Array.isArray(gallery.boundary_polygon)) return [];
    return gallery.boundary_polygon.map(p => {
      if (p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng)) {
        return { lat: Number(p.lat), lng: Number(p.lng), x: p.x, y: p.y };
      }
      if (fp && p.x != null && p.y != null) {
        const gps = mapXyToGps(p.x, p.y, fp, mus);
        if (gps.lat != null && gps.lng != null) {
          return { lat: gps.lat, lng: gps.lng, x: p.x, y: p.y };
        }
      }
      return p;
    });
  };

  useEffect(() => {
    if (formData.museum_id && isModalOpen) {
      const selectedMus = museums.find(m => m.id === parseInt(formData.museum_id));
      let centerLat = 13.073226;
      let centerLng = 80.257045;
      if (formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude))) {
        centerLat = parseFloat(formData.latitude);
        centerLng = parseFloat(formData.longitude);
      } else if (selectedMus && selectedMus.latitude && selectedMus.longitude) {
        centerLat = parseFloat(selectedMus.latitude);
        centerLng = parseFloat(selectedMus.longitude);
      }
      setMapViewState(prev => ({ ...prev, latitude: centerLat, longitude: centerLng, zoom: 18 }));
    }
  }, [formData.museum_id, isModalOpen]);

  const matchedRoom = useMemo(() => {
    if (!formData.museum_id || !formData.latitude || !formData.longitude) return null;
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;

    const mus = museums.find(m => m.id === parseInt(formData.museum_id));
    const musGalleries = galleries.filter(g => g.museum_id === parseInt(formData.museum_id) && g.boundary_polygon && g.boundary_polygon.length >= 3);
    return musGalleries.find(g => {
      const poly = getGalleryGpsPolygon(g, activeFloorPlan, mus);
      return isPointInPolygon(lat, lng, poly);
    });
  }, [formData.museum_id, formData.latitude, formData.longitude, galleries, activeFloorPlan, museums]);

  const selectedGallery = useMemo(() => {
    if (!formData.gallery_id) return null;
    return galleries.find(g => g.id.toString() === formData.gallery_id.toString());
  }, [formData.gallery_id, galleries]);

  const isSelectedRoomShapeSaved = useMemo(() => {
    if (!selectedGallery) return false;
    return Array.isArray(selectedGallery.boundary_polygon) && selectedGallery.boundary_polygon.length >= 3;
  }, [selectedGallery]);

  const isPointInSelectedRoom = useMemo(() => {
    if (!selectedGallery || !isSelectedRoomShapeSaved || !formData.latitude || !formData.longitude) return false;
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;

    const mus = museums.find(m => m.id === parseInt(formData.museum_id));
    const polyGps = getGalleryGpsPolygon(selectedGallery, activeFloorPlan, mus);
    if (!polyGps || polyGps.length < 3 || polyGps.some(p => p.lat == null || p.lng == null)) {
      return false;
    }
    return isPointInPolygon(lat, lng, polyGps);
  }, [selectedGallery, isSelectedRoomShapeSaved, formData.latitude, formData.longitude, activeFloorPlan, museums, formData.museum_id]);

  const filteredObjects = useMemo(() => {
    return objects.filter(obj => {
      const matchesSearch = !searchQuery || (obj.name || obj.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const hasCoords = obj.latitude !== null && obj.latitude !== undefined && obj.latitude !== '' &&
                        obj.longitude !== null && obj.longitude !== undefined && obj.longitude !== '';
      if (!matchesSearch) return false;
      if (locationFilter === 'unplaced') return !hasCoords;
      if (locationFilter === 'placed') return hasCoords;
      return true;
    });
  }, [objects, searchQuery, locationFilter]);

  const roomGeoJSON = useMemo(() => {
    if (!formData.museum_id) return { type: 'FeatureCollection', features: [] };
    const mus = museums.find(m => m.id === parseInt(formData.museum_id));
    const features = galleries
      .filter(g => g.museum_id === parseInt(formData.museum_id) && g.boundary_polygon && g.boundary_polygon.length >= 3)
      .map(g => {
        const polyGps = getGalleryGpsPolygon(g, activeFloorPlan, mus);
        const validCoords = polyGps
          .filter(p => p && p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng))
          .map(p => [Number(p.lng), Number(p.lat)]);
        if (validCoords.length < 3) return null;
        const coords = [...validCoords, validCoords[0]];
        return {
          type: 'Feature',
          properties: { id: g.id, name: g.name },
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          }
        };
      })
      .filter(Boolean);
    return { type: 'FeatureCollection', features };
  }, [galleries, formData.museum_id, activeFloorPlan, museums]);

  const edgesGeoJSON = useMemo(() => {
    const features = edges.map(edge => {
      const n1 = nodes.find(n => n.id === edge.from_node_id);
      const n2 = nodes.find(n => n.id === edge.to_node_id);
      if (!n1?.latitude || !n2?.latitude) return null;
      return {
        type: 'Feature',
        properties: { id: edge.id, edge_type: edge.edge_type },
        geometry: {
          type: 'LineString',
          coordinates: [ [n1.longitude, n1.latitude], [n2.longitude, n2.latitude] ]
        }
      };
    }).filter(Boolean);
    return { type: 'FeatureCollection', features };
  }, [edges, nodes]);

  const fetchObjects = async () => {
    try {
      const res = await getAdminObjects({ search: searchQuery });
      setObjects(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const openAddModal = () => {
    setEditingObject(null);
    setFormData({ 
      title: '', description: '', museum_id: museums.length > 0 ? museums[0].id : '', 
      gallery_id: '', collection_id: '', creator: '', creation_date: '', 
      medium: '', dimensions: '', image_url: '', model_3d_url: '', audio_url: '',
      latitude: '', longitude: ''
    });
    setFormError(null);
    setClickPinXy(null);
    setMapViewMode('floorplan');
    setImageLoadError(false);
    setIsModalOpen(true);
  };

  const openEditModal = (obj) => {
    setEditingObject(obj);
    setFormData({
      title: obj.name || obj.title || '',
      description: obj.description || '',
      museum_id: obj.museum_id || '',
      gallery_id: obj.gallery_id || '',
      collection_id: obj.collection_id || '',
      creator: obj.creator || '',
      creation_date: obj.creation_date || '',
      medium: obj.medium || '',
      dimensions: obj.dimensions || '',
      image_url: obj.image || obj.image_url || '',
      model_3d_url: obj.model_3d_url || '',
      audio_url: obj.audio_url || '',
      latitude: obj.latitude !== null && obj.latitude !== undefined ? obj.latitude : '',
      longitude: obj.longitude !== null && obj.longitude !== undefined ? obj.longitude : ''
    });
    setFormError(null);
    setClickPinXy(null);
    setMapViewMode('floorplan');
    setImageLoadError(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    
    try {
      const payload = { ...formData };
      if (!payload.museum_id) {
        throw new Error("Museum selection is required.");
      }

      const hasLatitude = payload.latitude !== '' && payload.latitude != null;
      const hasLongitude = payload.longitude !== '' && payload.longitude != null;
      const hasGps = hasLatitude && hasLongitude && !isNaN(parseFloat(payload.latitude)) && !isNaN(parseFloat(payload.longitude));
      if (hasLatitude !== hasLongitude) {
        throw new Error('Enter both Latitude and Longitude, or leave both blank to use floor-plan placement.');
      }

      // A saved room boundary is sufficient for floor-plan placement.
      const targetGalleryId = payload.gallery_id || matchedRoom?.id;
      if (!targetGalleryId) {
        throw new Error("Room Assignment Error: Every exhibit must belong to a room with a saved boundary polygon. Please select a gallery.");
      }

      const targetGallery = galleries.find(g => g.id.toString() === targetGalleryId.toString());
      if (!targetGallery || !targetGallery.boundary_polygon || targetGallery.boundary_polygon.length < 3) {
        throw new Error(`Room-First Gate Block: Room '${targetGallery?.name || 'Selected'}' does not have a saved boundary polygon. Draw this room's boundary in the Room/Coordinate Editor before placing exhibits inside it.`);
      }

      if (hasGps) {
        const lat = parseFloat(payload.latitude);
        const lng = parseFloat(payload.longitude);
        const selectedMus = museums.find(m => m.id === parseInt(payload.museum_id));
        if (!isWithinMuseumBounds(lat, lng, selectedMus)) {
          throw new Error(`Bounding-Box Error: The coordinates (${lat}, ${lng}) fall outside ${selectedMus?.name || 'the selected museum'}'s physical perimeter bounds.`);
        }

        const mus = museums.find(m => m.id === parseInt(payload.museum_id));
        const polyGps = getGalleryGpsPolygon(targetGallery, activeFloorPlan, mus);
        if (polyGps?.length >= 3 && polyGps.every(p => p.lat != null && p.lng != null) && !isPointInPolygon(lat, lng, polyGps)) {
          throw new Error(`Point Placement Error: The coordinates (${lat}, ${lng}) fall OUTSIDE '${targetGallery.name}' boundary polygon. Exhibits must be placed inside the room's boundary.`);
        }
        payload.latitude = lat;
        payload.longitude = lng;
      } else {
        delete payload.latitude;
        delete payload.longitude;
      }

      payload.museum_id = parseInt(payload.museum_id);
      payload.gallery_id = parseInt(targetGalleryId);
      payload.collection_id = payload.collection_id ? parseInt(payload.collection_id) : null;
      
      if (editingObject) {
        await updateAdminObject(editingObject.id, payload);
      } else {
        await createAdminObject(payload);
      }
      setIsModalOpen(false);
      fetchObjects();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminObject(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchObjects();
    } catch (err) {
      console.log(err.response?.data?.error?.message || 'Failed to delete object.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading objects...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const relevantGalleries = formData.museum_id ? galleries.filter(g => g.museum_id === parseInt(formData.museum_id)) : [];
  const relevantCollections = formData.museum_id ? collections.filter(c => c.museum_id === parseInt(formData.museum_id)) : [];

  const unplacedCount = objects.filter(o => o.latitude === null || o.latitude === undefined || o.latitude === '').length;
  const placedCount = objects.filter(o => o.latitude !== null && o.latitude !== undefined && o.latitude !== '').length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Manage Objects</h1>
          <p className="text-xs text-neutral-500 mt-1">Every exhibit requires a saved room placement. GPS coordinates are optional.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="flex items-center px-4 py-2 border border-neutral-300 bg-white text-neutral-800 rounded-md hover:bg-neutral-50 font-medium text-sm shadow-xs transition"
          >
            <Upload className="w-4 h-4 mr-2 text-indigo-600" /> Bulk Import CSV
          </button>
          <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 font-medium text-sm">
            <Plus className="w-5 h-5 mr-2" /> Add Object
          </button>
        </div>
      </div>
      
      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 sm:text-sm"
          placeholder="Search objects by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Requirement 4: Location Status Filter Controls */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setLocationFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${locationFilter === 'all' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}
        >
          All Objects ({objects.length})
        </button>
        <button
          onClick={() => setLocationFilter('unplaced')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${locationFilter === 'unplaced' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Location Missing / Unplaced ({unplacedCount})
        </button>
        <button
          onClick={() => setLocationFilter('placed')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${locationFilter === 'placed' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Placed ({placedCount})
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">QR Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Location Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Museum ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Gallery / Collection</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">AI Media</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredObjects.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-neutral-500 italic">No matching objects found.</td></tr>
              ) : filteredObjects.map((obj, index) => {
                const hasLocation = obj.latitude !== null && obj.latitude !== undefined && obj.latitude !== '' &&
                                   obj.longitude !== null && obj.longitude !== undefined && obj.longitude !== '';
                return (
                  <tr key={obj.id} className={!hasLocation ? 'bg-red-50/40' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-800">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="bg-white p-1 rounded-md border border-neutral-200 inline-block">
                        <QRCodeCanvas value={`${window.location.origin}/objects/${obj.id}`} size={48} level="M" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{obj.name || obj.title}</td>
                    
                    {/* Requirement 4: Location Status Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {hasLocation ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Placed ({parseFloat(obj.latitude).toFixed(4)}, {parseFloat(obj.longitude).toFixed(4)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" />
                          Location Missing (Unplaced)
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{obj.museum_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      <div>G: {obj.gallery_id || 'None'}</div>
                      <div>C: {obj.collection_id || 'None'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-500 space-y-1">
                      {obj.media_status === 'generating' && (
                        <span className="block text-amber-600 font-semibold">⏳ AI Generating...</span>
                      )}
                      {obj.media_status === 'failed' && (
                        <span className="block text-red-600 font-semibold">❌ Generation Failed</span>
                      )}
                      {obj.audio_url ? <span className="block text-green-600 font-semibold">🔊 Audio ✓</span> : <span className="block">No Audio</span>}
                      {obj.video_url ? <span className="block text-purple-600 font-semibold">🎬 Video ✓</span> : <span className="block">No Video</span>}
                      {obj.model_3d_url ? <span className="block text-blue-600 font-semibold">🧊 3D Model ✓</span> : <span className="block">No 3D Model</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openEditModal(obj)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">
                        <Edit className="w-4 h-4 inline mr-1" />
                        {!hasLocation ? 'Place' : 'Edit'}
                      </button>
                      <button onClick={() => setDeleteConfirm(obj)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editingObject ? 'Edit Object' : 'Add Object'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Basic Info</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Title *</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Description</label>
                    <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Creator</label>
                      <input type="text" value={formData.creator} onChange={e => setFormData({...formData, creator: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Creation Date</label>
                      <input type="text" value={formData.creation_date} onChange={e => setFormData({...formData, creation_date: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Medium</label>
                      <input type="text" value={formData.medium} onChange={e => setFormData({...formData, medium: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Dimensions</label>
                      <input type="text" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Organization</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Museum *</label>
                    <select required value={formData.museum_id} onChange={e => setFormData({...formData, museum_id: e.target.value, gallery_id: '', collection_id: ''})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                      <option value="">Select a Museum</option>
                      {museums.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Gallery / Room <span className="text-red-500 font-bold">*</span></label>
                    <select required value={formData.gallery_id} onChange={e => setFormData({...formData, gallery_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" disabled={!formData.museum_id}>
                      <option value="">Select a Room / Gallery</option>
                      {relevantGalleries.map(g => {
                        const hasShape = g.boundary_polygon && g.boundary_polygon.length >= 3;
                        return (
                          <option key={g.id} value={g.id}>
                            {g.name} {hasShape ? '✓ (Shape Saved)' : '⚠️ (Shape Missing - Blocked)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Collection (Optional)</label>
                    <select value={formData.collection_id} onChange={e => setFormData({...formData, collection_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" disabled={!formData.museum_id}>
                      <option value="">None</option>
                      {relevantCollections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <h3 className="font-semibold text-lg border-b pb-2 pt-4 flex items-center justify-between">
                    <span>Location (Floor Plan Placement) <span className="text-red-500 font-bold">*</span></span>
                  </h3>
                  {!formData.museum_id ? (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Select a Museum to place this object on its schematic floor plan.
                      </p>
                    </div>
                  ) : !formData.gallery_id ? (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Select a Room / Gallery above to unlock object location placement under the Room-First Workflow.
                      </p>
                    </div>
                  ) : !isSelectedRoomShapeSaved ? (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-red-900 text-sm">Room Shape Required — Object Placement Locked</h4>
                          <p className="text-xs text-red-700 mt-1">
                            Room <strong>"{selectedGallery?.name}"</strong> does not have a saved boundary polygon yet. Under the Room-First Workflow, every room must have a confirmed corner boundary shape before exhibits can be placed inside it.
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/admin/coordinates?tab=boundaries&gallery_id=${selectedGallery?.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition shadow-sm"
                      >
                        <MapPin className="w-4 h-4" /> Draw Room Boundary in Editor &rarr;
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Room Shape Verified: <strong>{selectedGallery?.name}</strong> ({selectedGallery?.boundary_polygon?.length} corner vertices)</span>
                        </div>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Unlocked</span>
                      </div>

                      {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) && (
                        <div className="mb-2">
                          {isPointInSelectedRoom ? (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span>Point Inside Boundary: <strong>{selectedGallery?.name}</strong> (Point-in-Polygon Confirmed)</span>
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-amber-900 mb-0.5">⚠️ Point Outside Room Boundary</span>
                                <span>Coordinates ({formData.latitude}, {formData.longitude}) fall OUTSIDE the perimeter polygon of <strong>"{selectedGallery?.name}"</strong>. Exhibits must be located inside the room's defined boundary.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Floor Plan Header & View Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                            {activeFloorPlan ? `${activeFloorPlan.name || 'Floor Plan'} (Floor ${activeFloorPlan.floor_number ?? 1})` : 'Floor Plan Schematic'}
                          </span>
                          {activeFloorPlan && (activeFloorPlan.anchor_1_lat != null || activeFloorPlan.affine_transform != null) && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> Georeferenced
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {currentPinXy && (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Normalized: ({(currentPinXy.x * 100).toFixed(1)}%, {(currentPinXy.y * 100).toFixed(1)}%)
                            </span>
                          )}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setMapViewMode('floorplan')}
                              className={`px-2 py-0.5 rounded font-semibold transition flex items-center gap-1 ${
                                mapViewMode === 'floorplan' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="View indoor floor plan schematic"
                            >
                              <LayoutGrid className="w-3 h-3" /> Floor Plan
                            </button>
                            <button
                              type="button"
                              onClick={() => setMapViewMode('geo')}
                              className={`px-2 py-0.5 rounded font-semibold transition flex items-center gap-1 ${
                                mapViewMode === 'geo' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="View outdoor satellite/street map"
                            >
                              <Globe className="w-3 h-3" /> Geo Map
                            </button>
                          </div>
                        </div>
                      </div>

                      {mapViewMode === 'floorplan' ? (
                        /* Indoor Floor Plan Schematic Canvas: EXACT FIT, NO EXTRA LINES */
                        <div className="w-full flex items-center justify-center bg-slate-100/70 p-2 rounded-xl border border-slate-200 overflow-hidden">
                          {activeFloorPlan && activeFloorPlan.image_url && !imageLoadError ? (
                            <div
                              ref={floorPlanContainerRef}
                              onClick={handleFloorPlanClick}
                              className="relative cursor-crosshair select-none inline-block max-w-full rounded-lg shadow-sm overflow-hidden border border-slate-300 bg-white"
                            >
                              <img
                                ref={floorPlanImageRef}
                                src={getFloorPlanImageUrl(activeFloorPlan.image_url)}
                                alt={activeFloorPlan.name || 'Floor Plan'}
                                className="block max-w-full max-h-[460px] w-auto h-auto select-none pointer-events-none"
                                onError={() => setImageLoadError(true)}
                              />

                              {/* SVG Overlay: Perfectly fits image bounds with 0 margin */}
                              <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                              >
                                {/* Render ONLY Selected Target Room Boundary - Clean solid outline matching architectural walls */}
                                {selectedGallery && Array.isArray(selectedGallery.boundary_polygon) && selectedGallery.boundary_polygon.length >= 3 && (() => {
                                  const pts = selectedGallery.boundary_polygon.map(p => getPointSvgCoords(p)).filter(Boolean);
                                  if (pts.length < 3) return null;
                                  const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                                  const center = getRoomSvgCentroid(selectedGallery.boundary_polygon);

                                  return (
                                    <g key={`target_room_${selectedGallery.id}`}>
                                      <polygon
                                        points={pointsStr}
                                        fill={isPointInSelectedRoom ? 'rgba(16, 185, 129, 0.22)' : 'rgba(59, 130, 246, 0.22)'}
                                        stroke={isPointInSelectedRoom ? '#059669' : '#2563eb'}
                                        strokeWidth="1.2"
                                      />
                                      {center && (
                                        <g transform={`translate(${center.x}, ${center.y})`}>
                                          <rect
                                            x="-14"
                                            y="-3.5"
                                            width="28"
                                            height="7"
                                            rx="1.5"
                                            fill={isPointInSelectedRoom ? '#065f46' : '#1e3a8a'}
                                            fillOpacity={0.92}
                                            stroke="#ffffff"
                                            strokeWidth="0.4"
                                          />
                                          <text
                                            x="0"
                                            y="1.3"
                                            textAnchor="middle"
                                            fill="#ffffff"
                                            fontSize="2.8"
                                            fontWeight="bold"
                                          >
                                            {selectedGallery.name}
                                          </text>
                                        </g>
                                      )}
                                    </g>
                                  );
                                })()}
                              </svg>

                              {/* Placed Object Pin Marker */}
                              {currentPinXy && (
                                <div
                                  className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150 z-20"
                                  style={{
                                    left: `${currentPinXy.x * 100}%`,
                                    top: `${currentPinXy.y * 100}%`
                                  }}
                                >
                                  <div className="relative flex flex-col items-center">
                                    <div className="px-1.5 py-0.5 bg-slate-900/90 text-white text-[9px] font-bold rounded shadow mb-0.5 whitespace-nowrap border border-white/40">
                                      {formData.title || selectedGallery?.name || 'Object Pin'}
                                    </div>
                                    <svg width="26" height="32" viewBox="0 0 40 50" fill="none" className="drop-shadow-md">
                                      <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#a07a5f" stroke="#ffffff" strokeWidth="2"/>
                                      <circle cx="20" cy="18" r="8" fill="white"/>
                                      <circle cx="20" cy="18" r="4" fill="#a07a5f"/>
                                    </svg>
                                  </div>
                                </div>
                              )}

                              {/* Instruction Overlay when not yet placed */}
                              {!currentPinXy && selectedGallery && (
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white text-[10px] px-2.5 py-1 rounded-full pointer-events-none z-10 backdrop-blur-xs flex items-center gap-1.5 shadow">
                                  <MapPin className="w-3 h-3 text-amber-400 animate-pulse" />
                                  <span>Click inside "{selectedGallery.name}" to place pin</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Fallback if no floor plan image uploaded */
                            <div
                              ref={floorPlanContainerRef}
                              onClick={handleFloorPlanClick}
                              className="w-full h-[320px] flex flex-col items-center justify-center text-slate-400 relative cursor-crosshair bg-slate-900 rounded-lg"
                            >
                              <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
                                <defs>
                                  <pattern id="adminObjGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#64748b" strokeWidth="0.5" />
                                  </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#adminObjGrid)" />
                              </svg>
                              <p className="text-xs font-semibold text-slate-400 z-10">Architectural Floor Plan Canvas</p>
                              <p className="text-[11px] text-slate-500 z-10">Click inside the room polygon to place exhibit pin</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Outdoor MapLibre Geo Map (Secondary view) */
                        <div className="relative w-full rounded-xl border border-neutral-300 overflow-hidden shadow-sm" style={{ height: '320px' }}>
                          <ErrorBoundary>
                            <Map
                              {...mapViewState}
                              onMove={evt => setMapViewState(evt.viewState)}
                              onClick={(e) => {
                                if (!isSelectedRoomShapeSaved) return;
                                if (e.lngLat) {
                                  setFormData(prev => ({
                                    ...prev,
                                    latitude: e.lngLat.lat.toFixed(6),
                                    longitude: e.lngLat.lng.toFixed(6)
                                  }));
                                }
                              }}
                              mapStyle={schematicMapStyle}
                              style={{ width: '100%', height: '100%' }}
                            >
                              {/* Room Polygons (Schematic Fill & Thin Outline) */}
                              {roomGeoJSON.features.length > 0 && (
                                <Source id="schematic-rooms" type="geojson" data={roomGeoJSON}>
                                  <Layer 
                                    id="schematic-rooms-fill" 
                                    type="fill" 
                                    paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.25 }} 
                                  />
                                  <Layer 
                                    id="schematic-rooms-line" 
                                    type="line" 
                                    paint={{ 'line-color': '#1d4ed8', 'line-width': 2 }} 
                                  />
                                </Source>
                              )}

                              {/* Dotted Line Connector Paths */}
                              {edgesGeoJSON.features.length > 0 && (
                                <Source id="schematic-edges" type="geojson" data={edgesGeoJSON}>
                                  <Layer 
                                    id="schematic-edges-line" 
                                    type="line" 
                                    paint={{ 
                                      'line-color': '#64748b', 
                                      'line-width': 2, 
                                      'line-dasharray': [2, 2] 
                                    }} 
                                  />
                                </Source>
                              )}

                              {/* Centered Room Labels */}
                              {galleries
                                .filter(g => g.museum_id === parseInt(formData.museum_id))
                                .map(g => {
                                  const polyGps = getGalleryGpsPolygon(g);
                                  if (!polyGps || polyGps.length < 3) return null;
                                  const center = getPolygonCentroid(polyGps);
                                  if (!center) return null;
                                  return (
                                    <Marker key={`room-label-${g.id}`} latitude={center.lat} longitude={center.lng} anchor="center">
                                      <div className="text-[11px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-slate-300 shadow-sm pointer-events-none whitespace-nowrap">
                                        {g.name}
                                      </div>
                                    </Marker>
                                  );
                                })}

                              {/* Node Markers with Green Entrance / Red Exit Pills & Amenities */}
                              {nodes
                                .filter(n => n.latitude && n.longitude)
                                .map((n, idx) => {
                                  const types = (n.node_type || '').toLowerCase().split(',').map(s => s.trim());
                                  if (types.includes('entrance') && types.includes('exit')) {
                                    return (
                                      <Marker key={`node-${n.id}`} latitude={n.latitude} longitude={n.longitude} anchor="center">
                                        <div className="flex rounded-full overflow-hidden shadow-md border border-white font-bold text-[9px] pointer-events-none">
                                          <span className="bg-emerald-600 text-white px-1.5 py-0.5">ENT</span>
                                          <span className="bg-red-600 text-white px-1.5 py-0.5">EXIT</span>
                                        </div>
                                      </Marker>
                                    );
                                  }
                                  if (types.includes('entrance')) {
                                    return (
                                      <Marker key={`node-${n.id}`} latitude={n.latitude} longitude={n.longitude} anchor="center">
                                        <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide pointer-events-none">
                                          ENTRANCE
                                        </div>
                                      </Marker>
                                    );
                                  }
                                  if (types.includes('exit')) {
                                    return (
                                      <Marker key={`node-${n.id}`} latitude={n.latitude} longitude={n.longitude} anchor="center">
                                        <div className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide pointer-events-none">
                                          EXIT
                                        </div>
                                      </Marker>
                                    );
                                  }
                                  const amenityMap = {
                                    information_desk: { label: 'INFO', emoji: 'ℹ️', bg: 'bg-sky-600' },
                                    restroom: { label: 'RESTROOM', emoji: '🚻', bg: 'bg-blue-600' },
                                    fire_extinguisher: { label: 'FIRE', emoji: '🧯', bg: 'bg-rose-600' },
                                    water_fountain: { label: 'WATER', emoji: '🚰', bg: 'bg-cyan-600' },
                                    cafeteria: { label: 'CAFE', emoji: '☕', bg: 'bg-amber-600' },
                                    cafe: { label: 'CAFE', emoji: '☕', bg: 'bg-amber-600' },
                                    gift_shop: { label: 'SHOP', emoji: '🛍️', bg: 'bg-pink-600' },
                                    giftshop: { label: 'SHOP', emoji: '🛍️', bg: 'bg-pink-600' },
                                    elevator: { label: 'ELEV', emoji: '🛗', bg: 'bg-indigo-600' },
                                    stairs: { label: 'STAIRS', emoji: '📶', bg: 'bg-amber-700' },
                                    escalator: { label: 'ESCAL', emoji: '🪜', bg: 'bg-teal-600' },
                                    first_aid: { label: 'MED', emoji: '🩹', bg: 'bg-red-700' },
                                    atm: { label: 'ATM', emoji: '🏧', bg: 'bg-emerald-700' },
                                    exhibit: { label: 'ART', emoji: '🖼️', bg: 'bg-purple-600' },
                                    artifact: { label: 'ART', emoji: '🖼️', bg: 'bg-purple-600' }
                                  };
                                  for (const t of types) {
                                    if (amenityMap[t]) {
                                      const { label, emoji, bg } = amenityMap[t];
                                      return (
                                        <Marker key={`node-${n.id}`} latitude={n.latitude} longitude={n.longitude} anchor="center">
                                          <div className={`${bg} text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide pointer-events-none flex items-center gap-1 whitespace-nowrap`}>
                                            <span>{emoji}</span>
                                            <span>{label}</span>
                                          </div>
                                        </Marker>
                                      );
                                    }
                                  }
                                  return (
                                    <Marker key={`node-${n.id}`} latitude={n.latitude} longitude={n.longitude} anchor="center">
                                      <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm pointer-events-none" title={n.name}>
                                        {idx + 1}
                                      </div>
                                    </Marker>
                                  );
                                })}

                              {/* Existing Objects Context */}
                              {objects
                                .filter(o => o.museum_id === parseInt(formData.museum_id) && o.latitude && o.longitude && o.id !== editingObject?.id)
                                .map(obj => (
                                  <Marker key={`existing-obj-${obj.id}`} latitude={parseFloat(obj.latitude)} longitude={parseFloat(obj.longitude)} anchor="center">
                                    <div className="w-4 h-4 bg-amber-500 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold pointer-events-none" title={obj.name || obj.title}>
                                      {obj.id}
                                    </div>
                                  </Marker>
                                ))}

                              {/* Current Object Pin Marker (Brown Pin) */}
                              {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) && (
                                <Marker latitude={parseFloat(formData.latitude)} longitude={parseFloat(formData.longitude)} anchor="bottom">
                                  <div className="relative -ml-3 -mt-7 transition-all duration-200 drop-shadow-md pointer-events-none">
                                    <svg width="24" height="30" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#a07a5f"/>
                                      <circle cx="20" cy="18" r="8" fill="white"/>
                                    </svg>
                                  </div>
                                </Marker>
                              )}
                            </Map>
                          </ErrorBoundary>
                        </div>
                      )}

                      {/* Latitude & Longitude Numeric Inputs */}
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">Latitude <span className="text-neutral-400">(Optional)</span></label>
                          <input
                            type="number"
                            step="any"
                            required
                            disabled={!isSelectedRoomShapeSaved}
                            value={formData.latitude}
                            onChange={e => {
                              setClickPinXy(null);
                              setFormData({ ...formData, latitude: e.target.value });
                            }}
                            placeholder={!isSelectedRoomShapeSaved ? "Locked (Draw room boundary first)" : "e.g. 13.073226"}
                            className="w-full border border-neutral-300 rounded-md p-2 text-sm font-mono focus:ring-neutral-500 focus:border-neutral-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">Longitude <span className="text-neutral-400">(Optional)</span></label>
                          <input
                            type="number"
                            step="any"
                            required
                            disabled={!isSelectedRoomShapeSaved}
                            value={formData.longitude}
                            onChange={e => {
                              setClickPinXy(null);
                              setFormData({ ...formData, longitude: e.target.value });
                            }}
                            placeholder={!isSelectedRoomShapeSaved ? "Locked (Draw room boundary first)" : "e.g. 80.257045"}
                            className="w-full border border-neutral-300 rounded-md p-2 text-sm font-mono focus:ring-neutral-500 focus:border-neutral-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs font-mono text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                        <span>Lat: <strong className="text-neutral-900">{formData.latitude || 'Not set'}</strong></span>
                        <span>Lng: <strong className="text-neutral-900">{formData.longitude || 'Not set'}</strong></span>
                      </div>
                    </div>
                  )}

                  <h3 className="font-semibold text-lg border-b pb-2 pt-4">Media</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Image *</label>
                    <div className="mt-1 flex items-center space-x-4">
                      <input type="url" required value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" placeholder="Image URL" />
                      <span className="text-neutral-500 text-sm">OR</span>
                      <label className="cursor-pointer bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                        {isUploading ? 'Uploading...' : 'Upload File'}
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleUpload(e, 'image_url')} disabled={isUploading} />
                      </label>
                    </div>
                    {formData.image_url && (
                      <div className="mt-2">
                        <img src={formData.image_url} alt="Preview" className="h-20 object-cover rounded border border-neutral-200" onError={(e) => e.target.style.display = 'none'} />
                      </div>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">Provide an image url or upload an image. Audio, Video, and 3D model will be auto-generated by AI.</p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800">🤖 AI Auto-Generation</p>
                    <p className="text-xs text-blue-600 mt-1">
                      When you save this object with an image URL, our AI will automatically generate:
                    </p>
                    <ul className="text-xs text-blue-600 mt-1 list-disc list-inside space-y-0.5">
                      <li>🔊 Audio narration (museum guide style)</li>
                      <li>🎬 Video experience (image + AI narration)</li>
                      <li>🧊 3D model (from the image)</li>
                    </ul>
                    <p className="text-xs text-blue-500 mt-2">You can optionally override any of these below:</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Audio (optional override)</label>
                    <div className="mt-1 flex items-center space-x-4">
                      <input type="url" value={formData.audio_url} onChange={e => setFormData({...formData, audio_url: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" placeholder="Leave empty for AI-generated audio" />
                      <span className="text-neutral-500 text-sm">OR</span>
                      <label className="cursor-pointer bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                        {isUploading ? 'Uploading...' : 'Upload File'}
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleUpload(e, 'audio_url')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">3D Model (optional override)</label>
                    <div className="mt-1 flex items-center space-x-4">
                      <input type="url" value={formData.model_3d_url} onChange={e => setFormData({...formData, model_3d_url: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" placeholder="Leave empty for AI-generated 3D model" />
                      <span className="text-neutral-500 text-sm">OR</span>
                      <label className="cursor-pointer bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                        {isUploading ? 'Uploading...' : 'Upload File'}
                        <input type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => handleUpload(e, 'model_3d_url')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Object'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Object</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone and will fail if there are dependent learning resources or stories.</p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Importer Modal */}
      <GenericCsvImporter
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        entityType="objects"
        existingItems={objects}
        createItem={createAdminObject}
        updateItem={updateAdminObject}
        onSuccess={fetchObjects}
        defaultContext={museums.length > 0 ? { museum_id: museums[0].id } : {}}
      />
    </div>
  );
};

export default AdminObjects;
