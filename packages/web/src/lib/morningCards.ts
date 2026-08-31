/**
 * Staff Home "This morning" ranking — New inquiries is always card #1,
 * including far-dated Draft/inquiry events that must not live only in 90-day details.
 */

export type MorningEventRow = {
  id: string;
  title: string;
  href: string;
  statusLabel?: string | null;
  stage?: string | null;
  proposalStatus?: string | null;
  space?: string | null;
  eventDateIso?: string | null;
  guests?: number | null;
};

export type MorningCard = {
  key: string;
  title: string;
  count: number;
  action: string;
  href: string;
  preview: string;
  urgent?: boolean;
};

const INQUIRY_STATUS = /inquiry|draft|new lead|new inquiry|\blead\b/i;
const PUBLISHED = ['sent', 'viewed', 'accepted', 'declined', 'superseded'];

export function isNewInquiry(row: MorningEventRow): boolean {
  const status = `${row.statusLabel ?? ''} ${row.stage ?? ''}`.trim();
  const proposal = (row.proposalStatus ?? '').toLowerCase();
  if (PUBLISHED.includes(proposal)) return false;
  if (INQUIRY_STATUS.test(status)) return true;
  if (!proposal || proposal === 'draft' || proposal === 'none') {
    if (!status || /lead|new|open|pending/i.test(status)) return true;
  }
  return false;
}

export function selectNewInquiries(rows: MorningEventRow[]): MorningEventRow[] {
  return rows.filter(isNewInquiry);
}

export function buildMorningCards(input: {
  inquiries: MorningEventRow[];
  unsignedProposals: Array<{ eventId: string; eventTitle: string; href?: string }>;
  unpaidDeposits: Array<{ eventId: string; eventTitle: string; href?: string }>;
  unansweredMessages: Array<{ eventId: string; eventTitle: string; preview?: string; href?: string }>;
  missingSpace: MorningEventRow[];
}): MorningCard[] {
  const firstInquiry = input.inquiries[0];
  const cards: MorningCard[] = [
    {
      key: 'new-inquiries',
      title: 'New inquiries',
      count: input.inquiries.length,
      action: 'Open & send proposal',
      href: firstInquiry?.href ?? '/opportunities',
      preview: firstInquiry ? firstInquiry.title : 'None waiting',
      urgent: input.inquiries.length > 0,
    },
    {
      key: 'unsigned',
      title: 'Unsigned proposals',
      count: input.unsignedProposals.length,
      action: 'Follow up to sign',
      href: input.unsignedProposals[0]?.href ?? '/inbox',
      preview: input.unsignedProposals[0]?.eventTitle ?? 'None waiting',
    },
    {
      key: 'unpaid',
      title: 'Unpaid deposits',
      count: input.unpaidDeposits.length,
      action: 'Collect deposit',
      href: input.unpaidDeposits[0]?.href ?? '/inbox',
      preview: input.unpaidDeposits[0]?.eventTitle ?? 'None outstanding',
    },
    {
      key: 'unanswered',
      title: 'Unanswered portal messages',
      count: input.unansweredMessages.length,
      action: 'Reply',
      href: input.unansweredMessages[0]?.href ?? '/inbox',
      preview: input.unansweredMessages[0]?.preview || input.unansweredMessages[0]?.eventTitle || 'All threads have a staff reply',
      urgent: input.unansweredMessages.length > 0,
    },
    {
      key: 'missing-space',
      title: 'This week · missing space',
      count: input.missingSpace.length,
      action: 'Assign room',
      href: input.missingSpace[0]?.href ?? '/calendar',
      preview: input.missingSpace[0]?.title ?? 'All dated events have a room',
      urgent: input.missingSpace.length > 0,
    },
  ];
  return cards;
}

const DO_NOW_ORDER = ['unanswered', 'new-inquiries', 'unpaid', 'missing-space'] as const;
const DO_NOW_ACTION: Record<(typeof DO_NOW_ORDER)[number], string> = {
  unanswered: 'Reply',
  'new-inquiries': 'Send proposal',
  unpaid: 'Collect deposit',
  'missing-space': 'Assign room',
};

/** One ranked next action for Home: Reply → Send proposal → Collect deposit → Assign room. */
export function pickDoThisNow(cards: MorningCard[]): MorningCard | null {
  for (const key of DO_NOW_ORDER) {
    const card = cards.find(c => c.key === key && c.count > 0);
    if (card) return { ...card, action: DO_NOW_ACTION[key] };
  }
  return null;
}
