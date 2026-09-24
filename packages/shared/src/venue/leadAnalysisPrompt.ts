import {
  HUB_LEAD_SYSTEM_PROMPT,
  detectTestRecord,
  interpretLeadStatus,
  presentDate,
  presentText,
  wrapAnalysisJobInput,
  type LocalAnalysisJobInput,
} from './localAdvisoryAnalysis.js';

export type LeadAnalysisSource = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function linkedEventId(lead: LeadAnalysisSource): string | null {
  return presentText(lead.convertedDealId) ?? presentText(lead.dealId);
}

function metaOf(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const raw = row?.importMeta;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function assessVenueFit(guestCount: number | null, eventType: string | null): { assessment: string; reason: string } {
  if (guestCount == null && !eventType) {
    return { assessment: 'unknown', reason: 'Guest count and event type are not on the record.' };
  }
  if (guestCount != null && guestCount > 99) {
    return {
      assessment: 'weak',
      reason: `${guestCount} guests exceeds typical 99-guest HuB on Lewis capacity unless overflow is documented.`,
    };
  }
  if (guestCount != null && guestCount >= 10) {
    return {
      assessment: 'strong',
      reason: `${guestCount} guests fits the 99-guest HuB on Lewis capacity${eventType ? ` for a ${eventType}` : ''}.`,
    };
  }
  if (guestCount != null && guestCount > 0) {
    return {
      assessment: 'possible',
      reason: `${guestCount} guests is a small private gathering; confirm layout/timing rather than capacity.`,
    };
  }
  return {
    assessment: 'possible',
    reason: eventType ? `${eventType} can fit; guest count not on record.` : 'Limited event-shape facts.',
  };
}

function suggestedNextAction(args: {
  status: string | null;
  linked: string | null;
  budget: number | null;
  startTime: string | null;
  endTime: string | null;
  availabilityIncluded: boolean;
}): string {
  const avail = args.availabilityIncluded
    ? ''
    : ' Availability not included in this analysis context — check the Hub calendar in CRM before promising a hold.';
  if (args.status === 'Converted') {
    const target = args.linked ? `Open linked event ${args.linked}` : 'Open the linked event/opportunity';
    const gaps: string[] = [];
    if (args.budget == null) gaps.push('budget');
    if (!args.startTime || !args.endTime) gaps.push('start/end times');
    gaps.push('layout', 'catering/bar');
    return `${target} and capture ${gaps.join(', ')} on that record. Do not reconfirm date, guest count, or contact.${avail}`;
  }
  if (args.status === 'Quoted') {
    return `Follow up on the outstanding proposal and deposit decision. Do not re-qualify date or guest count already on the lead.${avail}`;
  }
  if (args.status === 'Working' || args.status === 'Contacted') {
    const gaps: string[] = [];
    if (args.budget == null) gaps.push('budget');
    if (!args.startTime || !args.endTime) gaps.push('desired event times');
    gaps.push('walkthrough');
    return `Continue discovery: get ${gaps.join(', ')}, then schedule walkthrough or draft proposal if the date still looks viable.${avail}`;
  }
  if (args.status === 'Lost') {
    return 'Leave inactive unless notes show a reopen; document loss reason if missing.';
  }
  const gaps: string[] = [];
  if (args.budget == null) gaps.push('budget');
  if (!args.startTime || !args.endTime) gaps.push('desired event times');
  return `First-touch remaining gaps only (${gaps.join(', ') || 'walkthrough preference'}). Do not re-ask facts already listed as known.${avail}`;
}

export function buildLeadAnalysisContext(
  lead: LeadAnalysisSource,
  opts?: { availabilityIncluded?: boolean; linkedEvent?: Record<string, unknown> | null },
) {
  const status = presentText(lead.status);
  const eventType = presentText(lead.eventType);
  const eventDate = presentDate(lead.eventDate) ?? presentDate(lead.preferredDate) ?? presentDate(lead.requestedDate);
  const guestCount = num(lead.guestCount);
  const email = presentText(lead.email);
  const phone = presentText(lead.phone);
  const contact = presentText(lead.contact);
  const company = presentText(lead.company);
  const notes = presentText(lead.notes);
  const source = presentText(lead.source);
  const space = presentText(lead.spacePreference);
  const budget = num(lead.estimatedValue);
  const walkthrough =
    lead.walkthroughRequested === true ? 'requested' : lead.walkthroughRequested === false ? 'not requested' : null;
  const linked = linkedEventId(lead);
  const startTime = presentText(lead.startTime) ?? presentText(lead.desiredStartTime);
  const endTime = presentText(lead.endTime) ?? presentText(lead.desiredEndTime);
  const isTest =
    lead.isTest === true ||
    lead.testRecord === true ||
    detectTestRecord([notes, source, company, contact, presentText(lead.tags)]);

  const linkedEvent = opts?.linkedEvent ?? null;
  const em = metaOf(linkedEvent);
  const linkedTitle = linkedEvent ? presentText(linkedEvent.title) : null;
  const linkedStatus = linkedEvent ? presentText(linkedEvent.status) : null;
  const linkedDate = presentDate(em.eventDateIso) ?? presentDate(em.eventDate);
  const linkedAmount = linkedEvent ? num(linkedEvent.amount) ?? num(em.grandTotal) : null;
  const linkedStart = presentText(em.startTime);
  const linkedEnd = presentText(em.endTime);

  const knownFacts: string[] = [];
  const doNotTreatAsMissing: string[] = [];

  if (eventType) {
    knownFacts.push(`event type: ${eventType}`);
    doNotTreatAsMissing.push('event type', 'event_type');
  }
  if (guestCount != null) {
    knownFacts.push(`guest count: ${guestCount}`);
    doNotTreatAsMissing.push('guest count', 'guest_count', 'confirmation of guest count');
  }
  if (eventDate) {
    knownFacts.push(`requested date: ${eventDate}`);
    doNotTreatAsMissing.push(
      'event date',
      'requested date',
      'preferred date',
      'confirmation of event date',
      'venue availability on requested date',
    );
  }
  if (contact) {
    knownFacts.push(`contact name: ${contact}`);
    doNotTreatAsMissing.push('contact', 'contact confirmation', 'contact name');
  }
  if (email) {
    knownFacts.push(`email: ${email}`);
    doNotTreatAsMissing.push('email', 'contact confirmation');
  }
  if (phone) {
    knownFacts.push(`phone: ${phone}`);
    doNotTreatAsMissing.push('phone', 'contact confirmation');
  }
  if (company) knownFacts.push(`company/account: ${company}`);
  if (status) {
    knownFacts.push(`CRM status: ${status}`);
    doNotTreatAsMissing.push('status', 'lead status');
  }
  if (linked) {
    knownFacts.push(`linked event/opportunity id: ${linked}`);
    doNotTreatAsMissing.push('linked event');
  }
  if (linkedTitle) knownFacts.push(`linked event title: ${linkedTitle}`);
  if (linkedStatus) knownFacts.push(`linked event status: ${linkedStatus}`);
  if (linkedDate) knownFacts.push(`linked event date: ${linkedDate}`);
  if (linkedAmount != null) {
    knownFacts.push(`linked event amount: ${linkedAmount}`);
    doNotTreatAsMissing.push('budget', 'estimated value');
  }
  if (space) knownFacts.push(`space preference: ${space}`);
  if (budget != null) {
    knownFacts.push(`estimated value / budget: ${budget}`);
    doNotTreatAsMissing.push('budget', 'estimated value');
  }
  if (startTime || linkedStart) {
    knownFacts.push(`start time: ${startTime ?? linkedStart}`);
    doNotTreatAsMissing.push('start time');
  }
  if (endTime || linkedEnd) {
    knownFacts.push(`end time: ${endTime ?? linkedEnd}`);
    doNotTreatAsMissing.push('end time');
  }
  if (walkthrough) knownFacts.push(`walkthrough: ${walkthrough}`);
  if (source) knownFacts.push(`source: ${source}`);
  if (isTest) knownFacts.push('record is explicitly a test/demo lead');

  const effectiveBudget = budget ?? linkedAmount;
  const effectiveStart = startTime ?? linkedStart;
  const effectiveEnd = endTime ?? linkedEnd;

  const missingCandidates: string[] = [];
  if (effectiveBudget == null) missingCandidates.push('budget / estimated spend');
  if (!effectiveStart || !effectiveEnd) missingCandidates.push('desired start and end times');
  if (!presentText(lead.layout) && !presentText(lead.setupNeeds) && !presentText(em.layout)) {
    missingCandidates.push('layout / setup needs');
  }
  if (!presentText(lead.cateringBarNeeds) && !presentText(em.cateringBarNeeds)) {
    missingCandidates.push('catering / bar requirements');
  }
  if (!presentText(lead.decisionDeadline)) missingCandidates.push('decision deadline');
  if (walkthrough == null) missingCandidates.push('walkthrough preference');

  const venueFit = assessVenueFit(guestCount, eventType);
  const statusMeaning = interpretLeadStatus(status, linked);
  const availabilityIncluded = opts?.availabilityIncluded === true;
  const nextAction = suggestedNextAction({
    status,
    linked,
    budget: effectiveBudget,
    startTime: effectiveStart,
    endTime: effectiveEnd,
    availabilityIncluded,
  });

  return {
    knownFacts,
    doNotTreatAsMissing: [...new Set(doNotTreatAsMissing)],
    missingCandidates,
    suggestedNextAction: nextAction,
    venueFit,
    statusMeaning,
    isTestRecord: isTest,
    availabilityIncluded,
    snapshot: {
      id: presentText(lead._id) ?? presentText(lead.id),
      status,
      eventType,
      eventDate,
      guestCount,
      contact,
      company,
      source,
      spacePreference: space,
      estimatedValue: budget,
      startTime: effectiveStart,
      endTime: effectiveEnd,
      walkthroughRequested: walkthrough,
      linkedEventId: linked,
      linkedEventTitle: linkedTitle,
      linkedEventStatus: linkedStatus,
      isTestRecord: isTest,
      notes: notes ? notes.slice(0, 400) : null,
    },
  };
}

export function buildLeadAnalysisJobInput(
  lead: LeadAnalysisSource,
  opts?: { availabilityIncluded?: boolean; linkedEvent?: Record<string, unknown> | null },
): LocalAnalysisJobInput {
  const ctx = buildLeadAnalysisContext(lead, opts);
  const availabilityLine = ctx.availabilityIncluded
    ? 'Use only supplied availability facts.'
    : 'Availability not included in this analysis context';

  const userPrompt = `HuB on Lewis lead analysis. JSON only. Copy suggested next_action unless you have a sharper stage-specific step.

STAGE: ${ctx.statusMeaning}
KNOWN: ${ctx.knownFacts.join('; ') || 'none'}
DO NOT MARK MISSING: ${ctx.doNotTreatAsMissing.join(', ')}
GAPS: ${ctx.missingCandidates.join('; ') || 'none'}
VENUE FIT: ${ctx.venueFit.assessment} — ${ctx.venueFit.reason}
AVAILABILITY: ${availabilityLine}
TEST/DEMO: ${ctx.isTestRecord ? 'yes — mention once in summary' : 'no'}
SUGGESTED NEXT ACTION: ${ctx.suggestedNextAction}
SNAPSHOT: ${JSON.stringify(ctx.snapshot)}`;

  return wrapAnalysisJobInput({
    systemPrompt: HUB_LEAD_SYSTEM_PROMPT,
    userPrompt,
    knownFacts: ctx.knownFacts,
    doNotTreatAsMissing: ctx.doNotTreatAsMissing,
    missingCandidates: ctx.missingCandidates,
    suggestedNextAction: ctx.suggestedNextAction,
    availabilityIncluded: ctx.availabilityIncluded,
    isTestRecord: ctx.isTestRecord,
    recordSnapshot: ctx.snapshot,
  });
}
