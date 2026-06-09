import type { ReactNode } from 'react';
import ExecutiveRightRail from './ExecutiveRightRail.js';
import type { ExecutiveRailSection } from '../../../data/operationalIntelligence.js';

type Props = {
  hero: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  railSections?: ExecutiveRailSection[];
  rail?: ReactNode;
  footer?: ReactNode;
  stagger?: ReactNode;
};

export default function CommandPageFrame({
  hero,
  filters,
  children,
  railSections,
  rail,
  footer,
  stagger,
}: Props) {
  const railNode = rail ?? (railSections ? <ExecutiveRightRail sections={railSections} /> : null);

  return (
    <div className="command-page venue-ops-page">
      {hero}
      {filters}
      {stagger ? <div className="command-stagger">{stagger}</div> : null}
      <div className={`command-asymmetric${railNode ? ' command-asymmetric--railed' : ''}`}>
        <div className="command-asymmetric__main">{children}</div>
        {railNode ? <div className="command-asymmetric__rail">{railNode}</div> : null}
      </div>
      {footer}
    </div>
  );
}
