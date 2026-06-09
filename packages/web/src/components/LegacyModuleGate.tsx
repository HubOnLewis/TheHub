import { HUB_LABELS } from '@hub-crm/shared';
import { EmptyState } from './ui/index.js';
import type { LegacyModuleKey } from '../config/features.js';
import { isLegacyModuleEnabled } from '../config/features.js';

const MESSAGES: Record<LegacyModuleKey, { title: string; sub: string }> = {
  bookings: {
    title: `${HUB_LABELS.bookings} module disabled`,
    sub: 'Enable VITE_FEATURE_BOOKINGS=true in your web environment if your tenant uses booking records (legacy units API).',
  },
  fulfillment: {
    title: `${HUB_LABELS.fulfillment} module disabled`,
    sub: 'Enable VITE_FEATURE_FULFILLMENT=true if your team uses the fulfillment workflow (legacy production API).',
  },
  closeout: {
    title: `${HUB_LABELS.closeout} module disabled`,
    sub: 'Enable VITE_FEATURE_CLOSEOUT=true for client closeout and handoff tools (legacy delivery API).',
  },
  builds: {
    title: `${HUB_LABELS.proposals} workspace disabled`,
    sub: 'Enable VITE_FEATURE_BUILDS=true for structured proposals and economics (legacy builds API).',
  },
  legacyImportsUi: {
    title: 'Legacy import tools',
    sub: 'Reserved for admin UI. Imports are typically run as scripts; enable VITE_FEATURE_LEGACY_IMPORTS_UI when surfaced.',
  },
};

interface Props {
  module: LegacyModuleKey;
  children: React.ReactNode;
}

/** Renders children when the module flag is on; otherwise a neutral placeholder (routes stay registered). */
export default function LegacyModuleGate({ module, children }: Props) {
  if (!isLegacyModuleEnabled(module)) {
    const m = MESSAGES[module];
    return (
      <div style={{ padding: 48 }}>
        <EmptyState message={m.title} sub={m.sub} />
      </div>
    );
  }
  return <>{children}</>;
}
