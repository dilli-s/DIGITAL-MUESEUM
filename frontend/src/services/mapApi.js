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
export const getFloorPlans = async () => (await mapClient.get('/floor-plans')).data;
export const getFloorPlan = async (id) => (await mapClient.get(`/floor-plans/${id}`)).data;
export const createFloorPlan = async (data) => (await mapClient.post('/floor-plans', data)).data;
export const updateFloorPlan = async (id, data) => (await mapClient.patch(`/floor-plans/${id}`, data)).data;
export const georeferenceFloorPlan = async (id, data) => (await mapClient.put(`/floor-plans/${id}/georeference`, data)).data;
export const deleteFloorPlan = async (id) => (await mapClient.delete(`/floor-plans/${id}`)).data;

// Upload
export const uploadMapImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return (await mapClient.post('/upload-map', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data;
};

// Nodes
export const getNodes = async (floor_plan_id, floor) => {
  let url = '/nodes?';
  if (floor_plan_id) url += `floor_plan_id=${floor_plan_id}&`;
  if (floor !== undefined) url += `floor=${floor}`;
  return (await mapClient.get(url)).data;
};
export const getNode = async (id) => (await mapClient.get(`/nodes/${id}`)).data;
export const createNode = async (data) => (await mapClient.post('/nodes', data)).data;

// Edges
export const getEdges = async () => (await mapClient.get('/edges')).data;
export const createEdge = async (data) => (await mapClient.post('/edges', data)).data;

// Route
export const getRoute = async (from_id, to_id) => {
  return (await mapClient.get(`/route?from=${from_id}&to=${to_id}`)).data;
};

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

// Helper for absolute image URLs (if backend returns relative)
export const getAbsoluteImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${MAP_API_BASE.replace('/api', '')}${url}`;
};
