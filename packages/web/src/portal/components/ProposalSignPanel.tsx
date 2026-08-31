import { useRef, useState, type PointerEvent } from 'react';
import type { ProposalRecord } from '@hub-crm/shared';
import { formatCurrency } from '@hub-crm/shared';

type Props = {
  proposal: ProposalRecord | null;
  onView: () => Promise<void> | void;
  onSign: (input: { method: 'typed' | 'drawn'; name: string; dataUrl?: string }) => Promise<void> | void;
  busy?: boolean;
};

export default function ProposalSignPanel({ proposal, onView, onSign, busy }: Props) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'typed' | 'drawn'>('typed');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  if (!proposal || proposal.status === 'draft' || proposal.status === 'superseded') {
    return (
      <div className="portal-card portal-card--flat">
        <h3>Proposal</h3>
        <p style={{ fontSize: 14, color: 'var(--portal-muted)' }}>
          Your coordinator will publish a proposal here. Nothing to sign yet.
        </p>
      </div>
    );
  }

  const signed = proposal.status === 'accepted';

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1c1917';
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  };

  return (
    <div className="portal-card portal-card--flat">
      <h3>
        Proposal v{proposal.version}
      </h3>
      <p style={{ fontSize: 14, margin: '0 0 8px' }}>{proposal.title}</p>
      <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
        {formatCurrency(proposal.packageTotal)}
        {proposal.space ? ` · ${proposal.space}` : ''}
        {proposal.eventDate ? ` · ${proposal.eventDate}` : ''}
      </p>
      <p style={{ fontSize: 13, marginTop: 10, whiteSpace: 'pre-wrap' }}>{proposal.terms}</p>
      <p style={{ fontSize: 12, marginTop: 8 }}>
        Status:{' '}
        <strong>
          {signed
            ? `Signed by ${proposal.acceptedBy ?? 'you'}`
            : proposal.status === 'viewed'
              ? 'Viewed — awaiting your signature'
              : 'Ready to review'}
        </strong>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="portal-btn portal-btn--secondary" disabled={busy} onClick={() => void onView()}>
          Mark as viewed
        </button>
      </div>
      {signed ? (
        <div className="portal-peace" style={{ marginTop: 16 }}>
          <strong>Signature on file</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Signed {proposal.acceptedAt ? new Date(proposal.acceptedAt).toLocaleString() : ''}. Staff sees the same
            status on your event.
          </p>
        </div>
      ) : (
        <form
          style={{ marginTop: 16 }}
          onSubmit={e => {
            e.preventDefault();
            const dataUrl = mode === 'drawn' ? canvasRef.current?.toDataURL('image/png') : undefined;
            void onSign({ method: mode, name: name.trim(), dataUrl });
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" className={`portal-btn ${mode === 'typed' ? 'portal-btn--primary' : 'portal-btn--ghost'}`} onClick={() => setMode('typed')}>
              Type
            </button>
            <button type="button" className={`portal-btn ${mode === 'drawn' ? 'portal-btn--primary' : 'portal-btn--ghost'}`} onClick={() => setMode('drawn')}>
              Draw
            </button>
          </div>
          <label className="form-label">Full name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="Type your legal name" />
          {mode === 'drawn' ? (
            <canvas
              ref={canvasRef}
              width={420}
              height={120}
              style={{ width: '100%', marginTop: 10, border: '1px solid var(--portal-border, #e7e5e4)', borderRadius: 8, background: '#fff', touchAction: 'none' }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={() => { drawing.current = false; }}
              onPointerLeave={() => { drawing.current = false; }}
            />
          ) : null}
          <button type="submit" className="portal-btn portal-btn--primary" style={{ marginTop: 12 }} disabled={busy || !name.trim()}>
            Sign agreement
          </button>
          <p style={{ fontSize: 11, color: 'var(--portal-muted)', marginTop: 8 }}>
            Signature is recorded on this event. Payment is separate — no card is charged here.
          </p>
        </form>
      )}
    </div>
  );
}
