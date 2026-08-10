# Production unlock checklist (Jason / Hannah)

Use this after deploying the booking + portal work so the live site can be exercised end-to-end.

---

## 1) Confirm services

```bash
curl https://api.hubonlewis.com/health
# expect status ok, productMode venue

# Web
# https://admin.hubonlewis.com/login
```

---

## 2) Login (if Invalid credentials)

Render bootstrap **only seeds when the users collection is empty**. If users already exist, passwords are whatever was last set.

### Option A — Render shell (API service)

```bash
# In Render → The-Hub-Api → Shell
export RESET_PASSWORD='ChooseAStrongPassword!'
node scripts/reset-all-user-passwords.mjs --apply --confirm
```

Or for one user:

```bash
export RESET_PASSWORD='ChooseAStrongPassword!'
node scripts/reset-all-user-passwords.mjs --apply --confirm --email jason@hubonlewis.com
```

Login:

| Email | Password |
|-------|----------|
| `jason@hubonlewis.com` | value of `RESET_PASSWORD` |
| `hannah@hubonlewis.com` | same if reset-all |

### Option B — From laptop with Atlas URI

```powershell
$env:TARGET_MONGODB_URI="mongodb+srv://.../hub_crm"
$env:DB_NAME="hub_crm"
$env:RESET_PASSWORD="ChooseAStrongPassword!"
npm run reset:all-passwords:dry-run
npm run reset:all-passwords:apply
```

### Option C — Local Mongo only

```bash
node scripts/seed-admin.mjs
# defaults jason@hubonlewis.com / HubAdmin123! when SEED_* unset
```

---

## 3) Confirm CRM data

After login:

1. Home should show events (live Mongo) or honest empty state  
2. **+ Add Event** → create a test booking  
3. Open event → advance stages  
4. **Client portal** / **Copy portal link** → guest path for *that* event id  

Optional re-import Perfect Venue refresh (ops only):

```bash
npm run import:hub-refresh:audit
# then dry-run / apply with production confirm flags
```

---

## 4) Client portal

| URL | Meaning |
|-----|---------|
| `/portal/login` | Blank code → demo Miller/Harris |
| `/portal/login?event=<dealId>` | Opens portal bound to CRM deal |
| Event detail → **Client portal** | Opens bound link |

Guest can: checklist, pay (demo not charged), messages, guests, design board.

---

## 5) Ollama (always-on host)

On API (on-prem preferred):

```env
AI_PROVIDER=local
AI_MODE=draft_only
AI_BASE_URL=http://host.docker.internal:11434/v1
AI_MODEL=llama3.2
HUB_PRODUCT_MODE=venue
```

See `deploy/onprem/` and `docs/HUB_ONPREM_API_OLLAMA.md`.

Then Settings → Integrations → **Probe model PC**.

---

## 6) Smoke after unlock

```bash
npm run smoke:production
# or manual:
# login → Add Event → open detail → Client portal → Inbox AI draft (if AI configured)
```
