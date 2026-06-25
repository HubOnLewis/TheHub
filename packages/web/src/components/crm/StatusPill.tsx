import type { PvEventStatus } from '../../data/perfectVenueSeed.js';

const STATUS_CLASS: Record<string, string> = {
  lead: 'crm-status--lead',
  qualified: 'crm-status--qualified',
  proposal_sent: 'crm-status--proposal',
  confirmed: 'crm-status--confirmed',
  balance_due: 'crm-status--balance',
  completed: 'crm-status--completed',
  lost: 'crm-status--lost',
  Draft: 'crm-status--lead',
  'Pending Approval': 'crm-status--qualified',
  Approved: 'crm-status--proposal',
  Won: 'crm-status--confirmed',
  'In Build': 'crm-status--confirmed',
  Delivered: 'crm-status--completed',
  Lost: 'crm-status--lost',
};

type Props = {
  label: string;
  status?: string;
};

export default function StatusPill({ label, status }: Props) {
  const tone = status ? STATUS_CLASS[status] ?? '' : '';
  return <span className={`crm-status-pill ${tone}`.trim()}>{label}</span>;
}

export function statusClassFor(status: string | PvEventStatus): string {
  return STATUS_CLASS[status] ?? '';
}
