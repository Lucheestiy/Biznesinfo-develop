# AI Judges + Advisors Playbook (Gemini + Kimi + MiniMax)

Эта инструкция фиксирует единый QA/dev-loop для ассистента:

1. прогоняем сценарии,
2. оцениваем ответы через внешних судей (Gemini + Kimi, при необходимости + MiniMax через Droid CLI),
3. собираем advisory-рекомендации от Gemini + Kimi (+ MiniMax опционально),
4. внедряем P0/P1 правки и повторяем цикл.

## Наборы сценариев (сотни примеров)

- Core regression набор: `app/qa/ai-request/scenarios.json` (50 сценариев).
- Dirty real-world набор: `app/qa/ai-request/scenarios.dirty.realworld.json` (10 сценариев с «грязными» пользовательскими запросами).
- Link integrity regression: `app/qa/ai-request/scenarios.regressions.link-integrity.json` (проверяет, что `/company/...` ссылки из ответа реально открываются и не ведут в `not found`).
- Master-набор на базе документа с вопросами из ChatGPT Pro:
  - Документ: `devloop/AI_ASSISTANT_TEST_QUESTIONS_CHATGPT_PRO.md`
  - Сценарии: `app/qa/ai-request/scenarios.chatgpt-pro.master.json` (агрегируется скриптом, 100+ кейсов).
- External normalized набор: `app/qa/ai-request/external-challenges/scenarios.normalized.json` (350 сценариев с Gemini/Kimi/MiniMax).
- External subset для больших прогонов: `app/qa/ai-request/external-challenges/scenarios.normalized.more-200.json` (200 сценариев).
- Model-specific documents (для ручного review):
  - `devloop/AI_ASSISTANT_TEST_QUESTIONS_GEMINI.md`
  - `devloop/AI_ASSISTANT_TEST_QUESTIONS_KIMI.md`
  - `devloop/AI_ASSISTANT_TEST_QUESTIONS_MINIMAX.md`
- Combined multi-model pack:
  - `app/qa/ai-request/scenarios.multi-model.master.json` (ChatGPT Pro + Gemini + Kimi + MiniMax).
- Полная человекочитаемая документация по внешним сценариям:
  `app/qa/ai-request/external-challenges/SCENARIOS_NORMALIZED.md`.

## Быстрые команды

Запускать из `app/`.

```bash
npm run qa:scenarios:core
npm run qa:scenarios:external
npm run qa:scenarios:chatgpt-pro
npm run qa:scenarios:multi-model
npm run qa:external:docs
```

```bash
npm run qa:run
```

```bash
npm run qa:run:links
```

```bash
npm run qa:run:dirty
```

```bash
npm run qa:run:chatgpt-pro
npm run qa:run:external
npm run qa:run:multi-model
```

```bash
npm run qa:judge
```

`qa:judge` теперь запускается в strict real-user режиме и валит CI/скрипт, если:

- низкая `userSatisfaction`,
- пользователь с высокой вероятностью не продолжил бы диалог (`continueRate`),
- ассистент часто скатывается в generic fallback (`genericFallbackRate`).

```bash
npm run qa:advise
```

```bash
npm run qa:judge:triad
npm run qa:advise:triad
```

`qa:judge:triad` и `qa:advise:triad` добавляют MiniMax (M2.1) через `droid exec --model custom:MiniMax-M2.1`.
Для этих команд нужен установленный и авторизованный Droid CLI.

## Расширенный прогон на 200+ кейсов

```bash
node scripts/ai-request-qa-runner.mjs \
  --scenarios qa/ai-request/external-challenges/scenarios.normalized.more-200.json \
  --max-scenarios 200 \
  --prepare-paid \
  --paid-limit 3000
```

```bash
node scripts/rate_ai_usefulness_with_judges.mjs \
  --report qa/ai-request/reports/latest.json \
  --judges gemini,kimi \
  --batch-size 10 \
  --min-gemini-avg 3.0 \
  --min-kimi-avg 3.0 \
  --min-gemini-useful-rate 0.70 \
  --min-kimi-useful-rate 0.70
```

```bash
node scripts/advise_ai_with_judges.mjs \
  --report qa/ai-request/reports/latest.json \
  --judged qa/ai-request/reports/latest.usefulness.json \
  --advisors gemini,kimi \
  --top-scenarios 30
```

## Что делают скрипты

- `scripts/ai-request-qa-runner.mjs`: строгие pass/fail проверки по ходу диалога.
- `scripts/rate_ai_usefulness_with_judges.mjs`: внешняя полезность (0..5) и quality gates от Gemini/Kimi/MiniMax.
  Включая real-user метрики: `userSatisfaction`, `wouldContinue`, `genericFallbackRate`.
- `scripts/advise_ai_with_judges.mjs`: actionable roadmap от Gemini/Kimi/MiniMax как советников:
  P0/P1/P2, конкретные правки, ожидаемый эффект, сценарии валидации.
- `scripts/build_chatgpt_pro_test_pack.mjs`: собирает master-набор из сценариев, построенных на документе ChatGPT Pro.
- `scripts/build_external_challenge_docs.mjs`: генерирует отдельные markdown-документы вопросов для Gemini/Kimi/MiniMax.
- `scripts/build_multi_model_test_pack.mjs`: собирает единый multi-model pack (ChatGPT Pro + external sets).
- `scripts/generate_minimax_50_external_challenges.mjs`: chunked-генерация MiniMax-набора через Droid CLI.

## Артефакты после прогона

- QA-run:
  - `app/qa/ai-request/reports/latest.json`
  - `app/qa/ai-request/reports/latest.md`
- Judge report:
  - `app/qa/ai-request/reports/latest.usefulness.json`
  - `app/qa/ai-request/reports/latest.usefulness.md`
- Advisor report:
  - `app/qa/ai-request/reports/latest.advice.json`
  - `app/qa/ai-request/reports/latest.advice.md`

## Рекомендуемый недельный ритм

1. 2-3 прогона core (50) после мелких backend/prompt изменений.
2. 1 прогон external 200 для проверки устойчивости.
3. Judge gate (Gemini+Kimi, при необходимости +MiniMax) как обязательный stop/go.
4. Advisor pass (Gemini+Kimi, при необходимости +MiniMax) и перенос P0 в `devloop/TODO.md`.
5. Повтор цикла.
