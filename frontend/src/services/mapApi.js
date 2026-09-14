import axios from 'axios';

// In production, this should be an environment variable
const getMapApiBase = () => {
  if (import.meta.env.VITE_MAP_API_URL) return import.meta.env.VITE_MAP_API_URL;
  if (typeof window !== 'undefined') return `http://${window.location.hostname}:5001/api`;
  return 'http://127.0.0.1:5001/api';
};

const MAP_API_BASE = getMapApiBase();

const mapClient = axios.create({
  baseURL: MAP_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Floor Plans
export const getFloorPlans = async (museum_id) => {
  const url = museum_id ? `/floor-plans?museum_id=${museum_id}` : '/floor-plans';
  return (await mapClient.get(url)).data;
};
export const getFloorPlan = async (id) => (await mapClient.get(`/floor-plans/${id}`)).data;
export const createFloorPlan = async (data) => (await mapClient.post('/floor-plans', data)).data;
export const updateFloorPlan = async (id, data) => (await mapClient.patch(`/floor-plans/${id}`, data)).data;
export const georeferenceFloorPlan = async (id, data) => (await mapClient.put(`/floor-plans/${id}/georeference`, data)).data;
export const clearFloorPlanGeoreference = async (id) => (await mapClient.delete(`/floor-plans/${id}/georeference`)).data;
export const recomputeFloorPlanLatLng = async (id) => (await mapClient.post(`/floor-plans/${id}/recompute-latlng`)).data;
export const deleteFloorPlan = async (id) => (await mapClient.delete(`/floor-plans/${id}`)).data;
export const clearFloorPlanData = async (id) => (await mapClient.post(`/floor-plans/${id}/clear-data`)).data;

// Upload
export const uploadMapImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return (await mapClient.post('/upload-map', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data;
};

// Nodes
export const getNodes = async (floor_plan_id, floor, museum_id) => {
  const params = new URLSearchParams();
  if (floor_plan_id) params.append('floor_plan_id', floor_plan_id);
  if (floor !== undefined && floor !== null) params.append('floor', floor);
  if (museum_id) params.append('museum_id', museum_id);
  return (await mapClient.get(`/nodes?${params.toString()}`)).data;
};
export const getNode = async (id) => (await mapClient.get(`/nodes/${id}`)).data;
export const createNode = async (data) => (await mapClient.post('/nodes', data)).data;
export const deleteNode = async (id) => (await mapClient.delete(`/nodes/${id}`)).data;
export const patchNodeCoordinates = async (id, dataOrLat, lng) => {
  const body = typeof dataOrLat === 'object' ? dataOrLat : { latitude: dataOrLat, longitude: lng };
  return (await mapClient.patch(`/nodes/${id}/coordinates`, body)).data;
};
export const updateNode = async (id, data) => (await mapClient.put(`/nodes/${id}`, data)).data;

// Edges
export const getEdges = async (museum_id, floor_plan_id) => {
  const params = new URLSearchParams();
  if (museum_id) params.append('museum_id', museum_id);
  if (floor_plan_id) params.append('floor_plan_id', floor_plan_id);
  return (await mapClient.get(`/edges?${params.toString()}`)).data;
};
export const createEdge = async (data) => (await mapClient.post('/edges', data)).data;
export const deleteEdge = async (id) => (await mapClient.delete(`/edges/${id}`)).data;
export const validateFloorPlanEdges = async (plan_id) => (await mapClient.get(`/floor-plans/${plan_id}/validate-edges`)).data;
export const validateFloorPlan = async (plan_id) => (await mapClient.get(`/floor-plans/${plan_id}/validate`)).data;

// Building Footprints
export const getFootprint = async (floor_plan_id) => (await mapClient.get(`/floor-plans/${floor_plan_id}/footprint`)).data;
export const saveFootprint = async (floor_plan_id, points) => (await mapClient.post(`/floor-plans/${floor_plan_id}/footprint`, { points })).data;

// Rooms & Doorways
export const getRooms = async (floor_plan_id) => (await mapClient.get(`/floor-plans/${floor_plan_id}/rooms`)).data;
export const createRoom = async (data) => (await mapClient.post('/rooms', data)).data;
export const updateRoom = async (id, data) => (await mapClient.put(`/rooms/${id}`, data)).data;
export const deleteRoom = async (id) => (await mapClient.delete(`/rooms/${id}`)).data;
export const updateBoundaryPoint = async (roomId, pointId, data) => (await mapClient.put(`/rooms/${roomId}/boundary-points/${pointId}`, data)).data;
export const createDoorway = async (data) => (await mapClient.post('/doorways', data)).data;
export const deleteDoorway = async (id) => (await mapClient.delete(`/doorways/${id}`)).data;

// Route & Navigation
export const getRoute = async (from_id, to_id) => {
  return (await mapClient.get(`/route?from=${from_id}&to=${to_id}`)).data;
};

export const calculateNavigationRoute = async (start_node_id, destination_node_id) => {
  return (await mapClient.post('/navigation/route', { start_node_id, destination_node_id })).data;
};

export const fusePdrStep = async (stepPayload) => {
  return (await mapClient.post('/navigation/pdr-step', stepPayload)).data;
};

export const getFullRoomRoute = async (roomId, options = {}) => {
  return (await mapClient.post(`/route/full-room/${roomId}`, options)).data;
};

export const getFullTour = async (entranceId, exitId) => {
  let url = '/tour?';
  if (entranceId) url += `entrance=${entranceId}&`;
  if (exitId) url += `exit=${exitId}`;
  return (await mapClient.get(url)).data;
};

export const getNodeNameContext = async (id) => (await mapClient.get(`/nodes/${id}/name-context`)).data;

// Nearby
export const getNearbyNodes = async (node_id, radius, hops) => {
  let url = `/nodes/nearby?node_id=${node_id}&`;
  if (radius) url += `radius=${radius}&`;
  if (hops) url += `hops=${hops}`;
  return (await mapClient.get(url)).data;
};

// QR Locations
export const createQrLocation = async (data) => (await mapClient.post('/qr-locations', data)).data;
export const getQrLocations = async () => (await mapClient.get('/qr-locations')).data;
export const resolveQrLocation = async (payload) => (await mapClient.get(`/qr-locations/${encodeURIComponent(payload)}`)).data;

// Artifacts
export const getArtifacts = async (floor_plan_id) => {
  const url = floor_plan_id ? `/artifacts?floor_plan_id=${floor_plan_id}` : '/artifacts';
  return (await mapClient.get(url)).data;
};
export const getArtifact = async (id) => (await mapClient.get(`/artifacts/${id}`)).data;
export const createArtifact = async (data) => (await mapClient.post('/artifacts', data)).data;
export const updateArtifact = async (id, data) => (await mapClient.put(`/artifacts/${id}`, data)).data;
export const deleteArtifact = async (id) => (await mapClient.delete(`/artifacts/${id}`)).data;

// Anchors
export const getAnchors = async (floor_plan_id) => (await mapClient.get(`/floor-plans/${floor_plan_id}/anchors`)).data;
export const createAnchor = async (floor_plan_id, data) => (await mapClient.post(`/floor-plans/${floor_plan_id}/anchors`, data)).data;
export const updateAnchor = async (anchor_id, data) => (await mapClient.put(`/anchors/${anchor_id}`, data)).data;
export const deleteAnchor = async (anchor_id) => (await mapClient.delete(`/anchors/${anchor_id}`)).data;

// Helper for absolute image URLs (if backend returns relative)
export const getAbsoluteImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${MAP_API_BASE.replace('/api', '')}${url}`;
};

// WiFi Fingerprints
export const captureFingerprint = async (data) => (await mapClient.post('/fingerprints/capture', data)).data;
export const getFingerprintCoverage = async (roomId) => (await mapClient.get(`/fingerprints/coverage/${roomId}`)).data;
export const getRoomFingerprints = async (roomId) => (await mapClient.get(`/fingerprints/room/${roomId}`)).data;
export const deleteFingerprint = async (id) => (await mapClient.delete(`/fingerprints/${id}`)).data;
export const estimateWifiPosition = async (data) => (await mapClient.post('/fingerprints/estimate', data)).data;

