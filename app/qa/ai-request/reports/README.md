# QA Reports Directory Guide

Эта папка хранит артефакты прогонов QA-цикла ассистента.

## Основные типы файлов

1. `latest.json` / `latest.md`
   - Последний QA run (строгие сценарии pass/fail).

2. `latest.usefulness.json` / `latest.usefulness.md`
   - Последняя оценка usefulness от внешних judge-моделей.

3. `latest.advice.json` / `latest.advice.md`
   - Последний advisory-отчёт с рекомендациями по улучшению.

4. `run-<timestamp>-<id>.json` / `run-<timestamp>-<id>.md`
   - Исторические отчёты QA run (по сценариям).

5. `judge-<timestamp>.usefulness.json` / `judge-<timestamp>.usefulness.md`
   - Исторические judge-оценки.
   - Сопутствующая директория `judge-<timestamp>.raw/` содержит сырые ответы judge-моделей.

6. `advisor-<timestamp>.advice.json` / `advisor-<timestamp>.advice.md`
   - Исторические advisory-отчёты.
   - Сопутствующая директория `advisor-<timestamp>.raw/` содержит сырые ответы advisor-моделей.

7. `geo-ambiguity-trend.json` / `geo-ambiguity-trend.md`
   - Агрегированный тренд geo-ambiguity регрессий (pass-rate, sparkline, verdict, freshness).

## Быстрый ориентир по назначению

- Нужен текущий статус: открывайте `latest.*` + `geo-ambiguity-trend.*`.
- Нужна динамика во времени: `run-*`, `judge-*`, `advisor-*`.
- Нужен дебаг ответа конкретной модели: соответствующая папка `*.raw/`.

## Рекомендации по хранению

1. Для ежедневной работы достаточно актуальных:
   - `latest.*`
   - `geo-ambiguity-trend.*`
2. Исторические `run-*`, `judge-*`, `advisor-*` полезны для ретроспективы и сравнений.
3. Папки `*.raw/` самые «тяжёлые», их обычно очищают первыми по сроку.

## Безопасная ручная очистка (пример)

Запускать из `app/`.

```bash
find qa/ai-request/reports -type d \( -name 'judge-*.raw' -o -name 'advisor-*.raw' \) -mtime +14 -prune -print
```

Команда выше только показывает кандидатов на удаление (dry-run).  
Удаление делайте отдельно и осознанно, если артефакты больше не нужны для анализа.

## Связанная документация

- `app/qa/ai-request/JUDGES_ADVISORS_PLAYBOOK.md`
- `devloop/TODO.md`
- `devloop/AI_ASSISTANT_PLAN.md`
- `devloop/AI_ASSISTANT_MASTER_PLAN.md`
- `/scenarios` (веб-навигация по активным QA-сценариям)
