# HuB staging environment contract

No safe staging Mongo target currently exists in this workspace. The local `.env` target is an unrelated remote database named `mtte_core` and must not be used for Hub imports.

## Required target

Preferred:

- MongoDB Atlas database: `hub_crm_staging`
- Dedicated staging cluster or an isolated database/user on the Hub-owned cluster
- Database user scoped only to `hub_crm_staging`
- Network access limited to the operator/import runner and Render staging API as needed
- No shared credentials with `mtte_core` or production

The production application contract remains:

- `DB_NAME=hub_crm`
- tenant: `hub-wichita` (with legacy alias `hub-on-lewis` only where explicitly supported)

## Environment variables

Create `.env.staging.local` in the repository root. This file is covered by the repository `.env.*` ignore rule and must never be committed. Do not set these variables globally or in Windows user/system environment settings.

Run the Hub-local commands from the repository root:

```powershell
npm run validate:hub-staging
npm run import:hub-staging
```

The wrapper loads `.env.staging.local` only for its child process, validates the target, and then invokes the existing importer. It does not modify machine-global or user-global environment variables.

Set these only in the staging shell, Render staging service, or approved secret manager. Never commit them:

```text
NODE_ENV=development
MONGODB_URI=<Hub-owned staging Mongo URI whose database is hub_crm_staging>
DB_NAME=hub_crm_staging
JWT_SECRET=<staging-only secret, at least 32 characters>
SUPER_ADMIN_EMAILS=<staging admin emails>
HUB_PRODUCT_MODE=venue
CORS_ORIGINS=http://localhost:5173
```

For a production-shaped staging API, also set the normal API variables from `render.yaml`, but keep all credentials, hostnames, JWT secrets, and seed passwords staging-specific.

## Safety checks before import

1. Parse the URI and assert the host belongs to the Hub-owned Mongo deployment.
2. Assert `DB_NAME=hub_crm_staging`.
3. Refuse any URI containing `mtte_core` or a known unrelated cluster.
4. Assert the authenticated Mongo user has access only to the staging database.
5. Create a collection-level backup before the first write.
6. Run the full preview and require zero unapproved conflict writes.

## Required collections for full normalization

Existing collections:

- `deals` for event/deal records
- `companies` for organization/customer accounts
- `proposals` for proposal lifecycle records
- `payment_links` for Hub-created payment links
- `hub_payments` for the existing imported Perfect Venue payment ledger

Implemented production surfaces in this pass:

- `contacts` for person-level customer records and duplicate/conflict groups, exposed through `/api/contacts`
- proposal line items stored on imported `proposals` records and returned by the existing proposal API
- imported Perfect Venue payment records exposed through `/api/financial/payments`, separate from Hub-generated `/api/payments` links

The staging import still must be executed and verified before production use.
