/**
 * Google Analytics 4 — no-ops when VITE_GA_MEASUREMENT_ID is unset.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env['VITE_GA_MEASUREMENT_ID'] as string | undefined;

let initialized = false;

function isConfigured(): boolean {
  return typeof MEASUREMENT_ID === 'string' && MEASUREMENT_ID.trim().length > 0;
}

export function initAnalytics(): void {
  if (initialized || !isConfigured() || typeof window === 'undefined') return;

  const id = MEASUREMENT_ID!.trim();
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  initialized = true;
}

export function trackPageView(path: string): void {
  if (!isConfigured() || !initialized) return;
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!isConfigured() || !initialized) return;
  window.gtag?.('event', name, params ?? {});
}

export function isAnalyticsConfigured(): boolean {
  return isConfigured();
}
