/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCREENSHOT_MODE?: string;
  readonly VITE_FEATURE_BOOKINGS?: string;
  readonly VITE_FEATURE_FULFILLMENT?: string;
  readonly VITE_FEATURE_CLOSEOUT?: string;
  readonly VITE_FEATURE_BUILDS?: string;
  readonly VITE_FEATURE_LEGACY_IMPORTS_UI?: string;
  /** Intelligence LLM provider — none default (rules-only) */
  readonly VITE_AI_PROVIDER?: string;
  /** off | draft_only | approval_required | full_assist */
  readonly VITE_AI_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
