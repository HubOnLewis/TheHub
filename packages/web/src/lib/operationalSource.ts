import { getPvImportMeta } from '../data/perfectVenueSeed.js';
import { PV_FULL_EXPORT_AVAILABLE } from '../data/pvExportFlags.js';
import { HUB_REFRESH_AVAILABLE } from '../data/hubRefreshManifest.js';
import { PV_VENUE_SUMMARY } from '../data/perfectVenueSeed.js';

/** Neutral label for real client Perfect Venue export data — not live-synced. */
export function getOperationalSourceNote(): string {
  if (PV_FULL_EXPORT_AVAILABLE) {
    const meta = getPvImportMeta();
    const imported = new Date(meta.importedAt);
    if (!Number.isNaN(imported.getTime())) {
      const formatted = imported.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      return `Operational data imported from Perfect Venue export dated ${formatted}`;
    }
  }

  const extracted = PV_VENUE_SUMMARY.extractedAt;
  if (extracted) {
    const d = new Date(`${extracted}T12:00:00`);
    const formatted = Number.isNaN(d.getTime())
      ? extracted
      : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `Operational data imported from Perfect Venue export dated ${formatted}`;
  }

  return 'Operational data imported from Perfect Venue export';
}

export function hasImportedVenueRecords(): boolean {
  return (
    HUB_REFRESH_AVAILABLE ||
    PV_FULL_EXPORT_AVAILABLE ||
    Boolean(PV_VENUE_SUMMARY.lead || PV_VENUE_SUMMARY.proposalSent)
  );
}