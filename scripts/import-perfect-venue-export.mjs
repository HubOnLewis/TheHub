#!/usr/bin/env node
/**
 * Perfect Venue XLSX → sanitized Hub CRM seed + processed JSON.
 *
 * Usage: node scripts/import-perfect-venue-export.mjs
 *
 * Input (first match):
 *   data/perfect-venue-import/*.xlsx
 *   import/*.xlsx
 *
 * Output:
 *   packages/web/src/data/perfectVenueFullExport.ts
 *   data/perfect-venue-processed/*.json
 */

import XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_TS = resolve(ROOT, 'packages/web/src/data/perfectVenueFullExport.ts');
const OUT_FLAGS_TS = resolve(ROOT, 'packages/web/src/data/pvExportFlags.ts');
const OUT_JSON_DIR = resolve(ROOT, 'data/perfect-venue-processed');

const INPUT_DIRS = [
  resolve(ROOT, 'data/perfect-venue-import'),
  resolve(ROOT, 'import'),
];

function findXlsx() {
  const patterns = [
    { key: 'events', inc: 'Event Data' },
    { key: 'proposals', inc: 'Proposal Data' },
    { key: 'contacts', inc: 'Contact Data' },
    { key: 'payments', inc: 'Payment Data' },
  ];
  const found = {};
  for (const dir of INPUT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const isXlsx = f.endsWith('.xlsx');
      const isSalesCsv = f.endsWith('.csv') && /sales/i.test(f);
      if (!isXlsx && !isSalesCsv) continue;
      for (const p of patterns) {
        if (!found[p.key] && f.includes(p.inc)) found[p.key] = join(dir, f);
      }
      if (!found.sales && isSalesCsv) found.sales = join(dir, f);
      if (!found.sales && isXlsx && /sales/i.test(f)) found.sales = join(dir, f);
    }
  }
  return found;
}

function mapPaymentType(raw) {
  const t = String(raw ?? '').trim();
  if (t === 'Deposit') return 'deposit';
  if (t === 'Remaining Balance') return 'balance';
  if (t === 'Other') return 'other';
  return 'unknown';
}

function readSalesFile(path) {
  if (path.endsWith('.csv')) {
    const text = readFileSync(path, 'utf8');
    const wb = XLSX.read(text, { type: 'string' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
  return readSheet(path);
}

function parseSalesRows(rows) {
  const days = [];
  let totals = null;
  for (const row of rows) {
    const dateRaw = String(row.Date ?? row.date ?? '').trim();
    if (!dateRaw || dateRaw.toLowerCase() === 'total') {
      if (dateRaw.toLowerCase() === 'total') {
        totals = {
          venueSpace: parseMoney(row['Venue Space']),
          office: parseMoney(row.Office),
          uncategorized: parseMoney(row.Uncategorized),
          subtotal: parseMoney(row.Subtotal),
          salesTax: parseMoney(row['Sales Tax']),
          adminFee: parseMoney(row['Admin Fee']),
          gratuity: parseMoney(row.Gratuity),
          grandTotal: parseMoney(row['Grand Total']),
          creditCardPayments: parseMoney(row['Credit Card Payments']),
          achPayments: parseMoney(row['ACH Card Payments']),
          offlinePayments: parseMoney(row['Offline Payments']),
          paymentsTotal: parseMoney(row['Payments Total']),
        };
      }
      continue;
    }
    const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : excelSerialToIso(dateRaw);
    if (!date) continue;
    days.push({
      date,
      venueSpace: parseMoney(row['Venue Space']),
      office: parseMoney(row.Office),
      uncategorized: parseMoney(row.Uncategorized),
      subtotal: parseMoney(row.Subtotal),
      salesTax: parseMoney(row['Sales Tax']),
      adminFee: parseMoney(row['Admin Fee']),
      gratuity: parseMoney(row.Gratuity),
      grandTotal: parseMoney(row['Grand Total']),
      creditCardPayments: parseMoney(row['Credit Card Payments']),
      achPayments: parseMoney(row['ACH Card Payments']),
      offlinePayments: parseMoney(row['Offline Payments']),
      paymentsTotal: parseMoney(row['Payments Total']),
    });
  }
  if (!totals && days.length) {
    totals = days.reduce(
      (acc, d) => ({
        venueSpace: acc.venueSpace + d.venueSpace,
        office: acc.office + d.office,
        uncategorized: acc.uncategorized + d.uncategorized,
        subtotal: acc.subtotal + d.subtotal,
        salesTax: acc.salesTax + d.salesTax,
        adminFee: acc.adminFee + d.adminFee,
        gratuity: acc.gratuity + d.gratuity,
        grandTotal: acc.grandTotal + d.grandTotal,
        creditCardPayments: acc.creditCardPayments + d.creditCardPayments,
        achPayments: acc.achPayments + d.achPayments,
        offlinePayments: acc.offlinePayments + d.offlinePayments,
        paymentsTotal: acc.paymentsTotal + d.paymentsTotal,
      }),
      {
        venueSpace: 0,
        office: 0,
        uncategorized: 0,
        subtotal: 0,
        salesTax: 0,
        adminFee: 0,
        gratuity: 0,
        grandTotal: 0,
        creditCardPayments: 0,
        achPayments: 0,
        offlinePayments: 0,
        paymentsTotal: 0,
      },
    );
  }
  return { days, totals: totals ?? null };
}

function parsePaymentRows(rows, eventByPvId) {
  const payments = [];
  let orphaned = 0;
  for (const row of rows) {
    const pvEventId = row['Event ID'];
    if (!row['Payment ID'] && !pvEventId) continue;
    const eventId = pvEventId ? slugId('pv', pvEventId) : null;
    const matched = eventId ? eventByPvId.get(String(pvEventId)) : null;
    if (pvEventId && !matched) orphaned++;

    const status = String(row.Status ?? '').trim();
    const amount = parseMoney(row.Amount);
    if (status !== 'Paid' && amount === 0) continue;

    payments.push({
      id: slugId('pay', row['Payment ID'] || `${pvEventId}-${row.Name}`),
      pvPaymentId: row['Payment ID'],
      eventId: matched?.id ?? eventId,
      pvEventId: pvEventId || null,
      eventName: String(row['Event Name'] ?? '').trim(),
      invoiceNumber: String(row['Invoice Number'] ?? '').trim(),
      eventStatus: String(row['Event Status'] ?? '').trim(),
      contactName: String(row['Contact Name'] ?? '').trim(),
      eventDateIso: excelSerialToIso(row['Event Date']),
      paymentName: String(row.Name ?? '').trim(),
      paymentType: mapPaymentType(row.Type),
      status,
      paidOnIso: excelSerialToDateTime(row['Paid On'])?.slice(0, 10) ?? null,
      scheduledAtIso: excelSerialToIso(row['Scheduled At']),
      amount,
      feeAmount: parseMoney(row['Fee Amount']),
      refundAmount: parseMoney(row['Refund Amount']),
      refundState: String(row['Refund State'] ?? '').trim(),
      method: String(row.Method ?? '').trim(),
      offlineMethod: String(row['Offline Method'] ?? '').trim(),
      createdOnIso: excelSerialToIso(row['Created On']),
    });
  }
  return { payments, orphaned };
}

function isLostRow(e) {
  return e.pvStatus === 'lost' || /archived/i.test(e.statusRaw);
}

function isOfficeLowSignal(e) {
  const t = `${e.title} ${e.eventType}`.toLowerCase();
  return /office\s*rental|office rental/i.test(t);
}

function buildEventFinancials(events, payments) {
  const byEvent = new Map();
  for (const e of events) {
    const proposalTotal = e.proposalTotal > 0 ? e.proposalTotal : e.value;
    const collectedTotal = e.totalPaid > 0 ? e.totalPaid : e.depositPaid + e.balancePaid;
    let outstandingBalance =
      e.balanceDue > 0 ? e.balanceDue : Math.max(0, proposalTotal - collectedTotal);
    if (isLostRow(e) || isOfficeLowSignal(e)) outstandingBalance = 0;

    const isPaidInFull = proposalTotal > 0 && collectedTotal >= proposalTotal - 1;
    let collectionStatus = 'not_applicable';
    if (proposalTotal <= 0) collectionStatus = 'no_proposal';
    else if (isPaidInFull) collectionStatus = 'paid_in_full';
    else if (outstandingBalance > 0) collectionStatus = 'balance_due';
    else if (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) collectionStatus = 'deposit_due';
    else if (collectedTotal > 0) collectionStatus = 'partial';

    byEvent.set(e.id, {
      eventId: e.id,
      pvEventId: e.pvId,
      proposalTotal,
      collectedTotal,
      depositPaid: e.depositPaid,
      balancePaid: e.balancePaid,
      otherPaid: Math.max(0, collectedTotal - e.depositPaid - e.balancePaid),
      balanceDue: e.balanceDue,
      outstandingBalance,
      refundedAmount: 0,
      netRevenue: collectedTotal,
      isPaidInFull,
      hasDeposit: e.depositPaid > 0,
      depositCoverageRatio: proposalTotal > 0 ? Math.min(1, e.depositPaid / proposalTotal) : 0,
      collectionStatus,
      collected: collectedTotal,
      depositCollected: e.depositPaid,
      balanceCollected: e.balancePaid,
      otherCollected: 0,
      refunded: 0,
      paymentCount: 0,
      lastPaidOn: null,
      paymentMethods: [],
      overdue: outstandingBalance > 0 && e.eventDateIso != null && !isLostRow(e),
    });
  }
  for (const p of payments) {
    if (!p.eventId || p.status !== 'Paid') continue;
    const fin = byEvent.get(p.eventId);
    if (!fin) continue;
    fin.paymentCount += 1;
    if (p.paymentType === 'deposit') fin.depositCollected += p.amount;
    else if (p.paymentType === 'balance') fin.balanceCollected += p.amount;
    else fin.otherCollected += p.amount;
    fin.refundedAmount += p.refundAmount;
    fin.refunded += p.refundAmount;
    if (p.method && !fin.paymentMethods.includes(p.method)) fin.paymentMethods.push(p.method);
    if (p.paidOnIso && (!fin.lastPaidOn || p.paidOnIso > fin.lastPaidOn)) fin.lastPaidOn = p.paidOnIso;
  }
  for (const fin of byEvent.values()) {
    fin.netRevenue = Math.max(0, fin.collectedTotal - fin.refundedAmount);
    fin.otherPaid = Math.max(0, fin.otherPaid || fin.otherCollected);
  }
  const record = {};
  for (const [id, fin] of byEvent) record[id] = fin;
  return record;
}

function buildAccountFinancials(accounts, eventFinancials) {
  return accounts.map(a => {
    let collected = 0;
    let outstanding = 0;
    let payments = 0;
    let lastPaid = null;
    let valueSum = 0;
    for (const eid of a.eventIds) {
      const fin = eventFinancials[eid];
      if (!fin) continue;
      collected += fin.collected;
      outstanding += fin.outstandingBalance ?? fin.balanceDue;
      payments += fin.paymentCount;
      valueSum += fin.proposalTotal;
      if (fin.lastPaidOn && (!lastPaid || fin.lastPaidOn > lastPaid)) lastPaid = fin.lastPaidOn;
    }
    return {
      accountId: a.id,
      accountName: a.name,
      lifetimeCollected: Math.round(collected * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      eventCount: a.eventCount,
      avgEventValue: a.eventCount > 0 ? Math.round((valueSum / a.eventCount) * 100) / 100 : 0,
      paymentCount: payments,
      lastPaidOn: lastPaid,
    };
  });
}

function buildFinancialSnapshot(events, payments, salesTotals, eventFinancials) {
  const paid = payments.filter(p => p.status === 'Paid');
  const collected = paid.reduce((s, p) => s + p.amount, 0);
  const activeStatuses = new Set(['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due']);
  const asOf = '2026-05-20';

  const opsRelevant = events.filter(e => {
    if (isLostRow(e) || isOfficeLowSignal(e) || e.isTest) return false;
    if (!activeStatuses.has(e.pvStatus)) return false;
    const fin = eventFinancials[e.id];
    if (!fin || fin.proposalTotal < 75) return false;
    if (e.eventDateIso && e.eventDateIso < asOf && e.pvStatus === 'completed') return false;
    return true;
  });

  const outstanding = opsRelevant.reduce(
    (s, e) => s + (eventFinancials[e.id]?.outstandingBalance ?? 0),
    0,
  );
  const overdue = opsRelevant.filter(e => {
    const fin = eventFinancials[e.id];
    return fin && fin.outstandingBalance > 0 && e.eventDateIso && e.eventDateIso <= asOf;
  });
  const proposals = opsRelevant.filter(e => e.pvStatus === 'proposal_sent');
  const converted = events.filter(e =>
    ['confirmed', 'completed', 'balance_due'].includes(e.pvStatus),
  );
  const withValue = events.filter(
    e => (e.proposalTotal || e.value) >= 75 && !isLostRow(e) && !isOfficeLowSignal(e),
  );

  const mayPrefix = '2026-05';
  const mtdCollected = paid
    .filter(p => p.paidOnIso?.startsWith(mayPrefix))
    .reduce((s, p) => s + p.amount, 0);

  return {
    paymentsCollected: Math.round(collected * 100) / 100,
    outstandingExposure: Math.round(outstanding * 100) / 100,
    overdueExposure: Math.round(
      overdue.reduce((s, e) => s + (eventFinancials[e.id]?.outstandingBalance ?? 0), 0) * 100,
    ) / 100,
    mtdCollected: Math.round(mtdCollected * 100) / 100,
    mtdGrandTotal: salesTotals?.grandTotal ?? 0,
    proposalExposure: Math.round(
      proposals.reduce((s, e) => s + (eventFinancials[e.id]?.proposalTotal ?? 0), 0) * 100,
    ) / 100,
    depositDueCount: events.filter(
      e =>
        e.pvStatus === 'proposal_sent' &&
        e.depositPaid === 0 &&
        (e.proposalTotal || e.value) >= 75 &&
        !isLostRow(e),
    ).length,
    avgBookingValue:
      withValue.length > 0
        ? Math.round(withValue.reduce((s, e) => s + (e.proposalTotal || e.value), 0) / withValue.length)
        : 0,
    conversionRatePct:
      events.length > 0 ? Math.round((converted.length / events.length) * 100) : 0,
  };
}

function excelSerialToIso(serial) {
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

function excelSerialToDateTime(serial) {
  if (serial === '' || serial == null) return null;
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const utc = (n - 25569) * 86400 * 1000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseMoney(v) {
  if (v === '' || v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function parseIntSafe(v) {
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function slugId(prefix, raw) {
  const s = String(raw).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${prefix}-${s || 'unknown'}`.slice(0, 64);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '—';
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

function maskPhone(phone) {
  const d = String(phone).replace(/\D/g, '');
  if (d.length < 4) return '—';
  return `***-***-${d.slice(-4)}`;
}

function mapStatus(raw) {
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

function accentForStatus(st) {
  const map = {
    confirmed: 'emerald',
    completed: 'emerald',
    balance_due: 'emerald',
    proposal_sent: 'violet',
    qualified: 'cyan',
    lead: 'amber',
    lost: 'rose',
  };
  return map[st] ?? 'emerald';
}

function isExampleRow(name, email) {
  const n = String(name).toLowerCase();
  return (
    n.includes('example') ||
    n.includes('test event') ||
    String(email).includes('perfectvenue.com')
  );
}

function categorizeLineItem(name, section) {
  const t = `${name} ${section}`.toLowerCase();
  if (/discount/.test(t)) return 'discount';
  if (/office/.test(t)) return 'office';
  if (/room rental|venue space|event space/.test(t)) return 'venue';
  if (/menu|buffet|catering|bar|beverage|charcuterie|dessert/.test(t)) return 'menu';
  if (/add-?on|upgrade|av |audio|lighting/.test(t)) return 'addon';
  return 'other';
}

function clientName(row) {
  const first = String(row['Contact First Name'] ?? '').trim();
  const last = String(row['Contact Last Name'] ?? '').trim();
  if (first || last) return `${first} ${last}`.trim();
  return String(row.Account ?? 'Guest').trim() || 'Guest';
}

function readSheet(path) {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets.Data ?? wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function main() {
  const files = findXlsx();
  if (!files.events || !files.proposals || !files.contacts) {
    console.error('[pv-import] Missing xlsx files. Expected in data/perfect-venue-import/ or import/');
    console.error('Found:', files);
    process.exit(1);
  }

  console.log('[pv-import] Reading', files);
  const eventRows = readSheet(files.events);
  const proposalRows = readSheet(files.proposals);
  const contactRows = readSheet(files.contacts);

  const warnings = [];
  const events = [];
  let exampleExcluded = 0;

  for (const row of eventRows) {
    const title = String(row.Name ?? '').trim();
    const pvId = row.ID;
    if (!title && !pvId) continue;

    const email = String(row['Contact Email'] ?? '').trim();
    if (isExampleRow(title, email)) {
      exampleExcluded++;
      continue;
    }

    const pvStatus = mapStatus(row.Status);
    const eventDateIso = excelSerialToIso(row['Event Date']) ?? excelSerialToIso(row['Created On']);
    const proposalTotal = parseMoney(row['Proposal Total']);
    const depositPaid = parseMoney(row['Deposit Paid']);
    const balanceDue = parseMoney(row['Balance Due']);
    const totalPaid = parseMoney(row['Total Paid']);
    const guests = parseIntSafe(row['Group Size']);
    const space = String(row.Space ?? '').trim();
    const spaces = space ? space.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];

    let paymentState = 'unknown';
    if (balanceDue > 0) paymentState = 'balance_due';
    else if (depositPaid > 0 && depositPaid < proposalTotal) paymentState = 'partial';
    else if (proposalTotal > 0 && depositPaid === 0 && pvStatus === 'proposal_sent') paymentState = 'deposit_due';
    else if (totalPaid >= proposalTotal && proposalTotal > 0) paymentState = 'clear';

    let readinessScore = 50;
    if (pvStatus === 'confirmed' || pvStatus === 'completed') readinessScore += 25;
    if (depositPaid > 0) readinessScore += 15;
    if (balanceDue === 0 && proposalTotal > 0) readinessScore += 10;
    if (!eventDateIso) readinessScore -= 20;
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    const id = slugId('pv', pvId || title);

    events.push({
      id,
      pvId,
      title,
      client: clientName(row),
      account: String(row.Account ?? '').trim() || clientName(row),
      pvStatus,
      statusRaw: String(row.Status ?? ''),
      eventType: String(row['Event Type'] ?? 'Event').trim() || 'Event',
      owner: String(row.Owner ?? '').trim(),
      eventDate: eventDateIso,
      eventDateIso,
      dayLabel: String(row.Day ?? '').trim(),
      startTime: String(row['Start Time'] ?? '').trim(),
      endTime: String(row['End Time'] ?? '').trim(),
      guests,
      space,
      spaces,
      value: proposalTotal || parseMoney(row.Budget),
      depositPaid,
      balancePaid: parseMoney(row['Balance Paid']),
      totalPaid,
      balanceDue,
      proposalSubtotal: parseMoney(row['Proposal Subtotal']),
      proposalDiscount: parseMoney(row['Proposal Discount']),
      proposalTotal,
      source: String(row.Source ?? row.Origin ?? '').trim(),
      origin: String(row.Origin ?? '').trim(),
      createdOn: excelSerialToIso(row['Created On']),
      confirmedOn: excelSerialToIso(row['Confirmed On']),
      lastContacted: excelSerialToIso(row['Last Contacted']),
      daysOut: row['Days Out'] !== '' ? parseIntSafe(row['Days Out']) : null,
      lostOn: excelSerialToIso(row['Lost On']),
      lostReason: String(row['Lost Reason'] ?? row['Lost Reason Note'] ?? '').trim(),
      isExample: false,
      isTest: /test/i.test(title),
      readinessScore,
      paymentState,
      lifecycleState: String(row.Status ?? 'Unknown'),
      accent: accentForStatus(pvStatus),
      private: {
        email: email || undefined,
        phone: String(row['Contact Phone'] ?? '').trim() || undefined,
        address: String(row.Address ?? '').trim() || undefined,
      },
    });
  }

  const proposalsByEvent = new Map();
  for (const row of proposalRows) {
    const pvEventId = row['Event ID'];
    const eventId = slugId('pv', pvEventId);
    const line = {
      eventId,
      pvEventId,
      itemName: String(row['Item Name'] ?? '').trim(),
      pricePerUnit: parseMoney(row['Price per unit']),
      quantity: parseFloat(row.Quantity) || 1,
      total: parseMoney(row.Total),
      unit: String(row.Unit ?? '').trim(),
      menuSection: String(row['Menu Section'] ?? '').trim(),
      details: String(row.Details ?? '').trim(),
      category: categorizeLineItem(row['Item Name'], row['Menu Section']),
    };
    if (!proposalsByEvent.has(eventId)) proposalsByEvent.set(eventId, []);
    proposalsByEvent.get(eventId).push(line);
  }

  const proposalSummaries = {};
  for (const [eventId, lines] of proposalsByEvent) {
    const subtotal = lines.filter(l => l.category !== 'discount').reduce((s, l) => s + l.total, 0);
    const discount = Math.abs(
      lines.filter(l => l.category === 'discount').reduce((s, l) => s + l.total, 0),
    );
    const total = Math.max(0, subtotal - discount);
    const ev = events.find(e => e.id === eventId);
    const guests = ev?.guests ?? 0;
    const menuSections = [...new Set(lines.map(l => l.menuSection).filter(Boolean))];
    const addons = lines.filter(l => l.category === 'addon' || l.category === 'menu').map(l => l.itemName);
    const primary = lines.find(l => l.category === 'venue' || l.category === 'room')?.itemName ?? lines[0]?.itemName ?? 'Package';

    proposalSummaries[eventId] = {
      eventId,
      lineCount: lines.length,
      subtotal,
      discount,
      total: total || ev?.proposalTotal || 0,
      primaryPackage: primary,
      menuSections,
      addonCandidates: addons.slice(0, 5),
      avgPerGuest: guests > 0 ? Math.round((total / guests) * 100) / 100 : 0,
      missingDepositRisk: ev ? ev.depositPaid === 0 && ev.pvStatus === 'proposal_sent' : false,
      upsellOpportunities: addons.slice(0, 3),
      revenueConfidence: ev?.pvStatus === 'confirmed' ? 85 : ev?.pvStatus === 'proposal_sent' ? 55 : 40,
      lines,
    };
  }

  const contacts = [];
  const contactByEmail = new Map();
  for (const row of contactRows) {
    const email = String(row.Email ?? '').trim().toLowerCase();
    const first = String(row['First Name'] ?? '').trim();
    const last = String(row['Last Name'] ?? '').trim();
    const displayName = `${first} ${last}`.trim() || 'Contact';
    const id = slugId('ct', email || displayName);
    const c = {
      id,
      firstName: first,
      lastName: last,
      displayName,
      account: String(row.Account ?? '').trim() || displayName,
      title: String(row.Title ?? '').trim(),
      eventsCount: parseIntSafe(row['Events Count']),
      totalSpend: parseMoney(row['Total Spend']),
      averageSpend: parseMoney(row['Average Spend']),
      city: String(row.City ?? '').trim(),
      state: String(row.State ?? '').trim(),
      isRepeat: parseIntSafe(row['Events Count']) >= 2,
      healthScore: Math.min(100, 40 + parseIntSafe(row['Events Count']) * 8),
      emailMasked: maskEmail(email),
      phoneMasked: maskPhone(row.Phone),
      _emailKey: email,
    };
    contacts.push(c);
    if (email) {
      if (contactByEmail.has(email)) warnings.push(`duplicate contact email: ${email}`);
      contactByEmail.set(email, c);
    }
  }

  const accountsMap = new Map();
  for (const c of contacts) {
    const accName = c.account || c.displayName;
    if (!accountsMap.has(accName)) {
      accountsMap.set(accName, {
        id: slugId('acct', accName),
        name: accName,
        contactIds: [],
        eventIds: [],
        totalSpend: 0,
        eventCount: 0,
        isVip: false,
        isDormant: false,
      });
    }
    const a = accountsMap.get(accName);
    a.contactIds.push(c.id);
    a.totalSpend += c.totalSpend;
    a.eventCount += c.eventsCount;
  }

  const eventToContact = {};
  const eventToAccount = {};
  for (const e of events) {
    const email = e.private?.email?.toLowerCase();
    const contact = email ? contactByEmail.get(email) : null;
    if (contact) eventToContact[e.id] = contact.id;
    const accName = e.account || e.client;
    eventToAccount[e.id] = accountsMap.get(accName)?.id ?? slugId('acct', accName);
    const acc = accountsMap.get(accName) ?? {
      id: slugId('acct', accName),
      name: accName,
      contactIds: [],
      eventIds: [],
      totalSpend: 0,
      eventCount: 0,
      isVip: false,
      isDormant: false,
    };
    if (!accountsMap.has(accName)) accountsMap.set(accName, acc);
    acc.eventIds.push(e.id);
    acc.totalSpend += e.value;
    acc.eventCount += 1;
  }

  const accounts = [...accountsMap.values()].map(a => ({
    ...a,
    isVip: a.totalSpend >= 2000 || a.eventCount >= 3,
    isDormant: a.eventCount === 0,
    expansionNote: a.eventCount >= 2 ? 'Repeat booker' : undefined,
  }));

  const contactToEvents = {};
  for (const e of events) {
    const cid = eventToContact[e.id];
    if (!cid) continue;
    contactToEvents[cid] = contactToEvents[cid] ?? [];
    contactToEvents[cid].push(e.id);
  }

  const accountToEvents = {};
  const accountToContacts = {};
  for (const a of accounts) {
    accountToEvents[a.id] = a.eventIds;
    accountToContacts[a.id] = a.contactIds;
  }

  const activeStatuses = new Set(['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due']);
  const activeEvents = events.filter(e => activeStatuses.has(e.pvStatus));
  const sum = arr => arr.reduce((s, e) => s + e.value, 0);

  const venueSummary = {
    activeEvents: activeEvents.length,
    activePipelineDollars: Math.round(sum(activeEvents)),
    lead: events.filter(e => e.pvStatus === 'lead').length,
    qualified: events.filter(e => e.pvStatus === 'qualified').length,
    proposalSent: events.filter(e => e.pvStatus === 'proposal_sent').length,
    confirmed: events.filter(e => e.pvStatus === 'confirmed').length,
    balanceDue: events.filter(e => e.balanceDue > 0).length,
    balanceDueDollars: Math.round(events.reduce((s, e) => s + e.balanceDue, 0)),
    completedYtd: events.filter(e => e.pvStatus === 'completed').length,
    completedYtdDollars: Math.round(sum(events.filter(e => e.pvStatus === 'completed'))),
    extractedAt: new Date().toISOString().slice(0, 10),
    venue: 'HuB on Lewis',
  };

  const flagship =
    events.find(e => e.title.includes('Miller/Harris') && e.pvStatus === 'confirmed') ??
    events.find(e => e.pvStatus === 'confirmed' && e.depositPaid > 0) ??
    events.find(e => e.pvStatus === 'confirmed') ??
    events[0];

  const relPath = p => p.replace(ROOT + '\\', '').replace(ROOT + '/', '');

  const eventByPvId = new Map(events.map(e => [String(e.pvId), e]));
  let payments = [];
  let orphanedPayments = 0;
  if (files.payments) {
    const paymentRows = readSheet(files.payments);
    const parsed = parsePaymentRows(paymentRows, eventByPvId);
    payments = parsed.payments;
    orphanedPayments = parsed.orphaned;
  } else {
    warnings.push('payments export not found — financial timelines limited to event sheet');
  }

  let salesDays = [];
  let salesTotals = null;
  if (files.sales) {
    const salesRows = readSalesFile(files.sales);
    const parsed = parseSalesRows(salesRows);
    salesDays = parsed.days;
    salesTotals = parsed.totals;
  } else {
    warnings.push('sales report not found — revenue pacing uses event aggregates only');
  }

  const eventFinancials = buildEventFinancials(events, payments);
  const accountFinancials = buildAccountFinancials(accounts, eventFinancials);
  const financialSnapshot = buildFinancialSnapshot(events, payments, salesTotals, eventFinancials);

  const paymentsCollected = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const paymentsFees = payments.reduce((s, p) => s + p.feeAmount, 0);
  const paymentsRefunded = payments.reduce((s, p) => s + p.refundAmount, 0);
  const eventOutstanding = Object.values(eventFinancials).reduce(
    (s, fin) => s + (fin.outstandingBalance ?? 0),
    0,
  );
  const opsOutstanding = events
    .filter(e => !isLostRow(e) && !isOfficeLowSignal(e) && ['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due'].includes(e.pvStatus))
    .reduce((s, e) => s + (eventFinancials[e.id]?.outstandingBalance ?? 0), 0);
  const joinPct =
    payments.length > 0
      ? Math.round((payments.filter(p => p.eventId && eventByPvId.has(String(p.pvEventId))).length / payments.length) * 100)
      : 100;
  const importHealthScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        warnings.length * 3 -
        orphanedPayments * 2 -
        (files.payments ? 0 : 15) -
        (files.sales ? 0 : 10),
    ),
  );

  const meta = {
    importedAt: new Date().toISOString(),
    sourceFiles: {
      events: relPath(files.events),
      proposals: relPath(files.proposals),
      contacts: relPath(files.contacts),
      ...(files.payments ? { payments: relPath(files.payments) } : {}),
      ...(files.sales ? { sales: relPath(files.sales) } : {}),
    },
    venue: 'HuB on Lewis',
    rowCounts: {
      eventsRaw: eventRows.length,
      eventsNormalized: events.length,
      proposalsRaw: proposalRows.length,
      proposalLineItems: proposalRows.length,
      contactsRaw: contactRows.length,
      contactsNormalized: contacts.length,
      accounts: accounts.length,
      ...(payments.length
        ? { paymentsRaw: payments.length, paymentsNormalized: payments.filter(p => p.status === 'Paid').length }
        : {}),
      ...(salesDays.length ? { salesDays: salesDays.length } : {}),
    },
    joins: {
      eventsWithProposals: events.filter(e => proposalsByEvent.has(e.id)).length,
      eventsWithContacts: Object.keys(eventToContact).length,
      contactsWithAccounts: contacts.filter(c => c.account).length,
      orphanedProposals: [...proposalsByEvent.keys()].filter(k => !events.some(e => e.id === k)).length,
      ...(payments.length
        ? {
            paymentsWithEvents: payments.filter(p => p.eventId && events.some(e => e.id === p.eventId)).length,
            orphanedPayments,
          }
        : {}),
    },
    warnings,
    quality: {
      missingEventDates: events.filter(e => !e.eventDateIso).length,
      missingContacts: events.filter(e => !eventToContact[e.id]).length,
      missingTotals: events.filter(e => e.value === 0).length,
      duplicateContactEmails: warnings.filter(w => w.startsWith('duplicate')).length,
      exampleEventsExcluded: exampleExcluded,
      zeroDollarEvents: events.filter(e => (e.proposalTotal || e.value) < 75).length,
      lostArchived: events.filter(isLostRow).length,
      completed: events.filter(e => e.pvStatus === 'completed').length,
      activePipeline: events.filter(
        e =>
          !isLostRow(e) &&
          !isOfficeLowSignal(e) &&
          ['lead', 'qualified', 'proposal_sent', 'confirmed', 'balance_due'].includes(e.pvStatus),
      ).length,
      confirmedFuture: events.filter(
        e =>
          (e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due') &&
          e.eventDateIso &&
          e.eventDateIso >= '2026-05-20' &&
          !isLostRow(e),
      ).length,
      unmatchedPayments: orphanedPayments,
    },
    financial: {
      paymentsCollected: Math.round(paymentsCollected * 100) / 100,
      paymentsFees: Math.round(paymentsFees * 100) / 100,
      paymentsRefunded: Math.round(paymentsRefunded * 100) / 100,
      salesSubtotal: salesTotals?.subtotal ?? 0,
      salesGrandTotal: salesTotals?.grandTotal ?? 0,
      salesPaymentsTotal: salesTotals?.paymentsTotal ?? 0,
      eventOutstanding: Math.round(opsOutstanding * 100) / 100,
      eventOutstandingRaw: Math.round(eventOutstanding * 100) / 100,
      importHealthScore,
    },
  };

  const relationships = {
    eventToContact,
    eventToAccount,
    contactToEvents,
    accountToEvents,
    accountToContacts,
  };

  const mayBookedDays = new Set(
    events
      .filter(
        e =>
          e.eventDateIso?.startsWith('2026-05') &&
          !isLostRow(e) &&
          !isOfficeLowSignal(e) &&
          !e.isTest &&
          ['confirmed', 'balance_due', 'completed', 'proposal_sent'].includes(e.pvStatus),
      )
      .map(e => Number(e.eventDateIso.slice(8, 10)))
      .filter(d => !Number.isNaN(d)),
  );
  const operational = {
    venueSummary,
    occupancyPct: Math.min(100, Math.round((mayBookedDays.size / 31) * 100) || 0),
    flagshipEventId: flagship?.id ?? '',
  };

  const publicContacts = contacts.map(({ _emailKey, ...c }) => c);

  mkdirSync(OUT_JSON_DIR, { recursive: true });
  writeFileSync(join(OUT_JSON_DIR, 'events.normalized.json'), JSON.stringify(events, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'proposals.normalized.json'), JSON.stringify(proposalSummaries, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'contacts.normalized.json'), JSON.stringify(publicContacts, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'accounts.normalized.json'), JSON.stringify(accounts, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'relationships.normalized.json'), JSON.stringify(relationships, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'import-summary.json'), JSON.stringify(meta, null, 2));
  if (payments.length) {
    writeFileSync(join(OUT_JSON_DIR, 'payments.normalized.json'), JSON.stringify(payments, null, 2));
  }
  if (salesDays.length) {
    writeFileSync(join(OUT_JSON_DIR, 'sales.normalized.json'), JSON.stringify({ days: salesDays, totals: salesTotals }, null, 2));
  }
  writeFileSync(join(OUT_JSON_DIR, 'event-financials.normalized.json'), JSON.stringify(eventFinancials, null, 2));
  writeFileSync(join(OUT_JSON_DIR, 'account-financials.normalized.json'), JSON.stringify(accountFinancials, null, 2));

  const ts = `/**
 * AUTO-GENERATED by scripts/import-perfect-venue-export.mjs — do not edit by hand.
 * Re-run: node scripts/import-perfect-venue-export.mjs
 * Source: Perfect Venue XLSX exports (sanitized — PII masked in public contact fields).
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

export const FULL_PV_EVENTS: PvFullEvent[] = ${JSON.stringify(events, null, 2)};

export const FULL_PV_PROPOSALS: Record<string, PvFullProposalSummary> = ${JSON.stringify(proposalSummaries, null, 2)};

export const FULL_PV_CONTACTS: PvFullContact[] = ${JSON.stringify(publicContacts, null, 2)};

export const FULL_PV_ACCOUNTS: PvFullAccount[] = ${JSON.stringify(accounts, null, 2)};

export const FULL_PV_RELATIONSHIPS: PvFullRelationships = ${JSON.stringify(relationships, null, 2)};

export const FULL_PV_OPERATIONAL_INTELLIGENCE: PvFullOperationalSnapshot = ${JSON.stringify(operational, null, 2)};

export const FULL_PV_PAYMENTS: PvFullPayment[] = ${JSON.stringify(payments, null, 2)};

export const FULL_PV_EVENT_FINANCIALS: Record<string, PvFullEventFinancial> = ${JSON.stringify(eventFinancials, null, 2)};

export const FULL_PV_SALES_DAYS: PvFullSalesDay[] = ${JSON.stringify(salesDays, null, 2)};

export const FULL_PV_VENUE_SALES_TOTALS: PvFullVenueSalesTotals | null = ${JSON.stringify(salesTotals, null, 2)};

export const FULL_PV_FINANCIAL_SNAPSHOT: PvFullFinancialSnapshot = ${JSON.stringify(financialSnapshot, null, 2)};

export const FULL_PV_ACCOUNT_FINANCIALS: PvFullAccountFinancial[] = ${JSON.stringify(accountFinancials, null, 2)};

export const PV_FULL_EXPORT_AVAILABLE = true;
`;

  writeFileSync(OUT_TS, ts, 'utf8');

  const flagsTs = `/**
 * AUTO-GENERATED by scripts/import-perfect-venue-export.mjs — do not edit by hand.
 */
export const PV_FULL_EXPORT_AVAILABLE = true;

export const isFullPvExportAvailable = PV_FULL_EXPORT_AVAILABLE;
`;
  writeFileSync(OUT_FLAGS_TS, flagsTs, 'utf8');

  console.log('[pv-import] Done');
  console.log('  Events:', events.length);
  console.log('  Contacts:', publicContacts.length);
  console.log('  Accounts:', accounts.length);
  console.log('  Proposal summaries:', Object.keys(proposalSummaries).length);
  console.log('  Payments:', payments.length, '(orphaned', orphanedPayments + ')');
  console.log('  Sales days:', salesDays.length);
  if (meta.financial) {
    console.log('  Collected:', meta.financial.paymentsCollected, 'Outstanding:', meta.financial.eventOutstanding);
  }
  console.log('  Warnings:', warnings.length);
  console.log('  Written:', OUT_TS);
}

main();
