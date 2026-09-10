/**
 * Portal nested routing regression — proves `/portal/login` matches under
 * `/portal/*` when `v7_relativeSplatPath` is enabled (production App.tsx flag).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Navigate, Route, Routes, matchPath, matchRoutes, type RouteObject } from 'react-router-dom';
import { PORTAL_ROUTES } from './paths.js';
import { PORTAL_NESTED, portalPublicUrl } from './portalNestedPaths.js';

const RR_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderAt(path: string, portalChildren: ReactNode): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path], future: RR_FUTURE },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/login', element: createElement('div', null, 'Staff sign in') }),
        createElement(Route, { path: '/book', element: createElement('div', null, 'Book your event') }),
        createElement(Route, {
          path: '/portal',
          element: createElement(Navigate, { to: '/portal/login', replace: true }),
        }),
        createElement(Route, { path: '/portal/*', element: portalChildren }),
        createElement(Route, {
          path: '/*',
          element: createElement('div', null, 'CRM shell'),
        }),
      ),
    ),
  );
}

/** Broken pattern that shipped on production (absolute nested path). */
function BrokenPortalRoutes() {
  return createElement(
    Routes,
    null,
    createElement(Route, {
      path: '/portal/login',
      element: createElement('div', null, 'Your event portal'),
    }),
    createElement(Route, {
      path: '*',
      element: createElement(Navigate, { to: '/portal/login', replace: true }),
    }),
  );
}

/** Fixed pattern — relative nested path under `/portal/*`. */
function FixedPortalRoutes() {
  return createElement(
    Routes,
    null,
    createElement(Route, {
      path: PORTAL_NESTED.login,
      element: createElement('div', null, 'Your event portal'),
    }),
    createElement(Route, {
      index: true,
      element: createElement(Navigate, { to: PORTAL_ROUTES.login, replace: true }),
    }),
    createElement(Route, {
      path: '*',
      element: createElement(Navigate, { to: PORTAL_ROUTES.login, replace: true }),
    }),
  );
}

test('public portal URL contract stays /portal/login', () => {
  assert.equal(PORTAL_ROUTES.login, '/portal/login');
  assert.equal(portalPublicUrl(PORTAL_NESTED.login), '/portal/login');
  assert.equal(
    portalPublicUrl(PORTAL_NESTED.login, 'access=TEST'),
    '/portal/login?access=TEST',
  );
});

test('nested login path is relative (not absolute /portal/login)', () => {
  assert.equal(PORTAL_NESTED.login, 'login');
  assert.ok(!PORTAL_NESTED.login.startsWith('/'));
  for (const value of Object.values(PORTAL_NESTED)) {
    assert.ok(!value.startsWith('/'), `nested path must be relative: ${value}`);
  }
});

test('broken absolute nested path yields empty portal shell (regression of live bug)', () => {
  const html = renderAt('/portal/login', createElement(BrokenPortalRoutes));
  assert.equal(html.includes('Your event portal'), false);
});

test('fixed relative nested path renders portal login at /portal/login', () => {
  const html = renderAt('/portal/login', createElement(FixedPortalRoutes));
  assert.ok(html.includes('Your event portal'));
});

test('fixed relative nested path keeps access query on /portal/login', () => {
  const html = renderAt('/portal/login?access=TEST', createElement(FixedPortalRoutes));
  assert.ok(html.includes('Your event portal'));
});

test('matchRoutes resolves /portal/login to nested login with relative splat tree', () => {
  const routes: RouteObject[] = [
    {
      path: '/portal',
      children: [
        {
          path: '*',
          children: [
            { path: 'login', id: 'portal-login' },
            { index: true, id: 'portal-index' },
            { path: 'dashboard', id: 'portal-dashboard' },
            { path: '*', id: 'portal-fallback' },
          ],
        },
      ],
    },
  ];

  const matched = matchRoutes(routes, '/portal/login');
  assert.ok(matched, 'expected /portal/login to match');
  assert.equal(matched[matched.length - 1]?.route.id, 'portal-login');
});

test('staff /login and /book still resolve and are not portal URLs', () => {
  assert.notEqual('/login', PORTAL_ROUTES.login);
  const staff = renderAt('/login', createElement(FixedPortalRoutes));
  const book = renderAt('/book', createElement(FixedPortalRoutes));
  assert.ok(staff.includes('Staff sign in'));
  assert.ok(book.includes('Book your event'));
  assert.equal(matchPath({ path: '/portal/login', end: true }, '/login'), null);
});

test('unknown portal child does not crash fixed tree', () => {
  const html = renderAt('/portal/not-a-real-page', createElement(FixedPortalRoutes));
  // Fallback Navigate to login — SSR may show empty or login depending on Navigate handling
  assert.equal(typeof html, 'string');
});

test('CRM shell still matches authenticated catch-all', () => {
  const html = renderAt('/dashboard', createElement(FixedPortalRoutes));
  assert.ok(html.includes('CRM shell'));
});
