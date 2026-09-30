import API_BASE_URL from '../config/api';

export const getMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  
  // Clean relative path
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const host = (API_BASE_URL || '').replace(/\/api\/?$/, '');
  return `${host}${cleanPath}`;
};
