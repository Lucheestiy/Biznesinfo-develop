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
19. ✅ Add safe “city/region extraction” hints for sourcing prompts (best-effort; capped; injection-safe), including ambiguity notes when multiple location candidates conflict across current message/history.
20. ✅ Add geo-focused QA regressions for ambiguous location refinements (city-only follow-ups and conflicting city/region hints).
21. ✅ Wire geo-ambiguity regression set into routine QA cycle (pre-merge/triad/dual npm cycles) and add pass-rate trend reports (`geo-ambiguity-trend.json/.md`).
22. ✅ Make geo long cycle truly “always-run”: `qa:cycle:geo-ambiguity:{triad|dual}` now executes run+judge+advise+trend even when early steps fail.
23. ✅ Add expanded always-run cycle: `qa:cycle:extended:{triad|dual}` now runs core + multi-step + geo + trend in one contour.
24. ✅ Add compact 7-run sparkline + “time since last green run” metric to `geo-ambiguity-trend.md` for faster nightly triage.
25. ✅ Add explicit “last green run id” + timestamp summary line to console output of `qa:trend:geo-ambiguity` for quick CI logs.
26. ✅ Add `--sparkline-window N` CLI option to `track_geo_ambiguity_pass_rate_trend.mjs` (default 7) to tune short-term trend granularity in CI.
27. ✅ Add one-line console summary of sparkline itself (`Sparkline[N]: ...`) to speed up CI triage without opening markdown.
28. ✅ Add console output for short geo trend verdict (`improving|flat|declining`) plus delta in pp to simplify alert routing.
29. ✅ Add machine-parseable CI summary line `GEO_TREND verdict=<...> delta_pp=<...> pass_rate=<...>` in `qa:trend:geo-ambiguity` output.
30. ✅ Add optional gate `--max-last-green-age-hours N` to fail trend check when last successful geo run is too old.
31. ✅ Add `qa:trend:geo-ambiguity:strict` npm script combining target gate + max-last-green-age-hours for nightly CI.
32. ✅ Add one-line action recommendation in trend output (`Recommendation: ...`) and gate-specific `Hint:` messages on failures.
33. ✅ Add `last_green_age_hours` to machine summary line `GEO_TREND ...` and to trend JSON stats for easier alert thresholds.
34. ✅ Add `--emit-ci-summary-only` mode and `qa:trend:geo-ambiguity:ci` script for lean CI logs (machine summary + gate errors only).
35. ✅ Add `--no-write` mode and `qa:trend:geo-ambiguity:ci-fast` script for gate-only CI checks without rewriting trend files.
36. ✅ Add `app/qa/ai-request/reports/README.md` with clear index of report file types, raw artifacts, and retention/cleanup guidance.
37. ✅ Add `--gate-order` (`target-first|freshness-first`) and `qa:trend:geo-ambiguity:ci:freshness-first` for explicit CI policy.
38. ✅ Add `gate_order=<...>` field to `GEO_TREND ...` machine summary line for explicit parser context.
39. ✅ Expand a new multi-step regression bank from user ideas (`scenarios.regressions.user-ideas-multistep-variants.json`, currently 21 сценарий) and wire run/cycle commands.
40. ✅ Add `gate_code=<...>` and `gate_name=<...>` to `GEO_TREND ...` on gate failure for direct CI routing without log parsing.
41. ✅ Add optional `--always-emit-gate-meta` flag to include `gate_code=0 gate_name=none` in successful `GEO_TREND ...` lines for stable parser schemas.
42. ✅ Add safe company-website scan context in `/api/ai/request` (public http/https only, anti-SSRF guards, timeout-capped) so assistant can extract best-effort facts from company sites when user explicitly asks.
43. ✅ Improve website-scan continuity: if current turn has no fresh candidates, reuse prior `/company/...` links from chat history (hydrate cards + websites) before scanning; add fast smoke script `qa:run:user-ideas:website-scan`.
44. ✅ Improve website-scan depth: when homepage is too shallow, do a safe mini-crawl of high-signal internal pages (contacts/about/products) on the same host to extract contacts/evidence with stricter SSRF-safe URL filtering.
45. ✅ Add dedicated deep website-scan regression scenario (`UV013`, tag `website_scan_deep`) + npm smoke command `qa:run:user-ideas:website-scan:deep`.
46. ✅ Add website-scan depth analytics in request payload (`websiteScanTargetCount`, `websiteScanInsightCount`, `websiteScanDepth`, `websiteInsightSources[*].deepScanUsed/scannedPageCount/scannedPageHints`) for QA triage and admin debugging.
47. ✅ Add a quick admin filter/toggle in `/admin/ai-requests` for website deep scans (`websiteScan.depth.deepScanUsed`) + list badges/counters for faster triage.
48. ✅ Add compact website-scan summary in `/api/admin/ai-requests/[id]` modal header/details (`attempted`, `targets`, `insights`, `pages`, `deep`) to reduce manual JSON scrolling.
49. ✅ Add server-side query filter to `/api/admin/ai-requests` (`onlyWebsiteDeep=1`) and wire it in admin UI data loading for faster filtering on large logs.
50. ✅ Expand server-side admin filters with `provider`, `onlyErrors`, and `onlyWebsiteAttempted` in `/api/admin/ai-requests` and wire them in admin UI loading to reduce large client-side post-filtering.
51. ✅ Add server-side pagination for `/api/admin/ai-requests` (`pagination.total/hasMore`) and UI controls (`limit/offset`, prev/next) with filter/page state persisted in URL.
52. ✅ Add compact “jump to page” control in `/admin/ai-requests` with clamp-safe page navigation (`1..totalPages`) for large history traversal.
53. ✅ Add quick `В начало` / `В конец` buttons in `/admin/ai-requests` pagination for faster navigation across long log history.
54. ✅ Add one-click filter presets in `/admin/ai-requests` (`Ошибки+Non-stub`, `Web attempted+deep`, `Down feedback`) to speed up triage sessions.
55. ✅ Add one-click “Сбросить фильтры” in `/admin/ai-requests` to clear query/provider/toggles and return to first page.
56. ✅ Persist active filter preset in `/admin/ai-requests` URL as `preset=...` and restore initial filter state from this key for shareable triage links.
57. ✅ Add compact “Copy triage link” action in `/admin/ai-requests` with a short success/error indicator for quick reviewer handoff.
58. ✅ Add keyboard shortcut `c` (outside editable fields) to trigger “Copy triage link” in `/admin/ai-requests`; include `(c)` hint in button title/label.
59. ✅ Add a tiny shortcut help hint block near filters in `/admin/ai-requests` (`c: copy triage link`) for discoverability.
60. ✅ Add optional `Shift+C` alias for “Copy triage link” and show both shortcuts (`c / Shift+C`) in button title and shortcut hint.
61. ✅ Add compact `?` shortcut to toggle a tiny in-page shortcut legend (`c / Shift+C`) in `/admin/ai-requests`.
62. ✅ Add optional `Esc` behavior to close the shortcut legend quickly when it is open.
63. ✅ Add anti-noise supplier filtering for commodity sourcing in `/api/ai/request`: reject non-supplier institutional profiles (e.g., colleges/universities) unless strong supplier/manufacturer signals are present.
64. ✅ Expand beet query understanding (`буряк|бурак|beet|beetroot`) with synonym enrichment and a dedicated intent anchor/conflict rule for vegetable sourcing.
65. ✅ Add targeted regression scenario `UV017` (500kg beet in Minsk) with explicit guardrails against educational entities; verify live pass via QA runner.
66. ✅ Add convenience smoke command `qa:run:user-ideas:beet` for fast anti-noise regression reruns.
67. ✅ Generalize institutional anti-noise filtering for supplier lookup beyond beet/commodity-only flows (apply when hard vendor intent anchors are present), and lock it with cable multi-step checks (`MX004.T1.C4`, `MX004.T2.C4`).
68. ✅ Add always-run user-ideas long cycle in `run_geo_ambiguity_long_cycle.mjs` (`--scope user-ideas`) + npm scripts `qa:cycle:user-ideas:always:{triad|dual}` and dry plan `qa:cycle:user-ideas:always:plan`.
69. ✅ Strengthen follow-up intent detection for card/site/news requests in `/api/ai/request` (phrases like `на карточке`, `на сайте`, `последние новости`) to preserve autonomous flow.
70. ✅ Add company-name hint extraction from current + recent turns for website research bootstrap when explicit `/company/...` link is absent.
71. ✅ Add anti-link-gate post-processing: when card/candidate context exists, assistant continues lookup instead of asking user to resend the same link.
72. ✅ Add analytics-tagging safety fallback in post-processing to prevent drift into supplier/rubric shortlist mode.
73. ✅ Add regression scenario `UV021` in `scenarios.regressions.user-ideas-multistep-variants.json` for “found → then not found / asked link” inconsistency.
74. ✅ Keep on-site QA scenario navigator (`/scenarios`) aligned with active regression packs for fast manual review.
75. ✅ Add regression scenario `UV022` for "explicit company search → latest site news" without redundant URL request.
76. ✅ Add entity-tracking instruction: maintain specific company as active subject across turns.
77. ✅ Add criteria persistence: accumulate all user criteria across turns and re-apply.
78. ✅ Add sparse-data response template: structured fallback instead of generic advice.
79. ✅ Add rubric-based anti-noise filter: block hospitals/schools from supplier search results.
80. ✅ Add placeholder garbage guardrail: detect 'уточняется' in templates and replace with explicit request for details.
81. ✅ Strengthen ENTITY TRACKING in system prompt with explicit examples.

Next:

1. Run QA cycle again to verify improvements (placeholder guardrail, entity tracking).
2. Add strict QA gate for "redundant link request" patterns.
3. Add category relevance filter for multi-candidate retrieval.

## Constraints

- Dev only: `biznesinfo-develop.lucheestiy.com` / host port `8131`.
- Do not touch production (`biznesinfo.lucheestiy.com`).
- Keep changes small and reviewable.
