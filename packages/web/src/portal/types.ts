/** Client portal — future production auth & roles */

export type PortalRole = 'client' | 'co_planner' | 'partner' | 'vendor' | 'coordinator';

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  eventId: string;
}

export type AgreementStatus = 'pending_review' | 'viewed' | 'signed' | 'waiting_venue';

export type PaymentMilestoneStatus = 'paid' | 'due' | 'scheduled' | 'queued';

export interface PortalPaymentMilestone {
  id: string;
  label: string;
  amount: number;
  status: PaymentMilestoneStatus;
  dueDate?: string;
  paidAt?: string;
}

export interface PortalChecklistItem {
  id: string;
  label: string;
  due?: string;
  complete: boolean;
  category: 'documents' | 'payments' | 'guests' | 'logistics' | 'design';
}

export interface PortalTimelineEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  kind: 'payment' | 'document' | 'message' | 'checklist' | 'ai' | 'system';
}

export interface PortalMessage {
  id: string;
  from: string;
  role: 'client' | 'coordinator' | 'ai';
  body: string;
  at: string;
  unread?: boolean;
}

export interface PortalVendorSlot {
  id: string;
  type: string;
  name: string;
  status: 'invited' | 'confirmed' | 'placeholder';
}

export interface PortalConciergeCard {
  id: string;
  headline: string;
  because: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissed?: boolean;
}

export interface PortalEventState {
  agreementStatus: AgreementStatus;
  agreementSignedAt?: string;
  agreementViewedAt?: string;
  guestCount: number;
  guestEstimateLocked: boolean;
  layoutChoice: string;
  checklist: PortalChecklistItem[];
  payments: PortalPaymentMilestone[];
  timeline: PortalTimelineEntry[];
  messages: PortalMessage[];
  vendors: PortalVendorSlot[];
  conciergeCards: PortalConciergeCard[];
  balanceQueuedAt?: string;
}
