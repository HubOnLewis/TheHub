// packages/web/src/api/client.ts
import axios from 'axios';
import { isScreenshotMode } from '../config/screenshotMode.js';
import {
  logApiBaseUrlDiagnostics,
  resolveApiBaseUrl,
} from '../config/apiBaseUrl.js';
import { createScreenshotMockAdapter } from './screenshotApiMock.js';

const AUTH_TOKEN_KEY = 'hub_crm_token';

const apiResolution = resolveApiBaseUrl();
logApiBaseUrlDiagnostics();

function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

const client = axios.create({
  baseURL: apiResolution.baseUrl || 'https://api-not-configured.invalid/api',
  timeout: 15_000,
  ...(isScreenshotMode() ? { adapter: createScreenshotMockAdapter() } : {}),
});

/** Production misconfiguration — show before attempting login. */
export function getApiConfigError(): string | null {
  return apiResolution.configError;
}

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
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default client;
