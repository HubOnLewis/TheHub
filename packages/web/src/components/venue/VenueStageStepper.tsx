import {
  DESK_PIPELINE_LABELS,
  DESK_PIPELINE_STEPS,
  deskStepFromVenueStage,
  type VenueStage,
} from '@hub-crm/shared';
import type { EventPipelineStage } from '../../lib/eventDetail.js';

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
  const venue = pipelineToVenueStage(pipelineStage);
  const current = deskStepFromVenueStage(venue);
  if (current === 'lost') {
    return (
      <div className="venue-stage-stepper venue-stage-stepper--lost" role="status">
        This booking did not go forward.
      </div>
    );
  }

  const idx = DESK_PIPELINE_STEPS.indexOf(current);

  return (
    <ol className="venue-stage-stepper" aria-label="Booking steps">
      {DESK_PIPELINE_STEPS.map((step, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
        return (
          <li key={step} className={`venue-stage-stepper__item is-${state}`}>
            <span className="venue-stage-stepper__dot" aria-hidden />
            <span className="venue-stage-stepper__label">{DESK_PIPELINE_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
