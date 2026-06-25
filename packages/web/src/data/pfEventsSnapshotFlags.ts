/**
 * CLEARED by scripts/reset-hub-tenant-data.mjs — ready for fresh Perfect Venue import.
 * Re-run: npm run import:pfevents -- --apply
 */
import type { PfEventsSnapshot } from './pfEventsTypes.js';

export const PF_EVENTS_SNAPSHOT_AVAILABLE = false;

export const PF_EVENTS_SNAPSHOT: PfEventsSnapshot = {
  "importedAt": "",
  "sourceFile": "",
  "referenceDate": "",
  "summary": {
    "activeEvents": 0,
    "activeEventsDollars": 0,
    "lead": 0,
    "leadDollars": 0,
    "qualified": 0,
    "qualifiedDollars": 0,
    "proposalSent": 0,
    "proposalSentDollars": 0,
    "confirmed": 0,
    "confirmedDollars": 0,
    "balanceDue": 0,
    "balanceDueDollars": 0,
    "completedYtd": 0,
    "completedYtdDollars": 0
  },
  "events": [],
  "importStatus": {
    "completeness": "FAILED",
    "authoritative": false,
    "parsedRowCount": 0,
    "expectedActiveEvents": 0,
    "mismatchSummary": "No PFevents.txt import loaded — ready for fresh Perfect Venue import",
    "safeToUseAsAuthoritative": false
  }
};
