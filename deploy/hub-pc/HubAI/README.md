# Hub PC AI Companion

The local AI worker uses outbound HTTPS from the Hub PC to the Hub API. It polls for AI jobs, runs them with local Ollama, and returns advisory results. Normal AI operation does not require an inbound connection to the PC.

## Onsite activation
1. Confirm Ollama is running and gpt-oss:20b is installed.
2. Open PowerShell as Administrator in this folder.
3. Run install.ps1.
4. Edit C:\HubAI\config.json and replace the placeholder token with the matching server-side Hub agent token.
5. Restart the scheduled task named Hub Local AI Companion.
6. Refresh Hub > AI Agents. The node should show Connected within 90 seconds.

Keep the real token only on the Hub PC. Do not commit it. AI output remains advisory and requires human approval.
