import { useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '../store/index.js';
import BrandLoader from './BrandLoader.js';

const MIN_MS = 520;
const MAX_MS = 3200;

type Props = { children: ReactNode };

/**
 * Initial boot veil: wait for auth persist hydration + short branded reveal.
 */
export default function AppBootstrap({ children }: Props) {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  const [minElapsed, setMinElapsed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), MIN_MS);
    const safety = window.setTimeout(() => setHydrated(true), MAX_MS);
    const forceVisible = window.setTimeout(() => setDone(true), MAX_MS + 400);
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(safety);
      window.clearTimeout(forceVisible);
      unsub();
    };
  }, []);

  const ready = hydrated && minElapsed;

  useEffect(() => {
    if (!ready || done) return;
    setExiting(true);
    const t = window.setTimeout(() => setDone(true), 380);
    return () => window.clearTimeout(t);
  }, [ready, done]);

  return (
    <div className="app-bootstrap">
      {!done && <BrandLoader exiting={exiting} />}
      <div className={`app-bootstrap__content${done ? ' app-bootstrap__content--visible' : ''}`}>{children}</div>
    </div>
  );
}
