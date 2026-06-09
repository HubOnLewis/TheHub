/**
 * Believable HuB on Lewis event operations timeline — sanitized, no PII.
 */

export type EventTimelineCategory =
  | 'inquiry'
  | 'walkthrough'
  | 'proposal'
  | 'deposit'
  | 'revision'
  | 'coordination'
  | 'automation'
  | 'balance'
  | 'access'
  | 'closeout';

export interface EventTimelineSeedEntry {
  id: string;
  at: string;
  atIso: string;
  category: EventTimelineCategory;
  title: string;
  detail?: string;
  actor: string;
  source: 'system' | 'user' | 'ai';
}

export const MILLER_HARRIS_TIMELINE: EventTimelineSeedEntry[] = [
  {
    id: 'tl-inquiry',
    at: 'Mar 18 · 9:02a',
    atIso: '2026-03-18T14:02:00.000Z',
    category: 'inquiry',
    title: 'Inquiry received',
    detail: 'Baby shower · Event Space · ~30 guests',
    actor: 'Web form',
    source: 'system',
  },
  {
    id: 'tl-walk',
    at: 'Mar 22 · 2:00p',
    atIso: '2026-03-22T19:00:00.000Z',
    category: 'walkthrough',
    title: 'Walkthrough scheduled',
    actor: 'Hannah Bayless',
    source: 'user',
  },
  {
    id: 'tl-proposal',
    at: 'Apr 02 · 6:36p',
    atIso: '2026-04-02T23:36:00.000Z',
    category: 'proposal',
    title: 'Proposal sent',
    detail: 'Shower package · $450',
    actor: 'HuB on Lewis',
    source: 'user',
  },
  {
    id: 'tl-viewed',
    at: 'Apr 08 · 11:14a',
    atIso: '2026-04-08T16:14:00.000Z',
    category: 'proposal',
    title: 'Proposal viewed',
    detail: 'Opened 6× · Follow-Up Hunter flagged',
    actor: 'Follow-Up Hunter',
    source: 'ai',
  },
  {
    id: 'tl-deposit-req',
    at: 'Apr 10 · 9:00a',
    atIso: '2026-04-10T14:00:00.000Z',
    category: 'deposit',
    title: 'Deposit requested',
    actor: 'Balance Guardian',
    source: 'ai',
  },
  {
    id: 'tl-deposit',
    at: 'Apr 12 · 2:18p',
    atIso: '2026-04-12T19:18:00.000Z',
    category: 'deposit',
    title: 'Deposit received',
    detail: '$225 · 50% of package',
    actor: 'Finance',
    source: 'system',
  },
  {
    id: 'tl-floor',
    at: 'Apr 18 · 4:55p',
    atIso: '2026-04-18T21:55:00.000Z',
    category: 'revision',
    title: 'Layout questions noted',
    detail: 'Tables & decor — portal message',
    actor: 'Kiasia Allen',
    source: 'user',
  },
  {
    id: 'tl-kisi-queue',
    at: 'Today · 8:14a',
    atIso: '2026-05-20T13:14:00.000Z',
    category: 'access',
    title: 'Kisi access queued',
    detail: 'Send Kisi Email · Booking Coordinator',
    actor: 'Booking Coordinator',
    source: 'ai',
  },
  {
    id: 'tl-reminder',
    at: 'Today · 9:02a',
    atIso: '2026-05-20T14:02:00.000Z',
    category: 'balance',
    title: 'Final balance reminder drafted',
    actor: 'Balance Guardian',
    source: 'ai',
  },
];

export const CATEGORY_LABELS: Record<EventTimelineCategory, string> = {
  inquiry: 'Inquiry',
  walkthrough: 'Walkthrough',
  proposal: 'Proposal',
  deposit: 'Deposit',
  revision: 'Revision',
  coordination: 'Coordination',
  automation: 'Automation',
  balance: 'Balance',
  access: 'Access',
  closeout: 'Closeout',
};
