import { getOperationalSourceNote } from '../../lib/operationalSource.js';

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export default function ImportedSourceNote({ className, style }: Props) {
  return (
    <p
      className={`text-sm text-muted imported-source-note${className ? ` ${className}` : ''}`}
      style={style}
    >
      {getOperationalSourceNote()}
    </p>
  );
}