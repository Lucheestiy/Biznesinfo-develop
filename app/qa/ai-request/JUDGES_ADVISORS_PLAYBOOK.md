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
- Geo ambiguity regression: `app/qa/ai-request/scenarios.regressions.geo-ambiguity.json` (конфликты city/region, уточнения "город vs область", multi-turn continuity).
- Multi-step journeys regression: `app/qa/ai-request/scenarios.regressions.multi-step-journeys.json` (длинные 4-5 ходовые диалоги: geo-corrections, switchback темы, shortlist + RFQ в одной сессии).
- User ideas multi-step variants: `app/qa/ai-request/scenarios.regressions.user-ideas-multistep-variants.json` (21 сценарий: вариативные многоходовки, anti-link-gate, website scan/deep scan, consistency и strict guardrail кейсы).
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
- Веб-навигация по активным QA-пакетам: `/scenarios` (страница внутри сайта).

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
npm run qa:run:geo-ambiguity
```

```bash
npm run qa:trend:geo-ambiguity
```

Nightly-режим со stricter age-gate:

```bash
npm run qa:trend:geo-ambiguity:strict
```

Lean CI-лог (только machine summary + ошибки гейтов):

```bash
npm run qa:trend:geo-ambiguity:ci
```

Максимально быстрый CI-пинг без перезаписи артефактов:

```bash
npm run qa:trend:geo-ambiguity:ci-fast
```

Альтернативная CI-политика (приоритет freshness gate):

```bash
npm run qa:trend:geo-ambiguity:ci:freshness-first
```

Для быстрого CI-triage можно управлять длиной мини-тренда:

```bash
node scripts/track_geo_ambiguity_pass_rate_trend.mjs --sparkline-window 3 --require-target-reached
```

Для контроля "протухания" зелёных прогонов можно добавить age-gate:

```bash
node scripts/track_geo_ambiguity_pass_rate_trend.mjs --max-last-green-age-hours 12 --require-target-reached
```

В консольном выводе у тренда теперь есть краткая строка `Sparkline[N] ...`,
чтобы динамику последних запусков было видно без открытия markdown-отчёта.
Там же печатается `Trend verdict: improving|flat|declining` с delta в pp для
быстрой маршрутизации алертов.
Дополнительно есть machine-parseable строка:
`GEO_TREND verdict=<...> delta_pp=<...> pass_rate=<...> last_green_age_hours=<...> gate_order=<...> target_reached=<yes|no> sparkline=<...>`.
Если gate не пройден, эта же строка дополняется полями:
`gate_code=<...> gate_name=<...>` (для прямой маршрутизации алертов в CI).
И строка `Recommendation: ...`, которая подсказывает следующее действие по текущему состоянию тренда.
Флаг `--emit-ci-summary-only` оставляет только строку `GEO_TREND ...` (и gate errors), если нужен минимальный шум в CI.
Флаг `--no-write` отключает обновление `geo-ambiguity-trend.json/.md`, если нужен только gate + консоль.
Флаг `--gate-order` управляет приоритетом гейтов: `target-first` (по умолчанию) или `freshness-first`.
Флаг `--always-emit-gate-meta` добавляет `gate_code=<...> gate_name=<...>` даже при success (`gate_code=0 gate_name=none`) для стабильной схемы парсинга.

```bash
npm run qa:run:multi-step
```

```bash
npm run qa:run:user-ideas
```

```bash
npm run qa:run:user-ideas:website-scan
npm run qa:run:user-ideas:website-scan:deep
npm run qa:run:user-ideas:beet
```

```bash
npm run qa:run:dirty
```

```bash
npm run qa:run:chatgpt-pro
npm run qa:run:external
npm run qa:run:multi-model
```

Before/after benchmark двух провайдеров (например `codex` vs `minimax`) с авто-документацией:

```bash
npm run qa:benchmark:providers -- \
  --before-provider codex \
  --after-provider minimax \
  --after-model MiniMax-M2.5 \
  --max-scenarios 20 \
  --judges kimi,minimax
```

Скрипт запустит два QA-прогона, два judge-прогона и соберёт единый comparison report.
Для request-level переключения провайдера в рамках одного runtime установите:
`AI_ASSISTANT_ALLOW_PROVIDER_OVERRIDE=1` (только для QA/benchmark окружения).

Model-matrix прогон (общее ядро + модельные профили) с отдельной глубокой проверкой primary-модели:

```bash
npm run qa:matrix:models
```

Что делает `qa:matrix:models`:

- запускает **общий regression pack** для каждой модели из матрицы (по умолчанию: MiniMax, Codex, OpenAI);
- запускает **primary deep pack** только для primary-модели (по умолчанию MiniMax);
- собирает единый отчет с метриками **по каждой модели**;
- в отчете показывает короткий прогресс **было -> стало** относительно предыдущего matrix-ого прогона;
- сохраняет артефакты в `app/qa/ai-request/reports/latest.model-matrix.{json,md}`.

Быстрый smoke-вариант без judge-прогона:

```bash
npm run qa:matrix:models:fast
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

Если Gemini временно недоступен, используйте dual-контур:

```bash
npm run qa:judge:dual
npm run qa:advise:dual
```

Для полного многоходового цикла:

```bash
npm run qa:cycle:multi-step:triad
```

или (fallback без Gemini):

```bash
npm run qa:cycle:multi-step:dual
```

Для цикла по пользовательским идеям (многоходовки + варианты):

```bash
npm run qa:cycle:user-ideas:triad
```

или (fallback без Gemini):

```bash
npm run qa:cycle:user-ideas:dual
```

Для расширенного long-цикла «всё сразу» (core + multi-step + geo + trend):

```bash
npm run qa:cycle:extended:triad
```

или (fallback без Gemini):

```bash
npm run qa:cycle:extended:dual
```

Для регулярной geo-ambiguity регрессии (nightly/pre-merge):

```bash
npm run qa:premerge:geo-ambiguity
```

```bash
npm run qa:cycle:geo-ambiguity:triad
```

или (fallback без Gemini):

```bash
npm run qa:cycle:geo-ambiguity:dual
```

`qa:cycle:geo-ambiguity:*` теперь запускает весь длинный контур всегда
(run + judge + advise + trend), даже если ранний шаг упал; итоговый exit code при этом остаётся fail, но все артефакты цикла обновляются.

`qa:cycle:extended:*` ведёт себя так же (always-run), но покрывает расширенный набор: core (50) + multi-step (5) + geo-ambiguity (2) + geo trend.

Для user-ideas контура в always-run режиме (full + beet focus):

```bash
npm run qa:cycle:user-ideas:always:triad
```

или (fallback без Gemini):

```bash
npm run qa:cycle:user-ideas:always:dual
```

Посмотреть план шагов без запуска:

```bash
npm run qa:cycle:user-ideas:always:plan
```

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
- `scripts/run_ai_provider_benchmark.mjs`: sequential before/after прогон для двух провайдеров ассистента
  (`AI_ASSISTANT_PROVIDER`) с итоговым diff-отчётом.
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
- Provider benchmark report:
  - `app/qa/ai-request/reports/latest.provider-benchmark.json`
  - `app/qa/ai-request/reports/latest.provider-benchmark.md`
- Geo ambiguity trend:
  - `app/qa/ai-request/reports/geo-ambiguity-trend.json`
  - `app/qa/ai-request/reports/geo-ambiguity-trend.md`

Полный индекс форматов и рекомендации по хранению:

- `app/qa/ai-request/reports/README.md`

## Рекомендуемый недельный ритм

1. 2-3 прогона core (50) после мелких backend/prompt изменений.
2. 1 прогон external 200 для проверки устойчивости.
3. Judge gate (Gemini+Kimi, при необходимости +MiniMax) как обязательный stop/go.
4. Advisor pass (Gemini+Kimi, при необходимости +MiniMax) и перенос P0 в `devloop/TODO.md`.
5. Повтор цикла.
