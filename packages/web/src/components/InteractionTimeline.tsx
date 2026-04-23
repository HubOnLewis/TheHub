// packages/web/src/components/InteractionTimeline.tsx
import type { InteractionRow } from '../hooks/useInteractions.js';
import InteractionCard from './InteractionCard.js';

interface Props {
  rows:    InteractionRow[];
  onSelect: (row: InteractionRow) => void;
  empty?:  string;
}

export default function InteractionTimeline({ rows, onSelect, empty = 'No interactions yet.' }: Props) {
  if (!rows.length) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        {empty}
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        paddingLeft: 0,
        borderLeft: '2px solid var(--border)',
        marginLeft: 8,
      }}
    >
      {rows.map(row => (
        <div key={row._id} style={{ position: 'relative', paddingLeft: 14, marginLeft: 4 }}>
          <div
            style={{
              position:   'absolute',
              left:       -6,
              top:        12,
              width:      8,
              height:     8,
              borderRadius: '50%',
              background: 'var(--red)',
              boxShadow:  '0 0 0 2px var(--card-bg, #1a1d24)',
            }}
          />
          <InteractionCard row={row} onOpen={() => onSelect(row)} />
        </div>
      ))}
    </div>
  );
}
