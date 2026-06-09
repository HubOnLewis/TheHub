# Perfect Venue export (local)

Generated: **2026-05-20T18:02:32.640Z**

This folder contains data extracted from [Perfect Venue](https://app.perfectvenue.com) while you were **logged in with your own account**. Nothing was sent off this machine.

## What was captured

| File | Description |
|------|-------------|
| `events.json` | Table rows, GraphQL-derived objects, and event detail page excerpts (40 records) |
| `tasks.json` | Task-like rows and API payloads (10 records) |
| `calendar.json` | Calendar-like rows and API payloads (190 records) |
| `settings.json` | Settings/inbox visible text, labels, and setting rows |
| `raw-page-text/` | Full visible page text per route |
| `network-captures/` | Filtered JSON/GraphQL responses (1009 files) |
| `event-links.json` | Event/booking URLs discovered for detail visits |
| `pages-index.json` | Routes visited and capture metadata |

## How it was captured

- Playwright **headed** browser (persistent profile: `.playwright-pv-profile/`)
- DOM visible text + tables + virtualized grid scrolling
- Network: JSON/GraphQL only; telemetry/Stripe/Canny/rrweb/analytics ignored

## Limitations

- Structure follows what Perfect Venue renders in the UI; field names may not match The Hub CRM schema.
- Virtualized lists may not include every historical row (scroll passes are finite).
- GraphQL capture depends on which API calls fire per page.
- **Do not commit this folder** — it may contain PII and commercial data.

## Next steps (Hub CRM)

Map `events.json` / GraphQL captures into `packages/web/src/data/demoVenue.ts` or Mongo import scripts manually. Review with Jason/Hannah before production import.
