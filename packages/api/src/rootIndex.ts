import type { Request, Response } from 'express';
import { getAiRuntimeConfig } from './config/ai.js';

export const HUB_ADMIN_URL = 'https://admin.hubonlewis.com';

export type ApiRootPayload = {
  status: 'ok';
  productMode: 'venue' | 'equipment';
  health: '/health';
  adminUrl: string;
};

/** JSON body for GET / — not a redirect. Browser hitting the API host sees this, not Cannot GET /. */
export function apiRootPayload(): ApiRootPayload {
  return {
    status: 'ok',
    productMode: getAiRuntimeConfig().productMode,
    health: '/health',
    adminUrl: HUB_ADMIN_URL,
  };
}

export function getApiRoot(_req: Request, res: Response): void {
  res.status(200).json(apiRootPayload());
}
