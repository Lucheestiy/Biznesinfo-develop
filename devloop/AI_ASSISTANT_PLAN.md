# Biznesinfo Develop — AI Assistant Plan (B2B)

This document defines a **B2B-first** roadmap for the AI assistant on `biznesinfo-develop.lucheestiy.com`.

It is written to be actionable for the automated devloop (small, safe PR-sized changes) and for manual implementation.

## Product goals

1. **Speed up B2B outcomes**: users should be able to go from “need” → “shortlist” → “outreach” in minutes.
2. **Stay practical**: clear next steps, templates, checklists, and links into Biznesinfo (rubrics/search/company pages).
3. **Be robust**: safe by default, resilient to bad inputs, stable UX (mobile-first).
4. **Be honest**: do not fabricate facts; clearly separate “known from directory data” vs “user-provided”.

## Non-goals (for now)

- Auto-sending messages to companies without explicit user action.
- Web-browsing or claiming to verify companies outside Biznesinfo data.
- Complex “agent” behaviors (tool-calling orchestration) without strong safety + observability.

## Primary B2B use cases

### A) Find suppliers / service providers (sourcing)

User intent: “I need X (product/service) in Y (city/region), with constraints (budget, deadline, specs).”

Assistant should:
- Propose **keywords + synonyms** and **rubric/category** paths.
- Suggest **filters** (region/city) and how to widen/narrow.
- Produce a **search plan** (1–3 query variants).
- Optionally provide **direct links** to relevant rubric/search pages.

### B) Qualify a company (due diligence)

User intent: “Is this company a good fit?” or “What should I ask before buying?”

Assistant should:
- Provide a checklist (lead time, certifications, warranty, terms, delivery, references).
- Suggest red flags and what to verify on the company page.
- Draft clarifying questions tailored to the category.

### C) Draft outreach / RFQ (conversion)

User intent: “Write a professional message to 5 suppliers.”

Assistant should:
- Generate RFQ templates with placeholders: `{product/service}`, `{qty}`, `{spec}`, `{delivery}`, `{deadline}`, `{contact}`.
- Produce variants: email / WhatsApp / short form.
- Encourage a single clear CTA and structured requirements.

### D) Follow-ups and negotiation helpers

User intent: “No response yet” / “Price too high” / “Need faster delivery”.

Assistant should:
- Provide follow-up sequence templates (1st ping, 2nd ping, final).
- Provide negotiation language and “trade-offs” suggestions.

## UX surfaces (where the assistant appears)

1. **`/assistant`** (premium/partner): full chat with history, copy actions, and templates.
2. **Context entrypoints**:
   - Company page: open `/assistant` with `companyId/companyName`.
   - Favorites / search: open `/assistant` with intent + optional shortlist context (later).

## Backend architecture (current)

- Endpoint: `POST /api/ai/request`
- Providers:
  - `stub` (safe fallback)
  - `openai` (enabled by env vars; keys never committed)
- Storage: `ai_requests` row + JSONB payload includes request/response metadata and guardrails.
- Security:
  - Auth required (currently paid/partner)
  - Same-origin checks (CSRF)
  - Rate limit + daily quota
  - Prompt-injection signal detection

## Context strategy (how we make answers accurate)

Principle: **“structured data first, untrusted text second.”**

### Context levels

1. **UI context** (untrusted): page, companyId, companyName.
2. **Directory record** (untrusted but structured): selected fields from Biznesinfo dataset (categories/rubrics/region/city, etc.).
3. **Search/rubric hints** (computed): suggested rubric slugs, query variants, filters.

### Safety requirements

- Treat *all* injected context as **untrusted input** (prompt-injection can be embedded in descriptions).
- Apply strict **caps** (message count, char limits, list lengths).
- Add an explicit system rule: **do not fabricate facts** about a company.
- If injection signals are detected: add a system “security notice”.

## Output format (what the assistant should produce)

To make the assistant “usable”, prefer **structured, copyable outputs**:

- **Sourcing plan**:
  - “Try these rubrics”
  - “Try these query variants”
  - “If results too broad / too narrow”
- **RFQ template**:
  - Subject
  - Body
  - Short message
  - Placeholders
- **Qualification checklist**:
  - Must-ask questions
  - Red flags
  - Evidence to request

## Observability + admin

Minimum:
- Store request/response, provider errors, and guardrails version.
- Admin tooling to keep search healthy (reindex + stats).

Nice-to-have (later):
- Admin page for inspecting AI request logs (redacted view, filters by error/provider/quota).

## Roadmap (small steps; devloop-friendly)

Each step should be doable in one safe PR-sized change.

### Phase 1 — Answer quality foundations

1. Inject **safe company facts** when `companyId` is provided (server-side fetch + whitelist + truncation).
2. Add **linkify** + safe formatting in the assistant UI (no HTML injection).
3. Add “outreach export” helpers:
   - Copy as Email (subject+body)
   - Copy as WhatsApp/Telegram (short)
4. Improve intent chips:
   - When company context exists, show “Draft message to this company” / “Questions to ask this company”.

### Phase 2 — B2B workflows

5. Add an RFQ builder mini-form (product/service, qty, region, deadline) that generates a prompt and fills placeholders.
6. Add “shortlist mode” (favorites → assistant): pass a list of selected companies (IDs only) and generate outreach plan.

### Phase 3 — Provider + reliability upgrades

7. Optional streaming responses (provider-dependent).
8. Better error UX: quota/rate limit messages + retry guidance.
9. Provider abstraction for multiple LLMs (OpenAI, others) with unified timeouts and safe fallback.

## Definition of done (for each step)

- Works on mobile.
- No secrets committed.
- Doesn’t break non-assistant pages.
- Guardrails remain in place (no fabrication; injection-resistant context handling).
- Builds and passes TypeScript.

