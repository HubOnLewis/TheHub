#!/usr/bin/env node
/**
 * Build a PII-safe preview of the complete September Perfect Venue import.
 * This command never connects to Mongo and never writes Hub entities.
 */
import XLSX from 'xlsx';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[process.argv.indexOf('--root') + 1] || 'import/sept26');
if (!existsSync(root)) throw new Error(`Source folder not found: ${root}`);

const files = readdirSync(root);
const find = pattern => files.find(name => pattern.test(name));
const paths = {
  events: find(/^events-report-.*\.xlsx$/i),
  contacts: find(/^contact-report-.*\.xlsx$/i),
  proposals: find(/^proposal-report-.*\.xlsx$/i),
  payments: find(/^payment-report-.*\.xlsx$/i),
};

function rows(name) {
  if (!name) return [];
  const workbook = XLSX.readFile(join(root, name));
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
}
function text(value) { return String(value ?? '').trim(); }
function norm(value) { return text(value).toLowerCase(); }
function email(value) { return norm(value); }
function hash(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 12); }
function money(value) {
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
function date(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') return new Date((value - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function sourceId(value) { return text(value); }

const eventRows = rows(paths.events);
const contactRows = rows(paths.contacts);
const proposalRows = rows(paths.proposals);
const paymentRows = rows(paths.payments);
const eventRowsValid = eventRows.filter(row => sourceId(row.ID));
const eventIds = new Set(eventRowsValid.map(row => sourceId(row.ID)));
const paymentIds = new Set(paymentRows.map(row => sourceId(row['Payment ID'])).filter(Boolean));
const proposalIds = new Set(proposalRows.map(row => sourceId(row['Event ID'])).filter(Boolean));
const paymentEventIds = new Set(paymentRows.map(row => sourceId(row['Event ID'])).filter(Boolean));

const contactEmailGroups = new Map();
for (const row of contactRows) {
  const key = email(row.Email);
  if (!key) continue;
  const list = contactEmailGroups.get(key) ?? [];
  list.push(row);
  contactEmailGroups.set(key, list);
}
const duplicateContactGroups = [...contactEmailGroups.values()].filter(group => group.length > 1);
const contactWithoutEmail = contactRows.filter(row => !email(row.Email)).length;
const eventById = new Map(eventRowsValid.map(row => [sourceId(row.ID), row]));
const orphanProposalRows = proposalRows.filter(row => {
  const id = sourceId(row['Event ID']);
  return !id || !eventIds.has(id);
});
const orphanPaymentRows = paymentRows.filter(row => {
  const id = sourceId(row['Event ID']);
  return id && !eventIds.has(id);
});

const proposalGroups = new Map();
for (const row of proposalRows) {
  const id = sourceId(row['Event ID']);
  if (!id || !eventIds.has(id)) continue;
  const list = proposalGroups.get(id) ?? [];
  list.push({
    sourceId: id,
    itemName: text(row['Item Name']),
    quantity: Number(row.Quantity) || 0,
    unit: text(row.Unit),
    total: money(row.Total),
    category: text(row['Menu Section']) || 'other',
    sourceReport: paths.proposals,
  });
  proposalGroups.set(id, list);
}

const normalized = {
  events: eventRowsValid.map(row => ({
    externalId: sourceId(row.ID),
    normalizedId: `pv-refresh:${sourceId(row.ID)}`,
    title: text(row.Name),
    status: text(row.Status),
    owner: text(row.Owner),
    eventDate: date(row['Event Date']),
    guests: Number(row['Group Size']) || 0,
    amount: money(row['Proposal Total']),
    sourceReport: paths.events,
  })),
  contacts: contactRows.map(row => {
    const rawEmail = email(row.Email);
    const identity = rawEmail
      ? duplicateContactGroups.some(group => group.includes(row))
        ? `email-conflict:${hash(rawEmail)}`
        : `email:${rawEmail}`
      : `missing-email:${hash(`${row['First Name']}|${row['Last Name']}|${row.Account}`)}`;
    return {
      normalizedId: identity,
      sourceIdentity: rawEmail || null,
      displayNamePresent: Boolean(text(row['First Name']) || text(row['Last Name'])),
      account: text(row.Account),
      sourceReport: paths.contacts,
    };
  }),
  proposals: [...proposalGroups.entries()].map(([eventId, lines]) => ({
    externalEventId: eventId,
    normalizedDealKey: `pv-refresh:${eventId}`,
    lineCount: lines.length,
    packageTotal: Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100,
    sourceReport: paths.proposals,
  })),
  payments: paymentRows.filter(row => sourceId(row['Payment ID'])).map(row => ({
    externalId: sourceId(row['Payment ID']),
    normalizedId: `pay-${sourceId(row['Payment ID'])}`,
    externalEventId: sourceId(row['Event ID']) || null,
    eventKey: sourceId(row['Event ID']) ? `pv-refresh:${sourceId(row['Event ID'])}` : null,
    amount: money(row.Amount),
    status: text(row.Status),
    sourceReport: paths.payments,
  })),
};

console.log(JSON.stringify({
  sourceRoot: root,
  sourceFiles: paths,
  entityPreview: {
    eventsDeals: {
      sourceRows: eventRows.length,
      validRows: eventRowsValid.length,
      creates: null,
      updates: null,
      unchanged: null,
      duplicates: eventRows.length - eventIds.size,
      conflicts: 0,
      rejects: eventRows.length - eventRowsValid.length,
      identity: 'tenantId + importMeta.sourceKey = pv-refresh:<Event ID>',
    },
    contactsCustomers: {
      sourceRows: contactRows.length,
      validRows: contactRows.length,
      creates: null,
      updates: null,
      unchanged: null,
      duplicates: duplicateContactGroups.length,
      conflicts: duplicateContactGroups.length,
      rejects: 0,
      identity: 'email when unique; explicit conflict key for duplicate emails; deterministic hash only when email is missing',
    },
    proposalsPackages: {
      sourceRows: proposalRows.length,
      validRows: proposalRows.length - orphanProposalRows.length,
      creates: null,
      updates: null,
      unchanged: null,
      duplicates: 0,
      conflicts: orphanProposalRows.length,
      rejects: orphanProposalRows.filter(row => !sourceId(row['Event ID'])).length,
      disposition: 'orphan rows quarantined; no proposal entity created until a matching event is verified',
      identity: 'tenantId + external Event ID + proposal version/source report',
    },
    payments: {
      sourceRows: paymentRows.length,
      validRows: paymentRows.filter(row => sourceId(row['Payment ID'])).length,
      creates: null,
      updates: null,
      unchanged: null,
      duplicates: paymentRows.length - paymentIds.size,
      conflicts: orphanPaymentRows.length,
      rejects: paymentRows.filter(row => !sourceId(row['Payment ID'])).length,
      identity: 'tenantId + external Payment ID',
    },
  },
  relationshipPreview: {
    eventIds: eventIds.size,
    proposalEventLinks: [...proposalGroups.keys()].length,
    orphanProposalRows: orphanProposalRows.length,
    paymentEventLinks: [...paymentEventIds].filter(id => eventIds.has(id)).length,
    orphanPaymentRows: orphanPaymentRows.length,
    contactsWithUniqueEmail: [...contactEmailGroups.values()].filter(group => group.length === 1).length,
    contactsWithDuplicateEmail: duplicateContactGroups.reduce((sum, group) => sum + group.length, 0),
    contactsWithoutEmail: contactWithoutEmail,
  },
  databaseComparison: {
    status: 'blocked',
    reason: 'No safe hub_crm_staging Mongo target exists in the workspace; no creates/updates/unchanged counts can be truthfully computed against Mongo.',
  },
  normalizedSamples: {
    event: normalized.events[0],
    proposal: normalized.proposals[0],
    payment: normalized.payments[0],
  },
  conflictRules: {
    missingEventId: 'reject and quarantine',
    missingProposalEventId: 'reject and quarantine',
    orphanProposalEventId: 'quarantine as historical/missing-event anomaly; never create a phantom event',
    duplicateContactEmail: 'do not merge automatically; preserve records as conflict group until owner review confirms same person',
    displayNameOnly: 'never use as identity',
  },
}, null, 2));
