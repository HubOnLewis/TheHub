/**
 * Structured client details filled in the portal and read by staff BEO / docs.
 * Lives on deal.importMeta.clientDetails — no contact-model rewrite.
 */

export const BAR_PACKAGES = ['none', 'beer_wine', 'full_bar', 'cash_bar', 'hosted'] as const;
export type BarPackage = (typeof BAR_PACKAGES)[number];

export const BAR_PACKAGE_LABELS: Record<BarPackage, string> = {
  none: 'No bar',
  beer_wine: 'Beer & wine',
  full_bar: 'Full bar',
  cash_bar: 'Cash bar',
  hosted: 'Hosted bar',
};

export const EVENT_CONTACT_ROLES = ['client', 'planner', 'partner', 'other'] as const;
export type EventContactRole = (typeof EVENT_CONTACT_ROLES)[number];

export const EVENT_CONTACT_ROLE_LABELS: Record<EventContactRole, string> = {
  client: 'Primary client',
  planner: 'Planner',
  partner: 'Partner / spouse',
  other: 'Other',
};

export const LAYOUT_OPTIONS = [
  'Crescent tables',
  'Round banquet',
  'Long tables',
  'Open lounge',
  'Theater / presentation',
  'Ceremony + reception',
  'Gift table by windows',
] as const;

export type ClientTimelineBlock = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  notes?: string;
};

export type ClientVendor = {
  id: string;
  type: string;
  name: string;
  status: 'invited' | 'confirmed' | 'placeholder';
};

export type EventContact = {
  name: string;
  email?: string;
  phone?: string;
  role: EventContactRole;
};

export type ClientDetails = {
  guestCount?: number;
  timelineBlocks?: ClientTimelineBlock[];
  layout?: string;
  barPackage?: string;
  vendors?: ClientVendor[];
  allergies?: string;
  musicCutoff?: string;
  contacts?: EventContact[];
  updatedAt?: string;
};

const VENDOR_STATUSES = new Set(['invited', 'confirmed', 'placeholder']);

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function idOr(raw: unknown, fallback: string): string {
  const s = str(raw);
  return s || fallback;
}

export function parseBarPackage(raw: unknown): BarPackage | undefined {
  if (typeof raw !== 'string') return undefined;
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((BAR_PACKAGES as readonly string[]).includes(k)) return k as BarPackage;
  if (k.includes('beer') || k.includes('wine')) return 'beer_wine';
  if (k.includes('cash')) return 'cash_bar';
  if (k.includes('host')) return 'hosted';
  if (k.includes('full')) return 'full_bar';
  if (k === 'none' || k === 'no_bar') return 'none';
  return undefined;
}

export function parseContactRole(raw: unknown): EventContactRole {
  if (typeof raw !== 'string') return 'other';
  const k = raw.trim().toLowerCase();
  if ((EVENT_CONTACT_ROLES as readonly string[]).includes(k)) return k as EventContactRole;
  if (k.includes('plan')) return 'planner';
  if (k.includes('spouse') || k.includes('partner') || k.includes('groom') || k.includes('bride')) return 'partner';
  if (k.includes('client') || k.includes('guest') || k.includes('primary')) return 'client';
  return 'other';
}

function parseBlocks(raw: unknown): ClientTimelineBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ClientTimelineBlock[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    const label = str(r.label);
    if (!label) return;
    const block: ClientTimelineBlock = {
      id: idOr(r.id, `block-${i + 1}`),
      label,
      startTime: str(r.startTime),
      endTime: str(r.endTime),
    };
    const notes = str(r.notes);
    if (notes) block.notes = notes;
    out.push(block);
  });
  return out;
}

function parseVendors(raw: unknown): ClientVendor[] {
  if (!Array.isArray(raw)) return [];
  const out: ClientVendor[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    const name = str(r.name);
    const type = str(r.type);
    if (!name && !type) return;
    const status = str(r.status);
    out.push({
      id: idOr(r.id, `vendor-${i + 1}`),
      type: type || 'Vendor',
      name: name || 'TBD',
      status: (VENDOR_STATUSES.has(status) ? status : 'placeholder') as ClientVendor['status'],
    });
  });
  return out;
}

function parseContacts(raw: unknown): EventContact[] {
  if (!Array.isArray(raw)) return [];
  const out: EventContact[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = str(r.name);
    if (!name) continue;
    const contact: EventContact = { name, role: parseContactRole(r.role) };
    const email = str(r.email);
    const phone = str(r.phone);
    if (email) contact.email = email;
    if (phone) contact.phone = phone;
    out.push(contact);
  }
  return out;
}

export function parseClientDetails(raw: unknown): ClientDetails {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const guestRaw = r.guestCount ?? r.guests;
  const guestCount =
    typeof guestRaw === 'number' && Number.isFinite(guestRaw) && guestRaw >= 0
      ? Math.round(guestRaw)
      : undefined;
  const details: ClientDetails = {};
  if (guestCount != null) details.guestCount = guestCount;
  const blocks = parseBlocks(r.timelineBlocks);
  if (blocks.length) details.timelineBlocks = blocks;
  const layout = str(r.layout);
  if (layout) details.layout = layout;
  const bar = parseBarPackage(r.barPackage) ?? (str(r.barPackage) || undefined);
  if (bar) details.barPackage = bar;
  const vendors = parseVendors(r.vendors);
  if (vendors.length) details.vendors = vendors;
  const allergies = str(r.allergies);
  if (allergies) details.allergies = allergies;
  const musicCutoff = str(r.musicCutoff);
  if (musicCutoff) details.musicCutoff = musicCutoff;
  const contacts = parseContacts(r.contacts);
  if (contacts.length) details.contacts = contacts;
  const updatedAt = str(r.updatedAt);
  if (updatedAt) details.updatedAt = updatedAt;
  return details;
}

export function mergeClientDetails(existing: ClientDetails, patch: ClientDetails): ClientDetails {
  const next: ClientDetails = { ...existing };
  if (patch.guestCount != null) next.guestCount = patch.guestCount;
  if (patch.timelineBlocks) next.timelineBlocks = patch.timelineBlocks;
  if (patch.layout !== undefined) next.layout = patch.layout;
  if (patch.barPackage !== undefined) next.barPackage = patch.barPackage;
  if (patch.vendors) next.vendors = patch.vendors;
  if (patch.allergies !== undefined) next.allergies = patch.allergies;
  if (patch.musicCutoff !== undefined) next.musicCutoff = patch.musicCutoff;
  if (patch.contacts) next.contacts = patch.contacts;
  if (patch.updatedAt) next.updatedAt = patch.updatedAt;
  return next;
}

export function clientDetailsAreComplete(details: ClientDetails | null | undefined): boolean {
  if (!details) return false;
  const guests = details.guestCount != null && details.guestCount > 0;
  const layout = Boolean(details.layout);
  const blocks = Boolean(details.timelineBlocks && details.timelineBlocks.length > 0);
  return guests && (layout || blocks);
}

export function extraContacts(details: ClientDetails | null | undefined): EventContact[] {
  return (details?.contacts ?? []).filter(c => c.role !== 'client');
}

/**
 * Merge portal-submitted details onto deal.importMeta.
 * Syncs guestCount → importMeta.guests so staff BEO / KPIs read the same field.
 */
export function applyClientDetailsToImportMeta(
  meta: Record<string, unknown>,
  patchRaw: unknown,
  now = new Date(),
): Record<string, unknown> {
  const existing = parseClientDetails(meta.clientDetails);
  const patch = parseClientDetails(patchRaw);
  const merged = mergeClientDetails(existing, {
    ...patch,
    updatedAt: now.toISOString(),
  });
  const next: Record<string, unknown> = {
    ...meta,
    clientDetails: merged,
  };
  if (merged.guestCount != null) next.guests = merged.guestCount;
  if (merged.layout) next.layout = merged.layout;
  if (merged.barPackage) next.barPackage = merged.barPackage;
  next.detailsConfirmed = clientDetailsAreComplete(merged);
  return next;
}

export function clientDetailsFromImportMeta(meta: Record<string, unknown> | null | undefined): ClientDetails {
  if (!meta) return {};
  const parsed = parseClientDetails(meta.clientDetails);
  if (parsed.guestCount == null && typeof meta.guests === 'number') {
    parsed.guestCount = meta.guests;
  }
  if (!parsed.layout && typeof meta.layout === 'string') parsed.layout = meta.layout;
  if (!parsed.barPackage && typeof meta.barPackage === 'string') parsed.barPackage = meta.barPackage;
  return parsed;
}

export function barPackageLabel(raw: string | undefined): string {
  if (!raw) return 'Not captured yet';
  const parsed = parseBarPackage(raw);
  if (parsed) return BAR_PACKAGE_LABELS[parsed];
  return raw;
}

export type EventDocClientFields = {
  guestCount: string;
  layout: string;
  barPackage: string;
  allergies: string;
  musicCutoff: string;
  timelineBlocks: Array<{ label: string; startTime: string; endTime: string }>;
  vendors: Array<{ type: string; name: string; status: string }>;
  contacts: Array<{ name: string; role: string; email: string }>;
};

function escDoc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Flatten portal clientDetails into the fields staff BEO / guest event sheet print. */
export function eventDocFromClientDetails(details: ClientDetails | null | undefined): EventDocClientFields {
  const d = details ?? {};
  return {
    guestCount: d.guestCount != null ? String(d.guestCount) : 'TBD',
    layout: d.layout?.trim() || 'TBD',
    barPackage: barPackageLabel(d.barPackage),
    allergies: d.allergies?.trim() || 'None noted',
    musicCutoff: d.musicCutoff?.trim() || 'TBD',
    timelineBlocks: (d.timelineBlocks ?? []).map(b => ({
      label: b.label,
      startTime: b.startTime || '—',
      endTime: b.endTime || '—',
    })),
    vendors: (d.vendors ?? []).map(v => ({
      type: v.type,
      name: v.name,
      status: v.status,
    })),
    contacts: (d.contacts ?? []).map(c => ({
      name: c.name,
      role: c.role,
      email: c.email ?? '—',
    })),
  };
}

/** HTML fragment shared by staff BEO and guest event sheet. Same importMeta.clientDetails — no second store. */
export function buildClientDetailsDocHtml(details: ClientDetails | null | undefined): string {
  const f = eventDocFromClientDetails(details);
  const blocks = f.timelineBlocks.length
    ? `<h2>Run of show</h2>
  <table><thead><tr><th>Block</th><th>Start</th><th>End</th></tr></thead><tbody>
  ${f.timelineBlocks.map(b => `<tr><td>${escDoc(b.label)}</td><td>${escDoc(b.startTime)}</td><td>${escDoc(b.endTime)}</td></tr>`).join('')}
  </tbody></table>`
    : '';
  const vendors = f.vendors.length
    ? `<h2>Vendor roster</h2>
  <table><thead><tr><th>Type</th><th>Name</th><th>Status</th></tr></thead><tbody>
  ${f.vendors.map(v => `<tr><td>${escDoc(v.type)}</td><td>${escDoc(v.name)}</td><td>${escDoc(v.status)}</td></tr>`).join('')}
  </tbody></table>`
    : '';
  const contacts = f.contacts.length
    ? `<h2>Contacts</h2>
  <table><thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead><tbody>
  ${f.contacts.map(c => `<tr><td>${escDoc(c.name)}</td><td>${escDoc(c.role)}</td><td>${escDoc(c.email)}</td></tr>`).join('')}
  </tbody></table>`
    : '';
  return `<h2>Client details (portal)</h2>
  <div class="grid">
    <div class="field"><label>Guests</label><div>${escDoc(f.guestCount)}</div></div>
    <div class="field"><label>Layout</label><div>${escDoc(f.layout)}</div></div>
    <div class="field"><label>Bar package</label><div>${escDoc(f.barPackage)}</div></div>
    <div class="field"><label>Music cutoff</label><div>${escDoc(f.musicCutoff)}</div></div>
    <div class="field"><label>Allergies</label><div>${escDoc(f.allergies)}</div></div>
  </div>
  ${blocks}
  ${vendors}
  ${contacts}`;
}
