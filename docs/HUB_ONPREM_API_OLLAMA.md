# Hub CRM — Always-on on-prem API + Ollama (production topology)

**Decision (locked for always-on model hardware):**

> Run the **Hub API on the Hub LAN** next to Ollama.  
> Expose **only** `https://api.hubonlewis.com` to the internet.  
> Keep Ollama **private**. Users reach AI only through the Hub platform (JWT → `/api/ai/*`).

This is the correct production shape when the Ollama machine is always-on.

---

## Why not keep the API on Render?

| | API on Render + tunnel to Ollama | API on Hub LAN (this doc) |
|--|----------------------------------|---------------------------|
| Reach Ollama | Needs Cloudflare Tunnel / ngrok | Direct LAN / localhost |
| Latency | Cloud → tunnel → LAN → model | LAN only for model |
| Failure modes | Tunnel + PC + Render | PC + network (simpler AI path) |
| Ops | Easy hosting, fragile AI path | You own the always-on host |
| Security | Tunnel is another public surface | Ollama never leaves the building |

With an **always-on** box on Hub LAN, the second column wins.

Web UI can **remain on Render** (static CDN). Only the API needs to sit next to the model.

---

## Target topology

```
                         Internet users
                               │
               ┌───────────────┴───────────────┐
               │                               │
     admin.hubonlewis.com              api.hubonlewis.com
     (Render static web)               (Hub LAN host)
               │                               │
               │         HTTPS + JWT           │
               └──────────────►────────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │  Caddy :443                      │
                              │    → Hub API :3001 (localhost)   │
                              │         ├─ MongoDB Atlas         │
                              │         └─ Ollama :11434 (LAN)   │
                              │              ▲                   │
                              │              │ never public      │
                              └──────────────────────────────────┘
```

**Firewall / router rules**

| Port | Direction | Who |
|------|-----------|-----|
| 443, 80 | Inbound public → always-on host | Internet (Caddy only) |
| 3001 | Localhost / Docker only | Not on router |
| 11434 | LAN or localhost only | Ollama — **never** port-forward |

---

## Recommended hardware layout

### Single always-on box (simplest)

One machine runs:

- Ollama (native install, always-on)
- Docker: Hub API + Caddy

`AI_BASE_URL=http://host.docker.internal:11434/v1` (Windows Docker)  
or `http://172.17.0.1:11434/v1` / host network on Linux.

### Two always-on boxes (scale later)

| Host | Role |
|------|------|
| **api-host** | Caddy + Hub API |
| **ollama-host** | Ollama only (GPU) |

`AI_BASE_URL=http://<ollama-lan-ip>:11434/v1`  
Firewall on ollama-host: 11434 only from api-host IP.

---

## Deploy kit in this repo

| Path | Purpose |
|------|---------|
| [`deploy/onprem/docker-compose.yml`](../deploy/onprem/docker-compose.yml) | API + Caddy |
| [`deploy/onprem/Caddyfile`](../deploy/onprem/Caddyfile) | TLS reverse proxy |
| [`deploy/onprem/.env.example`](../deploy/onprem/.env.example) | Secrets template |
| [`deploy/onprem/README.md`](../deploy/onprem/README.md) | Step-by-step |

---

## Cutover from Render API

1. Stand up on-prem stack; confirm `https://api.hubonlewis.com/health`.
2. Confirm Mongo is the **same** Atlas DB the Render API used (`DB_NAME=hub_crm`).
3. Settings → Integrations → **Probe model PC**.
4. Set web `VITE_API_URL=https://api.hubonlewis.com/api` and **redeploy web**.
5. Smoke: login, Home/Events, Inbox AI draft.
6. Pause or scale down Render **The-Hub-Api** so only one API writes to Mongo.
7. Keep Render API as cold standby if desired (same env secrets, `AI_PROVIDER=none` unless you re-add a tunnel).

**Do not** run two live APIs against the same DB with different JWT secrets.

---

## Interim (optional): tunnel while waiting for DNS/hardware

If DNS or public IP is not ready yet but Ollama is up:

1. Keep API on Render temporarily.
2. Cloudflare Tunnel from the always-on Ollama host → `AI_BASE_URL=https://<tunnel>/v1` on Render.
3. Move to on-prem API when ready; remove the tunnel from the AI path.

See [`HUB_LOCAL_MODEL_LINK.md`](./HUB_LOCAL_MODEL_LINK.md) § tunnel notes.

---

## Security baseline

1. Browser never calls Ollama.
2. No public bind on 11434.
3. Strong `JWT_SECRET` on the API host only.
4. `AI_MODE=draft_only` until human approval workflows are enforced.
5. Prefer Cloudflare proxy in front of `api.hubonlewis.com` for WAF/DDoS.
6. Automatic OS + Docker updates on a maintenance window.
7. UPS on the always-on host.

---

## Success criteria

- [ ] `curl https://api.hubonlewis.com/health` → `status: ok`, `ai.configured: true`
- [ ] Probe succeeds in Settings → Integrations
- [ ] Inbox **AI draft** returns model text
- [ ] Port scan from outside shows **no** 11434 / 3001
- [ ] Web at admin.hubonlewis.com uses the on-prem API with no CORS errors
- [ ] Host reboots cleanly and stack auto-starts

---

## Support map

| Symptom | Check |
|---------|--------|
| Probe fails | Ollama running? `AI_BASE_URL` correct? Firewall? |
| CORS errors | `CORS_ORIGINS` includes exact web origin |
| Empty CRM | `MONGODB_URI` / `DB_NAME` wrong cluster or name |
| Cert errors | DNS A record, ports 80/443 open for Caddy ACME |
| Slow drafts | Model size / GPU; raise `AI_TIMEOUT_MS` |

## Onsite model PC contract (hardware not required yet)
Onsite box talks to Hub API only. Hub talks to a local OpenAI-compatible model only when AI_PROVIDER=local. Production stays AI_PROVIDER=none until the model PC is built. UI says Onsite model offline and must not crash. Roles: assistant, lead generator, accounting manager, booking assistant. Outbound is draft_only / human approve. GET /api/ai/roles works while offline. Do not install Ollama as part of this work.
