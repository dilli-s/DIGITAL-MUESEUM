const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? '/api' : 'http://127.0.0.1:5000/api');

export default API_BASE_URL;
