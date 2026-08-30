import axios from 'axios';
import API_BASE_URL from '../config/api';
import { 
  mapMuseumFromApi, 
  mapGalleryFromApi, 
  mapCollectionFromApi, 
  mapExhibitionFromApi, 
  mapObjectFromApi,
  mapLearningFromApi
} from './mappers';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (config.data && typeof config.data === 'object') {
    const cleanUrl = (url) => {
      if (typeof url === 'string' && url.includes('google.com/imgres')) {
        try {
          const urlObj = new URL(url);
          const imgurl = urlObj.searchParams.get('imgurl');
          if (imgurl) return imgurl;
        } catch (e) {
          // invalid url
        }
      }
      return url;
    };
    
    if (config.data.image) config.data.image = cleanUrl(config.data.image);
    if (config.data.image_url) config.data.image_url = cleanUrl(config.data.image_url);
    if (config.data.audio_url) config.data.audio_url = cleanUrl(config.data.audio_url);
    if (config.data.model_3d_url) config.data.model_3d_url = cleanUrl(config.data.model_3d_url);
  }
  return config;
});

export const healthCheck = async () => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    console.error("Health check failed:", error);
    throw error;
  }
};

export const dbHealthCheck = async () => {
  try {
    const response = await apiClient.get('/health/db');
    return response.data;
  } catch (error) {
    console.error("Database health check failed:", error);
    throw error;
  }
};

export const registerUser = async (data) => {
  try {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (data) => {
  try {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getAdminDashboard = async () => {
  try {
    const response = await apiClient.get('/admin/dashboard');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getAdminMuseums = async () => {
  const response = await apiClient.get('/admin/museums');
  return response.data;
};

export const getAdminMuseum = async (id) => {
  const response = await apiClient.get(`/admin/museums/${id}`);
  return response.data;
};

export const createAdminMuseum = async (data) => {
  const response = await apiClient.post('/admin/museums', data);
  return response.data;
};

export const updateAdminMuseum = async (id, data) => {
  const response = await apiClient.patch(`/admin/museums/${id}`, data);
  return response.data;
};

export const deleteAdminMuseum = async (id) => {
  const response = await apiClient.delete(`/admin/museums/${id}`);
  return response.data;
};

// Admin Galleries
export const getAdminGalleries = async (params = {}) => {
  const response = await apiClient.get('/admin/galleries', { params });
  return response.data;
};

export const getAdminGallery = async (id) => {
  const response = await apiClient.get(`/admin/galleries/${id}`);
  return response.data;
};

export const createAdminGallery = async (data) => {
  const response = await apiClient.post('/admin/galleries', data);
  return response.data;
};

export const updateAdminGallery = async (id, data) => {
  const response = await apiClient.patch(`/admin/galleries/${id}`, data);
  return response.data;
};

export const deleteAdminGallery = async (id) => {
  const response = await apiClient.delete(`/admin/galleries/${id}`);
  return response.data;
};

// Admin Collections
export const getAdminCollections = async (params = {}) => {
  const response = await apiClient.get('/admin/collections', { params });
  return response.data;
};

export const getAdminCollection = async (id) => {
  const response = await apiClient.get(`/admin/collections/${id}`);
  return response.data;
};

export const createAdminCollection = async (data) => {
  const response = await apiClient.post('/admin/collections', data);
  return response.data;
};

export const updateAdminCollection = async (id, data) => {
  const response = await apiClient.patch(`/admin/collections/${id}`, data);
  return response.data;
};

export const deleteAdminCollection = async (id) => {
  const response = await apiClient.delete(`/admin/collections/${id}`);
  return response.data;
};

// Admin Exhibitions
export const getAdminExhibitions = async (params = {}) => {
  const response = await apiClient.get('/admin/exhibitions', { params });
  return response.data;
};

export const getAdminExhibition = async (id) => {
  const response = await apiClient.get(`/admin/exhibitions/${id}`);
  return response.data;
};

export const createAdminExhibition = async (data) => {
  const response = await apiClient.post('/admin/exhibitions', data);
  return response.data;
};

export const updateAdminExhibition = async (id, data) => {
  const response = await apiClient.patch(`/admin/exhibitions/${id}`, data);
  return response.data;
};

export const deleteAdminExhibition = async (id) => {
  const response = await apiClient.delete(`/admin/exhibitions/${id}`);
  return response.data;
};

// Admin Objects
export const getAdminObjects = async (params = {}) => {
  const response = await apiClient.get('/admin/objects', { params });
  return response.data;
};

export const getAdminObject = async (id) => {
  const response = await apiClient.get(`/admin/objects/${id}`);
  return response.data;
};

export const createAdminObject = async (data) => {
  const response = await apiClient.post('/admin/objects', data);
  return response.data;
};

export const updateAdminObject = async (id, data) => {
  const response = await apiClient.patch(`/admin/objects/${id}`, data);
  return response.data;
};

export const deleteAdminObject = async (id) => {
  const response = await apiClient.delete(`/admin/objects/${id}`);
  return response.data;
};

// Admin Learning
export const getAdminLearningResources = async (params = {}) => {
  const response = await apiClient.get('/admin/learning', { params });
  return response.data;
};

export const createAdminLearningResource = async (data) => {
  const response = await apiClient.post('/admin/learning', data);
  return response.data;
};

export const updateAdminLearningResource = async (id, data) => {
  const response = await apiClient.patch(`/admin/learning/${id}`, data);
  return response.data;
};

export const deleteAdminLearningResource = async (id) => {
  const response = await apiClient.delete(`/admin/learning/${id}`);
  return response.data;
};

// Admin Stories
export const getAdminStories = async (params = {}) => {
  const response = await apiClient.get('/admin/stories', { params });
  return response.data;
};

export const createAdminStory = async (data) => {
  const response = await apiClient.post('/admin/stories', data);
  return response.data;
};

export const updateAdminStory = async (id, data) => {
  const response = await apiClient.patch(`/admin/stories/${id}`, data);
  return response.data;
};

export const deleteAdminStory = async (id) => {
  const response = await apiClient.delete(`/admin/stories/${id}`);
  return response.data;
};

// Admin Activities
export const getAdminActivities = async (params = {}) => {
  const response = await apiClient.get('/admin/activities', { params });
  return response.data;
};

export const createAdminActivity = async (data) => {
  const response = await apiClient.post('/admin/activities', data);
  return response.data;
};

export const updateAdminActivity = async (id, data) => {
  const response = await apiClient.patch(`/admin/activities/${id}`, data);
  return response.data;
};

export const deleteAdminActivity = async (id) => {
  const response = await apiClient.delete(`/admin/activities/${id}`);
  return response.data;
};

// Admin Analytics
export const getAdminAnalyticsSummary = async () => {
  const response = await apiClient.get('/admin/analytics/summary');
  return response.data;
};

export const getAdminAnalyticsUsers = async (params = {}) => {
  const response = await apiClient.get('/admin/analytics/users', { params });
  return response.data;
};

export const getAdminAnalyticsContent = async () => {
  const response = await apiClient.get('/admin/analytics/content');
  return response.data;
};

export const getAdminAnalyticsPopularContent = async () => {
  const response = await apiClient.get('/admin/analytics/popular-content');
  return response.data;
};

export const getAdminAnalyticsBookmarks = async () => {
  const response = await apiClient.get('/admin/analytics/bookmarks');
  return response.data;
};

export const getAdminAnalyticsLearning = async () => {
  const response = await apiClient.get('/admin/analytics/learning');
  return response.data;
};

export const getAdminAnalyticsActivities = async () => {
  const response = await apiClient.get('/admin/analytics/activities');
  return response.data;
};

export const getAdminAnalyticsTrends = async (params = {}) => {
  const response = await apiClient.get('/admin/analytics/trends', { params });
  return response.data;
};

export const getAdminAnalyticsAI = async () => {
  const response = await apiClient.get('/admin/analytics/ai');
  return response.data;
};

export const getAdminAnalyticsRecommendations = async () => {
  const response = await apiClient.get('/admin/analytics/recommendations');
  return response.data;
};

export const getAdminAnalyticsAPI = async () => {
  const response = await apiClient.get('/admin/analytics/api');
  return response.data;
};

export const getAdminHealth = async () => {
  const response = await apiClient.get('/admin/health');
  return response.data;
};

// Public Endpoints
export const getBookmarks = async () => {
  try {
    const response = await apiClient.get('/bookmarks');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createBookmark = async (contentType, contentId) => {
  try {
    const response = await apiClient.post('/bookmarks', { content_type: contentType, content_id: contentId });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteBookmark = async (bookmarkId) => {
  try {
    const response = await apiClient.delete(`/bookmarks/${bookmarkId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getLearningProgress = async (learningId) => {
  try {
    const response = await apiClient.get(`/progress/learning/${learningId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateLearningProgress = async (learningId, progress) => {
  try {
    const response = await apiClient.post(`/progress/learning/${learningId}`, { progress });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getActivityProgress = async (activityId) => {
  try {
    const response = await apiClient.get(`/activities/${activityId}/progress`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const completeActivity = async (activityId) => {
  try {
    const response = await apiClient.post(`/activities/${activityId}/complete`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getHistory = async (page = 1, perPage = 20) => {
  try {
    const response = await apiClient.get(`/history`, { params: { page, per_page: perPage } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const askMuseumAssistant = async (question) => {
  try {
    const response = await apiClient.post('/ai/ask', { question });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getRecommendations = async (limit = 10) => {
  try {
    const response = await apiClient.get('/recommendations', { params: { limit } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getMuseums = async (params = {}) => {
  try {
    const response = await apiClient.get('/museums', { params });
    // Apply mapping to preserve UI expectations
    return {
      ...response.data,
      data: (response.data.data || []).map(mapMuseumFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getMuseum = async (id) => {
  try {
    const response = await apiClient.get(`/museums/${id}`);
    return mapMuseumFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getGalleries = async (params = {}) => {
  try {
    const response = await apiClient.get('/galleries', { params });
    return {
      ...response.data,
      data: (response.data.data || []).map(mapGalleryFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getGallery = async (id) => {
  try {
    const response = await apiClient.get(`/galleries/${id}`);
    return mapGalleryFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getCollections = async (params = {}) => {
  try {
    const response = await apiClient.get('/collections', { params });
    return {
      ...response.data,
      data: (response.data.data || []).map(mapCollectionFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getCollection = async (id) => {
  try {
    const response = await apiClient.get(`/collections/${id}`);
    return mapCollectionFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getExhibitions = async (params = {}) => {
  try {
    const response = await apiClient.get('/exhibitions', { params });
    return {
      ...response.data,
      data: (response.data.data || []).map(mapExhibitionFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getExhibition = async (id) => {
  try {
    const response = await apiClient.get(`/exhibitions/${id}`);
    return mapExhibitionFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getExhibitionObjects = async (id) => {
  try {
    const response = await apiClient.get(`/exhibitions/${id}/objects`);
    return (response.data.data || []).map(mapObjectFromApi);
  } catch (error) {
    throw error;
  }
};

export const getObjects = async (params = {}) => {
  try {
    const response = await apiClient.get('/objects', { params });
    return {
      ...response.data,
      data: (response.data.data || []).map(mapObjectFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getObject = async (id) => {
  try {
    const response = await apiClient.get(`/objects/${id}`);
    return mapObjectFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getObjectByCode = async (code) => {
  try {
    const response = await apiClient.get(`/objects/code/${code}`);
    return mapObjectFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

export const getLearning = async (params = {}) => {
  try {
    const response = await apiClient.get('/learning', { params });
    return {
      ...response.data,
      data: (response.data.data || []).map(mapLearningFromApi)
    };
  } catch (error) {
    throw error;
  }
};

export const getLearningById = async (id) => {
  try {
    const response = await apiClient.get(`/learning/${id}`);
    return mapLearningFromApi(response.data.data);
  } catch (error) {
    throw error;
  }
};

// --- File Upload ---
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/admin/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Admin Users
export const getAdminUsers = async () => {
  const response = await apiClient.get('/admin/users');
  return response.data;
};

export const createAdminUser = async (data) => {
  const response = await apiClient.post('/admin/users', data);
  return response.data;
};

export const updateAdminUser = async (id, data) => {
  const response = await apiClient.put(`/admin/users/${id}`, data);
  return response.data;
};

export const deleteAdminUser = async (id) => {
  const response = await apiClient.delete(`/admin/users/${id}`);
  return response.data;
};

export default apiClient;
