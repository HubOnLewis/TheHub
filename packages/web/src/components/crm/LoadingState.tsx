import { Spinner } from '../ui/index.js';

type Props = {
  message?: string;
};

export default function LoadingState({ message = 'Loading events…' }: Props) {
  return (
    <div className="crm-loading">
      <Spinner />
      <span className="text-muted">{message}</span>
    </div>
  );
}
