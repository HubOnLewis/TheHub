import { useEffect } from 'react';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

export default function DemoToastStack() {
  const toasts = useDemoOpsStore(s => s.toasts);
  const dismissToast = useDemoOpsStore(s => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = toasts[0];
    const timer = window.setTimeout(() => dismissToast(t.id), 4200);
    return () => window.clearTimeout(timer);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="demo-toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          className={`demo-toast demo-toast--${t.tone}`}
          onClick={() => dismissToast(t.id)}
        >
          <span className="demo-toast__msg">{t.message}</span>
          <span className="demo-toast__hint">Tap to dismiss</span>
        </button>
      ))}
    </div>
  );
}
