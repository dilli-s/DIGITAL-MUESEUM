import API_BASE_URL from '../config/api';

export const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  // If it's a relative URL from our backend (e.g. /static/audio/...)
  // We need to strip the '/api' from the API_BASE_URL to get the root host
  const host = API_BASE_URL.replace(/\/api$/, '');
  return `${host}${url.startsWith('/') ? '' : '/'}${url}`;
};
