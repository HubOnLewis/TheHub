/**
 * CLEARED by scripts/reset-hub-tenant-data.mjs — ready for fresh Perfect Venue import.
 * Re-run: npm run import:perfect-venue
 */

import type {
  PvFullImportMeta,
  PvFullEvent,
  PvFullProposalSummary,
  PvFullContact,
  PvFullAccount,
  PvFullRelationships,
  PvFullOperationalSnapshot,
  PvFullPayment,
  PvFullEventFinancial,
  PvFullSalesDay,
  PvFullVenueSalesTotals,
  PvFullFinancialSnapshot,
  PvFullAccountFinancial,
} from './pvFullTypes.js';

export const PV_FULL_IMPORT_META: PvFullImportMeta = {
  "importedAt": "",
  "sourceFiles": {
    "events": "",
    "proposals": "",
    "contacts": ""
  },
  "venue": "HuB on Lewis",
  "rowCounts": {
    "eventsRaw": 0,
    "eventsNormalized": 0,
    "proposalsRaw": 0,
    "proposalLineItems": 0,
    "contactsRaw": 0,
    "contactsNormalized": 0,
    "accounts": 0
  },
  "joins": {
    "eventsWithProposals": 0,
    "eventsWithContacts": 0,
    "contactsWithAccounts": 0,
    "orphanedProposals": 0
  },
  "warnings": [],
  "quality": {
    "missingEventDates": 0,
    "missingContacts": 0,
    "missingTotals": 0,
    "duplicateContactEmails": 0,
    "exampleEventsExcluded": 0,
    "zeroDollarEvents": 0
  }
};

export const FULL_PV_EVENTS: PvFullEvent[] = [];

export const FULL_PV_PROPOSALS: Record<string, PvFullProposalSummary> = {};

export const FULL_PV_CONTACTS: PvFullContact[] = [];

export const FULL_PV_ACCOUNTS: PvFullAccount[] = [];

export const FULL_PV_RELATIONSHIPS: PvFullRelationships = {
  "eventToContact": {},
  "eventToAccount": {},
  "contactToEvents": {},
  "accountToEvents": {},
  "accountToContacts": {}
};

export const FULL_PV_OPERATIONAL_INTELLIGENCE: PvFullOperationalSnapshot = {
  "venueSummary": {
    "activeEvents": 0,
    "activePipelineDollars": 0,
    "lead": 0,
    "qualified": 0,
    "proposalSent": 0,
    "confirmed": 0,
    "balanceDue": 0,
    "balanceDueDollars": 0,
    "completedYtd": 0,
    "completedYtdDollars": 0,
    "extractedAt": "",
    "venue": "HuB on Lewis"
  },
  "occupancyPct": 0,
  "flagshipEventId": ""
};

export const FULL_PV_PAYMENTS: PvFullPayment[] = [];

export const FULL_PV_EVENT_FINANCIALS: Record<string, PvFullEventFinancial> = {};

export const FULL_PV_SALES_DAYS: PvFullSalesDay[] = [];

export const FULL_PV_VENUE_SALES_TOTALS: PvFullVenueSalesTotals | null = null;

export const FULL_PV_FINANCIAL_SNAPSHOT: PvFullFinancialSnapshot = {
  "paymentsCollected": 0,
  "outstandingExposure": 0,
  "overdueExposure": 0,
  "mtdCollected": 0,
  "mtdGrandTotal": 0,
  "proposalExposure": 0,
  "depositDueCount": 0,
  "avgBookingValue": 0,
  "conversionRatePct": 0
};

export const FULL_PV_ACCOUNT_FINANCIALS: PvFullAccountFinancial[] = [];

export const PV_FULL_EXPORT_AVAILABLE = false;
