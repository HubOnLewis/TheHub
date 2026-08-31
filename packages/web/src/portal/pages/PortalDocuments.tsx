import { usePortalStore } from '../portalStore.js';
import ProposalSignPanel from '../components/ProposalSignPanel.js';
import GuestStatusTimeline from '../components/GuestStatusTimeline.js';

export default function PortalDocuments() {
  const proposal = usePortalStore(s => s.proposal);
  const viewProposal = usePortalStore(s => s.viewProposal);
  const signProposal = usePortalStore(s => s.signProposal);
  const snapshot = usePortalStore(s => s.snapshot);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 20px' }}>Documents</h1>
      <GuestStatusTimeline />
      <ProposalSignPanel
        proposal={proposal}
        onView={() => viewProposal()}
        onSign={input => signProposal(input)}
      />
      <div className="portal-card portal-card--flat" style={{ marginTop: 16 }}>
        <h3>Guest downloads</h3>
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
          Event details are the guest BEO. Internal staff BEOs stay on the admin event.
        </p>
        {(snapshot?.documents ?? []).filter(d => d.audience === 'guest').map(d => (
          <p key={d.kind} style={{ fontSize: 14 }}>
            {d.available ? '✓' : '○'} {d.label}
          </p>
        ))}
      </div>
    </>
  );
}
