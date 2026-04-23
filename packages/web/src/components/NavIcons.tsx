// packages/web/src/components/NavIcons.tsx
import React from 'react';

const S = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const NavIcons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
  ),
  leads: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  deals: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
  ),
  units: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 6V4h8v2M9 14h.01M15 14h.01" /></svg>
  ),
  builds: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" /></svg>
  ),
  production: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
  ),
  delivery: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M1 12h6l2 7 4-14 2 7h6" /></svg>
  ),
  companies: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
  ),
  work: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4M9 11V9a3 3 0 0 1 6 0v2M9 11h6" /></svg>
  ),
  pressure: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
  ),
  forecast: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M3 3v18h18M7 16l4-8 4 5 4-9" /></svg>
  ),
  scorecards: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M8 21h8M12 17v4M6 3h12v11H6zM9 7h.01M12 7h.01M15 7h.01" /></svg>
  ),
  cadence: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
  coverage: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
  ),
  expansion: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M12 5v14M5 12h14M5 5l7 7 7-7M5 19l7-7 7 7" /></svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
  ),
};
