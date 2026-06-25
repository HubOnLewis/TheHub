import React, { Suspense } from 'react';

import ReactDOM from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppBootstrap from './components/AppBootstrap.js';

import RootErrorBoundary from './components/RootErrorBoundary.js';

import BrandLoader from './components/BrandLoader.js';

import './index.css';
import { purgeHubContaminatedLocalCache, hubDemoCacheResetConsoleHelp } from './lib/hubLocalCacheCleanup.js';



const App = React.lazy(() => import('./App.js'));



// Apply theme before first paint (default light for client demos)

(() => {
  try {
    purgeHubContaminatedLocalCache();
    hubDemoCacheResetConsoleHelp();
    const raw = localStorage.getItem('hub-crm-auth');
    let theme: 'light' | 'dark' = 'light';
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: string } };
      if (parsed?.state?.theme === 'dark') theme = 'dark';
      else if (parsed?.state?.theme === 'light') theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();



const queryClient = new QueryClient({

  defaultOptions: {

    queries: { retry: 1, staleTime: 30_000 },

  },

});



const rootEl = document.getElementById('root')!;

rootEl.innerHTML = '';



ReactDOM.createRoot(rootEl).render(

  <React.StrictMode>

    <RootErrorBoundary>

      <QueryClientProvider client={queryClient}>

        <AppBootstrap>

          <Suspense fallback={<BrandLoader message="Loading venue workspace…" showStatusRotation />}>

            <App />

          </Suspense>

        </AppBootstrap>

      </QueryClientProvider>

    </RootErrorBoundary>

  </React.StrictMode>,

);


