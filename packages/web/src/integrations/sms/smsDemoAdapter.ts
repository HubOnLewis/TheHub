/**
 * SMS demo adapter — simulates queue/dry-run only. Never calls Twilio.
 */

import type {
  SmsInboundMessage,
  SmsKeywordRule,
  SmsMessageTemplate,
  SmsOutboundDraft,
  SmsProviderStatus,
  SmsTrigger,
} from './types.js';

export const SMS_PROVIDER_STATUS: SmsProviderStatus = {
  configured: false,
  provider: 'none',
  mode: 'disabled',
  lastHealthCheck: 'Not configured — add TWILIO_* env vars on API service (future)',
};

export const SMS_TEMPLATES: SmsMessageTemplate[] = [
  {
    id: 'tpl-deposit',
    name: 'Deposit reminder',
    body: 'Hi {{name}} — your deposit secures your date at HuB on Lewis. Reply with questions anytime.',
    recipientType: 'customer',
    approvalRequired: true,
    enabled: true,
  },
  {
    id: 'tpl-balance',
    name: 'Final balance reminder',
    body: 'Your event at HuB on Lewis is approaching. Remaining balance is due before load-in per your agreement.',
    recipientType: 'customer',
    approvalRequired: true,
    enabled: true,
  },
  {
    id: 'tpl-review',
    name: 'Review request',
    body: 'Thank you for hosting with HuB on Lewis. If you have a moment, we would appreciate a brief review.',
    recipientType: 'customer',
    approvalRequired: true,
    enabled: true,
  },
  {
    id: 'tpl-owner-alert',
    name: 'Owner day-of alert',
    body: 'Ops alert: {{event}} · {{detail}} — review in Hub CRM Today.',
    recipientType: 'owner',
    approvalRequired: false,
    enabled: true,
  },
];

export const SMS_KEYWORD_RULES: SmsKeywordRule[] = [
  {
    id: 'kw-tour',
    keyword: '#tour',
    description: 'Schedule site visit follow-up',
    recipientType: 'customer',
    templateId: 'tpl-deposit',
    approvalRequired: true,
    enabled: true,
    agentOwner: 'Lead Concierge',
    triggerSource: 'inbound_sms',
  },
  {
    id: 'kw-deposit',
    keyword: '#deposit',
    description: 'Deposit reminder path',
    recipientType: 'customer',
    templateId: 'tpl-deposit',
    approvalRequired: true,
    enabled: true,
    agentOwner: 'Balance Guardian',
    triggerSource: 'event_status',
  },
  {
    id: 'kw-balance',
    keyword: '#balance',
    description: 'Final balance reminder',
    recipientType: 'customer',
    templateId: 'tpl-balance',
    approvalRequired: true,
    enabled: true,
    agentOwner: 'Balance Guardian',
    triggerSource: 'task',
  },
  {
    id: 'kw-kisi',
    keyword: '#kisi',
    description: 'Door access coordination',
    recipientType: 'customer',
    templateId: 'tpl-deposit',
    approvalRequired: true,
    enabled: true,
    agentOwner: 'Booking Coordinator',
    triggerSource: 'task',
  },
  {
    id: 'kw-owner',
    keyword: '#owner',
    description: 'Escalate to owner channel',
    recipientType: 'owner',
    templateId: 'tpl-owner-alert',
    approvalRequired: false,
    enabled: true,
    agentOwner: 'Owner Briefing Agent',
    triggerSource: 'internal_note',
  },
  {
    id: 'kw-urgent',
    keyword: '#urgent',
    description: 'Day-of urgent alert',
    recipientType: 'team',
    templateId: 'tpl-owner-alert',
    approvalRequired: true,
    enabled: true,
    agentOwner: 'Calendar Conflict',
    triggerSource: 'manual',
  },
];

const drafts: SmsOutboundDraft[] = [];

export function isSmsSendAllowed(): boolean {
  return SMS_PROVIDER_STATUS.configured && SMS_PROVIDER_STATUS.mode === 'live';
}

/** Queue outbound — returns simulated draft; never sends. */
export function queueSmsDraft(input: {
  to: string;
  body: string;
  templateId?: string;
  createdBy: string;
}): SmsOutboundDraft {
  const draft: SmsOutboundDraft = {
    id: `sms-${Date.now()}`,
    to: input.to,
    body: input.body,
    templateId: input.templateId,
    status: isSmsSendAllowed() ? 'queued' : 'simulated',
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  drafts.unshift(draft);
  return draft;
}

export function matchInboundKeyword(body: string): SmsKeywordRule | undefined {
  const lower = body.toLowerCase().trim();
  return SMS_KEYWORD_RULES.find(r => r.enabled && lower.includes(r.keyword.toLowerCase()));
}

export function simulateInboundSms(body: string): {
  message: SmsInboundMessage;
  rule?: SmsKeywordRule;
  trigger: SmsTrigger;
} {
  const rule = matchInboundKeyword(body);
  const message: SmsInboundMessage = {
    id: `in-${Date.now()}`,
    from: '+1 (316) 555-0142',
    body,
    receivedAt: new Date().toISOString(),
    matchedKeyword: rule?.keyword,
  };
  const trigger: SmsTrigger = {
    id: `tr-${Date.now()}`,
    ruleId: rule?.id ?? 'none',
    firedAt: new Date().toISOString(),
    source: rule?.triggerSource ?? 'inbound_sms',
    payloadSummary: rule ? `Matched ${rule.keyword} · ${rule.description}` : 'No keyword match',
    outcome: 'blocked_no_config',
  };
  return { message, rule, trigger };
}
