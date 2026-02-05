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

See the roadmap: `devloop/AI_ASSISTANT_PLAN.md`

Rule of thumb: pick **ONE** small, safe, reviewable change per run.

Recently completed:

1. ✅ Inject safe company facts into the assistant prompt when `companyId` is provided (server-side fetch + whitelist + truncation).
2. ✅ Linkify assistant answers safely (URLs/emails/phones + internal `/company/...` & `/catalog/...`) — no HTML injection.
3. ✅ Add outreach export helpers: “Copy as Email” (subject+body) + “Copy as WhatsApp”.
4. ✅ Make suggestion chips context-aware (company context → outreach/questions/follow-up/alternatives).
5. ✅ Improve assistant system prompt for outreach: when drafting messages, output explicit blocks (Subject/Body/WhatsApp).
6. ✅ Add an “RFQ builder” mini-form (product/service, qty, city/region, deadline) that generates a prompt and fills the chat draft.
7. ✅ Add “shortlist mode” (favorites → assistant): pass selected company IDs and generate an outreach plan.
8. ✅ In `/assistant`, show shortlist UI when `companyIds` are provided (company names + links + shortlist chips).
9. ✅ Improve quick prompt chips: insert “ready-to-send” prompts (not only short labels), especially for shortlist mode.
10. ✅ Shortlist mode: show a tiny meta line per company (category + region) in the shortlist UI to help compare faster.
11. ✅ Shortlist mode: add a “remove” (×) action on shortlist chips (URL-only; doesn’t change favorites).
12. ✅ Outreach templates: render Subject/Body/WhatsApp as structured UI blocks + per-block copy buttons.
13. ✅ Admin: add `/admin/ai-requests` page to inspect AI request logs + provider errors.
14. ✅ Add 👍/👎 feedback buttons for assistant messages (store in DB + show in `/admin/ai-requests`).
15. ✅ Store a lightweight “template compliance” flag in `ai_requests.payload` for analytics (Subject/Body/WhatsApp blocks).
16. ✅ Add streaming replies (SSE) for `/assistant` (via `POST /api/ai/request?stream=1`) with safe fallback.
17. ✅ Add safe “rubric hints” injection for sourcing prompts (catalog-based, capped, injection-safe).
18. ✅ Add safe “query variants” suggestions for sourcing prompts (2–3 variants with synonyms; capped; injection-safe).

Next (pick ONE):

1. Add safe “city/region extraction” hints for sourcing prompts (best-effort; capped; injection-safe).

## Constraints

- Dev only: `biznesinfo-develop.lucheestiy.com` / host port `8131`.
- Do not touch production (`biznesinfo.lucheestiy.com`).
- Keep changes small and reviewable.
