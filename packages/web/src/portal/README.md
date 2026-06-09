# Client portal (`packages/web/src/portal`)

Dedicated client-facing environment — separate routes, styles, and Zustand store from internal CRM.

## Routes

See `paths.ts` — base `/portal`, demo event `pv-miller-harris` (Miller/Harris Baby Shower).

## Demo entry

- Sidebar **Client portal** (venue team app)
- `/portal/login` → **Open my event**
- Screenshot mode auto-signs in as Kiasia Allen

## Persistence

`localStorage` key: `hub-crm-portal`

## Audit

Portal actions call `logPortalAudit()` → shared `hub-crm-audit-trail` with client attribution.
