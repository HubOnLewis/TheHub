import axios from 'axios';
import { isScreenshotMode } from '../config/screenshotMode.js';
import { resolveApiBaseUrl } from '../config/apiBaseUrl.js';
import { createScreenshotMockAdapter } from './screenshotApiMock.js';

const apiResolution = resolveApiBaseUrl();

/**
 * Guest-facing HTTP client. Does not attach staff JWT and does not redirect to /login on 401.
 */
const publicClient = axios.create({
  baseURL: apiResolution.baseUrl || 'https://api-not-configured.invalid/api',
  timeout: 15_000,
  ...(isScreenshotMode() ? { adapter: createScreenshotMockAdapter() } : {}),
});

export default publicClient;
