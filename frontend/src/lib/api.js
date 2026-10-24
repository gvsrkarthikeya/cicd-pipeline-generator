import axios from 'axios';

// In production the frontend is served by the same Express server as the
// API (single Render service), so requests can safely use a relative path.
// VITE_API_URL can still override this (e.g. for a separately hosted API).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api'),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
