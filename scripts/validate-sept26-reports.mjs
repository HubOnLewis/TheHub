#!/usr/bin/env node
/**
 * Validate a fresh flat Perfect Venue report folder without writing files or Mongo.
 * Usage: node scripts/validate-sept26-reports.mjs --root import/sept26
 */
import XLSX from 'xlsx';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootArg = process.argv[process.argv.indexOf('--root') + 1] || 'import/sept26';
const root = resolve(rootArg);
if (!existsSync(root)) {
  console.error(`Source folder not found: ${root}`);
  process.exit(1);
}

const REPORTS = [
  { key: 'events', pattern: /^events-report-.*\.xlsx$/i, identity: 'ID', dateFields: ['Event Date', 'Created On', 'Confirmed On', 'Last Contacted'] },
  { key: 'contacts', pattern: /^contact-report-.*\.xlsx$/i, identity: 'Email', dateFields: ['Created At'] },
  { key: 'proposals', pattern: /^proposal-report-.*\.xlsx$/i, identity: 'Event ID', dateFields: ['Start Date', 'Created On'] },
  { key: 'payments', pattern: /^payment-report-.*\.xlsx$/i, identity: 'Payment ID', dateFields: ['Event Date', 'Scheduled At', 'Paid On', 'Created On'] },
  { key: 'sales', pattern: /^sales-categories-.*\.xlsx$/i, identity: null, dateFields: ['Event Date'] },
  { key: 'goals', pattern: /^.*_goals_\d{4}\.csv$/i, identity: null, dateFields: [] },
];

function readReport(file) {
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function asDate(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function idSet(rows, field) {
  return new Set(rows.map(row => normalized(row[field])).filter(Boolean));
}

function dateRange(rows, fields) {
  const dates = [];
  for (const row of rows) {
    for (const field of fields) {
      const date = asDate(row[field]);
      if (date) dates.push(date);
    }
  }
  return dates.length ? { min: dates.sort()[0], max: dates.sort().at(-1) } : null;
}

function reportFile(key) {
  const spec = REPORTS.find(item => item.key === key);
  return readdirSync(root).find(name => spec.pattern.test(name));
}

const loaded = {};
for (const spec of REPORTS) {
  const name = reportFile(spec.key);
  if (!name) continue;
  loaded[spec.key] = { name, rows: readReport(join(root, name)), spec };
}

const events = loaded.events?.rows ?? [];
const contacts = loaded.contacts?.rows ?? [];
const proposals = loaded.proposals?.rows ?? [];
const payments = loaded.payments?.rows ?? [];
const sales = loaded.sales?.rows ?? [];
const eventIds = idSet(events, 'ID');
const paymentIds = idSet(payments, 'Payment ID');
const proposalEventIds = idSet(proposals, 'Event ID');
const paymentEventIds = idSet(payments, 'Event ID');
const eventRowsWithId = events.filter(row => normalized(row.ID));
const contactEmails = contacts.map(row => normalized(row.Email)).filter(Boolean);
const duplicateContactEmails = contactEmails.filter((email, index) => contactEmails.indexOf(email) !== index);
const orphanPaymentEvents = [...paymentEventIds].filter(id => !eventIds.has(id));
const orphanProposalEvents = [...proposalEventIds].filter(id => !eventIds.has(id));
const blankEventRows = events.filter(row => !normalized(row.ID));
const blankPaymentRows = payments.filter(row => !normalized(row['Payment ID']));
const blankProposalRows = proposals.filter(row => !normalized(row['Event ID']));
const eventNames = new Map();
for (const row of events) {
  const name = normalized(row.Name);
  if (name) eventNames.set(name, (eventNames.get(name) ?? 0) + 1);
}
const duplicateEventNames = [...eventNames.entries()].filter(([, count]) => count > 1).length;

console.log(JSON.stringify({
  sourceRoot: root,
  reports: Object.fromEntries(Object.entries(loaded).map(([key, value]) => {
    const { name, rows, spec } = value;
    return [key, {
      filename: name,
      fileType: name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
      reportType: key,
      sourceRows: rows.length,
      validRows: key === 'events' ? eventRowsWithId.length : rows.length,
      identityField: spec.identity,
      missingRequiredIdentifier: key === 'events' ? blankEventRows.length : key === 'payments' ? blankPaymentRows.length : key === 'proposals' ? blankProposalRows.length : 0,
      dateRange: dateRange(rows, spec.dateFields),
      keyColumns: rows.length ? Object.keys(rows[0]) : [],
    }];
  })),
  overlap: {
    eventIds: eventIds.size,
    paymentIds: paymentIds.size,
    proposalEventIds: proposalEventIds.size,
    paymentEventsMissingFromEvents: orphanPaymentEvents.length,
    proposalEventsMissingFromEvents: orphanProposalEvents.length,
    duplicateEventNamesNotUsedAsIdentity: duplicateEventNames,
    duplicateContactEmails: new Set(duplicateContactEmails).size,
  },
  rejects: {
    blankEventIds: blankEventRows.length,
    blankPaymentIds: blankPaymentRows.length,
    blankProposalEventIds: blankProposalRows.length,
  },
  representative: {
    createCandidate: eventRowsWithId[0] ? { externalId: String(eventRowsWithId[0].ID), report: loaded.events?.name } : null,
    rejected: blankEventRows.length ? { reason: 'missing event ID', report: loaded.events?.name } : null,
    conflict: orphanPaymentEvents[0] ? { reason: 'payment references missing event', externalEventId: orphanPaymentEvents[0], report: loaded.payments?.name } : orphanProposalEvents[0] ? { reason: 'proposal references missing event', externalEventId: orphanProposalEvents[0], report: loaded.proposals?.name } : null,
  },
  sourcePrecedence: {
    eventIdentityAndLifecycle: 'events report by ID',
    eventFinancials: 'payment report for paid transactions; events report for proposal/balance fields when no payment rows exist',
    proposalLines: 'proposal report by Event ID',
    contactProfile: 'contact report by normalized email; never display name alone as identity',
    aggregateGoals: 'goal CSVs for reporting only; never used to create CRM entities',
    salesCategories: 'sales-categories report is a financial cross-check against events; it is not independently keyed and cannot override event ID records',
  },
}, null, 2));
