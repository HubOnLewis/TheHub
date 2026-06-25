/**
 * Detect cloned MTTE / truck / equipment records that must not appear in HuB on Lewis venue CRM.
 */

export type HubContaminationFields = {
  title?: string | null;
  company?: string | null;
  contact?: string | null;
  notes?: string | null;
  unitId?: string | null;
  unitIds?: string[] | null;
  make?: string | null;
  model?: string | null;
  stockNumber?: string | null;
  importMeta?: { source?: string } | Record<string, unknown> | null;
};

/** HuB venue tenants — equipment/truck pipeline records are out of scope. */
export function isHubVenueTenantId(tenantId: string | null | undefined): boolean {
  if (!tenantId) return false;
  return tenantId.startsWith('hub-');
}

const STRONG_PHRASES = [
  'mtte',
  'wki',
  'kenworth',
  'pacleas',
  'pac lease',
  't880',
  't380',
  'mk0243',
  "myles' water truck",
  'myles water truck',
  'beran dump',
  'platte county',
  'water truck',
  'dump truck',
  'mechanics truck',
  'mechanic truck',
  'snow truck',
  'service truck',
  'day cab tractor',
  '4x2 snow',
  '14k crane',
  "14' body",
  '14 foot body',
  'paclease return',
  'qrf import',
  'voze import',
  'demo-202',
  'stocknumber',
];

const TRUCK_EXCLUSIONS = [
  'food truck',
  'hu b on lewis',
  'hub on lewis',
];

function haystack(fields: HubContaminationFields): string {
  const importSource =
    fields.importMeta && typeof fields.importMeta === 'object' && 'source' in fields.importMeta
      ? String((fields.importMeta as { source?: string }).source ?? '')
      : '';
  return [
    fields.title,
    fields.company,
    fields.contact,
    fields.notes,
    fields.make,
    fields.model,
    fields.stockNumber,
    importSource,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getHubContaminationReasons(fields: HubContaminationFields): string[] {
  const reasons: string[] = [];
  const h = haystack(fields);

  if (fields.unitId || (fields.unitIds?.length ?? 0) > 0) {
    reasons.push('linked equipment unit');
  }

  for (const phrase of STRONG_PHRASES) {
    if (h.includes(phrase)) reasons.push(`matched "${phrase}"`);
  }

  if (/\btruck\b/.test(h) && !TRUCK_EXCLUSIONS.some(ex => h.includes(ex))) {
    reasons.push('matched "truck"');
  }

  if (/\btractor\b/.test(h) && !h.includes('investor')) {
    reasons.push('matched "tractor"');
  }

  if (/\bchassis\b/.test(h) || /\bcab\b/.test(h) && /\bday\b/.test(h)) {
    reasons.push('equipment chassis/cab language');
  }

  return reasons;
}

export function isHubContaminatedRecord(fields: HubContaminationFields): boolean {
  return getHubContaminationReasons(fields).length > 0;
}

export function filterHubVenueRecords<T extends HubContaminationFields>(
  tenantId: string | null | undefined,
  records: T[],
): T[] {
  if (!isHubVenueTenantId(tenantId)) return records;
  return records.filter(r => !isHubContaminatedRecord(r));
}
