# Biznesinfo Develop

Development deployment of Biznesinfo, isolated from production.

## URLs

- **Dev:** `https://biznesinfo-develop.lucheestiy.com` (via droplet reverse proxy + SSO)
- **Local:** `http://127.0.0.1:8131/`

## Quick start

1. Create `.env` (see `.env.example`).
2. Start stack:
   - `docker compose up -d --build`
3. Check:
   - `curl -fsSI http://127.0.0.1:8131/ | head`

## Dataset

The main dataset file is expected at:

- `app/public/data/biznesinfo/companies.jsonl` (gitignored)

## Rebuild helper

- `./safe_rebuild_biznesinfo_develop.sh`

## AI chat storage

- By default assistant chat history is stored in `DATABASE_URL`.
- To store chat history in a separate DB (for example Show DB), set:
  - `AI_CHATS_DATABASE_URL=postgresql://...`
- In this dev setup, `docker-compose.yml` can use a shared network/database with Show:
  - external network: `showlucheestiycom_default`
  - DSN defaults: `postgresql://show_ai:show_ai_change_me@ai-chats-postgres:5432/show_ai_chats`

## Automation (AI devloop)

This repo is intended to be advanced automatically via a systemd timer that:

- creates a branch,
- runs Codex (pinned to `gpt-5.2` with `model_reasoning_effort="xhigh"`),
- commits + pushes to GitHub,
- rebuilds/restarts the dev stack if the build succeeds,
- sends a Telegram summary.

Edit `devloop/TODO.md` to steer what the AI works on next.
