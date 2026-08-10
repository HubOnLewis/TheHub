/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCREENSHOT_MODE?: string;
  readonly VITE_FEATURE_BOOKINGS?: string;
  readonly VITE_FEATURE_FULFILLMENT?: string;
  readonly VITE_FEATURE_CLOSEOUT?: string;
  readonly VITE_FEATURE_BUILDS?: string;
  readonly VITE_FEATURE_LEGACY_IMPORTS_UI?: string;
  /**
   * Client UI hint only. Real model config lives on the API (AI_* env).
   * Use `api` or `local` to show draft affordances; server status is authoritative.
   */
  readonly VITE_AI_PROVIDER?: string;
  /** off | draft_only | approval_required | full_assist */
  readonly VITE_AI_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
