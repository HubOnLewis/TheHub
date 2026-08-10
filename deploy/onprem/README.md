# On-prem Hub API + always-on Ollama (Hub LAN)

**Recommended production topology** when the model machine is always-on.

```
Users anywhere
    → https://admin.hubonlewis.com     (web — can stay on Render)
    → https://api.hubonlewis.com       (this host — Caddy + Hub API)
         ├─ MongoDB Atlas
         └─ Ollama on LAN (private, never port-forwarded)
```

Full architecture notes: [`docs/HUB_ONPREM_API_OLLAMA.md`](../../docs/HUB_ONPREM_API_OLLAMA.md)

---

## 1. Prepare the always-on host

- Windows Server / Windows 10–11 Pro / Linux — sleep **disabled**
- Docker Desktop (Windows) or Docker Engine (Linux)
- Ollama installed as a service / always running
- Static LAN IP for this host (or DHCP reservation)

### Ollama

```powershell
# Allow LAN containers / other boxes to reach Ollama
$env:OLLAMA_HOST = "0.0.0.0:11434"
# Prefer installing Ollama as a Windows service and setting OLLAMA_HOST system-wide

ollama pull llama3.2
ollama list
```

Firewall: allow **TCP 11434 only from private network** (or only from Docker subnet).  
**Do not** port-forward 11434 on the router.

Firewall public: allow **TCP 80 and 443** only (for Caddy / Let's Encrypt).

---

## 2. Configure env

```powershell
cd <repo>
copy deploy\onprem\.env.example deploy\onprem\.env
# edit deploy\onprem\.env — MONGODB_URI, JWT_SECRET, AI_BASE_URL, CORS_ORIGINS
```

| Setup | `AI_BASE_URL` |
|-------|----------------|
| Ollama on same Windows host as Docker | `http://host.docker.internal:11434/v1` |
| Ollama on another LAN machine | `http://192.168.x.x:11434/v1` |

---

## 3. DNS

Point **`api.hubonlewis.com`** to this host’s public IP (router port-forward **80/443** → this host only).

Optional: Cloudflare orange-cloud proxy for DDoS / WAF (SSL full/strict once certs work).

---

## 4. Start stack

From **repo root**:

```powershell
docker compose -f deploy/onprem/docker-compose.yml --env-file deploy/onprem/.env up -d --build
docker compose -f deploy/onprem/docker-compose.yml ps
curl http://127.0.0.1:3001/health
```

Public check (after DNS + 80/443):

```powershell
curl https://api.hubonlewis.com/health
```

Expect JSON including `"ai": { "provider": "local", "configured": true, ... }`.

---

## 5. Point the web app at this API

On Render **The-Hub** (static web) set:

```
VITE_API_URL=https://api.hubonlewis.com/api
```

Redeploy the **web** service so the URL is baked into the bundle.

CORS on this API must include the web origin:

```
CORS_ORIGINS=https://admin.hubonlewis.com,...
```

---

## 6. Verify AI path

1. Login at admin.hubonlewis.com  
2. **Settings → Integrations → Local model / AI bridge → Probe model PC**  
3. **Inbox → AI draft** on a live activity row  

---

## 7. Ops checklist (always-on)

- [ ] Host sleep / hibernate disabled  
- [ ] Docker set to start on login / boot  
- [ ] Ollama starts on boot (`OLLAMA_HOST` persisted)  
- [ ] Router only forwards 80/443 (not 3001, not 11434)  
- [ ] UPS recommended for venue power events  
- [ ] Disk space for model weights + Docker volumes  
- [ ] Mongo Atlas network access allows this host egress IP  

---

## Stop / update

```powershell
docker compose -f deploy/onprem/docker-compose.yml --env-file deploy/onprem/.env pull
docker compose -f deploy/onprem/docker-compose.yml --env-file deploy/onprem/.env up -d --build
```

---

## Rollback

If on-prem API fails, temporarily repoint web `VITE_API_URL` back to the Render API and set Render `AI_PROVIDER=none` (or tunnel) until the host is healthy. CRM data in Atlas is independent of which API process is running — use **one** active API writer at a time.
