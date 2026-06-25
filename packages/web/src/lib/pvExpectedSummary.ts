/**
 * Perfect Venue home summary targets (HuB on Lewis screenshot reference).
 * Used by import validation and CRM source diagnostics.
 */

export interface PvExpectedSummary {
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

export const PV_EXPECTED_SUMMARY: PvExpectedSummary = {
  activeEvents: 98,
  activeEventsDollars: 32_013,
  lead: 13,
  leadDollars: 0,
  qualified: 16,
  qualifiedDollars: 0,
  proposalSent: 29,
  proposalSentDollars: 16_798,
  confirmed: 40,
  confirmedDollars: 15_215,
  balanceDue: 0,
  balanceDueDollars: 0,
  completedYtd: 53,
  completedYtdDollars: 16_283,
};

export const PV_EXPECTED_SUMMARY_FIELDS: Array<{
  countKey: keyof PvExpectedSummary;
  dollarKey: keyof PvExpectedSummary;
  label: string;
}> = [
  { countKey: 'activeEvents', dollarKey: 'activeEventsDollars', label: 'Active Events' },
  { countKey: 'lead', dollarKey: 'leadDollars', label: 'Lead' },
  { countKey: 'qualified', dollarKey: 'qualifiedDollars', label: 'Qualified' },
  { countKey: 'proposalSent', dollarKey: 'proposalSentDollars', label: 'Proposal Sent' },
  { countKey: 'confirmed', dollarKey: 'confirmedDollars', label: 'Confirmed' },
  { countKey: 'balanceDue', dollarKey: 'balanceDueDollars', label: 'Balance Due' },
  { countKey: 'completedYtd', dollarKey: 'completedYtdDollars', label: 'Completed YTD' },
];
