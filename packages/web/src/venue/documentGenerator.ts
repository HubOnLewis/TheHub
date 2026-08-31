/**
 * Proposal + BEO HTML document generation (print / save as PDF via browser).
 */

import { buildClientDetailsDocHtml, buildGuestPaymentSummaryDocHtml, buildStaffBeoChecklistHtml, formatCurrency, venueStageLabel, type ClientDetails, type PaymentSummaryDocInput } from '@hub-crm/shared';
import type { EventDetailViewModel, EventPipelineStage } from '../lib/eventDetail.js';

function stageLabel(stage: EventPipelineStage): string {
  const map: Record<EventPipelineStage, string> = {
    lead: 'inquiry',
    qualified: 'qualified',
    proposal_sent: 'proposal',
    confirmed: 'confirmed',
    balance_due: 'deposit',
    completed: 'completed',
    lost: 'lost',
  };
  return venueStageLabel(map[stage] ?? 'inquiry');
}

export type VenueDocKind = 'proposal' | 'beo' | 'beo_guest' | 'invoice_summary';

export type GuestEventSheetInput = {
  title: string;
  eventDateDisplay: string;
  eventTimeDisplay?: string;
  space?: string | null;
  contact?: string;
  guests?: number | null;
  clientDetails: ClientDetails;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return formatCurrency(n);
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      margin: 0; padding: 40px 48px; color: #1c1917; background: #fff;
      font-size: 13px; line-height: 1.5;
    }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em;
         color: #78716c; margin: 28px 0 10px; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; }
    .brand { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .brand-sub { color: #78716c; font-size: 12px; }
    .pill { display: inline-block; background: #1e1b4b; color: #fff; padding: 3px 10px;
            border-radius: 999px; font-size: 11px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #a8a29e; }
    .field div { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f5f5f4; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c; }
    .totals { margin-top: 16px; margin-left: auto; width: 260px; }
    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .row.strong { font-weight: 700; font-size: 15px; border-top: 2px solid #1c1917; margin-top: 6px; padding-top: 8px; }
    .notes { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px 14px; white-space: pre-wrap; }
    .footer { margin-top: 40px; font-size: 11px; color: #a8a29e; }
    @media print {
      body { padding: 24px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:8px 16px;background:#1e1b4b;color:#fff;border:0;border-radius:8px;cursor:pointer;font-weight:600">
      Print / Save as PDF
    </button>
  </div>
  ${body}
</body>
</html>`;
}

export function buildProposalHtml(model: EventDetailViewModel): string {
  const stage = stageLabel(model.pipelineStage);
  const body = `
  <div class="brand">
    <div>
      <h1>Event Proposal</h1>
      <div class="brand-sub">HuB on Lewis · Wichita, KS</div>
    </div>
    <div style="text-align:right">
      <span class="pill">${esc(stage)}</span>
      <div class="brand-sub" style="margin-top:8px">${esc(model.eventDateDisplay)}</div>
    </div>
  </div>
  <h2>Event</h2>
  <div class="grid">
    <div class="field"><label>Event name</label><div>${esc(model.title)}</div></div>
    <div class="field"><label>Client</label><div>${esc(model.contact)} · ${esc(model.company)}</div></div>
    <div class="field"><label>Date & time</label><div>${esc(model.eventDateDisplay)}${model.eventTimeDisplay !== 'Not captured yet' ? ` · ${esc(model.eventTimeDisplay)}` : ''}</div></div>
    <div class="field"><label>Space</label><div>${esc(model.space ?? 'TBD')}</div></div>
    <div class="field"><label>Guests</label><div>${model.guests != null ? model.guests : 'TBD'}</div></div>
    <div class="field"><label>Event type</label><div>${esc(model.eventType ?? 'Private event')}</div></div>
    <div class="field"><label>Coordinator</label><div>${esc(model.owner)}</div></div>
    <div class="field"><label>Lead source</label><div>${esc(model.leadSource ?? '—')}</div></div>
  </div>
  <h2>Investment</h2>
  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Event package — ${esc(model.title)}</td><td>${money(model.grandTotal)}</td></tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Package total</span><span>${money(model.grandTotal)}</span></div>
    <div class="row"><span>Amount paid</span><span>${money(model.amountPaid)}</span></div>
    <div class="row strong"><span>Balance</span><span>${money(model.balanceDue)}</span></div>
  </div>
  <h2>Terms</h2>
  <div class="notes">A deposit is required to reserve your date. Final guest count and balance are due per your agreement with HuB on Lewis. This proposal is valid for 14 days unless otherwise noted.</div>
  ${model.notes ? `<h2>Notes</h2><div class="notes">${esc(model.notes)}</div>` : ''}
  <div class="footer">Generated by The Hub CRM · ${esc(new Date().toLocaleString())} · Not a tax invoice unless marked paid.</div>`;
  return shell(`Proposal — ${model.title}`, body);
}

export function buildBeoHtml(model: EventDetailViewModel): string {
  const body = `
  <div class="brand">
    <div>
      <h1>Banquet Event Order</h1>
      <div class="brand-sub">HuB on Lewis · Internal ops document</div>
    </div>
    <div style="text-align:right">
      <span class="pill">BEO</span>
      <div class="brand-sub" style="margin-top:8px">${esc(model.eventDateDisplay)}</div>
    </div>
  </div>
  <h2>Event summary</h2>
  <div class="grid">
    <div class="field"><label>Event</label><div>${esc(model.title)}</div></div>
    <div class="field"><label>Status</label><div>${esc(model.statusLabel)}</div></div>
    <div class="field"><label>Contact</label><div>${esc(model.contact)}</div></div>
    <div class="field"><label>Phone / email</label><div>${esc(model.contactPhone ?? '—')} / ${esc(model.contactEmail ?? '—')}</div></div>
    <div class="field"><label>Date</label><div>${esc(model.eventDateDisplay)}</div></div>
    <div class="field"><label>Time</label><div>${esc(model.eventTimeDisplay)}</div></div>
    <div class="field"><label>Space</label><div>${esc(model.space ?? 'TBD')}</div></div>
    <div class="field"><label>Guests</label><div>${model.guests != null ? model.guests : 'TBD'}</div></div>
    <div class="field"><label>Owner</label><div>${esc(model.owner)}</div></div>
    <div class="field"><label>Type</label><div>${esc(model.eventType ?? '—')}</div></div>
  </div>
  <h2>Financial snapshot</h2>
  <div class="grid">
    <div class="field"><label>Grand total</label><div>${money(model.grandTotal)}</div></div>
    <div class="field"><label>Paid</label><div>${money(model.amountPaid)}</div></div>
    <div class="field"><label>Balance due</label><div>${money(model.balanceDue)}</div></div>
    <div class="field"><label>Payment status</label><div>${esc(model.paymentStatus)}</div></div>
  </div>

  ${model.playbook ? `<h2>Playbook · ${esc(model.playbook.eventTypeLabel)}</h2>
  <div class="notes">${esc(model.playbook.clientTimeline.map(s => s.label + ' — ' + s.dueLabel).join('; '))}</div>` : ''}
  ${buildClientDetailsDocHtml(model.clientDetails)}
  <h2>Run of show / notes</h2>
  <div class="notes">${esc(model.notes || 'No internal notes captured yet. Add setup, F&B, AV, and special requests on the event record.')}</div>
  ${buildStaffBeoChecklistHtml(model.playbook?.tasks, model.owner)}
  <div class="footer">BEO generated by The Hub CRM · ${esc(new Date().toLocaleString())}</div>`;
  return shell(`BEO — ${model.title}`, body);
}

export function buildGuestBeoHtml(input: GuestEventSheetInput): string {
  const guests =
    input.clientDetails.guestCount != null
      ? input.clientDetails.guestCount
      : input.guests != null
        ? input.guests
        : 'TBD';
  const time = input.eventTimeDisplay && input.eventTimeDisplay !== 'Not captured yet' ? ` · ${esc(input.eventTimeDisplay)}` : '';
  const body = `
  <div class="brand">
    <div>
      <h1>Event details</h1>
      <div class="brand-sub">HuB on Lewis · Guest copy of the banquet event order</div>
    </div>
    <div style="text-align:right">
      <span class="pill">Event sheet</span>
      <div class="brand-sub" style="margin-top:8px">${esc(input.eventDateDisplay)}</div>
    </div>
  </div>
  <h2>Event summary</h2>
  <div class="grid">
    <div class="field"><label>Event</label><div>${esc(input.title)}</div></div>
    <div class="field"><label>Contact</label><div>${esc(input.contact ?? '—')}</div></div>
    <div class="field"><label>Date</label><div>${esc(input.eventDateDisplay)}${time}</div></div>
    <div class="field"><label>Space</label><div>${esc(input.space ?? 'TBD')}</div></div>
    <div class="field"><label>Guests</label><div>${guests}</div></div>
  </div>
  ${buildClientDetailsDocHtml(input.clientDetails)}
  <div class="footer">Guest event sheet · HuB on Lewis · ${esc(new Date().toLocaleString())}</div>`;
  return shell(`Event details — ${input.title}`, body);
}

export function buildInvoiceSummaryHtml(model: EventDetailViewModel): string {
  const rows =
    model.payments.length > 0
      ? model.payments
          .map(
            p =>
              `<tr><td>${esc(p.date ?? '—')}</td><td>${esc(p.type ?? 'Payment')}</td><td>${esc(p.method ?? '—')}</td><td>${money(p.amount)}</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="4">No payment lines recorded yet</td></tr>`;
  const body = `
  <div class="brand">
    <div>
      <h1>Payment summary</h1>
      <div class="brand-sub">HuB on Lewis · ${esc(model.title)}</div>
    </div>
    <div class="brand-sub">${esc(model.eventDateDisplay)}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Package total</span><span>${money(model.grandTotal)}</span></div>
    <div class="row"><span>Paid</span><span>${money(model.amountPaid)}</span></div>
    <div class="row strong"><span>Balance</span><span>${money(model.balanceDue)}</span></div>
  </div>
  <div class="footer">Generated by The Hub CRM · ${esc(new Date().toLocaleString())}</div>`;
  return shell(`Payment summary — ${model.title}`, body);
}

function openHtml(html: string): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!w) {
    window.alert('Pop-up blocked — allow pop-ups to generate documents.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function openGuestEventSheet(input: GuestEventSheetInput): void {
  openHtml(buildGuestBeoHtml(input));
}

export type GuestPaymentSheetInput = PaymentSummaryDocInput;

export function buildGuestPaymentSummaryHtml(input: GuestPaymentSheetInput): string {
  const body = `
  <div class="brand">
    <div>
      <h1>Payment summary</h1>
      <div class="brand-sub">HuB on Lewis · ${esc(input.title)}</div>
    </div>
    <div class="brand-sub">${esc(input.eventDateDisplay)}</div>
  </div>
  ${buildGuestPaymentSummaryDocHtml(input)}
  <div class="footer">Generated by The Hub CRM · ${esc(new Date().toLocaleString())} · Venue payment rows — not a card charge.</div>`;
  return shell(`Payment summary — ${input.title}`, body);
}

export function openGuestPaymentSummary(input: GuestPaymentSheetInput): void {
  openHtml(buildGuestPaymentSummaryHtml(input));
}

export function openVenueDocument(kind: VenueDocKind, model: EventDetailViewModel): void {
  const html =
    kind === 'proposal'
      ? buildProposalHtml(model)
      : kind === 'beo'
        ? buildBeoHtml(model)
        : kind === 'beo_guest'
          ? buildGuestBeoHtml({
              title: model.title,
              eventDateDisplay: model.eventDateDisplay,
              eventTimeDisplay: model.eventTimeDisplay,
              space: model.space,
              contact: model.contact,
              guests: model.guests,
              clientDetails: model.clientDetails,
            })
          : buildInvoiceSummaryHtml(model);
  openHtml(html);
}
