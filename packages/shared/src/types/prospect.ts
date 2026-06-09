export const PROSPECT_STATUSES = [
  'new',
  'researching',
  'contacted',
  'qualified',
  'converted',
  'not_fit',
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export interface Prospect {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  status: ProspectStatus;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
