// packages/web/src/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? '/api',
  timeout: 15_000,
});

// Attach JWT from localStorage on every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('mtte_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mtte_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default client;
