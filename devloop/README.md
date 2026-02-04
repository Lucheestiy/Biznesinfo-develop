# Devloop

Local-only automation artifacts live under `devloop/` (runs, logs, Codex session ids).

## Files

- `TODO.md` — edit this to steer the AI work.
- `session_id.txt` — last-used Codex thread id (gitignored).
- `session_ids.json` — per-`codex-auth` account Codex thread ids (gitignored).
- `local.env` — optional local env overrides (gitignored), e.g. enable Gemini/Kimi advice.
- `runs/<timestamp>/` — per-run artifacts (gitignored).

## Manual run

From repo root:

- `sudo -u root -H bin/ai-devloop-run`

Or via systemd:

- `systemctl start biznesinfo-develop-ai.service`
- `journalctl -u biznesinfo-develop-ai.service -f`

## Optional advisors (Gemini / Kimi)

To enable (local-only), create `devloop/local.env`:

```bash
DEVLOOP_USE_GEMINI=1
DEVLOOP_GEMINI_MODEL=gemini-2.5-pro

DEVLOOP_USE_KIMI=1
# DEVLOOP_KIMI_MODEL=...
```
