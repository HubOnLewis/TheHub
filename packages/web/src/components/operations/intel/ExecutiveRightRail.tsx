import { Link } from 'react-router-dom';
import type { ExecutiveRailSection } from '../../../data/operationalIntelligence.js';

type Props = {
  sections: ExecutiveRailSection[];
  className?: string;
};

function MicroSpark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="exec-rail__spark" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="exec-rail__spark-bar" style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

export default function ExecutiveRightRail({ sections, className = '' }: Props) {
  return (
    <aside className={`exec-rail ${className}`.trim()} aria-label="Executive intelligence">
      {sections.map(sec => (
        <section
          key={sec.id}
          className={`exec-rail__block exec-rail__block--${sec.tone ?? 'neutral'}`}
        >
          <header className="exec-rail__head">
            <h3>{sec.title}</h3>
            {sec.live ? (
              <span className="exec-rail__live">
                <span className="ops-pulse" aria-hidden />
                Live
              </span>
            ) : null}
          </header>
          {sec.spark ? <MicroSpark values={sec.spark} /> : null}
          <ul className="exec-rail__list">
            {sec.items.map(item => {
              const inner = (
                <>
                  <span className="exec-rail__label">{item.label}</span>
                  {item.meta ? <span className="exec-rail__meta">{item.meta}</span> : null}
                  {item.progress != null ? (
                    <span className="exec-rail__progress" aria-hidden>
                      <span className="exec-rail__progress-fill" style={{ width: `${item.progress}%` }} />
                    </span>
                  ) : null}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link to={item.href} className="exec-rail__item">
                      {inner}
                    </Link>
                  ) : (
                    <div className="exec-rail__item">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}
