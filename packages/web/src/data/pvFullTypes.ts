/**
 * Types for Perfect Venue full XLSX export (sanitized for Hub CRM).
 */

import type { PvEventStatus } from './perfectVenueSeedCore.js';

export interface PvFullImportMeta {
  importedAt: string;
  sourceFiles: {
    events: string;
    proposals: string;
    contacts: string;
    payments?: string;
    sales?: string;
  };
  venue: string;
  rowCounts: {
    eventsRaw: number;
    eventsNormalized: number;
    proposalsRaw: number;
    proposalLineItems: number;
    contactsRaw: number;
    contactsNormalized: number;
    accounts: number;
    paymentsRaw?: number;
    paymentsNormalized?: number;
    salesDays?: number;
  };
  joins: {
    eventsWithProposals: number;
    eventsWithContacts: number;
    contactsWithAccounts: number;
    orphanedProposals: number;
    paymentsWithEvents?: number;
    orphanedPayments?: number;
  };
  warnings: string[];
  quality: {
    missingEventDates: number;
    missingContacts: number;
    missingTotals: number;
    duplicateContactEmails: number;
    exampleEventsExcluded: number;
    zeroDollarEvents: number;
    lostArchived?: number;
    completed?: number;
    activePipeline?: number;
    confirmedFuture?: number;
    unmatchedPayments?: number;
  };
  financial?: PvFullFinancialImportTotals;
}

export interface PvFullFinancialImportTotals {
  paymentsCollected: number;
  paymentsFees: number;
  paymentsRefunded: number;
  salesSubtotal: number;
  salesGrandTotal: number;
  salesPaymentsTotal: number;
  eventOutstanding: number;
  eventOutstandingRaw?: number;
  importHealthScore: number;
}

export interface PvFullPayment {
  id: string;
  pvPaymentId: number | string;
  eventId: string | null;
  pvEventId: number | string | null;
  eventName: string;
  invoiceNumber: string;
  eventStatus: string;
  contactName: string;
  eventDateIso: string | null;
  paymentName: string;
  paymentType: 'deposit' | 'balance' | 'other' | 'unknown';
  status: string;
  paidOnIso: string | null;
  scheduledAtIso: string | null;
  amount: number;
  feeAmount: number;
  refundAmount: number;
  refundState: string;
  method: string;
  offlineMethod: string;
  createdOnIso: string | null;
}

export interface PvFullEventFinancial {
  eventId: string;
  pvEventId: number | string;
  invoiceNumber?: string;
  proposalTotal: number;
  collectedTotal?: number;
  collected: number;
  depositPaid?: number;
  depositCollected: number;
  balancePaid?: number;
  balanceCollected: number;
  otherPaid?: number;
  otherCollected: number;
  refundedAmount?: number;
  refunded: number;
  balanceDue: number;
  outstandingBalance?: number;
  netRevenue?: number;
  isPaidInFull?: boolean;
  hasDeposit?: boolean;
  depositCoverageRatio?: number;
  collectionStatus?: string;
  paymentCount: number;
  lastPaidOn: string | null;
  paymentMethods: string[];
  overdue: boolean;
}

export interface PvFullSalesDay {
  date: string;
  venueSpace: number;
  office: number;
  uncategorized: number;
  subtotal: number;
  salesTax: number;
  adminFee: number;
  gratuity: number;
  grandTotal: number;
  creditCardPayments: number;
  achPayments: number;
  offlinePayments: number;
  paymentsTotal: number;
}

export interface PvFullVenueSalesTotals {
  venueSpace: number;
  office: number;
  uncategorized: number;
  subtotal: number;
  salesTax: number;
  adminFee: number;
  gratuity: number;
  grandTotal: number;
  creditCardPayments: number;
  achPayments: number;
  offlinePayments: number;
  paymentsTotal: number;
}

export interface PvFullFinancialSnapshot {
  paymentsCollected: number;
  outstandingExposure: number;
  overdueExposure: number;
  mtdCollected: number;
  mtdGrandTotal: number;
  proposalExposure: number;
  depositDueCount: number;
  avgBookingValue: number;
  conversionRatePct: number;
}

export interface PvFullEventPrivate {
  email?: string;
  phone?: string;
  address?: string;
}

export interface PvFullEvent {
  id: string;
  pvId: number | string;
  title: string;
  client: string;
  account: string;
  pvStatus: PvEventStatus;
  statusRaw: string;
  eventType: string;
  owner: string;
  eventDate: string | null;
  eventDateIso: string | null;
  dayLabel: string;
  startTime: string;
  endTime: string;
  guests: number;
  space: string;
  spaces: string[];
  value: number;
  depositPaid: number;
  balancePaid: number;
  totalPaid: number;
  balanceDue: number;
  proposalSubtotal: number;
  proposalDiscount: number;
  proposalTotal: number;
  source: string;
  origin: string;
  createdOn: string | null;
  confirmedOn: string | null;
  lastContacted: string | null;
  daysOut: number | null;
  lostOn: string | null;
  lostReason: string;
  isExample: boolean;
  isTest: boolean;
  readinessScore: number;
  paymentState: 'clear' | 'deposit_due' | 'balance_due' | 'partial' | 'unknown';
  lifecycleState: string;
  accent: string;
  private?: PvFullEventPrivate;
}

export interface PvFullProposalLine {
  eventId: string;
  pvEventId: number | string;
  itemName: string;
  pricePerUnit: number;
  quantity: number;
  total: number;
  unit: string;
  menuSection: string;
  details: string;
  category: 'room' | 'venue' | 'office' | 'menu' | 'addon' | 'discount' | 'other';
}

export interface PvFullProposalSummary {
  eventId: string;
  lineCount: number;
  subtotal: number;
  discount: number;
  total: number;
  primaryPackage: string;
  menuSections: string[];
  addonCandidates: string[];
  avgPerGuest: number;
  missingDepositRisk: boolean;
  upsellOpportunities: string[];
  revenueConfidence: number;
  lines: PvFullProposalLine[];
}

export interface PvFullContact {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  account: string;
  title: string;
  eventsCount: number;
  totalSpend: number;
  averageSpend: number;
  city: string;
  state: string;
  isRepeat: boolean;
  healthScore: number;
  emailMasked: string;
  phoneMasked: string;
}

export interface PvFullAccount {
  id: string;
  name: string;
  contactIds: string[];
  eventIds: string[];
  totalSpend: number;
  eventCount: number;
  isVip: boolean;
  isDormant: boolean;
  expansionNote?: string;
}

export interface PvFullRelationships {
  eventToContact: Record<string, string>;
  eventToAccount: Record<string, string>;
  contactToEvents: Record<string, string[]>;
  accountToEvents: Record<string, string[]>;
  accountToContacts: Record<string, string[]>;
}

export interface PvFullAccountFinancial {
  accountId: string;
  accountName: string;
  lifetimeCollected: number;
  outstanding: number;
  eventCount: number;
  avgEventValue: number;
  paymentCount: number;
  lastPaidOn: string | null;
}

export interface PvFullOperationalSnapshot {
  venueSummary: {
    activeEvents: number;
    activePipelineDollars: number;
    lead: number;
    qualified: number;
    proposalSent: number;
    confirmed: number;
    balanceDue: number;
    balanceDueDollars: number;
    completedYtd: number;
    completedYtdDollars: number;
    extractedAt: string;
    venue: string;
  };
  occupancyPct: number;
  flagshipEventId: string;
}
