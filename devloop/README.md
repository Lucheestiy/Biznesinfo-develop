# Devloop

Local-only automation artifacts live under `devloop/` (runs, logs, Codex session ids).

## Files

- `TODO.md` — edit this to steer the AI work.
- `session_id.txt` — last-used Codex thread id (gitignored).
- `session_ids.json` — per-`codex-auth` account Codex thread ids (gitignored).
- `local.env` — optional local env overrides (gitignored), e.g. enable Gemini/Kimi/MiniMax advice.
- `runs/<timestamp>/` — per-run artifacts (gitignored).

## Manual run

From repo root:

- `sudo -u root -H bin/ai-devloop-run`

Or via systemd:

- `systemctl start biznesinfo-develop-ai.service`
- `journalctl -u biznesinfo-develop-ai.service -f`

## Optional advisors (Gemini / Kimi / MiniMax)

Enabled by default. To disable (local-only), create `devloop/local.env`:

```bash
DEVLOOP_AUTO_MERGE_MAIN=1  # 1=auto-merge successful runs into main (default), 0=keep PR-only workflow

DEVLOOP_USE_GEMINI=0
# DEVLOOP_GEMINI_MODEL=gemini-3-pro-preview
# DEVLOOP_GEMINI_FALLBACK_MODEL=gemini-2.5-pro
# DEVLOOP_GEMINI_TIMEOUT_SEC=600
# DEVLOOP_GEMINI_AUTH_PROBE_SEC=5

DEVLOOP_USE_KIMI=0
# If you generally keep Kimi off, but want it to run only when Gemini was
# attempted and failed (e.g., daily quota), enable:
# DEVLOOP_USE_KIMI_FALLBACK=1
# DEVLOOP_KIMI_MODEL=...

DEVLOOP_USE_MINIMAX=0
# DEVLOOP_MINIMAX_MODEL=custom:MiniMax-M2.1
# DEVLOOP_MINIMAX_TIMEOUT_SEC=600

# Include latest triad QA snapshot (latest.usefulness/advice) in Codex prompt:
# DEVLOOP_INCLUDE_TRIAD_SNAPSHOT=1
# DEVLOOP_TRIAD_USEFULNESS_FILE=app/qa/ai-request/reports/latest.usefulness.json
# DEVLOOP_TRIAD_ADVICE_FILE=app/qa/ai-request/reports/latest.advice.json
```
