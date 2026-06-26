import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';

type Props = {
  title?: string;
  explanation?: string;
};

/** Client-friendly recovery when a record cannot be resolved. */
export default function RecordRecoveryState({
  title = 'Lead record unavailable',
  explanation = 'This record is not currently linked to a live CRM item.',
}: Props) {
  return (
    <div className="record-recovery card">
      <div className="record-recovery__icon" aria-hidden />
      <h1 className="record-recovery__title">{title}</h1>
      <p className="record-recovery__text">{explanation}</p>
      <div className="record-recovery__actions">
        <Link to={ROUTES.leads} className="btn btn-primary">
          Back to Leads
        </Link>
        <Link to={ROUTES.opportunities} className="btn btn-secondary">
          Back to Events
        </Link>
      </div>
    </div>
  );
}
