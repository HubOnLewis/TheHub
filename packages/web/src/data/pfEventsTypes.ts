import type { PvEventStatus } from './perfectVenueSeedCore.js';

export interface PfParsedSummary {
  activeEvents: number;
  activeEventsDollars: number;
  lead: number;
  leadDollars: number;
  qualified: number;
  qualifiedDollars: number;
  proposalSent: number;
  proposalSentDollars: number;
  confirmed: number;
  confirmedDollars: number;
  balanceDue: number;
  balanceDueDollars: number;
  completedYtd: number;
  completedYtdDollars: number;
}

export interface PfParsedEvent {
  id: string;
  sourceKey: string;
  title: string;
  contact: string;
  pvStatus: PvEventStatus;
  eventDateIso: string | null;
  eventDateDisplay: string;
  timeRange: string;
  guests: number;
  space: string;
  value: number;
  lastContactedIso: string | null;
  lastContactedDisplay: string;
  createdIso: string | null;
  createdDisplay: string;
  owner: string;
  importNotes?: string;
}

export interface PfImportStatus {
  completeness: 'COMPLETE' | 'PARTIAL' | 'FAILED';
  authoritative: boolean;
  parsedRowCount: number;
  expectedActiveEvents: number;
  mismatchSummary: string | null;
  /** Set by import script — whether UI may use PFevents as sole source. */
  safeToUseAsAuthoritative?: boolean;
}

export interface PfEventsSnapshot {
  importedAt: string;
  sourceFile: string;
  referenceDate: string;
  summary: PfParsedSummary;
  events: PfParsedEvent[];
  importStatus?: PfImportStatus;
}
