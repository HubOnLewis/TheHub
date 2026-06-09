// packages/web/src/api/client.ts
import axios from 'axios';
import { isScreenshotMode } from '../config/screenshotMode.js';
import { createScreenshotMockAdapter } from './screenshotApiMock.js';

const AUTH_TOKEN_KEY = 'hub_crm_token';
const LEGACY_TOKEN_KEY = 'mtte_token';

/**
 * API routes live under `/api` on the Express server (e.g. POST /api/auth/login).
 * - Relative mode: use `/api` so Vite dev proxy forwards to the API.
 * - Absolute `VITE_API_URL` must include the `/api` base path. If someone sets
 *   `http://localhost:3001` only, we append `/api` so login is not sent to a 404.
 */
function normalizeApiBaseUrl(): string {
  const raw = import.meta.env['VITE_API_URL'] as string | undefined;
  if (raw == null || String(raw).trim() === '') return '/api';
  let base = String(raw).trim().replace(/\/$/, '');
  if (!base.endsWith('/api')) base = `${base}/api`;
  return base;
}

function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

const client = axios.create({
  baseURL: normalizeApiBaseUrl(),
  timeout: 15_000,
  ...(isScreenshotMode() ? { adapter: createScreenshotMockAdapter() } : {}),
});

// Attach JWT from localStorage on every request
client.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default client;
