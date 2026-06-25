/**
 * Remove persisted demo/cache data. Does not clear auth/session tokens.
 */

import { isHubContaminatedRecord, type HubContaminationFields } from '@hub-crm/shared';
import { DEMO_OPS_STORAGE_KEY } from '../state/demoOpsStore.js';
import { AUDIT_STORAGE_KEY } from '../audit/auditStore.js';

const REVIEW_NOTES_KEY = 'hub-crm-review-notes';
const CLEANUP_FLAG = 'hub-crm-mtte-cache-purged-v1';

/** Local keys safe to clear for demo/cache reset (never auth). */
export const HUB_LOCAL_DEMO_CACHE_KEYS = [
  DEMO_OPS_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
  REVIEW_NOTES_KEY,
  CLEANUP_FLAG,
  'hub-crm-referrals',
  'hub-crm-marketing-blasts',
  'hub-crm-finalization',
  'hub-crm-portal',
  'hub-crm-demo-flow-collapsed',
] as const;

function asContaminationFields(value: unknown): HubContaminationFields | null {
  if (typeof value === 'string') {
    return { title: value, notes: value };
  }
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  return {
    title: typeof o.title === 'string' ? o.title : typeof o.subject === 'string' ? o.subject : undefined,
    company: typeof o.company === 'string' ? o.company : typeof o.org === 'string' ? o.org : undefined,
    contact: typeof o.contact === 'string' ? o.contact : typeof o.from === 'string' ? o.from : undefined,
    notes:
      typeof o.notes === 'string'
        ? o.notes
        : typeof o.linkedEvent === 'string'
          ? o.linkedEvent
          : typeof o.preview === 'string'
            ? o.preview
            : undefined,
  };
}

function textLooksContaminated(value: unknown): boolean {
  const fields = asContaminationFields(value);
  return fields ? isHubContaminatedRecord(fields) : false;
}

function scanJsonForContamination(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const stack: unknown[] = [parsed];
    while (stack.length) {
      const cur = stack.pop();
      if (textLooksContaminated(cur)) return true;
      if (Array.isArray(cur)) {
        for (const item of cur) stack.push(item);
      } else if (cur && typeof cur === 'object') {
        for (const v of Object.values(cur as Record<string, unknown>)) stack.push(v);
      }
    }
  } catch {
    return isHubContaminatedRecord({ notes: raw });
  }
  return false;
}

/** Full demo/cache reset — does not touch auth/session. */
export function resetHubLocalDemoCache(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of HUB_LOCAL_DEMO_CACHE_KEYS) {
    localStorage.removeItem(key);
  }
}

/** One-time targeted purge when contamination detected in cached JSON. */
export function purgeHubContaminatedLocalCache(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(CLEANUP_FLAG) === '1') return;

  let removed = 0;
  for (const key of HUB_LOCAL_DEMO_CACHE_KEYS) {
    const raw = localStorage.getItem(key);
    if (scanJsonForContamination(raw)) {
      localStorage.removeItem(key);
      removed += 1;
    }
  }

  localStorage.setItem(CLEANUP_FLAG, '1');

  if (removed > 0 && import.meta.env.DEV) {
    console.info(`[Hub CRM] Purged ${removed} local cache key(s) containing truck/MTTE demo data.`);
  }
}

/** Console helper: hubDemoCacheReset() */
export function hubDemoCacheResetConsoleHelp(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { hubDemoCacheReset?: () => void }).hubDemoCacheReset = () => {
    resetHubLocalDemoCache();
    window.location.reload();
  };
}
