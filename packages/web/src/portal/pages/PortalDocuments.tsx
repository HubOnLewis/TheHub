import { usePortalStore } from '../portalStore.js';
import ProposalSignPanel from '../components/ProposalSignPanel.js';
import GuestStatusTimeline from '../components/GuestStatusTimeline.js';
import { openGuestEventSheet } from '../../venue/documentGenerator.js';

export default function PortalDocuments() {
  const proposal = usePortalStore(s => s.proposal);
  const viewProposal = usePortalStore(s => s.viewProposal);
  const signProposal = usePortalStore(s => s.signProposal);
  const snapshot = usePortalStore(s => s.snapshot);
  const profile = usePortalStore(s => s.profile);

  const printGuestBeo = () => {
    openGuestEventSheet({
      title: profile.title,
      eventDateDisplay: profile.displayDate,
      space: profile.space,
      contact: profile.contactName,
      guests: profile.guests,
      clientDetails: snapshot?.clientDetails ?? {},
    });
  };

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
          Event details are the guest BEO from the same planning fields staff print. Internal staff BEOs stay on the admin event.
        </p>
        {(snapshot?.documents ?? []).filter(d => d.audience === 'guest').map(d => (
          <p key={d.kind} style={{ fontSize: 14 }}>
            {d.available ? '✓' : '○'} {d.label}
            {d.kind === 'beo_guest' ? (
              <>
                {' '}
                <button type="button" className="portal-btn portal-btn--secondary" onClick={printGuestBeo}>
                  Print
                </button>
              </>
            ) : null}
          </p>
        ))}
      </div>
    </>
  );
}
