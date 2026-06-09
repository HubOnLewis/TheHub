/**
 * SMS / Twilio integration types — future provider adapter surface.
 * No outbound sends in client review without configured credentials.
 */

export type SmsRecipientType = 'customer' | 'owner' | 'employee' | 'team';

export type SmsDeliveryStatus =
  | 'draft'
  | 'queued'
  | 'simulated'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered';

export type SmsTriggerSource =
  | 'inbound_sms'
  | 'internal_note'
  | 'task'
  | 'event_status'
  | 'manual';

export interface SmsMessageTemplate {
  id: string;
  name: string;
  body: string;
  recipientType: SmsRecipientType;
  approvalRequired: boolean;
  enabled: boolean;
}

export interface SmsConversation {
  id: string;
  participantLabel: string;
  recipientType: SmsRecipientType;
  lastMessageAt: string;
  linkedEntityId?: string;
}

export interface SmsOutboundDraft {
  id: string;
  to: string;
  body: string;
  templateId?: string;
  status: SmsDeliveryStatus;
  createdBy: string;
  createdAt: string;
}

export interface SmsInboundMessage {
  id: string;
  from: string;
  body: string;
  receivedAt: string;
  matchedKeyword?: string;
}

export interface SmsKeywordRule {
  id: string;
  keyword: string;
  description: string;
  recipientType: SmsRecipientType;
  templateId: string;
  approvalRequired: boolean;
  enabled: boolean;
  agentOwner: string;
  triggerSource: SmsTriggerSource;
}

export interface SmsTrigger {
  id: string;
  ruleId: string;
  firedAt: string;
  source: SmsTriggerSource;
  payloadSummary: string;
  outcome: 'queued' | 'simulated' | 'blocked_no_config';
}

export interface SmsProviderStatus {
  configured: boolean;
  provider: 'twilio' | 'none';
  messagingServiceSid?: string;
  fromNumberMasked?: string;
  lastHealthCheck?: string;
  mode: 'disabled' | 'dry_run' | 'live';
}
