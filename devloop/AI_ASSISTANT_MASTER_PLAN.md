# Biznesinfo Develop — AI Assistant Master Plan (Super Detailed)

This is the **master** plan for improving the AI assistant on `biznesinfo-develop.lucheestiy.com`.

It is intentionally **exhaustive** (product + UX + backend + data + admin + ops), and designed to support an
**iterative loop**:

1) plan → 2) implement → 3) measure → 4) refine → repeat.

For a shorter B2B-only roadmap, see `devloop/AI_ASSISTANT_PLAN.md`.

---

## 0) Scope, principles, constraints

### Scope (what counts as “AI assistant functionality”)

Anything that affects the assistant’s ability to help users achieve outcomes, including:

- Entry points (company page, favorites, search, header navigation).
- `/assistant` UX: prompts, copy/export, templates, workflow helpers.
- Backend prompting, context injection, provider reliability.
- Data retrieval (Meilisearch, directory snapshot, rubric knowledge).
- Auth + plans + quotas + rate limits.
- Admin tooling: configuration, observability, moderation/abuse tooling, dataset/evaluation tooling.

### Principles

- **B2B outcomes first:** “need → shortlist → outreach” should be fast.
- **Honesty:** never fabricate company facts; clearly label what is “from directory snapshot” vs user-provided.
- **Autonomy with verification:** assistant should proactively use available card/context data and self-check consistency before asking user to repeat input.
- **Safety:** treat all text as untrusted; prompt injection resistance is mandatory.
- **Mobile-first:** the assistant must be usable on mobile.
- **Small, reviewable changes:** prefer PR-sized steps.
- **No secrets in repo:** never commit keys/datasets.

### Constraints (current reality)

- Dev only: repo `/home/mlweb/biznesinfo-develop.lucheestiy.com` on host port `8131`.
- Production (`/home/mlweb/biznesinfo.lucheestiy.com`) must not be touched.
- Current provider options: `stub` + optional `openai` behind env vars.
- Directory data is a **snapshot** and can be incomplete/outdated.

---

## 1) Current state (baseline)

### UX surfaces

- `/assistant` page:
  - Chat with **last-N message history** (client sends, server sanitizes + trims).
  - Context header: optional company context (`companyId/companyName`) + optional shortlist.
  - Suggestion chips (context-aware).
  - RFQ builder mini-form (fills a “prompt” into the draft).
  - Copy/export menu on assistant replies:
    - Copy answer
    - Copy as Email (subject+body)
    - Copy as WhatsApp (short)
  - Safe linkify for assistant output (no HTML injection).

- Entry points:
  - Company page opens `/assistant?companyId=...&companyName=...`.
  - Favorites opens `/assistant?companyIds=...` (shortlist mode).

### Backend (current)

- `POST /api/ai/request`:
  - Auth required; gated by plan (`paid|partner` only).
  - Rate limit + daily quota.
  - Prompt injection signal detection (basic heuristic).
  - Safe context injection:
    - If `companyId` is provided: fetch company record and inject **whitelisted + truncated** facts.
    - If `companyIds` are provided: inject a safe shortlist facts block.
  - Provider:
    - `stub` reply by default.
    - Optional OpenAI `chat/completions` by env vars.
  - Storage:
    - Creates `ai_requests` row; stores rich metadata in `ai_requests.payload` (JSONB), including guardrails + prompt.

### Admin (current)

- `/admin`:
  - Users list; edit plan/role.
  - Plan limits editing (AI requests per day by plan).
  - Partner domains editing (domain-specific AI limits).
  - Search tooling (`/admin/reindex`) with Meilisearch stats.

---

## 2) Success metrics (what “better” means)

### North-star metrics (business / product)

- **Time-to-outreach:** median time from opening assistant → “copy email/whatsapp” action.
- **Shortlist-to-outreach conversion:** % of sessions with shortlist where user copies/export outreach template.
- **Return usage:** users who use assistant again within 7 days.

### Quality metrics (assistant output)

- **Template compliance:** % of “draft outreach” replies that contain valid `Subject/Body/WhatsApp` blocks.
- **Hallucination rate:** % of replies that claim unverified company facts (should trend to ~0).
- **Clarifying question discipline:** asks ≤3 targeted questions when missing key info.
- **Actionability:** reply contains concrete next steps (rubrics/queries/checklists).

### Reliability / ops metrics

- **Non-stub reply rate** (when provider enabled).
- **P95 latency** for `/api/ai/request`.
- **Error rate** (429 quota, 429 rate-limit, 5xx provider failures).
- **Cost per useful outcome** (later, when token usage instrumentation exists).

### Safety metrics

- **Prompt injection handling:** % of flagged injections where assistant still follows rules.
- **PII leakage:** avoid storing sensitive user content unnecessarily; implement redaction where possible.

---

## 3) Improvement map (every angle)

This section lists improvement ideas by area. The roadmap below picks what to implement first.

### 3.1 UX / product workflow (user-facing)

**Onboarding**
- Show “what the assistant can do” with 3–5 chips + examples (sourcing, RFQ draft, qualification checklist).
- If user is `free`: show “why paid is worth it” with preview examples and remaining free quota rules.

**Entry points**
- Company page: prefill “what to ask” prompt + show quick chips (“Draft RFQ”, “Questions to ask”, “Follow-up”).
- Favorites: “shortlist mode” should feel like a workflow:
  - ability to remove a company from shortlist (URL-only) and keep working.
  - “goal selector”: compare vs outreach plan vs gaps.
- Search results: allow “send to assistant” for selected companies (later).

**Chat usability**
- Better “assistant typing” UX (streaming later).
- Make “template replies” visually structured: highlight Subject/Body/WhatsApp as blocks with one-click copy.
- Allow “regenerate” / “refine” actions safely (later).
- Add “save to notes” / “export as doc” (later).

**Language**
- Detect and respect user language; add bilingual templates (RU/BE/EN).
- Ensure labels remain consistent even in non-English content.

### 3.2 Prompting, formatting, and correctness

- Upgrade system prompt with:
  - stricter “no fabricated facts” and “ask user to verify on company page”.
  - explicit “directory snapshot may be outdated”.
  - required structured formats for common intents (sourcing plan, RFQ, checklist).
- Add lightweight **few-shot** examples for:
  - sourcing plan output
  - outreach template output
  - shortlist outreach plan output
- Add response post-processing checks (server-side):
  - detect if outreach template is missing required blocks → ask model to reformat (provider-dependent; optional).

### 3.3 Context injection & retrieval (RAG without overengineering)

**Today:** inject company facts + shortlist facts (safe, whitelisted, truncated).

**Next steps**
- Add “rubric hints” injection:
  - for user query, suggest 3–5 rubric slugs/labels.
  - inject *only* from a trusted internal mapping file (not user-provided).
- Add “Meilisearch retrieval” (careful):
  - if user asks “find suppliers for X in Y”, do a Meili search server-side and inject top N company summaries.
  - strict caps + sanitization (structured fields only).
  - mark results as “suggestions, not verified”.

**Do not** inject raw descriptions at full length: prompt injection risk and noise.

### 3.4 Provider architecture (reliability & speed)

- Add streaming response support (SSE) when provider supports it.
- Add **single-flight concurrency** per user (borrowed from Clawdbot-style “one active job per chat”):
  - default mode: **reject** new requests while one is running (return `AiBusy` + `retryAfter`).
  - optional: **queue** (later) — accept request but delay provider call until previous finishes.
  - must include **cancellation** (“Stop generating”) to unblock users quickly.
- Provider failover rules:
  - if provider fails → fallback stub but keep request stored with error metadata.
  - add circuit breaker style cooldown (avoid hammering provider when down).
- Token/cost instrumentation:
  - store token usage when provider returns it (OpenAI usage fields).
  - (optional) store cost estimate if pricing table is configured (avoid hardcoding volatile prices).

### 3.5 Safety, privacy, abuse resistance

- Strengthen injection detection:
  - scan user message + recent user history + any injected company text.
  - keep a small set of multilingual heuristics (RU/EN).
- Redaction:
  - in stored payload, redact obvious secrets and phone/email if not needed for product analytics (admin-only view can keep raw).
- Abuse / spam:
  - per-user rate limit (not only per-IP).
  - add “blocked terms” / “abusive content” detection (minimal; later).

### 3.6 Admin panel & ops tooling

**AI request logs**
- Admin page to browse requests:
  - filter by provider, stub/non-stub, errors, injection-flagged.
  - view details: user, companyId(s), prompt metadata, response, timestamps.

**Quality/feedback**
- Add user feedback controls (👍/👎 + “issue reason”):
  - store feedback tied to request id + message id.
  - admin view of feedback; quick filters (“bad formatting”, “hallucination”, “too long”, etc).

**Configuration**
- Admin toggles (stored in DB):
  - enable/disable streaming
  - set assistant history length caps
  - set safe “prompt version” / “guardrails version”
  - enable extra retrieval injections (rubrics, shortlist summaries)

### 3.7 Evaluation harness (keep it simple but real)

- Build a small “golden set” of prompts:
  - 20 sourcing prompts (RU/EN)
  - 20 outreach prompts (template compliance)
  - 10 injection attempts
  - 10 shortlist prompts
- Add an internal script to run them against stub/openai providers (when enabled) and store results as JSON for diffing.
- Define scoring:
  - template compliance (regex)
  - hallucination detection heuristics (mentions “verified” / invented address/unp)
  - length and question count constraints.

---

## 4) Roadmap as 3 improvement cycles (the loop)

Each cycle:

1) choose a small batch → 2) ship → 3) review logs/feedback → 4) update prompt/UX → 5) repeat.

### Cycle 1 — UX + observability “make it usable and debuggable”

**Goal:** improve the assistant’s usability without changing fundamentals.

Checklist (implement top-down):

- [x] Shortlist mode: add “remove company from shortlist” action (URL-only).
- [x] Template rendering: detect `Subject/Body/WhatsApp` blocks and show them as structured UI sections with copy buttons.
- [x] Admin: add AI request logs page (`/admin/ai-requests`) with basic filters and detail view.
- [x] Admin: show provider health summary (stub vs openai enabled, recent errors) on the AI logs page.

Definition of done:
- Works on mobile.
- No secrets committed.
- `/assistant` still works without provider keys.

### Cycle 2 — Feedback + quality gates “close the loop”

**Goal:** capture real user signals and use them to improve quality.

Checklist:

- [x] Add 👍/👎 feedback on assistant messages (stores with `ai_requests` row).
- [x] Add “reason” quick-select (formatting wrong, too generic, hallucination, language wrong).
- [x] Admin: feedback view + filters; one-click open request details.
- [x] Add lightweight compliance checks:
  - mark replies as “template-compliant” vs not (server-side heuristic).
  - store a compliance flag for analytics.

Definition of done:
- Feedback is stored and visible in admin.
- No new privacy leaks (only store what’s needed).

### Cycle 3 — Retrieval + streaming “make it feel fast and smart”

**Goal:** improve answer accuracy and perceived speed.

Checklist:

- [x] Add streaming replies (SSE) for OpenAI provider (keep fallback non-streaming).
- [ ] Add safe “rubric hints” injection for sourcing prompts.
- [ ] Add optional Meilisearch retrieval for “find suppliers” intents:
  - inject top N company summaries (structured fields only) and ask user to confirm shortlist.
- [ ] Add basic offline eval script + golden prompts (internal only).

Definition of done:
- Streaming works without breaking non-streaming.
- Retrieval is capped and injection-safe.

### Cycle 4 — Performance + control “one active request, cancel, measure”

**Goal:** make the assistant feel responsive and predictable under real usage, inspired by the local bots (Clawdbot/Moltbot/OpenClaw patterns).

Checklist:

- [x] Backend: enforce **one in-flight request per user** (lock with TTL).
- [x] Backend: add **cancellation semantics** for streaming:
  - if client disconnects/aborts, stop provider call and store request as `canceled` (not “provider failed”).
- [x] UI: add “Stop generating” button (AbortController) during streaming.
- [x] Backend: capture request timings (`startedAt`, `completedAt`, `durationMs`).
- [x] Backend: capture OpenAI token usage:
  - non-stream: `usage` from response
  - stream: request `include_usage` and parse final usage chunk (provider-dependent)
- [x] Admin: surface “canceled” + token usage columns; add filters.
- [ ] Ops: provider backoff/circuit breaker (short cooldown after repeated 429/5xx).

Definition of done:
- Users can always stop a stuck/slow response.
- No “double replies” from accidental double-submit / multi-tab.
- Admin can see latency + usage at a glance.

### Cycle 5 — Retrieval (safe RAG) “answer with better evidence”

**Goal:** reduce “generic answers” by injecting *trusted, bounded* retrieval results.

Checklist:
- [ ] Add rubric hints injection (from internal store only; no user-provided rubric text).
- [ ] Add Meilisearch retrieval for supplier-finding intents:
  - cap results (e.g., top 5–8)
  - inject structured summaries only (name, region, rubrics, contacts)
  - explicitly label as “suggestions from directory snapshot”
- [ ] Add “confirm shortlist” UX: one-click add/remove suggested companies.

Definition of done:
- Retrieval never injects raw untrusted HTML/text blobs.
- Assistant clearly distinguishes “directory snapshot” vs “user-provided”.

### Cycle 6 — Evaluation + iteration “measure quality, ship tiny fixes weekly”

**Goal:** keep improving without regressions.

Checklist:
- [ ] Golden prompts + offline evaluation script (template compliance, injection resistance, question count).
- [ ] Admin: export a small sample of requests/feedback for review (no secrets).
- [ ] “Prompt versioning” in stored payload so we can compare before/after changes.

Definition of done:
- Changes are measurable (at least locally) and regressions are caught early.

### Cycle 7 — Autonomy + consistency hardening

**Goal:** eliminate trust-breaking regressions where assistant asks for already-known links or contradicts its own prior step.

Checklist:
- [x] Add history-aware follow-up detection for card/site/news intents (e.g., “на карточке компании”).
- [x] Bootstrap website research from company-name hints in current + recent turns when explicit card link is absent.
- [x] Add anti-link-gate post-processing: if candidate/card context exists, continue autonomously instead of requesting the same link.
- [x] Add analytics-tagging recovery guard: block drift into supplier-mode for pure analytics/tagging prompts.
- [x] Add dedicated regression case for “found first, then not found / asked link” consistency failure.

Definition of done:
- Assistant does not ask for redundant links when context already contains enough identifiers.
- Analytics-tagging turns remain in analytics domain through the full answer.
- Multi-turn consistency regressions are covered by explicit scenario tests.

---

## 5) Continuous improvement playbook (repeat forever)

After each cycle:

1) Review admin AI logs:
   - errors, latency, provider failures
   - injection-flagged requests
   - low-quality feedback clusters
2) Identify top 3 failure modes (e.g., “template missing WhatsApp”, “hallucinated company address”).
3) Pick 1–2 targeted fixes:
   - adjust prompt wording or add a tiny few-shot example
   - add a UX affordance (structured template UI)
   - tweak context injection caps
4) Deploy and measure again.

---

## 6) Backlog (idea bank; not all to implement soon)

### Advanced workflows
- “Outreach sequence builder” (3-message cadence).
- “Negotiation playbook” (counteroffers, delivery changes).
- “Shortlist scoring” (criteria-based comparison).

### Integrations
- Export to CRM (CSV) for shortlist + contact data.
- Email sending (only with explicit confirmation; later).
- WhatsApp deep-links (`wa.me`) and mailto links.

### Personalization
- Per-user saved templates / signature blocks.
- Remember preferred tone (formal vs casual) (store in profile).

### Safety & compliance
- Per-tenant data separation (if partners share a domain).
- Stronger PII redaction + retention policy.
