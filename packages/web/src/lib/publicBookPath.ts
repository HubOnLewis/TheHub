export function isPublicBookPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return pathname === '/book' || pathname.startsWith('/book/');
}
