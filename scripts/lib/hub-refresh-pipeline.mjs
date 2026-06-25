/**
 * Parse and enrich HuB Perfect Venue refresh import folders.
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';
import {
  FOLDER_MAP,
  excelSerialToIso,
  excelSerialToDateTime,
  parseMoney,
  parseIntSafe,
  normalizePvId,
  normalizeName,
  normalizeEmail,
  normalizePhone,
  mapPvStatus,
  mapPaymentType,
  slugId,
  extractPdfDocKey,
  scanContamination,
} from './hub-refresh-utils.mjs';

function readXlsx(path) {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

export function discoverFiles(root) {
  const found = { folders: {}, files: [] };
  for (const [folder, meta] of Object.entries(FOLDER_MAP)) {
    const dir = join(root, folder);
    found.folders[folder] = { ...meta, path: dir, exists: existsSync(dir), files: [] };
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      if (!meta.types.includes(ext)) continue;
      const full = join(dir, f);
      found.folders[folder].files.push(full);
      found.files.push({ folder, role: meta.role, path: full, name: f });
    }
  }
  return found;
}

function parseEventsMaster(files) {
  const masterFiles = files.filter(f => f.role === 'master');
  const events = [];
  const warnings = [];
  for (const f of masterFiles) {
    const rows = readXlsx(f.path);
    for (const row of rows) {
      const pvEventId = String(row.ID ?? '').trim();
      if (!pvEventId) continue;
      const invoiceNumber = normalizePvId(row['Invoice Number']);
      const first = String(row['Contact First Name'] ?? '').trim();
      const last = String(row['Contact Last Name'] ?? '').trim();
      const contactName = [first, last].filter(Boolean).join(' ') || String(row.Name ?? '').trim();
      const pvStatus = mapPvStatus(row.Status);
      const proposalTotal = parseMoney(row['Proposal Total']);
      const totalPaid = parseMoney(row['Total Paid']);
      const balanceDueRaw = parseMoney(row['Balance Due']);
      const depositPaid = parseMoney(row['Deposit Paid']) > 0;
      const event = {
        id: slugId('pv', pvEventId),
        sourceKey: `pv-refresh:${pvEventId}`,
        pvEventId,
        pvId: invoiceNumber,
        title: String(row.Name ?? '').trim() || contactName || `Event ${pvEventId}`,
        pvStatus,
        statusRaw: String(row.Status ?? '').trim(),
        eventType: String(row['Event Type'] ?? '').trim(),
        owner: String(row.Owner ?? '').trim(),
        contact: contactName,
        contactEmail: normalizeEmail(row['Contact Email']),
        contactPhone: normalizePhone(row['Contact Phone']),
        company: String(row.Account ?? '').trim(),
        eventDateIso: excelSerialToIso(row['Event Date']),
        startTime: String(row['Start Time'] ?? '').trim(),
        endTime: String(row['End Time'] ?? '').trim(),
        guests: parseIntSafe(row['Group Size']),
        space: String(row.Space ?? '').trim(),
        subtotal: parseMoney(row['Proposal Subtotal']),
        discount: parseMoney(row['Proposal Discount']),
        grandTotal: proposalTotal,
        amountPaid: totalPaid,
        balanceDue: balanceDueRaw > 0 ? balanceDueRaw : Math.max(0, proposalTotal - totalPaid),
        depositPaid,
        paidInFull: proposalTotal > 0 && totalPaid >= proposalTotal - 0.01,
        paymentCount: 0,
        latestPaymentDate: null,
        createdOnIso: excelSerialToIso(row['Created On']),
        lastContactedIso: excelSerialToIso(row['Last Contacted']),
        leadSource: String(row['How did you hear about us?'] || row['How Did You Hear about Us'] || '').trim(),
        sourceFile: f.name,
        documents: {
          eventSummary: false,
          beo: false,
          staffBeo: false,
          invoice: false,
          agreement: false,
          menu: false,
        },
        documentFiles: {},
        payments: [],
        enrichmentNotes: [],
      };
      if (!event.eventDateIso && row.Day) {
        event.eventDateIso = excelSerialToIso(row.Day);
      }
      events.push(event);
    }
  }
  return { events, warnings };
}

function buildEventIndexes(events) {
  const byPvEventId = new Map();
  const byPvId = new Map();
  const byFallback = new Map();
  for (const e of events) {
    byPvEventId.set(e.pvEventId, e);
    if (e.pvId) byPvId.set(e.pvId, e);
    const fb = `${normalizeName(e.title)}|${e.eventDateIso ?? ''}|${e.contactEmail}`;
    byFallback.set(fb, e);
    if (e.contactPhone) {
      byFallback.set(`${normalizeName(e.title)}|${e.eventDateIso ?? ''}|${e.contactPhone}`, e);
    }
  }
  return { byPvEventId, byPvId, byFallback };
}

function matchEvent(indexes, { pvId, pvEventId, title, eventDateIso, contactEmail, contactPhone }) {
  if (pvEventId && indexes.byPvEventId.has(String(pvEventId))) {
    return { event: indexes.byPvEventId.get(String(pvEventId)), match: 'pvEventId' };
  }
  const normPv = normalizePvId(pvId);
  if (normPv && indexes.byPvId.has(normPv)) {
    return { event: indexes.byPvId.get(normPv), match: 'pvId' };
  }
  const fb1 = `${normalizeName(title)}|${eventDateIso ?? ''}|${normalizeEmail(contactEmail)}`;
  if (indexes.byFallback.has(fb1)) {
    return { event: indexes.byFallback.get(fb1), match: 'nameDateEmail' };
  }
  const fb2 = `${normalizeName(title)}|${eventDateIso ?? ''}|${normalizePhone(contactPhone)}`;
  if (contactPhone && indexes.byFallback.has(fb2)) {
    return { event: indexes.byFallback.get(fb2), match: 'nameDatePhone' };
  }
  return { event: null, match: null };
}

function attachPdfDocuments(files, indexes, unmatched) {
  const docRoles = {
    eventSummary: 'eventSummary',
    beo: 'beo',
    staffBeo: 'staffBeo',
    invoice: 'invoice',
    agreement: 'agreement',
    menu: 'menu',
  };
  let matched = 0;
  for (const f of files.filter(x => x.role !== 'master' && x.role !== 'payments')) {
    const role = docRoles[f.role];
    if (!role) continue;
    const key = extractPdfDocKey(f.name);
    const candidates = [
      key ? normalizePvId(key) : null,
      key,
      key ? String(parseInt(key, 10)) : null,
    ].filter(Boolean);
    let hit = null;
    for (const c of candidates) {
      const m = matchEvent(indexes, { pvId: c, pvEventId: c, title: '', eventDateIso: null });
      if (m.event) {
        hit = m;
        break;
      }
    }
    if (hit?.event) {
      hit.event.documents[role] = true;
      hit.event.documentFiles[role] = f.name;
      matched += 1;
    } else {
      unmatched.push({ type: 'document', role, file: f.name, path: f.path, docKey: key });
    }
  }
  return matched;
}

function parsePayments(files, indexes, importBatchId, unmatched, warnings) {
  const paymentFiles = files.filter(f => f.role === 'payments');
  const payments = [];
  let matched = 0;
  for (const f of paymentFiles) {
    const rows = readXlsx(f.path);
    for (const row of rows) {
      const pvEventId = String(row['Event ID'] ?? '').trim();
      const invoiceNumber = normalizePvId(row['Invoice Number']);
      const eventDateIso = excelSerialToIso(row['Event Date']);
      const title = String(row['Event Name'] ?? '').trim();
      const contactEmail = '';
      const amount = parseMoney(row.Amount);
      const status = String(row.Status ?? '').trim();
      if (!pvEventId && !invoiceNumber && amount === 0) continue;

      const { event, match } = matchEvent(indexes, {
        pvEventId,
        pvId: invoiceNumber,
        title,
        eventDateIso,
        contactEmail,
        contactPhone: '',
      });

      const payment = {
        id: slugId('pay', row['Payment ID'] || `${pvEventId}-${row.Name}-${row['Paid On']}`),
        pvPaymentId: String(row['Payment ID'] ?? ''),
        pvEventId: pvEventId || null,
        pvId: invoiceNumber,
        eventId: event?.id ?? null,
        eventName: title,
        payer: String(row['Contact Name'] ?? row.Name ?? '').trim(),
        paymentDate: excelSerialToDateTime(row['Paid On']),
        method: String(row.Method ?? row['Offline Method'] ?? '').trim(),
        amount,
        paymentType: mapPaymentType(row.Type),
        status,
        sourceFile: f.name,
        importBatchId,
        matchType: match,
      };

      if (event) {
        event.payments.push(payment);
        matched += 1;
        if (status === 'Paid' && amount > 0) {
          event.paymentCount += 1;
          const paidDate = payment.paymentDate;
          if (paidDate && (!event.latestPaymentDate || paidDate > event.latestPaymentDate)) {
            event.latestPaymentDate = paidDate;
          }
        }
      } else {
        unmatched.push({ type: 'payment', payment, file: f.name });
      }
      payments.push(payment);
    }
  }

  // Roll up payment totals — payments win over master sheet
  for (const e of indexes.byPvEventId.values()) {
    const paidRows = e.payments.filter(p => p.status === 'Paid' && p.amount > 0);
    if (paidRows.length > 0) {
      const paid = Math.round(paidRows.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      e.amountPaid = paid;
      e.paymentCount = paidRows.length;
      e.depositPaid = paidRows.some(p => p.paymentType === 'deposit');
      e.paidInFull = e.grandTotal > 0 && paid >= e.grandTotal - 0.01;
      e.balanceDue = Math.max(0, Math.round((e.grandTotal - paid) * 100) / 100);
      if (e.balanceDue > 0 && e.pvStatus === 'confirmed') {
        e.pvStatus = 'balance_due';
      }
    }
    if (e.grandTotal > 0 && Math.abs(e.grandTotal - e.amountPaid - e.balanceDue) > 0.02) {
      warnings.push({
        type: 'financial_mismatch',
        eventId: e.id,
        title: e.title,
        grandTotal: e.grandTotal,
        amountPaid: e.amountPaid,
        balanceDue: e.balanceDue,
      });
    }
  }

  return { payments, matched };
}

export function runRefreshPipeline({ root, importBatchId }) {
  const discovered = discoverFiles(root);
  const { events, warnings: parseWarnings } = parseEventsMaster(discovered.files);
  const indexes = buildEventIndexes(events);
  const unmatched = [];
  const warnings = [...parseWarnings];

  const docsMatched = attachPdfDocuments(discovered.files, indexes, unmatched);
  const { payments, matched: paymentsMatched } = parsePayments(
    discovered.files,
    indexes,
    importBatchId,
    unmatched,
    warnings,
  );

  const contacts = [];
  const contactKeys = new Set();
  for (const e of events) {
    const key = `${e.contactEmail}|${normalizeName(e.contact)}`;
    if (!e.contact || contactKeys.has(key)) continue;
    contactKeys.add(key);
    contacts.push({
      id: slugId('contact', key),
      name: e.contact,
      email: e.contactEmail,
      phone: e.contactPhone,
      company: e.company,
      pvEventIds: [e.pvEventId],
    });
  }

  const contamination = [];
  for (const e of events) {
    const hit = scanContamination(e);
    if (hit) contamination.push({ eventId: e.id, title: e.title, ...hit });
  }
  for (const p of payments) {
    const hit = scanContamination(p);
    if (hit) contamination.push({ paymentId: p.id, payer: p.payer, ...hit });
  }

  const pvIds = new Set(events.map(e => e.pvId).filter(Boolean));
  const duplicatePvIds = events
    .map(e => e.pvId)
    .filter((id, i, arr) => id && arr.indexOf(id) !== i);

  const summary = {
    importBatchId,
    importedAt: new Date().toISOString(),
    sourceRoot: root,
    eventsParsed: events.length,
    uniquePvIds: pvIds.size,
    contactsParsed: contacts.length,
    paymentsParsed: payments.length,
    paymentsMatched,
    documentsMatched: docsMatched,
    invoicesMatched: events.filter(e => e.documents.invoice).length,
    beosMatched: events.filter(e => e.documents.beo).length,
    agreementsMatched: events.filter(e => e.documents.agreement).length,
    menusMatched: events.filter(e => e.documents.menu).length,
    eventSummariesMatched: events.filter(e => e.documents.eventSummary).length,
    staffBeosMatched: events.filter(e => e.documents.staffBeo).length,
    unmatchedCount: unmatched.length,
    warningsCount: warnings.length,
    contaminationCount: contamination.length,
    duplicatePvIds: [...new Set(duplicatePvIds)],
    folders: Object.fromEntries(
      Object.entries(discovered.folders).map(([k, v]) => [k, { exists: v.exists, fileCount: v.files.length }]),
    ),
    financialTotals: {
      grandTotal: Math.round(events.reduce((s, e) => s + e.grandTotal, 0) * 100) / 100,
      amountPaid: Math.round(events.reduce((s, e) => s + e.amountPaid, 0) * 100) / 100,
      balanceDue: Math.round(events.reduce((s, e) => s + e.balanceDue, 0) * 100) / 100,
    },
    byStatus: events.reduce((acc, e) => {
      acc[e.pvStatus] = (acc[e.pvStatus] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return {
    discovered,
    events,
    contacts,
    payments,
    documents: events.flatMap(e =>
      Object.entries(e.documentFiles).map(([role, file]) => ({
        eventId: e.id,
        pvEventId: e.pvEventId,
        pvId: e.pvId,
        role,
        file,
      })),
    ),
    unmatched,
    warnings,
    contamination,
    summary,
  };
}
