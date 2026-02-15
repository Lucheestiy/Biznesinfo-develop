# AI Provider Benchmark — provider-benchmark-2026-02-15T04-43-44-876Z

- Generated: 2026-02-15T04:43:44.876Z
- Scenario set: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/scenarios.json
- Max scenarios: all
- Base URL: http://127.0.0.1:8131

## Compared Runs

- Before: codex (run-2026-02-15T04-30-04-338Z-3450511-q2zae)
  - QA report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/run-2026-02-15T04-30-04-338Z-3450511-q2zae.json
  - Judge report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/judge-2026-02-15T04-35-42-313Z.usefulness.json
  - Provider usage: codex=32
  - Model usage: gpt-5.3-codex=32
- After: minimax:MiniMax-M2.5 (run-2026-02-15T04-38-09-614Z-3465674-i0zgk)
  - QA report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/run-2026-02-15T04-38-09-614Z-3465674-i0zgk.json
  - Judge report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/judge-2026-02-15T04-41-02-238Z.usefulness.json
  - Provider usage: minimax=32
  - Model usage: MiniMax-M2.5=32

## QA Delta

- Pass rate: 100.00% -> 62.50% (-37.5 pp)
- Check pass rate: 100.00% -> 95.24% (-4.76 pp)
- Passed scenarios: 8 -> 5 (-3)
- Failed scenarios: 0 -> 3 (+3)
- Avg turn latency: 10549.13ms -> 3487.53ms (-7061.6 ms)
- Stub replies: 0 -> 0 (0)
- Busy retries: 0 -> 0 (0)
- Rate-limit retries: 0 -> 0 (0)

## Scenario Diff

- Compared scenarios: 8
- Improved (fail -> pass): 0
- Regressed (pass -> fail): 3 [UV002, UV003, UV004]
- Unchanged pass: 5
- Unchanged fail: 0

## Judge Delta

- kimi: avg usefulness -1.125; useful-rate -62.5 pp; user-satisfaction -22.5 pp; continue-rate -62.5 pp; generic-fallback +37.5 pp
- minimax: avg usefulness -1.25; useful-rate -50 pp; user-satisfaction -25.62 pp; continue-rate -50 pp; generic-fallback +50 pp

## Verdict

- Result: regressed
- Score: -5
- Pass-rate dropped by 37.5 pp
- Judge average usefulness dropped by 1.19

