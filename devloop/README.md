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

Enabled by default. To disable (local-only), create `devloop/local.env`:

```bash
DEVLOOP_AUTO_MERGE_MAIN=1  # 1=auto-merge successful runs into main (default), 0=keep PR-only workflow

DEVLOOP_USE_GEMINI=0
# DEVLOOP_GEMINI_MODEL=gemini-3-pro-preview
# DEVLOOP_GEMINI_FALLBACK_MODEL=gemini-2.5-pro
# DEVLOOP_GEMINI_TIMEOUT_SEC=600
# DEVLOOP_GEMINI_AUTH_PROBE_SEC=5

DEVLOOP_USE_KIMI=0
# DEVLOOP_KIMI_MODEL=...
```
