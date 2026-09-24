/**
 * Compact Hub On Lewis lead/event analysis prompt + job facts.
 * Does not set companion model identity — gpt-oss:20b is already primary on the Hub PC.
 * Advisory only.
 */

export const LOCAL_ADVISORY_ANALYSIS_PROMPT_VERSION = 'hub-advisory-analysis-v3';

/** Short generation caps for local 20b JSON (companion may honor these). */
export const LOCAL_ADVISORY_GENERATION = {
  temperature: 0.2,
  max_tokens: 512,
  num_predict: 512,
} as const;

export const HUB_LEAD_SYSTEM_PROMPT = `You are HuB on Lewis (Wichita) venue sales/ops. Indoor+outdoor events, typical capacity 99, kitchen, tables/chairs, audio. Staff already see the CRM.

Return compact JSON only:
{"summary":"","priority":"high|medium|low","venue_fit":{"assessment":"strong|possible|weak|unknown","reason":""},"known_facts":[],"qualification_signals":[],"missing_information":[],"risks_or_flags":[],"next_action":"","staff_brief":"","confidence":0.0}

Rules:
- Known facts are true. Never list them as missing. Never ask to reconfirm date, guest count, contact, or status when supplied.
- Converted = already linked to an event/opportunity. Next action is ops handoff + complete the event record, not new-lead outreach.
- missing_information = decision-critical gaps only (budget, start/end times, layout/setup, catering/bar, decision deadline, walkthrough preference).
- Do not invent availability. If not in context, write exactly: Availability not included in this analysis context
- next_action: one concrete Hub staff step for THIS stage. Not "reach out to confirm everything."
- Test/demo: mention once in summary. Never emit field "unknown".
- Keep JSON short: summary ≤2 sentences, each array ≤5 items, each string ≤28 words.`;

export type LocalAnalysisJobInput = {
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  knownFacts: string[];
  doNotTreatAsMissing: string[];
  missingCandidates: string[];
  suggestedNextAction: string;
  availabilityIncluded: boolean;
  availabilityInstruction: string;
  isTestRecord: boolean;
  recordSnapshot: Record<string, unknown>;
  temperature: number;
  max_tokens: number;
  num_predict: number;
};

export function wrapAnalysisJobInput(args: {
  systemPrompt: string;
  userPrompt: string;
  knownFacts: string[];
  doNotTreatAsMissing: string[];
  missingCandidates: string[];
  suggestedNextAction: string;
  availabilityIncluded: boolean;
  isTestRecord: boolean;
  recordSnapshot: Record<string, unknown>;
}): LocalAnalysisJobInput {
  const availabilityInstruction = args.availabilityIncluded
    ? 'Use only the availability facts supplied in the user prompt.'
    : 'Availability not included in this analysis context';
  return {
    promptVersion: LOCAL_ADVISORY_ANALYSIS_PROMPT_VERSION,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    knownFacts: args.knownFacts,
    doNotTreatAsMissing: args.doNotTreatAsMissing,
    missingCandidates: args.missingCandidates,
    suggestedNextAction: args.suggestedNextAction,
    availabilityIncluded: args.availabilityIncluded,
    availabilityInstruction,
    isTestRecord: args.isTestRecord,
    recordSnapshot: args.recordSnapshot,
    temperature: LOCAL_ADVISORY_GENERATION.temperature,
    max_tokens: LOCAL_ADVISORY_GENERATION.max_tokens,
    num_predict: LOCAL_ADVISORY_GENERATION.num_predict,
  };
}

export function detectTestRecord(parts: Array<string | null | undefined>): boolean {
  const blob = parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .toLowerCase();
  if (!blob) return false;
  if (/\b(test lead|demo lead|test record|demo record|qa lead|sandbox lead)\b/.test(blob)) return true;
  if (/\b(is[_-]?test|test[_-]?data|demo[_-]?data)\b/.test(blob)) return true;
  return false;
}

export function presentText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    if (lower === 'not captured yet' || lower === 'n/a' || lower === 'none' || lower === 'unknown') return null;
    return t;
  }
  return null;
}

export function presentDate(v: unknown): string | null {
  const t = presentText(v);
  if (!t) return null;
  const iso = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : t;
}

export function interpretLeadStatus(status: string | null, linkedEventId: string | null): string {
  switch (status) {
    case 'New':
      return 'New inquiry. Qualify remaining gaps only; do not re-ask supplied date/guests/contact.';
    case 'Contacted':
      return 'Contacted. Continue discovery (budget, times, walkthrough), not restart intake.';
    case 'Working':
      return 'Working. Prepare proposal-readiness from remaining gaps.';
    case 'Quoted':
      return 'Quoted. Follow proposal/deposit/decision. Do not re-qualify captured basics.';
    case 'Converted':
      return linkedEventId
        ? `Converted — linked event/opportunity ${linkedEventId}. Ops handoff and event completeness, not new-lead qualification.`
        : 'Converted — already an opportunity in CRM. Complete the event record; do not treat as a new lead.';
    case 'Lost':
      return 'Lost/inactive. No new-lead outreach unless notes say reopen.';
    default:
      return status ? `Status ${status}. Reason from that stage.` : 'Status not supplied.';
  }
}
