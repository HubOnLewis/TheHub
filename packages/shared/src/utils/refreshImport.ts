/** Perfect Venue refresh import source detection — shared by API and web. */

export type RefreshImportFields = {
  source?: string | null;
  importMeta?: { source?: string } | Record<string, unknown> | null;
};

export function isPerfectVenueRefreshDeal(fields: RefreshImportFields): boolean {
  const top = String(fields.source ?? '').trim();
  if (top === 'perfect_venue_refresh') return true;
  const meta = fields.importMeta;
  if (meta && typeof meta === 'object' && 'source' in meta) {
    return String((meta as { source?: string }).source ?? '').trim() === 'perfect_venue_refresh';
  }
  return false;
}
