# September 2026 Perfect Venue import plan

Source of truth for this pass: `import/sept26/`. Do not substitute older exports when a corresponding report exists here.

## Inventory

| Report | Rows | Identity | Hub use |
|---|---:|---|---|
| `events-report-10533.xlsx` | 487 | `ID` | Authoritative event/deal lifecycle, owner, date/time, guests, space, proposal/balance fields |
| `contact-report-10539.xlsx` | 441 | normalized email where present | Contact/customer enrichment; never identify by display name alone |
| `proposal-report-10538.xlsx` | 317 | `Event ID` | Proposal line items and package detail |
| `payment-report-10537.xlsx` | 170 | `Payment ID` | Payment ledger and paid totals; event linkage by `Event ID` |
| `sales-categories-10535.xlsx` | 487 | no stable source ID | Financial cross-check only; cannot override event-ID records |
| `grand_total_goals_2026.csv` | 2 | aggregate venue/month | Reporting goals only; does not create CRM entities |
| `number_of_events_goals_2026.csv` | 2 | aggregate venue/month | Reporting goals only; does not create CRM entities |
| `subtotal_goals_2026.csv` | 2 | aggregate venue/month | Reporting goals only; does not create CRM entities |

The validator reports the exact columns, date ranges, overlap, and reject counts:

```powershell
npm run validate:sept26
```

## Precedence

- Event identity and lifecycle: `events-report-10533.xlsx`, keyed by numeric `ID`.
- Payment transactions and paid totals: `payment-report-10537.xlsx`, keyed by `Payment ID`; matched to events by `Event ID`.
- Proposal lines: `proposal-report-10538.xlsx`, keyed by `Event ID`; orphan proposal rows are rejected from event attachment pending review.
- Contact enrichment: `contact-report-10539.xlsx`, keyed by normalized email where available. Duplicate emails require reconciliation; names alone are not identity.
- `sales-categories` is a cross-check only because it has no stable source ID.
- Goal CSVs are aggregate reporting inputs only.

Source-owned fields may update from Perfect Venue: event status, event dates/times, owner, guest count, spaces, source financials, contact enrichment, proposal lines, and payment records. Hub-owned notes, tasks, interactions, approvals, audit events, and manually assigned workflow fields must not be overwritten by this import.

## Dry-run

```powershell
npm run import:hub-refresh:dry-run -- --root "import\sept26" --tenant hub-wichita
```

The September dry-run currently reports:

- 486 unique event IDs from 487 event rows
- 419 derived contacts in the existing refresh normalizer
- 169 matched payment rows
- 0 unmatched payments
- 0 contamination hits
- 1 blank event ID rejected
- 1 blank proposal Event ID rejected
- 4 proposal Event IDs absent from the event report and held as conflicts
- 30 duplicate event names, proving names are not safe identity
- 12 duplicate contact emails requiring reconciliation

Normalization was run twice with the same input and produced identical event and payment identities: 486 event keys and 169 payment keys, with no duplicate source keys.

The complete no-database entity preview is repeatable with:

```powershell
npm run preview:sept26
```

It reports 309 proposal groups attached to valid events, 5 proposal conflicts (4 orphan Event IDs plus 1 missing Event ID), 404 contacts with unique email, 27 contact rows inside duplicate-email groups, and 10 contacts without email.

## Production apply plan

Do not run this until a separate staging `hub_crm` database has been supplied and the local apply has been verified.

```powershell
$env:MONGODB_URI = '<staging-or-production-hub-crm-uri>'
$env:DB_NAME = 'hub_crm'
npm run import:hub-refresh:apply -- --root "import\sept26" --tenant hub-wichita
```

The script prints only the Mongo host/database target, creates a pre-import backup of the target tenant's deals and payments, and uses deterministic upserts:

- deals: `tenantId + importMeta.sourceKey`, where `sourceKey = pv-refresh:<Perfect Venue event ID>`
- payments: `tenantId + id`, where `id = pay-<Perfect Venue payment ID>`

Stale-record archival is now opt-in via `--archive-stale`; it is disabled by default. The default import does not delete or archive Hub-owned data.

## Current blockers

- No local/staging `hub_crm` Mongo target is available in this workspace. The existing `.env` points to a remote database named `mtte_core`, so it must not be used for this import.
- Contacts are now first-class `contacts` records with tenant-safe `/api/contacts` access. Duplicate-email groups remain explicitly flagged and are not auto-merged.
- Imported proposals now carry deterministic source provenance and line items; the existing proposal lifecycle remains intact.
- Imported Perfect Venue payments remain separate from Hub-generated `payment_links` and are exposed through `/api/financial/payments`.
- These new paths have compile/test coverage but require a real staging database for relationship and API integration verification.
- Production intelligence pages still contain static/demo dependencies and are not made current merely by importing this batch.
- This plan does not authorize a production write. Production execution requires a reviewed staging result, backup confirmation, and post-import API verification.
