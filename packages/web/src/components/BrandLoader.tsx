import { useEffect, useMemo, useState } from 'react';
import BrandLogo from './BrandLogo.js';

const STATUS_LINES = [
  'Loading event pipeline',
  'Checking today’s operations',
  'Preparing Autopilot',
  'Syncing venue intelligence',
] as const;

const ROTATE_MS = 2200;

type Props = {
  /** Fade-out when parent signals boot complete */
  exiting?: boolean;
  /** Compact overlay for login submit, etc. */
  variant?: 'fullscreen' | 'overlay';
  message?: string;
  showStatusRotation?: boolean;
};

export default function BrandLoader({
  exiting = false,
  variant = 'fullscreen',
  message = 'Preparing venue operations…',
  showStatusRotation = true,
}: Props) {
  const [lineIdx, setLineIdx] = useState(0);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (!showStatusRotation || reducedMotion) return;
    const id = window.setInterval(() => {
      setLineIdx(i => (i + 1) % STATUS_LINES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [showStatusRotation, reducedMotion]);

  const statusLine = STATUS_LINES[lineIdx];

  return (
    <div
      className={`brand-loader brand-loader--${variant}${exiting ? ' brand-loader--exit' : ''}${reducedMotion ? ' brand-loader--reduced' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="brand-loader__backdrop" aria-hidden />
      <div className="brand-loader__stage">
        <div className="brand-loader__glow" aria-hidden />
        <div className="brand-loader__logo-wrap">
          <BrandLogo size="hero" className="brand-loader__logo" />
          <span className="brand-loader__shimmer" aria-hidden />
        </div>
        <p className="brand-loader__message">{message}</p>
        {showStatusRotation ? (
          <p className="brand-loader__status" key={statusLine}>
            {statusLine}
          </p>
        ) : null}
        <div className="brand-loader__progress" aria-hidden>
          <span className="brand-loader__progress-bar" />
        </div>
      </div>
    </div>
  );
}
