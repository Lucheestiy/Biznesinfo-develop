# TODO (AI Devloop)

Edit this file to steer what the AI timer should work on next.

Rule of thumb: pick **ONE** small, safe, reviewable change per run.

## Top priority: AI assistant for registered/premium users

Goal: help paid/partner users use the B2B website (find suppliers, craft outreach text, understand rubrics, etc.).

Suggested milestones (do in order; keep each run small):

1. ✅ Add an `/assistant` page with a minimal chat UI + a navigation entry.
   - Gate it behind auth (must be logged in).
   - For `plan=free`: show upsell + quota info (no chat yet).
   - For `plan=paid|partner`: allow sending messages.
2. ✅ Use the existing `POST /api/ai/request` as the backend for the UI.
   - Make the endpoint return a stub reply for now (until real model integration is wired).
   - Store the request + response in `ai_requests.payload`.
3. ✅ Add a contextual entrypoint:
   - On `/company/[id]`: “Ask AI about this company” → opens assistant with company context prefilled.
4. Add basic safety + limits:
   - Rate limit, daily quota already exist — make sure the UI displays remaining quota.
   - Add a disclaimer + basic prompt-injection guardrails in server-side prompt assembly.
5. Add real model integration (behind env vars; never commit keys):
   - If the key is missing → keep the stub reply (do not break the site).

## Current focus

1. Improve the homepage/search UX — polish search result cards (hover lift/shadow + clearer “Подробнее” affordance).
2. (fill in) Improve company page layout and blocks.
3. (fill in) Add admin tooling / reindex UX improvements.

## Constraints

- Dev only: `biznesinfo-develop.lucheestiy.com` / host port `8131`.
- Do not touch production (`biznesinfo.lucheestiy.com`).
- Keep changes small and reviewable.
