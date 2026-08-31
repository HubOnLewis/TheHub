import {
  VENUE_STAGE_LABELS,
  type VenueStage,
} from '@hub-crm/shared';
import type { EventPipelineStage } from '../../lib/eventDetail.js';

const STEPS: VenueStage[] = [
  'inquiry',
  'qualified',
  'proposal',
  'deposit',
  'confirmed',
  'prep',
  'completed',
];

export function pipelineToVenueStage(stage: EventPipelineStage): VenueStage {
  switch (stage) {
    case 'lead':
      return 'inquiry';
    case 'qualified':
      return 'qualified';
    case 'proposal_sent':
      return 'proposal';
    case 'balance_due':
      return 'deposit';
    case 'confirmed':
      return 'confirmed';
    case 'completed':
      return 'completed';
    case 'lost':
      return 'lost';
    default:
      return 'inquiry';
  }
}

type Props = {
  pipelineStage: EventPipelineStage;
};

export default function VenueStageStepper({ pipelineStage }: Props) {
  const current = pipelineToVenueStage(pipelineStage);
  if (current === 'lost') {
    return (
      <div className="venue-stage-stepper venue-stage-stepper--lost" role="status">
        This booking is marked lost.
      </div>
    );
  }

  const idx = STEPS.indexOf(current);

  return (
    <ol className="venue-stage-stepper" aria-label="Booking pipeline">
      {STEPS.map((step, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
        return (
          <li key={step} className={`venue-stage-stepper__item is-${state}`}>
            <span className="venue-stage-stepper__dot" aria-hidden />
            <span className="venue-stage-stepper__label">{VENUE_STAGE_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
