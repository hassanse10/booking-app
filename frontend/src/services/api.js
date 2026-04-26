import axios from 'axios';

// Handle VITE_API_URL with or without /api suffix, or fall back to Vercel proxy
const rawBase = import.meta.env.VITE_API_URL;
const baseURL = rawBase
  ? rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '') + '/api'
  : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
