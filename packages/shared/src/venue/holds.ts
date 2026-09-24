/**
 * Timed date holds — inquiry places a hold; staff extend/release; expiry frees the calendar.
 */

import { resolveVenueStage, type VenueStage } from './stages.js';

export const DEFAULT_HOLD_DAYS = 7;
export const HOLD_EXTEND_DAYS = 7;
export const HOLD_EXPIRING_WITHIN_DAYS = 2;

export const HOLD_PIPELINE_STAGES: ReadonlySet<VenueStage> = new Set([
  'inquiry',
  'qualified',
  'proposal',
]);

export const BOOKED_PIPELINE_STAGES: ReadonlySet<VenueStage> = new Set([
  'deposit',
  'confirmed',
  'prep',
  'completed',
]);

export type HoldLifecycle = 'none' | 'active' | 'expiring' | 'expired' | 'released' | 'converted';

const DAY_MS = 86_400_000;

export function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString();
}

export function defaultHoldExpiresAt(now = new Date()): string {
  return addDaysIso(now, DEFAULT_HOLD_DAYS);
}

function metaOf(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return meta && typeof meta === 'object' ? meta : {};
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string {
  const value = metaOf(meta)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function holdExpiresAtFromMeta(meta: Record<string, unknown> | null | undefined): string | null {
  const raw = metaString(meta, 'holdExpiresAt') || metaString(meta, 'holdExpires');
  return raw || null;
}

export function isHoldReleased(meta: Record<string, unknown> | null | undefined): boolean {
  return Boolean(metaString(meta, 'holdReleasedAt'));
}

export function isHoldExpired(meta: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  const raw = holdExpiresAtFromMeta(meta);
  if (!raw) return false;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) && ms <= nowMs;
}

export function venueStageFromDeal(deal: {
  status?: string | null;
  importMeta?: Record<string, unknown> | null;
}): VenueStage {
  const meta = metaOf(deal.importMeta);
  return resolveVenueStage({
    dealStatus: deal.status,
    pvStatus: metaString(meta, 'pvStatus') || null,
    balanceDue: typeof meta.balanceDue === 'number' ? meta.balanceDue : null,
    amountPaid: typeof meta.amountPaid === 'number' ? meta.amountPaid : null,
    grandTotal: typeof meta.grandTotal === 'number' ? meta.grandTotal : null,
  });
}

export function resolveHoldLifecycle(
  deal: {
    status?: string | null;
    importMeta?: Record<string, unknown> | null;
  },
  nowMs = Date.now(),
): HoldLifecycle {
  if (deal.status === 'Lost') return 'none';
  if (deal.status === 'Won' || deal.status === 'In Build' || deal.status === 'Delivered') return 'converted';
  const stage = venueStageFromDeal(deal);
  if (stage === 'lost') return 'none';
  if (BOOKED_PIPELINE_STAGES.has(stage)) return 'converted';
  if (!HOLD_PIPELINE_STAGES.has(stage)) return 'none';
  if (isHoldReleased(deal.importMeta)) return 'released';
  if (isHoldExpired(deal.importMeta, nowMs)) return 'expired';
  const expires = holdExpiresAtFromMeta(deal.importMeta);
  if (!expires) return 'active';
  const ms = Date.parse(expires);
  if (!Number.isFinite(ms)) return 'active';
  const remaining = ms - nowMs;
  if (remaining <= HOLD_EXPIRING_WITHIN_DAYS * DAY_MS) return 'expiring';
  return 'active';
}

/** Soft inquiry holds stop occupying the room after expiry or staff release. Confirmed events always occupy. */
export function dealOccupiesCalendar(
  deal: {
    status?: string | null;
    importMeta?: Record<string, unknown> | null;
  },
  nowMs = Date.now(),
): boolean {
  const life = resolveHoldLifecycle(deal, nowMs);
  if (life === 'expired' || life === 'released' || life === 'none') return false;
  return true;
}

export function holdActionPatch(
  action: 'extend' | 'release',
  meta: Record<string, unknown> | null | undefined,
  opts?: { days?: number; now?: Date },
): Record<string, unknown> {
  const now = opts?.now ?? new Date();
  const days = opts?.days ?? HOLD_EXTEND_DAYS;
  if (action === 'release') {
    return {
      holdReleasedAt: now.toISOString(),
      holdExpiresAt: now.toISOString(),
    };
  }
  const current = holdExpiresAtFromMeta(meta);
  const currentMs = current ? Date.parse(current) : NaN;
  const base = Number.isFinite(currentMs) && currentMs > now.getTime() ? new Date(currentMs) : now;
  return {
    holdExpiresAt: addDaysIso(base, days),
    holdExtendedAt: now.toISOString(),
    holdReleasedAt: '',
  };
}
