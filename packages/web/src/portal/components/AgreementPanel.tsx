import { usePortalStore } from '../portalStore.js';
import { PORTAL_DEMO_EVENT } from '../demoData.js';

function statusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'signed':
      return { label: 'Signed by client', className: 'portal-status--signed' };
    case 'viewed':
      return { label: 'Viewed by client', className: 'portal-status--viewed' };
    case 'waiting_venue':
      return { label: 'Waiting on venue', className: 'portal-status--venue' };
    default:
      return { label: 'Pending review', className: 'portal-status--pending' };
  }
}

export default function AgreementPanel() {
  const event = usePortalStore(s => s.event);
  const viewAgreement = usePortalStore(s => s.viewAgreement);
  const signAgreement = usePortalStore(s => s.signAgreement);
  const st = statusLabel(event.agreementStatus);

  return (
    <div className="portal-card portal-card--flat">
      <h3>Event agreement</h3>
      <p style={{ fontSize: 14, margin: '0 0 12px' }}>{PORTAL_DEMO_EVENT.proposalStatus}</p>
      <span className={`portal-status ${st.className}`}>{st.label}</span>
      {event.agreementViewedAt ? (
        <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 10 }}>Viewed {event.agreementViewedAt}</p>
      ) : null}
      {event.agreementSignedAt ? (
        <p style={{ fontSize: 12, color: 'var(--portal-success)', marginTop: 6 }}>Signed {event.agreementSignedAt}</p>
      ) : null}

      <div style={{ marginTop: 16, padding: '14px', background: 'var(--portal-bg)', borderRadius: 10, fontSize: 13 }}>
        <strong>HuB on Lewis — Event Agreement</strong>
        <p style={{ margin: '8px 0 0', color: 'var(--portal-muted)' }}>
          Shower package · {PORTAL_DEMO_EVENT.spacesBooked.join(', ')} · policies for cancellation, insurance, and
          vendor load-in included.
        </p>
      </div>

      <ul style={{ fontSize: 12, color: 'var(--portal-muted)', margin: '12px 0', paddingLeft: 18 }}>
        <li>Apr 02 — Proposal issued</li>
        <li>Apr 10 — Viewed by client</li>
        <li>Apr 12 — Signed · deposit received</li>
      </ul>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => viewAgreement()}>
          View agreement
        </button>
        {event.agreementStatus !== 'signed' ? (
          <button type="button" className="portal-btn portal-btn--primary" onClick={() => signAgreement()}>
            Sign agreement
          </button>
        ) : (
          <button type="button" className="portal-btn portal-btn--ghost" onClick={() => window.alert('PDF download — demo only')}>
            Download PDF
          </button>
        )}
        <button type="button" className="portal-btn portal-btn--ghost" onClick={() => window.alert('Policy acknowledgments recorded (demo).')}>
          Acknowledge policies
        </button>
      </div>

      {event.agreementStatus === 'signed' ? (
        <div className="portal-peace" style={{ marginTop: 16 }}>
          <strong>Signature confirmed</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>Your coordinator and venue team were notified. This appears on your timeline and audit trail.</p>
        </div>
      ) : null}
    </div>
  );
}
