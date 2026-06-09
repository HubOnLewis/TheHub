import { computeReadiness } from '../readiness.js';
import { usePortalStore } from '../portalStore.js';

export default function ReadinessScore({ compact = false }: { compact?: boolean }) {
  const event = usePortalStore(s => s.event);
  const r = computeReadiness(event);

  if (compact) {
    return (
      <div className="portal-readiness" style={{ marginBottom: 0 }}>
        <div className="portal-readiness__ring" style={{ ['--pct' as string]: r.score, width: 64, height: 64 }}>
          <span style={{ width: 50, height: 50, fontSize: 16 }}>{r.score}</span>
        </div>
        <div>
          <strong>{r.label}</strong>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--portal-muted)' }}>Event readiness</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-readiness">
      <div className="portal-readiness__ring" style={{ ['--pct' as string]: r.score }}>
        <span>{r.score}</span>
      </div>
      <div>
        <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--portal-display)', fontSize: 18 }}>{r.label}</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--portal-muted)' }}>Event readiness score</p>
        {r.risks.length > 0 ? (
          <ul className="portal-risk" style={{ paddingLeft: 16, margin: '8px 0 0' }}>
            {r.risks.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
