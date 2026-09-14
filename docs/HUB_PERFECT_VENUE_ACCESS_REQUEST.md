# Perfect Venue access request

The Hub currently supports local, operator-assisted Perfect Venue extraction and structured XLSX processing. It does not yet have a production Perfect Venue connector or Render sync secret. Before credentials are supplied, confirm which supported access method Perfect Venue provides for the HuB account.

## Preferred order

1. A dedicated read-only API or service token.
2. A supported authenticated report/export delivery mechanism.
3. A dedicated read-only Perfect Venue user only if the first two options are unavailable.

Do not provide an owner password or token in chat, source control, screenshots, or test fixtures.

## Minimum data scope

The integration needs read access only to the records required for Hub operations:

- events/bookings: source event ID, title, lifecycle status, event date/time, assigned space, guest count, event type, owner, notes, created/updated timestamps
- contacts/customers: source contact ID, name, email/phone where authorized, organization, address, created/updated timestamps
- proposals/packages: source proposal ID, event ID, line items, totals, discounts, status, created/updated timestamps
- payments/financial summaries: source payment ID, event ID, amount, status, payment date, method, refund fields, balance fields
- tasks/calendar/inbox only if these are not derivable from the event and proposal reports and are required for the intended production pages

No write, delete, billing-administration, user-administration, or payment-processing permissions are needed.

## Configuration to provide through Render secrets

For an API connector, the owner should provide the vendor-documented names and values for:

- `PV_API_BASE_URL`
- `PV_API_TOKEN` or the vendor's equivalent secret name
- `PV_VENUE_ID` or account/organization identifier, if required
- `PV_SYNC_MODE` and `PV_SYNC_INTERVAL_MINUTES`, if the connector needs explicit scheduling

If Perfect Venue uses OAuth instead of a token, provide the vendor's authorization URL, token URL, client ID, and client secret through Render environment variables. Do not expose any of these values to the browser bundle.

For a structured export path, the required inputs are the official report/export format, delivery location or upload process, report identifiers, and a non-secret venue/account identifier. The current importer accepts Event Data, Contact Data, Proposal Data, Payment Data, sales reports, and matched documents, but it is a manual import pipeline rather than a production scheduler.

## What must be confirmed by the owner

- Which of the three access methods is supported by the Perfect Venue account.
- Whether a read-only service token can be restricted to the HuB venue/account.
- Which reports or API resources contain the minimum data scope above.
- Whether source updates expose a last-modified cursor or timestamp for incremental sync.
- Whether payments and private contact fields are authorized for Hub ingestion.
- The venue/account identifier and timezone.

Once this is confirmed, implement the connector against the documented supported interface, add an idempotent sync job, store source provenance, and add Render-only secrets using the final vendor-approved names.
