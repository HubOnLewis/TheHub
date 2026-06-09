# The Hub CRM — migration & technical notes

Internal reference for engineers upgrading from older forks or merged databases. User-facing product identity is **The Hub CRM** / **HuB on Lewis** (see `docs/HUB_CRM_MASTER_CONSTITUTION.md`).

## What was rebranded (user-facing)

- Product name: **The Hub CRM**; workspace packages: `@hub-crm/*`.
- Navigation and copy use **accounts**, **opportunities**, **bookings**, **proposals**, **fulfillment**, **closeout**, **insights**, and **follow-ups** where it maps to older domain language.
- **Route aliases** (e.g. `/accounts` vs `/companies`, `/opportunities` vs `/deals`, `/bookings` vs `/units`, `/fulfillment` vs `/production`, `/closeout` vs `/delivery`, `/proposals` vs `/builds`) preserve bookmarks and integrations.
- **Feature flags** (`VITE_FEATURE_*`) gate legacy-adapted *screens*; production builds default them off unless set; Vite dev defaults them on for local testing. APIs are not removed.

## What remains legacy (internal / compatibility)

- **REST paths and collections** such as `/api/companies`, `/api/deals`, `/api/units`, `/api/builds`, `/api/production`, `/api/delivery` — unchanged to avoid breaking integrations and existing data.
- **MongoDB collection names** and most **field names** (e.g. external reference fields on booking records, deal status strings like `In Build`).
- **Import scripts** may retain historical `source` values for deduplication; treat filenames on disk as **import formats**, not product branding.
- **Legacy entity codes** on old rows may still appear in data; `entityForDisplay()` maps known codes to friendly labels. Prefer **`HUB`** for new HuB on Lewis users.
- **Auth storage migration**: legacy keys may be read once to migrate to `hub-crm-auth` / `hub_crm_token` — intentional for session continuity.

## Why keep legacy routes and models

- **Zero-downtime deploys** and **existing API consumers** continue to work.
- **Data migration** can be phased: UI first, optional schema work later.
- **Risk reduction**: big-bang renames are a common source of production incidents.

## Recommended MongoDB migration path (optional)

1. **Backup** the target cluster.
2. **Align application config**: set `DB_NAME` and `MONGODB_URI` to the same database.
3. **User/entity cleanup**: align legacy entity codes to `HUB` where business rules allow.
4. **Database consolidation** (optional, advanced): dump/restore or Atlas migration; update env; cut over.
5. **Field renames** (only if required): plan dual-read periods and indexes carefully.

## Recommended API route rename strategy (future)

1. Introduce **v2** routes that proxy to existing services.
2. Update the web app to call v2; keep v1 for external clients until deprecated.
3. Document sunset dates.

## Risks before a client demo

- **Wrong `DB_NAME`**: app appears empty — verify `MONGODB_URI` includes the correct database and matches `DB_NAME`.
- **Feature flags**: production build defaults legacy modules off; enable `VITE_FEATURE_*` in the host if the demo needs those UIs.
- **Legacy modules disabled**: direct URLs may show a “module disabled” message — expected until flags are on.
