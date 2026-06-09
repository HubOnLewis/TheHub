import AgreementPanel from '../components/AgreementPanel.js';

export default function PortalDocuments() {
  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 20px' }}>Documents</h1>
      <AgreementPanel />
      <div className="portal-card portal-card--flat" style={{ marginTop: 16 }}>
        <h3>Downloads</h3>
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => window.alert('Proposal PDF — demo')}>
          Proposal PDF
        </button>
        <button type="button" className="portal-btn portal-btn--ghost" style={{ marginLeft: 8 }} onClick={() => window.alert('Insurance requirements — demo')}>
          Policy packet
        </button>
      </div>
    </>
  );
}
