import {
  HUB_LEAD_SYSTEM_PROMPT,
  detectTestRecord,
  presentDate,
  presentText,
  wrapAnalysisJobInput,
  type LocalAnalysisJobInput,
} from './localAdvisoryAnalysis.js';

export type EventAnalysisSource = Record<string, unknown>;

function meta(deal: EventAnalysisSource): Record<string, unknown> {
  const raw = deal.importMeta;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function buildEventAnalysisJobInput(
  deal: EventAnalysisSource,
  opts?: { availabilityIncluded?: boolean },
): LocalAnalysisJobInput {
  const m = meta(deal);
  const title = presentText(deal.title);
  const status = presentText(deal.status);
  const eventDate = presentDate(m.eventDateIso) ?? presentDate(m.eventDate) ?? presentDate(deal.eventDate);
  const guests = num(m.guests) ?? num(deal.guestCount);
  const eventType = presentText(m.eventType) ?? presentText(deal.eventType);
  const space = presentText(m.space) ?? presentText(deal.space);
  const startTime = presentText(m.startTime);
  const endTime = presentText(m.endTime);
  const amount = num(deal.amount) ?? num(m.grandTotal);
  const notes = presentText(deal.notes) ?? presentText(m.inquiryNotes);
  const contact = presentText(deal.contact);
  const company = presentText(deal.company);
  const isTest = detectTestRecord([title, notes, company, contact, presentText(m.source)]);

  const knownFacts: string[] = [];
  const doNotTreatAsMissing: string[] = [];
  if (title) knownFacts.push(`title: ${title}`);
  if (status) {
    knownFacts.push(`status: ${status}`);
    doNotTreatAsMissing.push('status');
  }
  if (eventDate) {
    knownFacts.push(`event date: ${eventDate}`);
    doNotTreatAsMissing.push('event date', 'confirmation of event date', 'venue availability on requested date');
  }
  if (guests != null) {
    knownFacts.push(`guest count: ${guests}`);
    doNotTreatAsMissing.push('guest count', 'confirmation of guest count');
  }
  if (eventType) knownFacts.push(`event type: ${eventType}`);
  if (space) knownFacts.push(`space: ${space}`);
  if (startTime) {
    knownFacts.push(`start time: ${startTime}`);
    doNotTreatAsMissing.push('start time');
  }
  if (endTime) {
    knownFacts.push(`end time: ${endTime}`);
    doNotTreatAsMissing.push('end time');
  }
  if (amount != null) {
    knownFacts.push(`amount: ${amount}`);
    doNotTreatAsMissing.push('budget', 'amount');
  }
  if (contact) {
    knownFacts.push(`contact: ${contact}`);
    doNotTreatAsMissing.push('contact', 'contact confirmation');
  }
  if (company) knownFacts.push(`company: ${company}`);
  if (isTest) knownFacts.push('test/demo event');

  const missingCandidates: string[] = [];
  if (amount == null) missingCandidates.push('budget / contract value');
  if (!startTime || !endTime) missingCandidates.push('start and end times');
  if (!space) missingCandidates.push('assigned space');
  if (!presentText(m.layout)) missingCandidates.push('layout / setup needs');
  if (m.cateringBarNeeds == null) missingCandidates.push('catering / bar requirements');

  const availabilityIncluded = opts?.availabilityIncluded === true;
  const availabilityLine = availabilityIncluded
    ? 'Use only supplied availability facts.'
    : 'Availability not included in this analysis context';
  const suggestedNextAction = `Complete remaining event-ops gaps (${missingCandidates.slice(0, 3).join(', ') || 'none'}). Do not reconfirm known date/guests/contact. ${availabilityLine}`;

  const snapshot = {
    id: presentText(deal._id) ?? presentText(deal.id),
    title,
    status,
    eventDate,
    guests,
    eventType,
    space,
    startTime,
    endTime,
    amount,
    isTestRecord: isTest,
  };

  const userPrompt = `HuB on Lewis event analysis. JSON only.
STAGE: opportunity status ${status ?? 'unknown'} — not a new lead.
KNOWN: ${knownFacts.join('; ') || 'none'}
DO NOT MARK MISSING: ${[...new Set(doNotTreatAsMissing)].join(', ')}
GAPS: ${missingCandidates.join('; ') || 'none'}
AVAILABILITY: ${availabilityLine}
TEST/DEMO: ${isTest ? 'yes — mention once' : 'no'}
SUGGESTED NEXT ACTION: ${suggestedNextAction}
SNAPSHOT: ${JSON.stringify(snapshot)}`;

  return wrapAnalysisJobInput({
    systemPrompt: HUB_LEAD_SYSTEM_PROMPT,
    userPrompt,
    knownFacts,
    doNotTreatAsMissing: [...new Set(doNotTreatAsMissing)],
    missingCandidates,
    suggestedNextAction,
    availabilityIncluded,
    isTestRecord: isTest,
    recordSnapshot: snapshot,
  });
}
