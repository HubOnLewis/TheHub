/**
 * Clear stale Perfect Venue generated frontend artifacts (empty import state).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const PATHS = {
  pfEventsTs: resolve(ROOT, 'packages/web/src/data/pfEventsSnapshotFlags.ts'),
  pvFlagsTs: resolve(ROOT, 'packages/web/src/data/pvExportFlags.ts'),
  pvFullTs: resolve(ROOT, 'packages/web/src/data/perfectVenueFullExport.ts'),
  processedDir: resolve(ROOT, 'data/perfect-venue-processed'),
  importDir: resolve(ROOT, 'data/perfect-venue-import'),
  importAltDir: resolve(ROOT, 'import'),
  resetManifest: resolve(ROOT, 'data/hub-reset-manifest.json'),
};

function emptyMeta() {
  return {
    importedAt: '',
    sourceFiles: { events: '', proposals: '', contacts: '' },
    venue: 'HuB on Lewis',
    rowCounts: {
      eventsRaw: 0,
      eventsNormalized: 0,
      proposalsRaw: 0,
      proposalLineItems: 0,
      contactsRaw: 0,
      contactsNormalized: 0,
      accounts: 0,
    },
    joins: {
      eventsWithProposals: 0,
      eventsWithContacts: 0,
      contactsWithAccounts: 0,
      orphanedProposals: 0,
    },
    warnings: [],
    quality: {
      missingEventDates: 0,
      missingContacts: 0,
      missingTotals: 0,
      duplicateContactEmails: 0,
      exampleEventsExcluded: 0,
      zeroDollarEvents: 0,
    },
  };
}

function emptyPfSnapshot() {
  return {
    importedAt: '',
    sourceFile: '',
    referenceDate: '',
    summary: {
      activeEvents: 0,
      activeEventsDollars: 0,
      lead: 0,
      leadDollars: 0,
      qualified: 0,
      qualifiedDollars: 0,
      proposalSent: 0,
      proposalSentDollars: 0,
      confirmed: 0,
      confirmedDollars: 0,
      balanceDue: 0,
      balanceDueDollars: 0,
      completedYtd: 0,
      completedYtdDollars: 0,
    },
    events: [],
    importStatus: {
      completeness: 'FAILED',
      authoritative: false,
      parsedRowCount: 0,
      expectedActiveEvents: 0,
      mismatchSummary: 'No PFevents.txt import loaded — ready for fresh Perfect Venue import',
      safeToUseAsAuthoritative: false,
    },
  };
}

export function listArtifactPaths() {
  const files = [];
  for (const [label, p] of Object.entries(PATHS)) {
    if (label === 'processedDir' || label === 'importDir' || label === 'importAltDir') {
      if (existsSync(p)) {
        for (const f of readdirSync(p)) files.push({ label, path: join(p, f) });
      }
    } else if (existsSync(p)) {
      files.push({ label, path: p });
    }
  }
  return files;
}

export function backupArtifactFiles(backupDir) {
  mkdirSync(backupDir, { recursive: true });
  const backedUp = [];
  for (const { label, path } of listArtifactPaths()) {
    const dest = join(backupDir, 'artifacts', label, path.split(/[/\\]/).pop());
    mkdirSync(dirname(dest), { recursive: true });
    try {
      if (existsSync(path) && !path.endsWith('/') && !path.includes('*')) {
        const stat = statSync(path);
        if (stat.isFile()) {
          writeFileSync(dest, readFileSync(path));
          backedUp.push({ label, from: path, to: dest });
        }
      }
    } catch {
      // skip
    }
  }
  for (const dir of [PATHS.processedDir, PATHS.importDir]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const src = join(dir, f);
      const dest = join(backupDir, 'artifacts', dir.split(/[/\\]/).pop(), f);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(src));
      backedUp.push({ from: src, to: dest });
    }
  }
  return backedUp;
}

export function writeEmptyImportArtifacts({ resetAt, tenantIds }) {
  const meta = emptyMeta();
  const pf = emptyPfSnapshot();

  const pfTs = `/**
 * CLEARED by scripts/reset-hub-tenant-data.mjs — ready for fresh Perfect Venue import.
 * Re-run: npm run import:pfevents -- --apply
 */
import type { PfEventsSnapshot } from './pfEventsTypes.js';

export const PF_EVENTS_SNAPSHOT_AVAILABLE = false;

export const PF_EVENTS_SNAPSHOT: PfEventsSnapshot = ${JSON.stringify(pf, null, 2)};
`;

  const pvFlagsTs = `/**
 * CLEARED by scripts/reset-hub-tenant-data.mjs — ready for fresh Perfect Venue import.
 * Re-run: npm run import:perfect-venue
 */
export const PV_FULL_EXPORT_AVAILABLE = false;

export const isFullPvExportAvailable = PV_FULL_EXPORT_AVAILABLE;
`;

  const venueSummary = {
    activeEvents: 0,
    activePipelineDollars: 0,
    lead: 0,
    qualified: 0,
    proposalSent: 0,
    confirmed: 0,
    balanceDue: 0,
    balanceDueDollars: 0,
    completedYtd: 0,
    completedYtdDollars: 0,
    extractedAt: '',
    venue: 'HuB on Lewis',
  };

  const operational = { venueSummary, occupancyPct: 0, flagshipEventId: '' };
  const relationships = {
    eventToContact: {},
    eventToAccount: {},
    contactToEvents: {},
    accountToEvents: {},
    accountToContacts: {},
  };
  const financialSnapshot = {
    paymentsCollected: 0,
    outstandingExposure: 0,
    overdueExposure: 0,
    mtdCollected: 0,
    mtdGrandTotal: 0,
    proposalExposure: 0,
    depositDueCount: 0,
    avgBookingValue: 0,
    conversionRatePct: 0,
  };

  const pvFullTs = `/**
 * CLEARED by scripts/reset-hub-tenant-data.mjs — ready for fresh Perfect Venue import.
 * Re-run: npm run import:perfect-venue
 */

import type {
  PvFullImportMeta,
  PvFullEvent,
  PvFullProposalSummary,
  PvFullContact,
  PvFullAccount,
  PvFullRelationships,
  PvFullOperationalSnapshot,
  PvFullPayment,
  PvFullEventFinancial,
  PvFullSalesDay,
  PvFullVenueSalesTotals,
  PvFullFinancialSnapshot,
  PvFullAccountFinancial,
} from './pvFullTypes.js';

export const PV_FULL_IMPORT_META: PvFullImportMeta = ${JSON.stringify(meta, null, 2)};

export const FULL_PV_EVENTS: PvFullEvent[] = [];

export const FULL_PV_PROPOSALS: Record<string, PvFullProposalSummary> = {};

export const FULL_PV_CONTACTS: PvFullContact[] = [];

export const FULL_PV_ACCOUNTS: PvFullAccount[] = [];

export const FULL_PV_RELATIONSHIPS: PvFullRelationships = ${JSON.stringify(relationships, null, 2)};

export const FULL_PV_OPERATIONAL_INTELLIGENCE: PvFullOperationalSnapshot = ${JSON.stringify(operational, null, 2)};

export const FULL_PV_PAYMENTS: PvFullPayment[] = [];

export const FULL_PV_EVENT_FINANCIALS: Record<string, PvFullEventFinancial> = {};

export const FULL_PV_SALES_DAYS: PvFullSalesDay[] = [];

export const FULL_PV_VENUE_SALES_TOTALS: PvFullVenueSalesTotals | null = null;

export const FULL_PV_FINANCIAL_SNAPSHOT: PvFullFinancialSnapshot = ${JSON.stringify(financialSnapshot, null, 2)};

export const FULL_PV_ACCOUNT_FINANCIALS: PvFullAccountFinancial[] = [];

export const PV_FULL_EXPORT_AVAILABLE = false;
`;

  writeFileSync(PATHS.pfEventsTs, pfTs, 'utf8');
  writeFileSync(PATHS.pvFlagsTs, pvFlagsTs, 'utf8');
  writeFileSync(PATHS.pvFullTs, pvFullTs, 'utf8');

  if (existsSync(PATHS.processedDir)) {
    rmSync(PATHS.processedDir, { recursive: true, force: true });
  }
  mkdirSync(PATHS.processedDir, { recursive: true });
  writeFileSync(
    join(PATHS.processedDir, 'import-summary.json'),
    JSON.stringify({ resetAt, status: 'cleared', tenants: tenantIds }, null, 2),
  );

  const archiveDir = join(ROOT, 'data/backups', `stale-import-${resetAt.replace(/[:.]/g, '-')}`);
  mkdirSync(archiveDir, { recursive: true });
  for (const dir of [PATHS.importDir, PATHS.importAltDir]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const src = join(dir, f);
      try {
        renameSync(src, join(archiveDir, `${dir.split(/[/\\]/).pop()}-${f}`));
      } catch {
        // best effort
      }
    }
  }

  const manifest = {
    resetAt,
    tenantIds,
    message: 'HuB tenant data reset — ready for fresh Perfect Venue import',
    expectedFiles: [
      'data/perfect-venue-import/Event Data *.xlsx',
      'data/perfect-venue-import/Proposal Data *.xlsx',
      'data/perfect-venue-import/Contact Data *.xlsx',
      'data/perfect-venue-import/Payment Data *.xlsx (optional)',
      'data/perfect-venue-import/PFevents.txt (optional text snapshot)',
    ],
    importCommands: ['npm run import:perfect-venue', 'npm run import:pfevents -- --apply'],
  };
  mkdirSync(dirname(PATHS.resetManifest), { recursive: true });
  writeFileSync(PATHS.resetManifest, JSON.stringify(manifest, null, 2), 'utf8');

  const webManifestTs = resolve(ROOT, 'packages/web/src/data/hubResetManifest.ts');
  writeFileSync(
    webManifestTs,
    `/** Auto-generated by scripts/reset-hub-tenant-data.mjs — do not edit manually. */

export type HubResetManifest = {
  resetAt: string;
  tenantIds: string[];
  message: string;
  expectedFiles: string[];
  importCommands: string[];
};

export const HUB_RESET_MANIFEST: HubResetManifest | null = ${JSON.stringify(manifest, null, 2)};
`,
    'utf8',
  );

  return {
    cleared: [PATHS.pfEventsTs, PATHS.pvFlagsTs, PATHS.pvFullTs, PATHS.processedDir],
    manifestPath: PATHS.resetManifest,
    archivedImportDir: archiveDir,
  };
}
