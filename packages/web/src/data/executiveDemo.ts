/**
 * Executive intelligence demo data — HuB on Lewis · Wichita venue scale.
 * Powers Owner Briefing, Revenue Leaks, and Automation Impact (UI-only).
 */

import { ROUTES } from '../config/paths.js';
import { getAgentEngineSnapshot } from '../agents/mockAgentEngine.js';
import { DEMO_KPIS_SEED, DEMO_PIPELINE, DEMO_WEEK_EVENTS } from './demoVenue.js';
import { PV_EXECUTIVE_ANCHORS, PV_VENUE_SUMMARY } from './perfectVenueSeed.js';

const agentSnap = () => getAgentEngineSnapshot();

export const EXEC_OWNER_NAME = 'Jason Lavender';

export const OWNER_BRIEFING_META = {
  generatedAt: 'Today · 7:05a',
  venue: 'HuB on Lewis',
  location: 'Lewis Street · Wichita',
  periodLabel: 'Wednesday, May 20',
};

export const OWNER_OVERNIGHT_AUTOMATION = agentSnap().ownerBriefing.overnightActions.map(o => ({
  id: o.id,
  agent: o.agent,
  action: o.action,
  at: o.at,
  state: o.state,
}));

export const OWNER_BALANCES_ATTENTION = agentSnap().ownerBriefing.balancesAttention;

export const OWNER_TODAY_EVENTS = [
  { id: 'e1', title: 'ICT Investor Lunch · Event Space', time: '11:30a', space: 'Event Space', guests: 85, status: 'Confirmed' },
  { id: 'e2', title: 'Bingo fundraiser · mental health awareness', time: '4:00p', space: 'Event Space', guests: 75, status: 'Confirmed' },
];

export const OWNER_WEEK_EVENTS = DEMO_WEEK_EVENTS.slice(0, 5);

export const OWNER_STAFFING_PRESSURE = {
  openTasks: 9,
  overdueTasks: 0,
  urgentToday: 2,
  coverageGaps: ['Jun 6 Dufferfest load-in · Kisi batch', 'Jun 7 Miller/Harris shower · Event Space flip'],
};

export const OWNER_OCCUPANCY_WEAK = [
  { day: 'Tue May 12', pct: 48, note: 'Wichita AI lunch confirmed · morning gap' },
  { day: 'Thu May 14', pct: 52, note: 'WAREIA session · strong evening' },
  { day: 'Mon May 18', pct: 44, note: 'Proposal hold · May 29 slot' },
];

export const OWNER_STALE_PROPOSALS = PV_EXECUTIVE_ANCHORS.staleProposals.map((s, i) => ({
  id: `s${i + 1}`,
  title: s.title,
  daysOpen: s.days,
  value: s.value,
  lastTouch: 'PV pipeline · proposal stage',
}));

export const OWNER_AI_RECOMMENDATIONS = agentSnap().ownerBriefing.recommendations;

export const OWNER_TOP_OPPORTUNITIES = DEMO_PIPELINE.filter(p => ['proposal', 'qualified'].includes(p.stage)).slice(0, 4);

export const OWNER_TODAYS_FOCUS = {
  headline: agentSnap().ownerBriefing.headline,
  bullets: agentSnap().ownerBriefing.bullets,
};

export const OWNER_OPERATIONAL_INSIGHTS = [
  { id: 'i1', label: 'May occupancy', value: '81%', trend: '↑ vs April · PV calendar', tone: 'positive' as const },
  { id: 'i2', label: 'Proposals out', value: String(PV_VENUE_SUMMARY.proposalSent), trend: formatK(PV_VENUE_SUMMARY.proposalSentDollars), tone: 'warn' as const },
  { id: 'i3', label: 'Completed YTD', value: String(PV_VENUE_SUMMARY.completedYtd), trend: formatK(PV_VENUE_SUMMARY.completedYtdDollars), tone: 'neutral' as const },
  { id: 'i4', label: 'Agent signals (24h)', value: String(agentSnap().signals.length), trend: `${agentSnap().pendingApprovals.length} pending approval`, tone: 'neutral' as const },
];

function formatK(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

/** Revenue Leaks */
export const REVENUE_LEAKS_SUMMARY = {
  recoverableEstimate: 18450,
  recoveredYtd: 6200,
  activePursuits: 11,
  period: 'Last 30 days · HuB on Lewis',
};

export const REVENUE_UNPAID_BALANCES = OWNER_BALANCES_ATTENTION;

export const REVENUE_STALE_LEADS = [
  { id: 'l1', who: 'Mia Temple', org: 'Wedding · Oct 2027', age: '14 days', value: 975, channel: 'Proposal sent' },
  { id: 'l2', who: 'Megan Deppner', org: 'Wedding reception', age: '21 days', value: 975, channel: 'Qualified' },
  { id: 'l3', who: 'Samantha Thompson', org: "Baby's 1st Birthday", age: '30 days', value: 650, channel: 'Qualified' },
];

export const REVENUE_DORMANT_CLIENTS = [
  { id: 'd1', org: 'Jason Lavender · Investor Lunch', lastEvent: 'May 20 session', ltv: 4800, suggestion: 'Recurring ICT lunch · quarterly cadence' },
  { id: 'd2', org: 'Ely Randelas · WAREIA', lastEvent: 'May 14 session', ltv: 3600, suggestion: 'Jun 11 chapter night · deposit reminder' },
  { id: 'd3', org: 'Sherrie Lane · Friendsgiving', lastEvent: 'Nov 2025 event', ltv: 2600, suggestion: 'Repeat seasonal booking outreach' },
];

export const REVENUE_MISSED_ADDONS = PV_EXECUTIVE_ANCHORS.revenueLeads.map((r, i) => ({
  id: `a${i + 1}`,
  event: r.event,
  item: r.note,
  est: r.est,
  reason: 'Perfect Venue proposal / balance path',
}));

export const REVENUE_LOW_WEEKDAYS = OWNER_OCCUPANCY_WEAK;

export const REVENUE_UNDERPERFORMING_CATEGORIES = [
  { category: 'Corporate lunches (Tue–Thu)', vsGoal: '-22%', note: 'River Room underbooked midweek' },
  { category: 'Nonprofit AM meetings', vsGoal: '-14%', note: 'Competing with church halls east side' },
  { category: 'School receptions (May)', vsGoal: '+18%', note: 'Grad season carrying month' },
];

export const REVENUE_AI_RECOVERY_ACTIONS = [
  { id: 'x1', title: 'Villarreal grad balance · Jun 13', impact: '$325', agent: 'Balance Guardian', status: 'queued' as const },
  { id: 'x2', title: 'Miller/Harris deposit follow-up', impact: '$225', agent: 'Follow-Up Hunter', status: 'pending_approval' as const },
  { id: 'x3', title: 'Vaughn Engagement proposal nudge', impact: '$650', agent: 'Lead Concierge', status: 'draft' as const },
  { id: 'x4', title: 'Dufferfest final balance · Jun 6', impact: '$325', agent: 'Balance Guardian', status: 'ready' as const },
];

export const REVENUE_REENGAGEMENT = [
  { id: 'g1', target: 'Ciara Trass · Vaughn Engagement', action: 'Proposal follow-up · Jun 2027 hold', when: 'This week' },
  { id: 'g2', target: 'Yovana Villarreal · Grad Party', action: 'Balance due Jun 1 · signed agreement', when: 'Today' },
  { id: 'g3', target: 'WAREIA · Ely Randelas', action: 'Jun 11 deposit path on recurring series', when: 'Before Jun 4' },
];

export const REVENUE_LEAK_TREND = [8, 9, 11, 10, 14, 12, 18];

/** Automation Impact */
export const AUTOMATION_IMPACT_SUMMARY = {
  hoursSaved30d: 28,
  hoursSavedDelta: '+9%',
  laborCostAvoided: 840,
  workflowsCompleted: 312,
  period: 'Rolling 30 days',
};

export const AUTOMATION_METRICS = [
  { id: 'm1', label: 'Follow-ups automated', value: '86', sub: 'Drafts + scheduled sequences', delta: '+14 vs prior month' },
  { id: 'm2', label: 'Reminders sent', value: '124', sub: 'Deposits, headcount, load-in', delta: '98% on-time' },
  { id: 'm3', label: 'Hours saved (est.)', value: '28h', sub: 'Coordinator + sales admin', delta: '+9%' },
  { id: 'm4', label: 'AI-assisted comms', value: '41', sub: 'Human-approved sends', delta: '0 misfires' },
  { id: 'm5', label: 'Workflows completed', value: '312', sub: 'BEO, compliance, wedding T-30', delta: '+22%' },
  { id: 'm6', label: 'Review requests triggered', value: '18', sub: 'Post-closeout window', delta: '12 published' },
  { id: 'm7', label: 'Missed tasks reduction', value: '-34%', sub: 'vs pre-Autopilot baseline', delta: '3 overdue today' },
  { id: 'm8', label: 'Median response time', value: '2.4h', sub: 'Inquiry → first human touch', delta: '-41 min' },
];

export const AUTOMATION_WORKFLOW_EFFICIENCY = [
  { stage: 'Inquiry → qualified', before: '3.2d', after: '2.1d', pct: 34 },
  { stage: 'Proposal → deposit', before: '8.5d', after: '6.2d', pct: 27 },
  { stage: 'Final balance chase', before: '4.1d', after: '2.8d', pct: 32 },
  { stage: 'Post-event review ask', before: '5.0d', after: '1.2d', pct: 76 },
];

export const AUTOMATION_WEEKLY_ACTIVITY = [12, 15, 14, 18, 16, 21, 23];

export const AUTOMATION_HIGHLIGHTS = agentSnap().recommendations.slice(0, 3).map((r, i) => ({
  id: `h${i + 1}`,
  title: r.headline,
  detail: r.because,
}));

export const EXECUTIVE_INTEL_LINKS = [
  {
    id: 'owner-briefing',
    route: ROUTES.ownerBriefing,
    title: 'Owner briefing',
    subtitle: 'Morning command summary for Jason',
    metric: '7:05a digest',
    accent: 'rose',
  },
  {
    id: 'revenue-leaks',
    route: ROUTES.revenueLeaks,
    title: 'Revenue leaks',
    subtitle: 'Money the venue is leaving on the table',
    metric: `$${(REVENUE_LEAKS_SUMMARY.recoverableEstimate / 1000).toFixed(1)}k recoverable`,
    accent: 'amber',
  },
  {
    id: 'automation-impact',
    route: ROUTES.automationImpact,
    title: 'Automation impact',
    subtitle: 'Labor reduced · workflows completed',
    metric: `${AUTOMATION_IMPACT_SUMMARY.hoursSaved30d}h saved`,
    accent: 'emerald',
  },
] as const;
