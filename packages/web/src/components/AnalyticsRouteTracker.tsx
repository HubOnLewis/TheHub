import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView } from '../analytics/index.js';

/** Initializes GA4 once and tracks SPA page views. */
export default function AnalyticsRouteTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(`${pathname}${search}`);
  }, [pathname, search]);

  return null;
}
