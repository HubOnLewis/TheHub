import { Link } from 'react-router-dom';
import { EXECUTIVE_INTEL_LINKS } from '../../data/executiveDemo.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

export default function ExecutiveIntelStrip({
  title = 'Executive intelligence',
  compact = false,
  limit = 4,
}: {
  title?: string;
  compact?: boolean;
  limit?: number;
}) {
  const pending = useDemoOpsStore(s =>
    Object.values(s.approvals).filter(a => a.status === 'pending').length,
  );
  const feedLen = useDemoOpsStore(s => s.activityFeed.length);

  const metrics: Record<string, string> = {
    'owner-briefing': '7:05a digest',
    'revenue-leaks': EXECUTIVE_INTEL_LINKS.find(c => c.id === 'revenue-leaks')?.metric ?? '',
    'automation-impact': EXECUTIVE_INTEL_LINKS.find(c => c.id === 'automation-impact')?.metric ?? '',
  };
  metrics['owner-briefing'] = `${pending} approvals · live`;
  metrics['automation-impact'] = `${feedLen} ops events`;

  const links = EXECUTIVE_INTEL_LINKS.slice(0, limit);

  return (
    <section
      className={`exec-intel-strip command-intel-strip${compact ? ' exec-intel-strip--compact' : ''}`}
      aria-labelledby="exec-intel-strip-heading"
    >
      <div className="exec-intel-strip__head">
        <h2 id="exec-intel-strip-heading" className="exec-intel-strip__title">
          {title}
        </h2>
        {!compact ? (
          <p className="exec-intel-strip__lede">Command modules — counts refresh as you approve and complete work.</p>
        ) : null}
      </div>
      <div className="exec-intel-strip__grid">
        {links.map(card => (
          <Link key={card.id} to={card.route} className={`exec-intel-card exec-intel-card--${card.accent} command-intel-card`}>
            <span className="exec-intel-card__metric">{metrics[card.id] ?? card.metric}</span>
            <span className="exec-intel-card__status" aria-hidden />
            <span className="exec-intel-card__title">{card.title}</span>
            <span className="exec-intel-card__sub">{card.subtitle}</span>
            <span className="exec-intel-card__cta">Open →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
