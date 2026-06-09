# Hub CRM — SMS / Twilio Foundation

## Purpose

Future-safe SMS layer for HuB on Lewis and licensable venues. **Client review build does not send SMS.**

## Architecture

```
Web UI → API (future) → SmsAdapter interface → TwilioProvider | DemoProvider
```

- Types: `packages/web/src/integrations/sms/types.ts`
- Demo adapter: `packages/web/src/integrations/sms/smsDemoAdapter.ts` (simulate only)
- Settings UI: Venue settings → SMS & Notifications

## Environment (API service — future)

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Account |
| `TWILIO_AUTH_TOKEN` | **Server only** — never in web bundle |
| `TWILIO_MESSAGING_SERVICE_SID` | A2P messaging service |
| `TWILIO_FROM_NUMBER` | Fallback from number |
| `SMS_MODE` | `disabled` \| `dry_run` \| `live` |

When any required var is missing, `SMS_MODE` defaults to `disabled`.

## Keyword triggers

Inbound SMS (or internal `#keyword` in notes/tasks) maps to `SmsKeywordRule`:

- `#tour`, `#deposit`, `#balance`, `#kisi`, `#layout`, `#review`, `#urgent`, `#owner`, `#staff`, `#proposal`

Rules support: recipient type, template, approval required, agent owner, trigger source.

## Compliance

- Opt-in required before customer SMS
- Approval queue for client-facing texts (aligned with Autopilot)
- Audit log: `message_drafted`, `message_queued`, `message_sent_future`

## Backend work (later)

1. `POST /integrations/sms/webhook/inbound` — Twilio signature validation
2. `POST /integrations/sms/send` — approval-gated send
3. Persist `SmsConversation`, `SmsOutboundDraft`, `AuditEvent`
4. Keyword engine worker — match → queue Autopilot approval

## Demo behavior

- Send buttons disabled or label **Simulate queue**
- Provider card shows **Not configured**
- `queueSmsDraft()` returns `status: simulated`
