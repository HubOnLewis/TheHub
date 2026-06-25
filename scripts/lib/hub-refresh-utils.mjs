/**
 * Shared utilities for HuB Perfect Venue refresh import.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');

export const FOLDER_MAP = {
  '01-events-master': { role: 'master', types: ['.xlsx'] },
  '02-event-summaries': { role: 'eventSummary', types: ['.pdf'] },
  '03-beos': { role: 'beo', types: ['.pdf'] },
  '04-staff-beos': { role: 'staffBeo', types: ['.pdf'] },
  '05-invoices': { role: 'invoice', types: ['.pdf'] },
  '06-agreements': { role: 'agreement', types: ['.pdf'] },
  '07-menus': { role: 'menu', types: ['.pdf'] },
  '08-payments': { role: 'payments', types: ['.xlsx'] },
};

export const CONTAMINATION_TERMS = [
  'mtte', 'wki', 'wichita kenworth', 'kenworth', 'pacleas', 'pac lease', 'pacleas',
  't880', 't380', 'mechanics truck', 'mechanic truck', 'dump truck', 'water truck',
  'service truck', 'day cab', 'mk0243', 'myles water truck', "myles' water truck",
];

export function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

export function parseArgs(argv) {
  const rootIdx = argv.indexOf('--root');
  const tenantIdx = argv.indexOf('--tenant');
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : resolve(ROOT, 'import');
  const tenant = tenantIdx >= 0 ? argv[tenantIdx + 1] : 'hub-wichita';
  const apply = argv.includes('--apply');
  const audit = argv.includes('--audit');
  const dryRun = argv.includes('--dry-run');
  const confirmProduction = argv.includes('--confirm-production');
  return { root, tenant, apply, audit, dryRun, confirmProduction };
}

/** Resolve Mongo database — matches API `client.db(env.DB_NAME)`. */
export function getMongoDb(client) {
  const name = process.env.DB_NAME?.trim();
  return name ? client.db(name) : client.db();
}

/** Print-safe Mongo target (host + db name only). */
export function parseMongoTarget(uri) {
  const dbName =
    process.env.DB_NAME?.trim() ||
    uri.match(/\/([^/?]+)(\?|$)/)?.[1] ||
    '(client default)';
  const host =
    uri.match(/@([^/?]+)/)?.[1] ||
    uri.match(/mongodb(?:\+srv)?:\/\/([^/?]+)/)?.[1] ||
    'unknown';
  return { host, dbName };
}

export function excelSerialToIso(serial) {
  if (serial === '' || serial == null) return null;
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) {
    const s = String(serial).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const utc = (n - 25569) * 86400 * 1000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function excelSerialToDateTime(serial) {
  if (serial === '' || serial == null) return null;
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const utc = (n - 25569) * 86400 * 1000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseMoney(v) {
  if (v === '' || v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function parseIntSafe(v) {
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePvId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/PV-?0*(\d+)/i);
  if (m) return `PV-${String(m[1]).padStart(7, '0')}`;
  if (/^\d+$/.test(s)) return `PV-${s.padStart(7, '0')}`;
  return s.toUpperCase();
}

export function normalizeName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeEmail(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function normalizePhone(s) {
  return String(s ?? '').replace(/\D/g, '').slice(-10);
}

export function mapPvStatus(raw) {
  const s = String(raw ?? '').trim();
  if (s === 'Lead') return 'lead';
  if (s === 'Qualified') return 'qualified';
  if (s === 'Proposal Sent') return 'proposal_sent';
  if (s === 'Confirmed') return 'confirmed';
  if (s === 'Completed') return 'completed';
  if (s === 'Lost') return 'lost';
  if (/balance/i.test(s)) return 'balance_due';
  return 'qualified';
}

export function mapPvToDealStatus(pvStatus) {
  switch (pvStatus) {
    case 'lead':
      return 'Draft';
    case 'qualified':
      return 'Pending Approval';
    case 'proposal_sent':
      return 'Approved';
    case 'confirmed':
    case 'balance_due':
      return 'Won';
    case 'completed':
      return 'Delivered';
    case 'lost':
      return 'Lost';
    default:
      return 'Approved';
  }
}

export function mapPaymentType(raw) {
  const t = String(raw ?? '').trim();
  if (t === 'Deposit') return 'deposit';
  if (t === 'Remaining Balance') return 'balance';
  if (t === 'Other') return 'other';
  return 'unknown';
}

export function slugId(prefix, raw) {
  const s = String(raw).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${prefix}-${s || 'unknown'}`.slice(0, 64);
}

export function extractPdfDocKey(filename) {
  const base = filename.replace(/\.pdf$/i, '');
  const m = base.match(/(\d{3,})$/);
  return m ? m[1] : null;
}

export function contaminationHit(text) {
  const h = String(text ?? '').toLowerCase();
  if (!h) return null;
  if (/\btruck\b/.test(h) && !/food truck/.test(h)) return 'truck';
  for (const term of CONTAMINATION_TERMS) {
    if (h.includes(term)) return term;
  }
  return null;
}

export function scanContamination(record) {
  const parts = [
    record.title,
    record.company,
    record.contact,
    record.contactEmail,
    record.notes,
    record.eventName,
    record.payer,
  ].filter(Boolean);
  for (const p of parts) {
    const hit = contaminationHit(p);
    if (hit) return { field: p, term: hit };
  }
  return null;
}
