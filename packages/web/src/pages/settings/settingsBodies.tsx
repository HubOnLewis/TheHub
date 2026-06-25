import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { AUTOPILOT_WORKFLOW_CARDS, type WorkflowApprovalMode } from '../../data/autopilotDemo.js';
import {
  DEMO_VENUE_MEDIA_SLOTS,
  DEMO_VENUE_NAME,
  DEMO_VENUE_TAGLINE,
  DEMO_SPACE_SHOWCASE,
} from '../../data/demoVenue.js';
import {
  PV_VENUE_DETAILS_DEFAULTS,
  getPvImportMeta,
  isFullPvExportAvailable,
} from '../../data/perfectVenueSeed.js';
import { getDataQualityStats } from '../../data/pvEventModel.js';
import { HUB_RESET_MANIFEST } from '../../data/hubResetManifest.js';
import { HUB_REFRESH_AVAILABLE, HUB_REFRESH_MANIFEST } from '../../data/hubRefreshManifest.js';
import { DEMO_MANAGED_USERS } from '../../data/demoUsers.js';
import {
  queueSmsDraft,
  SMS_KEYWORD_RULES,
  SMS_PROVIDER_STATUS,
  SMS_TEMPLATES,
} from '../../integrations/sms/smsDemoAdapter.js';
import { useAppStore } from '../../store/index.js';
import { isDeployedAlpha } from '../../config/alphaPresentation.js';
import DemoControlsPanel from '../../components/settings/DemoControlsPanel.js';
import MailchimpSettingsPanel from '../../components/settings/MailchimpSettingsPanel.js';
import TeamAccessPanel from '../../components/settings/TeamAccessPanel.js';
import ReferralProgramPanel from '../../components/admin/ReferralProgramPanel.js';
import IntegrationsSettingsPanel from '../../components/settings/IntegrationsSettingsPanel.js';
import AnalyticsSettingsPanel from '../../components/settings/AnalyticsSettingsPanel.js';
import { HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';

function approvalModeLabel(m: WorkflowApprovalMode): string {
  switch (m) {
    case 'auto':
      return 'Auto-run safe steps';
    case 'review_low_risk':
      return 'Review low-risk sends';
    case 'always_review':
      return 'Always review';
    default:
      return m;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <label className="settings-field__label">{label}</label>
      {children}
    </div>
  );
}

function DataImportQualityPanel() {
  const resetManifest = HUB_RESET_MANIFEST;
  const refresh = HUB_REFRESH_AVAILABLE ? HUB_REFRESH_MANIFEST : null;

  if (refresh) {
    return (
      <div className="settings-deep data-import-panel">
        <div className="data-import-summary-grid">
          <div className="card settings-stat-card data-import-status-card data-import-status-card--ok">
            <h4>Refresh import</h4>
            <p className="settings-stat">Loaded</p>
            <p className="settings-muted">
              {new Date(refresh.importedAt).toLocaleString()}
            </p>
            <p className="settings-muted">Contamination audit: {refresh.contaminationAudit}</p>
          </div>
          <div className="card settings-stat-card">
            <h4>Events</h4>
            <p className="settings-stat">{refresh.eventsParsed}</p>
            <p className="settings-muted">{refresh.uniquePvIds} PV IDs</p>
          </div>
          <div className="card settings-stat-card">
            <h4>Contacts</h4>
            <p className="settings-stat">{refresh.contactsParsed}</p>
          </div>
          <div className="card settings-stat-card">
            <h4>Payments</h4>
            <p className="settings-stat">{refresh.paymentsParsed}</p>
            <p className="settings-muted">{refresh.paymentsMatched} matched to events</p>
          </div>
          <div className="card settings-stat-card">
            <h4>Documents</h4>
            <p className="settings-stat">{refresh.documentsMatched}</p>
            <p className="settings-muted">
              Inv {refresh.invoicesMatched} · BEO {refresh.beosMatched} · Agr {refresh.agreementsMatched} · Menu{' '}
              {refresh.menusMatched}
            </p>
          </div>
          <div className="card settings-stat-card">
            <h4>Financial totals</h4>
            <p className="settings-stat">${refresh.financialTotals.grandTotal.toLocaleString()}</p>
            <p className="settings-muted">
              Paid ${refresh.financialTotals.amountPaid.toLocaleString()} · Due $
              {refresh.financialTotals.balanceDue.toLocaleString()}
            </p>
          </div>
          <div className="card settings-stat-card">
            <h4>Unmatched</h4>
            <p className="settings-stat">{refresh.unmatchedCount}</p>
            <p className="settings-muted">{refresh.warningsCount} warning(s)</p>
          </div>
        </div>

        <p className="settings-lede">Perfect Venue refresh import · HuB on Lewis venue data only.</p>

        <details className="data-import-details">
          <summary>Source folder</summary>
          <p className="settings-muted settings-list--mono">{refresh.sourceRoot}</p>
        </details>

        <details className="data-import-details">
          <summary>Folder coverage</summary>
          <ul className="settings-list">
            {Object.entries(refresh.folders).map(([folder, info]) => (
              <li key={folder}>
                {folder}: {info.exists ? `${info.fileCount} file(s)` : 'missing'}
              </li>
            ))}
          </ul>
        </details>

        <details className="data-import-details">
          <summary>Re-import</summary>
          <p className="settings-muted settings-list--mono">
            npm run import:hub-refresh:dry-run
            <br />
            npm run import:hub-refresh:apply
          </p>
        </details>
      </div>
    );
  }

  if (!isFullPvExportAvailable) {
    return (
      <div className="settings-deep data-import-panel">
        <div className="card settings-stat-card data-import-status-card data-import-status-card--warn">
          <h4>Import status</h4>
          <p className="settings-stat">No current import loaded</p>
          <p className="settings-muted">Ready for fresh Perfect Venue import</p>
          {resetManifest?.resetAt ? (
            <p className="settings-muted">
              Last tenant reset: {new Date(resetManifest.resetAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <p className="settings-lede">
          Drop Perfect Venue refresh files into <code>import/</code> (numbered folders), then run the refresh import.
        </p>

        <details className="data-import-details" open>
          <summary>Expected folder structure</summary>
          <ul className="settings-list settings-list--mono">
            <li>import/01-events-master/Event Data *.xlsx</li>
            <li>import/02-event-summaries/*.pdf</li>
            <li>import/03-beos/*.pdf</li>
            <li>import/04-staff-beos/*.pdf</li>
            <li>import/05-invoices/*.pdf</li>
            <li>import/06-agreements/*.pdf</li>
            <li>import/07-menus/*.pdf</li>
            <li>import/08-payments/Payment Data *.xlsx</li>
          </ul>
        </details>

        <details className="data-import-details">
          <summary>Import commands</summary>
          <ul className="settings-list settings-list--mono">
            <li>npm run import:hub-refresh:audit</li>
            <li>npm run import:hub-refresh:dry-run</li>
            <li>npm run validate:hub-refresh</li>
            <li>npm run import:hub-refresh:apply</li>
          </ul>
        </details>

        <details className="data-import-details" open>
          <summary>Legacy expected files</summary>
          <ul className="settings-list settings-list--mono">
            {(resetManifest?.expectedFiles ?? [
              'data/perfect-venue-import/Event Data *.xlsx',
              'data/perfect-venue-import/Proposal Data *.xlsx',
              'data/perfect-venue-import/Contact Data *.xlsx',
              'data/perfect-venue-import/Payment Data *.xlsx (optional)',
              'data/perfect-venue-import/PFevents.txt (optional)',
            ]).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </details>

        <details className="data-import-details">
          <summary>Import commands</summary>
          <ul className="settings-list settings-list--mono">
            {(resetManifest?.importCommands ?? ['npm run import:perfect-venue', 'npm run import:pfevents -- --apply']).map(
              (c) => (
                <li key={c}>{c}</li>
              ),
            )}
          </ul>
        </details>

        <p className="settings-muted">
          Place XLSX files in <code>data/perfect-venue-import/</code> or <code>import/</code>, then run{' '}
          <code>npm run import:perfect-venue</code>.
        </p>
      </div>
    );
  }

  const meta = getPvImportMeta();
  const q = meta.quality;
  const canon = getDataQualityStats();
  const j = meta.joins;
  const r = meta.rowCounts;
  const fin = meta.financial;
  const joinPct = Math.round((j.eventsWithProposals / r.eventsNormalized) * 100);
  const contactPct = Math.round((j.eventsWithContacts / r.eventsNormalized) * 100);
  const safeForReview =
    q.missingEventDates <= 2 &&
    q.missingContacts <= 6 &&
    j.orphanedProposals <= 8 &&
    meta.warnings.length <= 10;
  const freshness = new Date(meta.importedAt);
  const ageHours = Math.floor((Date.now() - freshness.getTime()) / 3600000);

  const cleanup = [
    q.duplicateContactEmails > 0 ? 'Dedupe contact emails flagged in warnings' : null,
    q.missingTotals > 50 ? 'Review zero-dollar / office rental rows before revenue demos' : null,
    j.orphanedProposals > 0 ? 'Re-link proposal lines missing Event ID' : null,
    q.missingEventDates > 0 ? 'Fix events with missing dates in PV' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="settings-deep data-import-panel">
      <div className="data-import-summary-grid">
        <div className={`card settings-stat-card data-import-status-card${safeForReview ? ' data-import-status-card--ok' : ' data-import-status-card--warn'}`}>
          <h4>Import status</h4>
          <p className="settings-stat">{safeForReview ? 'Ready for review' : 'Needs attention'}</p>
          <p className="settings-muted">
            {ageHours < 48 ? 'Current' : 'Stale'} · imported {freshness.toLocaleDateString()}
          </p>
        </div>
        <div className="card settings-stat-card">
          <h4>Events</h4>
          <p className="settings-stat">{r.eventsNormalized}</p>
          <p className="settings-muted">Raw {r.eventsRaw} · ex. test {q.exampleEventsExcluded}</p>
        </div>
        <div className="card settings-stat-card">
          <h4>Contacts</h4>
          <p className="settings-stat">{r.contactsNormalized}</p>
          <p className="settings-muted">Accounts {r.accounts}</p>
        </div>
        <div className="card settings-stat-card">
          <h4>Proposal lines</h4>
          <p className="settings-stat">{r.proposalLineItems}</p>
          <p className="settings-muted">{j.eventsWithProposals} events joined</p>
        </div>
        <div className="card settings-stat-card">
          <h4>Relationship completeness</h4>
          <p className="settings-stat">{contactPct}%</p>
          <p className="settings-muted">Events ↔ contacts · proposals {joinPct}%</p>
        </div>
        {fin ? (
          <>
            <div className="card settings-stat-card">
              <h4>Payments collected</h4>
              <p className="settings-stat">${fin.paymentsCollected.toLocaleString()}</p>
              <p className="settings-muted">{r.paymentsRaw ?? 0} ledger rows</p>
            </div>
            <div className="card settings-stat-card">
              <h4>Outstanding</h4>
              <p className="settings-stat">${fin.eventOutstanding.toLocaleString()}</p>
              <p className="settings-muted">Active pipeline balance</p>
            </div>
            <div className="card settings-stat-card">
              <h4>Import health</h4>
              <p className="settings-stat">{fin.importHealthScore}</p>
              <p className="settings-muted">Join + warning score</p>
            </div>
          </>
        ) : null}
      </div>

      <p className="settings-lede data-import-lede">
        Perfect Venue spreadsheet import · PII masked in the client UI.
      </p>

      <details className="data-import-details">
        <summary>Source files</summary>
        <ul className="settings-list settings-list--mono">
          <li>Events · {meta.sourceFiles.events}</li>
          <li>Proposals · {meta.sourceFiles.proposals}</li>
          <li>Contacts · {meta.sourceFiles.contacts}</li>
        </ul>
      </details>

      <details className="data-import-details">
        <summary>Join coverage</summary>
        <ul className="settings-list">
          <li>Events with proposals: {j.eventsWithProposals} / {r.eventsNormalized}</li>
          <li>Events with contacts: {j.eventsWithContacts} / {r.eventsNormalized}</li>
          <li>Contacts with accounts: {j.contactsWithAccounts} / {r.contactsNormalized}</li>
          <li>Orphaned proposal lines: {j.orphanedProposals}</li>
          {j.paymentsWithEvents != null ? (
            <li>
              Payments matched to events: {j.paymentsWithEvents} / {r.paymentsRaw ?? 0}
            </li>
          ) : null}
          {j.orphanedPayments != null ? <li>Orphaned payments: {j.orphanedPayments}</li> : null}
        </ul>
      </details>

      <details className="data-import-details">
        <summary>Quality signals</summary>
        <ul className="settings-list">
          <li>Missing event dates: {q.missingEventDates}</li>
          <li>Missing contacts on events: {q.missingContacts}</li>
          <li>Missing/zero totals: {q.missingTotals}</li>
          <li>Duplicate contact emails: {q.duplicateContactEmails}</li>
          <li>Zero-dollar events (&lt; $75): {q.zeroDollarEvents ?? canon.zeroDollar}</li>
          {'lostArchived' in q ? <li>Lost / archived: {q.lostArchived as number}</li> : null}
          {'completed' in q ? <li>Completed: {q.completed as number}</li> : null}
          {'activePipeline' in q ? <li>Active pipeline: {q.activePipeline as number}</li> : null}
          {'confirmedFuture' in q ? <li>Confirmed future: {q.confirmedFuture as number}</li> : null}
          <li>Excluded from pressure scoring: {canon.excludedFromPressure}</li>
          <li>Pressure-eligible signals: {canon.pressureEligible}</li>
        </ul>
        <p className="settings-muted">
          Excluded rows are preserved for history but not used for active pressure scoring.
        </p>
      </details>

      {meta.warnings.length > 0 ? (
        <details className="data-import-details data-import-details--warn" open>
          <summary>Warnings ({meta.warnings.length})</summary>
          <ul className="settings-list settings-list--warn">
            {meta.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {cleanup.length > 0 ? (
        <section className="data-import-cleanup">
          <h4>Recommended cleanup</h4>
          <ul className="settings-list">
            {cleanup.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="data-import-details">
        <summary>Re-import instructions</summary>
        <p className="settings-muted">
          Re-import: <code>npm run import:perfect-venue</code>
          {!isDeployedAlpha() ? (
            <>
              {' '}· Debug JSON: <code>data/perfect-venue-processed/</code>
            </>
          ) : null}
        </p>
      </details>
    </div>
  );
}

export function SettingsBody({ moduleId }: { moduleId: string }) {
  const userName = useAppStore(s => s.user?.name ?? 'Coordinator');

  switch (moduleId) {
    case 'data-import':
      return <DataImportQualityPanel />;

    case 'demo-controls':
      if (isDeployedAlpha()) {
        return (
          <div className="settings-deep">
            <p className="settings-lede">Demo controls are available in local development only.</p>
          </div>
        );
      }
      return <DemoControlsPanel />;

    case 'audit-trail':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Every operational change is traceable. Human, agent, and automation actions are logged — approvals create a permanent audit trail.
          </p>
          <p className="settings-muted" style={{ marginBottom: 16 }}>
            Operational changes can be tracked from request to completion.
          </p>
          <Link to={ROUTES.audit} className="btn btn-primary">
            Open audit trail →
          </Link>
        </div>
      );

    case 'integrations':
      return <IntegrationsSettingsPanel />;

    case 'analytics':
      return <AnalyticsSettingsPanel />;

    case 'mailchimp':
      return <MailchimpSettingsPanel />;

    case 'team-access':
      return <TeamAccessPanel />;

    case 'referrals':
      if (isDeployedAlpha()) {
        return (
          <div className="settings-deep">
            <p className="settings-lede">Referral tracking is not connected to live CRM data in the production alpha yet.</p>
          </div>
        );
      }
      return <ReferralProgramPanel />;

    case 'sms-notifications':
      return (
        <div className="settings-deep">
          <div className="settings-provider-card card">
            <h4>Twilio connection</h4>
            <p>
              Status: <strong>{SMS_PROVIDER_STATUS.configured ? 'Configured' : 'Not configured'}</strong> · Mode:{' '}
              {SMS_PROVIDER_STATUS.mode}
            </p>
            <p className="settings-muted">{SMS_PROVIDER_STATUS.lastHealthCheck}</p>
          </div>
          <p className="settings-compliance">
            SMS sending requires opt-in and approved Twilio configuration. Outbound SMS is not enabled yet.
          </p>

          <h4 className="settings-autopilot-h4">SMS templates</h4>
          <ul className="settings-sms-templates">
            {SMS_TEMPLATES.map(t => (
              <li key={t.id} className="settings-sms-template card">
                <strong>{t.name}</strong>
                <span className="settings-muted">{t.recipientType}</span>
                <p>{t.body}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    queueSmsDraft({ to: '+13165550142', body: t.body, templateId: t.id, createdBy: userName });
                    window.alert('SMS queued locally — nothing sent. Requires Twilio configuration in production.');
                  }}
                >
                  Queue locally (not sent)
                </button>
              </li>
            ))}
          </ul>

          <h4 className="settings-autopilot-h4" style={{ marginTop: 24 }}>
            Keyword trigger rules
          </h4>
          <table className="data-table settings-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Description</th>
                <th>Recipient</th>
                <th>Agent</th>
                <th>Approval</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {SMS_KEYWORD_RULES.map(r => (
                <tr key={r.id}>
                  <td>
                    <code>{r.keyword}</code>
                  </td>
                  <td>{r.description}</td>
                  <td>{r.recipientType}</td>
                  <td>{r.agentOwner}</td>
                  <td>{r.approvalRequired ? 'Yes' : 'No'}</td>
                  <td>
                    <input type="checkbox" defaultChecked={r.enabled} readOnly />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="settings-autopilot-h4" style={{ marginTop: 24 }}>
            Owner / team notification preferences
          </h4>
          <label className="settings-toggle">
            <input type="checkbox" defaultChecked /> Day-of urgent alerts (#urgent)
          </label>
          <label className="settings-toggle">
            <input type="checkbox" defaultChecked /> Owner digest for #owner escalations
          </label>
          <label className="settings-toggle">
            <input type="checkbox" /> Staff task SMS (employee phones)
          </label>
        </div>
      );

    case 'payments':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Provider-agnostic payment foundation — deposit links, balance links, and webhook status. No card data stored in Hub CRM.
          </p>
          <div className="settings-provider-card card">
            <h4>Payment provider</h4>
            <p>
              Status: <strong>Not connected</strong>
            </p>
            <p className="settings-muted">
              Future paths: Stripe Payment Links, venue processor (e.g. BASYS) — see docs/HUB_PAYMENTS_FOUNDATION.md
            </p>
          </div>
          <div className="settings-form-grid">
            <Field label="Deposit policy">
              <select className="form-select" defaultValue="50">
                <option value="50">50% deposit to confirm</option>
                <option value="33">33% deposit (custom events)</option>
              </select>
            </Field>
            <Field label="Balance due">
              <select className="form-select" defaultValue="before">
                <option value="before">Before load-in</option>
                <option value="7">7 days before event</option>
              </select>
            </Field>
          </div>
          <h4 className="settings-autopilot-h4">Payment link templates</h4>
          <Field label="Deposit link email intro">
            <textarea
              className="form-textarea"
              rows={2}
              defaultValue="Complete your deposit to hold your date at HuB on Lewis. Link expires in 7 days."
              readOnly
            />
          </Field>
          <Field label="Webhook status">
            <input className="form-input" readOnly value="No webhooks received — API not connected" />
          </Field>
          <p className="settings-compliance">
            All payment events will write to the audit trail (link created, received, refund). Refunds require owner approval.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              window.alert(
                'Payment link would be generated after provider connection. No charges are processed yet.',
              )
            }
          >
            Preview payment link flow
          </button>
        </div>
      );

    case 'autopilot':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            The Hub Autopilot coordinates specialized agents — drafts and schedules only; nothing sends, bills, or deletes without
            explicit approval in this build.{' '}
            <Link to={ROUTES.autopilot} style={{ color: 'var(--red)', fontWeight: 700 }}>
              Open agent workforce
            </Link>
          </p>

          <div className="settings-autopilot-global">
            <h4 className="settings-autopilot-h4">Global approval posture</h4>
            <label className="settings-toggle">
              <input type="radio" name="ap_posture" defaultChecked /> Suggest & queue — humans approve outbound (recommended)
            </label>
            <label className="settings-toggle">
              <input type="radio" name="ap_posture" /> Review only low-risk templates (under $500 verbal commits)
            </label>
            <label className="settings-toggle">
              <input type="radio" name="ap_posture" /> Dry-run mode — log actions only (training tenants)
            </label>
          </div>

          <div className="settings-autopilot-global" style={{ marginTop: 18 }}>
            <h4 className="settings-autopilot-h4">Human-in-the-loop guardrails</h4>
            <label className="settings-toggle"><input type="checkbox" defaultChecked /> Require ops lead for calendar hold releases</label>
            <label className="settings-toggle"><input type="checkbox" defaultChecked /> Block payment links until Finance role ack</label>
            <label className="settings-toggle"><input type="checkbox" defaultChecked /> Escalate nonprofit ED-facing mail to AE + manager</label>
            <label className="settings-toggle"><input type="checkbox" /> Allow Autopilot to schedule internal tasks without approval</label>
          </div>

          <h4 className="settings-autopilot-h4" style={{ marginTop: 24 }}>Workflow programs</h4>
          <div className="settings-autopilot-workflows">
            {AUTOPILOT_WORKFLOW_CARDS.map(wf => (
              <div key={wf.id} className="settings-ap-workflow-card">
                <div className="settings-ap-workflow-card__head">
                  <label className="settings-toggle" style={{ fontWeight: 700 }}>
                    <input type="checkbox" defaultChecked={wf.enabled} /> {wf.title}
                  </label>
                  {wf.lastRun ? <span className="settings-muted">{wf.lastRun}</span> : null}
                </div>
                <p className="settings-muted" style={{ marginTop: 8, lineHeight: 1.45 }}>{wf.description}</p>
                <Field label="Approval mode">
                  <select className="form-select" defaultValue={wf.approvalMode}>
                    <option value="auto">{approvalModeLabel('auto')}</option>
                    <option value="review_low_risk">{approvalModeLabel('review_low_risk')}</option>
                    <option value="always_review">{approvalModeLabel('always_review')}</option>
                  </select>
                </Field>
              </div>
            ))}
          </div>
        </div>
      );

    case 'venue-details':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Legal operating entity, address, and capacity certificates on file with Sedgwick County.</p>
          <div className="settings-form-grid">
            <Field label="Venue legal name">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.legalName} />
            </Field>
            <Field label="Doing business as">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.dba} />
            </Field>
            <Field label="Street">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.street} />
            </Field>
            <Field label="City / State / ZIP">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.cityStateZip} />
            </Field>
            <Field label="Time zone">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.timeZone} />
            </Field>
            <Field label="Default event owner">
              <input className="form-input" defaultValue={PV_VENUE_DETAILS_DEFAULTS.defaultOwner} />
            </Field>
            <Field label="County permit #">
              <input className="form-input" defaultValue="SEDG-EVT-2019-8842" />
            </Field>
            <Field label="Max indoor occupancy (fire code)">
              <input className="form-input" defaultValue="220 standing / 160 seated (Grand Hall)" />
            </Field>
          </div>
          <div className="settings-toolbar">
            <label className="settings-toggle"><input type="checkbox" defaultChecked /> Certificate of liability on file</label>
            <label className="settings-toggle"><input type="checkbox" defaultChecked /> KDHE food service rider active</label>
          </div>
          <div className="settings-upload-row">
            <div className="settings-upload-card">
              <span className="settings-upload-card__tag">PDF</span>
              <strong>COI · The Hartford</strong>
              <span className="settings-muted">Uploaded Apr 02 · expires Apr 02, 2027</span>
            </div>
            <div className="settings-upload-card settings-upload-card--ghost">
              + Upload amended permit
            </div>
          </div>
        </div>
      );

    case 'venue-profile':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Public-facing copy, SEO, and <strong>venue media</strong> for Express Book and client preview. Add files under{' '}
            <code className="settings-code">public/venue/hub-on-lewis/</code> — paths below wire automatically when assets exist.
          </p>
          <Field label="Short description (≤ 280 chars)">
            <textarea className="form-textarea" rows={3} defaultValue={`${DEMO_VENUE_TAGLINE} — downtown-adjacent events, receptions, nonprofit lunches, and private parties with on-site coordination.`} />
          </Field>
          <Field label="SEO title">
            <input className="form-input" defaultValue="Event venue Wichita KS | HuB on Lewis | Receptions & meetings" />
          </Field>
          <div className="settings-venue-media-section">
            <h4 className="settings-venue-media-h4">Venue photography (import-ready)</h4>
            <div className="settings-venue-media-grid">
              {DEMO_VENUE_MEDIA_SLOTS.map(slot => (
                <div key={slot.id} className="settings-venue-media-card">
                  <div className="settings-venue-media-card__ph" aria-hidden />
                  <strong>{slot.label}</strong>
                  <span className="settings-muted">{slot.spec}</span>
                  <code className="settings-code settings-code--sm">{slot.assetPath}</code>
                </div>
              ))}
              <div className="settings-image-tile settings-image-tile--add">+ Upload batch</div>
            </div>
          </div>
          <label className="settings-toggle" style={{ marginTop: 14 }}><input type="checkbox" defaultChecked /> Show “Starting at” pricing on public calendar embed</label>
        </div>
      );

    case 'spaces':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Bookable spaces with capacities, default setups, and amenities — hero thumbnails pull from{' '}
            <code className="settings-code">/venue/hub-on-lewis/</code> when uploaded.
          </p>
          <table className="data-table settings-table">
            <thead>
              <tr><th>Space</th><th>Seated</th><th>Standing</th><th>Amenities</th><th>Default setup</th><th></th></tr>
            </thead>
            <tbody>
              {DEMO_SPACE_SHOWCASE.map(row => (
                <tr key={row.space}>
                  <td><strong>{row.space}</strong></td>
                  <td>{row.seated}</td>
                  <td>{row.standing}</td>
                  <td style={{ fontSize: 12, maxWidth: 280 }}>{row.amenities}</td>
                  <td>{row.space === 'Grand Hall' ? 'Rounds · stage north' : row.space === 'River Room' ? 'Banquet · AV rack SE' : row.space === 'Glass Atrium' ? 'Theater · open mic west' : 'Rounds + tent pad'}</td>
                  <td><button type="button" className="btn btn-ghost" style={{ fontSize: 11 }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="settings-space-cards">
            {DEMO_SPACE_SHOWCASE.map(row => (
              <div key={`card-${row.space}`} className="settings-space-card">
                <div className="settings-space-card__thumb" aria-hidden />
                <div>
                  <strong>{row.space}</strong>
                  <div className="settings-muted">{row.seated} seated · {row.standing} standing</div>
                  <div className="settings-muted" style={{ marginTop: 6 }}>{row.amenities}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }}>+ Add space</button>
        </div>
      );

    case 'floor-plans':
      return (
        <div className="settings-deep">
          <p className="settings-lede">CAD overlays for sales — versioned per fire marshal revision.</p>
          <div className="settings-plan-cards">
            <div className="settings-plan-card"><strong>Grand Hall · v2025.3</strong><span className="settings-muted">DWG + PDF · May 01</span></div>
            <div className="settings-plan-card"><strong>River Room · v2024.1</strong><span className="settings-muted">PDF only</span></div>
            <div className="settings-plan-card settings-plan-card--ghost">Upload new revision</div>
          </div>
        </div>
      );

    case 'contact-forms':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Lead capture fields routed to Express Book intake rules.</p>
          <div className="settings-form-grid">
            <Field label="Primary form slug">
              <input className="form-input" defaultValue="/book/inquiry" />
            </Field>
            <Field label="Thank-you redirect">
              <input className="form-input" defaultValue="https://hubonlewis.com/thanks" />
            </Field>
          </div>
          <label className="settings-toggle"><input type="checkbox" defaultChecked /> Require estimated guest count</label>
          <label className="settings-toggle"><input type="checkbox" defaultChecked /> Require preferred date range</label>
          <label className="settings-toggle"><input type="checkbox" /> Ask nonprofit EIN (toggle for gala funnel)</label>
        </div>
      );

    case 'menu-packages':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Catering packages attach to proposals — pricing ex tax.</p>
          <table className="data-table settings-table">
            <thead><tr><th>SKU</th><th>Package</th><th>Per guest</th><th>Min guests</th></tr></thead>
            <tbody>
              <tr><td>FB-SIL</td><td>Silver · buffet core</td><td>$42</td><td>75</td></tr>
              <tr><td>FB-GOL</td><td>Gold · plated + late snack</td><td>$68</td><td>50</td></tr>
              <tr><td>FB-GAL</td><td>Gala Platinum (anchor)</td><td>$92</td><td>200</td></tr>
            </tbody>
          </table>
        </div>
      );

    case 'proposal-templates':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Merge fields from opportunities and spaces populate branded PDF exports.</p>
          <div className="settings-template-grid">
            <div className="settings-template-card">
              <strong>Wedding · HuB 2026</strong>
              <span className="settings-muted">Last edit · Morgan K · Apr 28</span>
              <div className="settings-template-preview">
                <small>COVER</small>
                <div className="settings-template-preview__mock">HuB on Lewis · Proposal for {'{{client}}'}</div>
              </div>
              <button type="button" className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>Open designer</button>
            </div>
            <div className="settings-template-card">
              <strong>Gala · nonprofit tier</strong>
              <span className="settings-muted">Frozen · Mar 12</span>
              <div className="settings-template-preview">
                <small>PAGE 2</small>
                <div className="settings-template-preview__mock">F&B minimum · AV rider · insurance block</div>
              </div>
            </div>
          </div>
          <h4 className="settings-proposal-client-h4">Client-facing preview (PDF + web)</h4>
          <p className="settings-muted" style={{ marginBottom: 12 }}>
            Placeholder panels mirror where venue photography and floor plans appear in the client deck — assets resolve from{' '}
            <code className="settings-code">/venue/hub-on-lewis/</code> when present.
          </p>
          <div className="settings-client-preview-row">
            <div className="settings-client-preview-panel">
              <span className="settings-muted">Cover hero</span>
              <code className="settings-code settings-code--sm">/venue/hub-on-lewis/exterior-hero.webp</code>
            </div>
            <div className="settings-client-preview-panel">
              <span className="settings-muted">Signature room</span>
              <code className="settings-code settings-code--sm">/venue/hub-on-lewis/grand-hall-main.webp</code>
            </div>
            <div className="settings-client-preview-panel">
              <span className="settings-muted">Hospitality</span>
              <code className="settings-code settings-code--sm">/venue/hub-on-lewis/kitchenette-prep.webp</code>
            </div>
          </div>
        </div>
      );

    case 'email-templates':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Transactional sends via Hub mail relay · SPF/DKIM verified.</p>
          <div className="settings-email-split">
            <div>
              <label className="settings-field__label">Template · Deposit received</label>
              <textarea className="form-textarea" rows={10} defaultValue={`Subject: Deposit received — {{event_title}}\n\nHi {{contact_first}},\n\nWe received {{deposit_amount}} toward {{event_title}} on {{date}}. Outstanding balance {{balance}} due {{due_date}}.\n\n— HuB on Lewis Events`} />
            </div>
            <div className="settings-email-meta">
              <span className="settings-pill">Tokens: 12</span>
              <span className="settings-pill">Plain-text fallback · on</span>
              <div className="settings-email-render">
                <strong>Live preview</strong>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Hi Priya — We received $1,050 toward Patel / Nguyen rehearsal dinner…
                </p>
              </div>
            </div>
          </div>
        </div>
      );

    case 'automated-tasks':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Rules engine · triggers create tasks and Slack hooks.</p>
          <div className="settings-automation-stack">
            <div className="settings-auto-card">
              <span className="settings-badge settings-badge--live">Active</span>
              <strong>T-14 luncheon prep pack</strong>
              <p className="settings-muted">If guest count &gt;120 → spawn KDHE walk-through + coffee extension reminder · Ops lead</p>
            </div>
            <div className="settings-auto-card">
              <span className="settings-badge settings-badge--live">Active</span>
              <strong>Deposit aging &gt; 10d</strong>
              <p className="settings-muted">Friendly balance reminder draft · CC coordinator · hold new holds until reply</p>
            </div>
            <div className="settings-auto-card">
              <span className="settings-badge settings-badge--off">Paused</span>
              <strong>Outdoor weather SMS</strong>
              <p className="settings-muted">East Terrace only · severe weather watch · manager approves copy</p>
            </div>
          </div>
        </div>
      );

    case 'taxes-fees':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Sales tax, service, and facility fees applied at proposal freeze.</p>
          <table className="data-table settings-table">
            <thead><tr><th>Code</th><th>Description</th><th>Rate / amount</th><th>Applies to</th></tr></thead>
            <tbody>
              <tr><td>KS-SLS</td><td>Kansas sales tax (Sedgwick)</td><td>7.50%</td><td>Taxable goods & services</td></tr>
              <tr><td>SVC</td><td>Service charge · banquet</td><td>22%</td><td>F&B subtotal</td></tr>
              <tr><td>FAC</td><td>Facility fee · weekend prime</td><td>$350 flat</td><td>Sat events after 4p</td></tr>
            </tbody>
          </table>
        </div>
      );

    case 'team':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Role-based access · public contact {HUB_PUBLIC_CONTACT_EMAIL} · SSO optional next sprint.
          </p>
          <div className="settings-team-grid">
            {DEMO_MANAGED_USERS.map(u => (
              <div key={u.id} className="settings-team-card">
                <span className="avatar" style={{ width: 44, height: 44 }}>{u.name.split(' ').map(x => x[0]).join('')}</span>
                <div>
                  <strong>{u.name}</strong>
                  <div className="settings-muted">{u.role}</div>
                  <div className="settings-muted">{u.permissionsSummary}</div>
                </div>
                <span className="settings-pill">{u.status}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 14 }}>Invite user</button>
        </div>
      );

    case 'billing':
      return (
        <div className="settings-deep">
          <p className="settings-lede">
            Legacy billing view — use <Link to={`${ROUTES.settings}/payments`}>Payments</Link> for deposit/balance foundation.
          </p>
          <div className="settings-form-grid">
            <Field label="Processor">
              <select className="form-select" defaultValue="none">
                <option value="none">Not connected</option>
                <option value="stripe">Stripe (future)</option>
              </select>
            </Field>
            <Field label="Payout schedule">
              <select className="form-select" defaultValue="daily">
                <option>Daily (2-day rolling)</option>
              </select>
            </Field>
          </div>
          <table className="data-table settings-table" style={{ marginTop: 18 }}>
            <thead><tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              <tr><td>INV-4481</td><td>WCH Foundation</td><td>$60,750.00</td><td><span className="badge badge-quoted">Open</span></td><td>May 10</td></tr>
              <tr><td>INV-4472</td><td>Flint Hills Angel Network</td><td>$21,400.00</td><td><span className="badge badge-new">Paid</span></td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      );

    case 'express-book':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Express Book widget — instant holds and proposal shortcuts (Perfect Venue parity).</p>
          <Field label="Public booking URL slug">
            <input className="form-input" defaultValue="hub-on-lewis" />
          </Field>
          <label className="settings-toggle"><input type="checkbox" defaultChecked /> Show Event Space availability first</label>
        </div>
      );

    case 'group-contact-form':
    case 'group-settings':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Multi-venue group intake — shared branding and routing (demo shell).</p>
          <Field label="Group name">
            <input className="form-input" defaultValue="HuB on Lewis" />
          </Field>
          <Field label="Default coordinator">
            <input className="form-input" defaultValue="Hannah Bayless" />
          </Field>
        </div>
      );

    case 'profile':
      return (
        <div className="settings-deep">
          <p className="settings-lede">Your Hub profile — notification preferences and signature blocks.</p>
          <Field label="Display name">
            <input className="form-input" defaultValue="Jason Lavender" />
          </Field>
          <Field label="Role">
            <input className="form-input" defaultValue="Owner / Admin" />
          </Field>
        </div>
      );

    default:
      return (
        <p style={{ color: 'var(--text-secondary)' }}>Select a module from the left.</p>
      );
  }
}
