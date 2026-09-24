# Hub Development & Delivery Workflow

## Purpose

This repository uses a staged promotion workflow so code can be reviewed, tested, and seen live before it reaches production.

## Environments

### Production
- Branch: `main`
- Web: `The-Hub`
- API: `The-Hub-Api`
- Database: `hub_crm`
- Tenant: `hub-wichita`
- Rule: only release-tested code is promoted here.

### Staging
- Branch: `staging`
- Database: `hub_crm_staging`
- Rule: never point staging at `hub_crm`.
- Staging exists for visual review, integration testing, and client-meeting rehearsal.

## Normal feature flow

1. Create one short-lived branch from `staging`.
2. Make the smallest correct change.
3. Open a PR into `staging`.
4. CI must pass.
5. Merge into `staging`.
6. Render deploys staging.
7. Review the live staging URL as Hannah and Jason when relevant.
8. When staging is accepted, open one release PR from `staging` into `main`.
9. CI must pass again.
10. Merge the release PR.
11. Production deploys automatically.
12. Perform a read-only production smoke check.

## Pull-request previews

For this multi-service app, a safe PR preview must never write to production Mongo.

Preferred future setup on Render:
- Render Preview Environments
- manual generation
- automatic expiration after 3 days
- preview API uses a non-production Mongo database
- preview web talks only to the preview/staging API
- preview AI, email, SMS, and payment integrations remain disabled unless explicitly using sandbox credentials

Render's full Preview Environments require a Pro workspace. Until that is enabled, the permanent staging environment is the release gate.

## Required CI

Every PR to `staging` or `main` runs:
- shared build/tests/typecheck
- API tests/typecheck
- web tests/typecheck
- production web build

A green build proves code consistency. It does not replace visual staging review.

## Branch rules

Keep:
- `main`
- `staging`
- at most one active implementation branch per task

Avoid:
- tool-named long-lived branches
- Windows worktrees
- repo-local node_modules junctions/symlinks
- direct production hotfixes except true emergencies

## Production truth

- MongoDB is the source of truth.
- Production DB is `hub_crm`.
- Staging DB is `hub_crm_staging`.
- Never use `mtte_core`.
- AI is advisory/read-only unless a separately approved feature changes that.
- Email remains stubbed unless explicitly promoted through its own reviewed project.
- Customer exports, backups, secrets, and PII do not belong in Git.

## Release checklist

Before promoting staging to main:
- affected workflows tested live
- navigation verified
- role behavior verified
- mobile sanity checked
- no console-breaking errors
- no fake/demo production data
- database target verified
- rollback commit identified
