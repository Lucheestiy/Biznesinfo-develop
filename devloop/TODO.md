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
   - ✅ Rate limit, daily quota already exist — make sure the UI displays remaining quota.
   - ✅ Add a visible disclaimer in the assistant UI.
   - ✅ Add basic prompt-injection guardrails in server-side prompt assembly.
   - ✅ Chat UX polish: Enter-to-send + quick prompt chips.
   - ✅ Better B2B system prompt + safer context injection (companyId/companyName + injection-signal note).
   - ✅ Keep basic conversation context (send last N messages as history; trim server-side).
5. Add real model integration (behind env vars; never commit keys):
   - ✅ Optional OpenAI realtime replies (enable with `AI_ASSISTANT_PROVIDER=openai` + `OPENAI_API_KEY`).
   - If the key is missing → keep the stub reply (do not break the site).

## Current focus

1. ✅ Improve the homepage/search UX — polish search result cards (hover lift/shadow + clearer “Подробнее” affordance).
2. ✅ Improve company page layout and blocks — localized “Share” button (native share/copy link + “copied” feedback).
3. ✅ Improve AI assistant chat quality (small steps: better prompts, context, and UX) — mobile menu: sticky bottom actions for Favorites + AI.
4. ✅ Improve AI assistant chat quality — add conversation history + “New chat” reset + context badge on `/assistant`.
5. ✅ Improve AI assistant chat UX — add “Copy answer” action on assistant messages (with “Copied” feedback).
6. ✅ Improve AI assistant chat UX — preserve formatting/newlines in assistant messages (`whitespace-pre-wrap`).
7. ✅ Add admin tooling / reindex UX improvements — add an auth-gated `/admin/reindex` page with a “Run reindex” button and response output.
8. Add admin tooling / reindex UX improvements — show Meilisearch index stats (read-only) on `/admin/reindex`.

## Constraints

- Dev only: `biznesinfo-develop.lucheestiy.com` / host port `8131`.
- Do not touch production (`biznesinfo.lucheestiy.com`).
- Keep changes small and reviewable.
