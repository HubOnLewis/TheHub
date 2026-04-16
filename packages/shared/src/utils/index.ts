// packages/shared/src/utils/index.ts

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)  return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `${minutes}m ago`;
  const hours   = Math.floor(minutes / 60);
  if (hours   < 24)  return `${hours}h ago`;
  const days    = Math.floor(hours   / 24);
  if (days    < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function statusClass(status: string): string {
  return `badge badge-${status.toLowerCase().replace(/\s+/g, '')}`;
}
