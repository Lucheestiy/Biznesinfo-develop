# External Challenger Sets (Gemini + Kimi + MiniMax)

Generated from CLI one-shot outputs.

## Source files

- gemini: 50 scenarios -> `app/qa/ai-request/external-challenges/gemini-50.json`
- kimi: 50 scenarios -> `app/qa/ai-request/external-challenges/kimi-50.json`
- minimax: 50 scenarios -> `app/qa/ai-request/external-challenges/minimax-50.json`
- gemini: +100 scenarios -> `app/qa/ai-request/external-challenges/gemini-100-more.json`
- kimi: +100 scenarios -> `app/qa/ai-request/external-challenges/kimi-100-more.json`
- minimax: +100 scenarios (optional) -> `app/qa/ai-request/external-challenges/minimax-100-more.json`

## Normalized sets used in QA

- Combined normalized set (300 scenarios):
  `app/qa/ai-request/external-challenges/scenarios.normalized.json`
- Large regression subset (200 scenarios):
  `app/qa/ai-request/external-challenges/scenarios.normalized.more-200.json`
- Human-readable documentation for the normalized set:
  `app/qa/ai-request/external-challenges/SCENARIOS_NORMALIZED.md`

Build command:

```bash
node app/scripts/build_external_ai_request_scenarios.mjs
```

Build model-specific markdown documents (for devloop references):

```bash
npm --prefix app run qa:external:docs
```

## Prompt sources

- `app/qa/ai-request/external-challenges/prompts/generate-gemini-100-more.prompt.txt`
- `app/qa/ai-request/external-challenges/prompts/generate-kimi-100-more.prompt.txt`
- `app/qa/ai-request/external-challenges/prompts/generate-minimax-100-more.prompt.txt`

Kimi reliability fallback (chunked generation with retries):

- `app/scripts/generate_kimi_100_more_in_chunks.mjs`

MiniMax generation (chunked 50 with retries via Droid CLI):

- `app/scripts/generate_minimax_50_external_challenges.mjs`

## Full workflow

For judge + advisor loop (Gemini/Kimi as judges and advisors), see:

- `app/qa/ai-request/JUDGES_ADVISORS_PLAYBOOK.md`
