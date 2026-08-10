# Hub CRM — Link a local model PC (production-ready)

The Hub keeps **rules engines** for operational decisions. The LLM is an optional **draft / language** layer.

## Recommended path (always-on Ollama on Hub LAN)

**Run the Hub API on the Hub LAN next to Ollama.** Do not leave the primary AI path as “Render → tunnel → home PC” long-term.

Full topology + cutover: **[`HUB_ONPREM_API_OLLAMA.md`](./HUB_ONPREM_API_OLLAMA.md)**  
Deploy kit: **`deploy/onprem/`**

```
Browser (admin.hubonlewis.com — anywhere)
    │  JWT
    ▼
Hub API on Hub LAN  (https://api.hubonlewis.com)
    │  OpenAI-compatible chat/completions (private)
    ▼
Ollama always-on on Hub LAN  (not public)
```

The browser **never** calls the model host directly. Keys and `AI_BASE_URL` stay on the API.

---

## Interim path (API still on Render)

Use a Cloudflare Tunnel to Ollama only until the on-prem API host is live. See § “API on Render, model on home/office PC” below.

---

## 1) Model PC setup

### Option A — Ollama (recommended)

```bash
# On the model PC
ollama serve
ollama pull llama3.2
```

Default OpenAI-compatible base:

```
http://127.0.0.1:11434/v1
```

From another machine on the LAN, bind Ollama to all interfaces:

```powershell
# Windows PowerShell (session)
$env:OLLAMA_HOST="0.0.0.0:11434"
ollama serve
```

Allow inbound TCP **11434** in Windows Firewall for your private network.

### Option B — LM Studio

Enable **Local Server** → OpenAI-compatible endpoint (often `http://127.0.0.1:1234/v1`).

---

## 2) Point the Hub API at the model

### Same machine (API + model on one PC)

```env
AI_PROVIDER=local
AI_MODE=draft_only
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=llama3.2
AI_TIMEOUT_MS=90000
HUB_PRODUCT_MODE=venue
```

### API on Render, model on home/office PC

Render **cannot** reach `192.168.x.x`. Expose the model with a tunnel:

**Cloudflare Tunnel (recommended)**

```bash
cloudflared tunnel --url http://127.0.0.1:11434
```

Then set on Render API service:

```env
AI_PROVIDER=local
AI_MODE=draft_only
AI_BASE_URL=https://<your-tunnel-host>/v1
AI_MODEL=llama3.2
AI_API_KEY=ollama
AI_TIMEOUT_MS=120000
```

**ngrok**

```bash
ngrok http 11434
# AI_BASE_URL=https://xxxx.ngrok-free.app/v1
```

Restrict the tunnel if possible (Cloudflare Access, IP allowlist, or a random path secret).

---

## 3) Optional cloud fallback (SpaceXAI / xAI)

```env
AI_PROVIDER=xai
AI_MODE=draft_only
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=grok-4.5
XAI_API_KEY=xai-...
```

---

## 4) Verify

```bash
# API health includes AI config (no secrets)
curl https://api.hubonlewis.com/health

# Authenticated probe (Settings → Integrations → Probe model PC)
# or:
curl -X POST https://api.hubonlewis.com/api/ai/probe \
  -H "Authorization: Bearer <jwt>"
```

In the app: **Settings → Integrations → Local model / AI bridge**.

Live inbox: **AI draft** on activity rows (when mode ≠ off).

---

## 5) API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ai/status` | Config + last probe (`?probe=1` to test) |
| POST | `/api/ai/probe` | Connectivity check (admin/management) |
| POST | `/api/ai/enhance` | Draft/rewrite/summary |
| POST | `/api/ai/chat` | Multi-turn (future rails) |

Rate limits apply. Failures return the original text with `enhanced: false` — CRM data is never blocked by the model being down.

---

## 6) Production checklist

- [ ] `HUB_PRODUCT_MODE=venue` (default) so event stages do not require equipment `unitId`
- [ ] Mongo `DB_NAME` matches URI (`hub_crm`)
- [ ] CORS includes `https://admin.hubonlewis.com`
- [ ] `AI_BASE_URL` reachable from the API host (LAN IP or tunnel)
- [ ] Probe succeeds in Settings
- [ ] AI draft in Inbox produces text
- [ ] Model PC stays powered / sleep disabled during demos

---

## Security notes

- Do not put `AI_BASE_URL` or keys in `VITE_*` env (bundled into the static site).
- Prefer private network or authenticated tunnel over open internet exposure.
- LLM output is **draft-only** unless you change `AI_MODE` and add human approval UX.
