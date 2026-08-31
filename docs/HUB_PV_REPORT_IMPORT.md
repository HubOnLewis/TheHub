# Perfect Venue report import (first-class path)

Hub beats Perfect Venue for daily ops. PV remains the data feed: export reports, drop them in import/, run the refresh pipeline. Hub is the system of record after apply.

Do not commit PV PII exports or processed dumps.

## Export from Perfect Venue Reports
Drop Event Data and Payment Data workbooks plus PDF BEOs/invoices into the numbered import folders (01-events-master through 08-payments).
Space columns accepted: Space, Spaces, Selected Spaces, Room, Venue Space.
## Commands
Use hub-refresh audit, dry-run, validate, then apply from the repo root. Staff payment_links are not overwritten by PV apply.
