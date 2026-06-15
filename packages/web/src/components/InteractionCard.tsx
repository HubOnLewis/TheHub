// packages/web/src/components/InteractionCard.tsx
import type { InteractionType } from '@hub-crm/shared';
import type { InteractionRow } from '../hooks/useInteractions.js';
import { showInteractionAttachments } from '../config/alphaPresentation.js';

const TYPE_ICONS: Record<InteractionType, string> = {
  call: '📞', text: '💬', email: '✉️', meeting: '📅', note: '📝', task: '☑', visit: '🏢',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

interface Props {
  row:     InteractionRow;
  onOpen:  () => void;
}

export default function InteractionCard({ row, onOpen }: Props) {
  const icon  = (TYPE_ICONS as Record<string, string>)[row.type] ?? '•';
  const thumb = showInteractionAttachments() ? row.attachments.find(a => a.type === 'image') : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      style={{
        padding:   '10px 12px',
        textAlign: 'left',
        width:     '100%',
        border:    '1px solid var(--border)',
        cursor:    'pointer',
        background: 'var(--card-bg, #1a1d24)',
        display:   'grid',
        gridTemplateColumns: thumb ? '52px 1fr' : '1fr',
        gap: 10,
        alignItems: 'start',
      }}
    >
      {thumb && (
        <div
          style={{
            width: 52, height: 52, borderRadius: 6, overflow: 'hidden',
            background: 'var(--border)', flexShrink: 0,
          }}
        >
          <img
            src={thumb.url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{row.summary}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{fmtDate(row.createdAt)}</span>
          <span>Owner: {row.ownerName}</span>
          <span className="badge" style={{ fontSize: 10, textTransform: 'capitalize' }}>{row.outcome.replace(/_/g, ' ')}</span>
        </div>
        {row.isOverdue && row.followUpAt && (
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>⏰ Overdue follow-up: {fmtDate(row.followUpAt)}</div>
        )}
        {!row.isOverdue && row.followUpAt && row.status === 'open' && (
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c715', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>
            Follow-up {fmtDate(row.followUpAt)}
          </div>
        )}
      </div>
    </button>
  );
}
