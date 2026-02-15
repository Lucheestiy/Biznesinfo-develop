#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeProvider(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "stub") return "stub";
  if (key === "openai") return "openai";
  if (key === "codex" || key === "codex-auth" || key === "codex_cli") return "codex";
  if (key === "minimax" || key === "mini-max" || key === "minimax-api" || key === "m2.5") return "minimax";
  return null;
}

function parseArgs(argv) {
  const out = {
    baseUrl: "http://127.0.0.1:8131",
    scenarios: path.join(repoRoot, "app", "qa", "ai-request", "scenarios.json"),
    reportsDir: path.join(repoRoot, "app", "qa", "ai-request", "reports"),
    email: process.env.QA_AI_EMAIL || "qa.ai.runner@example.com",
    password: process.env.QA_AI_PASSWORD || "QaRunner!234",
    name: process.env.QA_AI_NAME || "AI QA Runner",
    preparePaid: true,
    paidLimit: Number(process.env.QA_AI_PAID_LIMIT || 2000),
    maxScenarios: null,
    tags: [],
    beforeProvider: "codex",
    beforeModel: "",
    beforeLabel: "",
    afterProvider: "minimax",
    afterModel: "",
    afterLabel: "",
    skipJudge: false,
    judges: "kimi,minimax",
    judgeBatchSize: 5,
    beforeReport: "",
    beforeJudgeReport: "",
    afterReport: "",
    afterJudgeReport: "",
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--scenarios") out.scenarios = path.resolve(argv[++i]);
    else if (a === "--reports-dir") out.reportsDir = path.resolve(argv[++i]);
    else if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--prepare-paid") out.preparePaid = true;
    else if (a === "--no-prepare-paid") out.preparePaid = false;
    else if (a === "--paid-limit") out.paidLimit = Number(argv[++i] || 2000);
    else if (a === "--max-scenarios") {
      const n = Number(argv[++i] || 0);
      out.maxScenarios = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a === "--tag") {
      const tag = String(argv[++i] || "").trim();
      if (tag) out.tags.push(tag);
    } else if (a === "--before-provider") {
      out.beforeProvider = String(argv[++i] || "").trim();
    } else if (a === "--before-model") {
      out.beforeModel = String(argv[++i] || "").trim();
    } else if (a === "--before-label") {
      out.beforeLabel = String(argv[++i] || "").trim();
    } else if (a === "--after-provider") {
      out.afterProvider = String(argv[++i] || "").trim();
    } else if (a === "--after-model") {
      out.afterModel = String(argv[++i] || "").trim();
    } else if (a === "--after-label") {
      out.afterLabel = String(argv[++i] || "").trim();
    } else if (a === "--skip-judge") {
      out.skipJudge = true;
    } else if (a === "--judges") {
      out.judges = String(argv[++i] || "").trim() || "kimi,minimax";
    } else if (a === "--judge-batch-size") {
      out.judgeBatchSize = Math.max(1, Math.floor(Number(argv[++i] || 5) || 5));
    } else if (a === "--before-report") {
      out.beforeReport = String(argv[++i] || "").trim();
    } else if (a === "--before-judge-report") {
      out.beforeJudgeReport = String(argv[++i] || "").trim();
    } else if (a === "--after-report") {
      out.afterReport = String(argv[++i] || "").trim();
    } else if (a === "--after-judge-report") {
      out.afterJudgeReport = String(argv[++i] || "").trim();
    } else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: node app/scripts/run_ai_provider_benchmark.mjs [options]",
          "",
          "Provider options:",
          "  --before-provider NAME    Baseline provider (default codex)",
          "  --before-model NAME       Baseline model override",
          "  --before-label LABEL      Baseline label in output",
          "  --before-report PATH      Reuse existing baseline QA report (skip baseline QA run)",
          "  --before-judge-report PATH Reuse existing baseline judge report",
          "  --after-provider NAME     Candidate provider (default minimax)",
          "  --after-model NAME        Candidate model override",
          "  --after-label LABEL       Candidate label in output",
          "  --after-report PATH       Reuse existing candidate QA report (skip candidate QA run)",
          "  --after-judge-report PATH Reuse existing candidate judge report",
          "",
          "Run options:",
          "  --base-url URL            Base URL (default http://127.0.0.1:8131)",
          "  --scenarios PATH          Scenario JSON (default core scenarios.json)",
          "  --reports-dir PATH        Reports directory",
          "  --max-scenarios N         Limit scenario count",
          "  --tag TAG                 Scenario tag filter (repeatable)",
          "  --prepare-paid            Promote QA user to paid (default on)",
          "  --no-prepare-paid         Skip paid preparation",
          "  --paid-limit N            Daily paid limit used by QA runner",
          "",
          "Judge options:",
          "  --skip-judge              Skip judge pass (compare only strict QA)",
          "  --judges LIST             Judges list for usefulness scoring (default kimi,minimax)",
          "  --judge-batch-size N      Judge batch size (default 5)",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  const beforeProvider = normalizeProvider(out.beforeProvider);
  const afterProvider = normalizeProvider(out.afterProvider);
  if (!beforeProvider) throw new Error(`Unsupported --before-provider: ${out.beforeProvider}`);
  if (!afterProvider) throw new Error(`Unsupported --after-provider: ${out.afterProvider}`);
  out.beforeProvider = beforeProvider;
  out.afterProvider = afterProvider;
  if (!out.beforeLabel) out.beforeLabel = `${beforeProvider}${out.beforeModel ? `:${out.beforeModel}` : ""}`;
  if (!out.afterLabel) out.afterLabel = `${afterProvider}${out.afterModel ? `:${out.afterModel}` : ""}`;
  if (out.beforeReport) out.beforeReport = path.resolve(out.beforeReport);
  if (out.beforeJudgeReport) out.beforeJudgeReport = path.resolve(out.beforeJudgeReport);
  if (out.afterReport) out.afterReport = path.resolve(out.afterReport);
  if (out.afterJudgeReport) out.afterJudgeReport = path.resolve(out.afterJudgeReport);
  return out;
}

function safeNum(raw, fallback = 0) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pctDelta(after, before) {
  return Number((((safeNum(after) - safeNum(before)) * 100)).toFixed(2));
}

function roundDelta(after, before, digits = 3) {
  const scale = 10 ** digits;
  return Math.round((safeNum(after) - safeNum(before)) * scale) / scale;
}

function formatSigned(n, suffix = "") {
  const value = Number(n);
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

function runCommand({ label, cmd, args, env, allowExitCodes = [0] }) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const res = spawnSync(cmd, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) throw res.error;
  const exitCode = Number.isFinite(Number(res.status)) ? Number(res.status) : 1;
  if (!allowExitCodes.includes(exitCode)) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
  return `${res.stdout || ""}\n${res.stderr || ""}`;
}

function buildProviderEnv(baseEnv, provider, model) {
  const env = { ...baseEnv, AI_ASSISTANT_PROVIDER: provider };
  if (provider === "openai" && model) env.OPENAI_MODEL = model;
  if (provider === "codex" && model) env.CODEX_MODEL = model;
  if (provider === "minimax" && model) env.MINIMAX_MODEL = model;
  return env;
}

function extractPathByPrefix(output, prefix) {
  const re = new RegExp(`${prefix}\\s*:\\s*(.+)`, "i");
  const m = re.exec(String(output || ""));
  return m?.[1]?.trim() || null;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pickSummary(report) {
  const s = report?.summary || {};
  return {
    runId: String(s.runId || ""),
    scenarioFile: String(s.scenarioFile || ""),
    totalScenarios: safeNum(s.totalScenarios),
    passedScenarios: safeNum(s.passedScenarios),
    failedScenarios: safeNum(s.failedScenarios),
    passRate: safeNum(s.passRate),
    totalChecks: safeNum(s.totalChecks),
    passedChecks: safeNum(s.passedChecks),
    failedChecks: safeNum(s.failedChecks),
    checkPassRate: safeNum(s.checkPassRate),
    totalTurnsExecuted: safeNum(s.totalTurnsExecuted),
    avgTurnLatencyMs: safeNum(s.avgTurnLatencyMs),
    totalStubReplies: safeNum(s.totalStubReplies),
    totalBusyRetries: safeNum(s.totalBusyRetries),
    totalRateLimitRetries: safeNum(s.totalRateLimitRetries),
    totalStubRetries: safeNum(s.totalStubRetries),
    providerUsage: Array.isArray(s.providerUsage) ? s.providerUsage : [],
    modelUsage: Array.isArray(s.modelUsage) ? s.modelUsage : [],
  };
}

function mapJudgeSummary(judgeReport) {
  const out = new Map();
  for (const judge of Array.isArray(judgeReport?.judges) ? judgeReport.judges : []) {
    const key = String(judge?.judge || "").trim().toLowerCase();
    if (!key) continue;
    const s = judge?.summary || {};
    out.set(key, {
      averageUsefulness: safeNum(s.averageUsefulness, NaN),
      usefulRate: safeNum(s.usefulRate, NaN),
      averageUserSatisfaction: safeNum(s.averageUserSatisfaction, NaN),
      continueRate: safeNum(s.continueRate, NaN),
      genericFallbackRate: safeNum(s.genericFallbackRate, NaN),
      zeroUsefulnessCount: safeNum(s.zeroUsefulnessCount, NaN),
      total: safeNum(s.total, NaN),
    });
  }
  return out;
}

function compareScenarios(beforeReport, afterReport) {
  const beforeMap = new Map();
  const afterMap = new Map();

  for (const s of Array.isArray(beforeReport?.scenarios) ? beforeReport.scenarios : []) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    beforeMap.set(id, Boolean(s?.pass));
  }
  for (const s of Array.isArray(afterReport?.scenarios) ? afterReport.scenarios : []) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    afterMap.set(id, Boolean(s?.pass));
  }

  const ids = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
  const improved = [];
  const regressed = [];
  let unchangedPass = 0;
  let unchangedFail = 0;

  for (const id of ids) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
    if (b === true && a === false) regressed.push(id);
    else if (b === false && a === true) improved.push(id);
    else if (b === true && a === true) unchangedPass += 1;
    else if (b === false && a === false) unchangedFail += 1;
  }

  return { idsCompared: ids.length, improved, regressed, unchangedPass, unchangedFail };
}

function buildVerdict({ qaDelta, scenarioDiff, judgeDelta }) {
  const reasons = [];
  let score = 0;

  if (qaDelta.passRatePp > 0) {
    score += 2;
    reasons.push(`Pass-rate improved by ${qaDelta.passRatePp} pp`);
  } else if (qaDelta.passRatePp < 0) {
    score -= 2;
    reasons.push(`Pass-rate dropped by ${Math.abs(qaDelta.passRatePp)} pp`);
  }

  if (qaDelta.checkPassRatePp > 0) score += 1;
  else if (qaDelta.checkPassRatePp < 0) score -= 1;

  if (qaDelta.stubRepliesDelta < 0) score += 1;
  else if (qaDelta.stubRepliesDelta > 0) score -= 1;

  if (scenarioDiff.improved.length > scenarioDiff.regressed.length) score += 1;
  else if (scenarioDiff.improved.length < scenarioDiff.regressed.length) score -= 1;

  if (Array.isArray(judgeDelta) && judgeDelta.length > 0) {
    const avgUsefulnessDelta = judgeDelta
      .map((row) => row.averageUsefulnessDelta)
      .filter((v) => Number.isFinite(v))
      .reduce((sum, v) => sum + v, 0) / Math.max(1, judgeDelta.length);
    if (avgUsefulnessDelta > 0.05) {
      score += 1;
      reasons.push(`Judge average usefulness improved by ${avgUsefulnessDelta.toFixed(2)}`);
    } else if (avgUsefulnessDelta < -0.05) {
      score -= 1;
      reasons.push(`Judge average usefulness dropped by ${Math.abs(avgUsefulnessDelta).toFixed(2)}`);
    }
  }

  let result = "mixed";
  if (score >= 2) result = "improved";
  else if (score <= -2) result = "regressed";

  return { result, score, reasons };
}

function buildMarkdown(report) {
  const lines = [];
  const { before, after, deltas, scenarioDiff, judgeDelta, verdict } = report;

  lines.push(`# AI Provider Benchmark — ${report.runId}`);
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Scenario set: ${report.config.scenarios}`);
  lines.push(`- Max scenarios: ${report.config.maxScenarios ?? "all"}`);
  lines.push(`- Base URL: ${report.config.baseUrl}`);
  lines.push("");
  lines.push("## Compared Runs");
  lines.push("");
  lines.push(`- Before: ${before.label} (${before.summary.runId})`);
  lines.push(`  - QA report: ${before.qaReport}`);
  if (before.judgeReport) lines.push(`  - Judge report: ${before.judgeReport}`);
  if (before.summary.providerUsage.length > 0) {
    lines.push(`  - Provider usage: ${before.summary.providerUsage.map((r) => `${r.provider}=${r.turns}`).join(", ")}`);
  }
  if (before.summary.modelUsage.length > 0) {
    lines.push(`  - Model usage: ${before.summary.modelUsage.map((r) => `${r.model}=${r.turns}`).join(", ")}`);
  }
  lines.push(`- After: ${after.label} (${after.summary.runId})`);
  lines.push(`  - QA report: ${after.qaReport}`);
  if (after.judgeReport) lines.push(`  - Judge report: ${after.judgeReport}`);
  if (after.summary.providerUsage.length > 0) {
    lines.push(`  - Provider usage: ${after.summary.providerUsage.map((r) => `${r.provider}=${r.turns}`).join(", ")}`);
  }
  if (after.summary.modelUsage.length > 0) {
    lines.push(`  - Model usage: ${after.summary.modelUsage.map((r) => `${r.model}=${r.turns}`).join(", ")}`);
  }
  lines.push("");
  lines.push("## QA Delta");
  lines.push("");
  lines.push(`- Pass rate: ${(before.summary.passRate * 100).toFixed(2)}% -> ${(after.summary.passRate * 100).toFixed(2)}% (${formatSigned(deltas.passRatePp, " pp")})`);
  lines.push(`- Check pass rate: ${(before.summary.checkPassRate * 100).toFixed(2)}% -> ${(after.summary.checkPassRate * 100).toFixed(2)}% (${formatSigned(deltas.checkPassRatePp, " pp")})`);
  lines.push(`- Passed scenarios: ${before.summary.passedScenarios} -> ${after.summary.passedScenarios} (${formatSigned(deltas.passedScenariosDelta)})`);
  lines.push(`- Failed scenarios: ${before.summary.failedScenarios} -> ${after.summary.failedScenarios} (${formatSigned(deltas.failedScenariosDelta)})`);
  lines.push(`- Avg turn latency: ${before.summary.avgTurnLatencyMs}ms -> ${after.summary.avgTurnLatencyMs}ms (${formatSigned(deltas.avgTurnLatencyMsDelta, " ms")})`);
  lines.push(`- Stub replies: ${before.summary.totalStubReplies} -> ${after.summary.totalStubReplies} (${formatSigned(deltas.stubRepliesDelta)})`);
  lines.push(`- Busy retries: ${before.summary.totalBusyRetries} -> ${after.summary.totalBusyRetries} (${formatSigned(deltas.busyRetriesDelta)})`);
  lines.push(`- Rate-limit retries: ${before.summary.totalRateLimitRetries} -> ${after.summary.totalRateLimitRetries} (${formatSigned(deltas.rateLimitRetriesDelta)})`);
  lines.push("");
  lines.push("## Scenario Diff");
  lines.push("");
  lines.push(`- Compared scenarios: ${scenarioDiff.idsCompared}`);
  lines.push(`- Improved (fail -> pass): ${scenarioDiff.improved.length}${scenarioDiff.improved.length ? ` [${scenarioDiff.improved.join(", ")}]` : ""}`);
  lines.push(`- Regressed (pass -> fail): ${scenarioDiff.regressed.length}${scenarioDiff.regressed.length ? ` [${scenarioDiff.regressed.join(", ")}]` : ""}`);
  lines.push(`- Unchanged pass: ${scenarioDiff.unchangedPass}`);
  lines.push(`- Unchanged fail: ${scenarioDiff.unchangedFail}`);

  if (Array.isArray(judgeDelta) && judgeDelta.length > 0) {
    lines.push("");
    lines.push("## Judge Delta");
    lines.push("");
    for (const row of judgeDelta) {
      lines.push(`- ${row.judge}: avg usefulness ${formatSigned(row.averageUsefulnessDelta)}; useful-rate ${formatSigned(row.usefulRatePpDelta, " pp")}; user-satisfaction ${formatSigned(row.userSatisfactionPpDelta, " pp")}; continue-rate ${formatSigned(row.continueRatePpDelta, " pp")}; generic-fallback ${formatSigned(row.genericFallbackPpDelta, " pp")}`);
    }
  }

  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(`- Result: ${verdict.result}`);
  lines.push(`- Score: ${verdict.score}`);
  if (verdict.reasons.length === 0) lines.push("- Reasons: none");
  else {
    for (const reason of verdict.reasons) lines.push(`- ${reason}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function runQaAndJudgeCase({ label, provider, model, opts }) {
  const env = buildProviderEnv(process.env, provider, model);

  const qaArgs = [
    "app/scripts/ai-request-qa-runner.mjs",
    "--base-url",
    opts.baseUrl,
    "--scenarios",
    opts.scenarios,
    "--reports-dir",
    opts.reportsDir,
    "--email",
    opts.email,
    "--password",
    opts.password,
    "--name",
    opts.name,
    "--provider-override",
    provider,
  ];
  if (model) qaArgs.push("--provider-model-override", model);
  if (opts.preparePaid) {
    qaArgs.push("--prepare-paid", "--paid-limit", String(Math.max(1, Math.floor(opts.paidLimit || 2000))));
  } else {
    qaArgs.push("--no-prepare-paid");
  }
  if (opts.maxScenarios != null) qaArgs.push("--max-scenarios", String(opts.maxScenarios));
  for (const tag of opts.tags || []) qaArgs.push("--tag", tag);

  const qaOutput = runCommand({
    label: `${label} | QA run (${provider}${model ? `:${model}` : ""})`,
    cmd: "node",
    args: qaArgs,
    env,
    allowExitCodes: [0, 2, 3],
  });
  const qaReport = extractPathByPrefix(qaOutput, "Report JSON");
  if (!qaReport) throw new Error(`Unable to parse QA report path for ${label}`);

  let judgeReport = null;
  if (!opts.skipJudge) {
    judgeReport = runJudgeForReport({ label, qaReport, opts, env });
  }

  return { qaReport: path.resolve(qaReport), judgeReport: judgeReport ? path.resolve(judgeReport) : null };
}

function runJudgeForReport({ label, qaReport, opts, env }) {
  const judgeArgs = [
    "app/scripts/rate_ai_usefulness_with_judges.mjs",
    "--report",
    qaReport,
    "--out-dir",
    opts.reportsDir,
    "--judges",
    opts.judges,
    "--batch-size",
    String(opts.judgeBatchSize),
  ];
  const judgeOutput = runCommand({
    label: `${label} | Judge run (${opts.judges})`,
    cmd: "node",
    args: judgeArgs,
    env,
    allowExitCodes: [0, 3],
  });
  const judgeReport = extractPathByPrefix(judgeOutput, "Usefulness JSON");
  if (!judgeReport) throw new Error(`Unable to parse judge report path for ${label}`);
  return judgeReport;
}

function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(opts.reportsDir, { recursive: true });

  const beforeEnv = buildProviderEnv(process.env, opts.beforeProvider, opts.beforeModel);
  const afterEnv = buildProviderEnv(process.env, opts.afterProvider, opts.afterModel);

  const beforeRun = opts.beforeReport
    ? { qaReport: opts.beforeReport, judgeReport: opts.beforeJudgeReport || null }
    : runQaAndJudgeCase({
      label: opts.beforeLabel,
      provider: opts.beforeProvider,
      model: opts.beforeModel,
      opts,
    });
  const afterRun = opts.afterReport
    ? { qaReport: opts.afterReport, judgeReport: opts.afterJudgeReport || null }
    : runQaAndJudgeCase({
      label: opts.afterLabel,
      provider: opts.afterProvider,
      model: opts.afterModel,
      opts,
    });

  if (!opts.skipJudge && !beforeRun.judgeReport) {
    beforeRun.judgeReport = path.resolve(
      runJudgeForReport({ label: opts.beforeLabel, qaReport: beforeRun.qaReport, opts, env: beforeEnv }),
    );
  }
  if (!opts.skipJudge && !afterRun.judgeReport) {
    afterRun.judgeReport = path.resolve(
      runJudgeForReport({ label: opts.afterLabel, qaReport: afterRun.qaReport, opts, env: afterEnv }),
    );
  }

  const beforeQa = loadJson(beforeRun.qaReport);
  const afterQa = loadJson(afterRun.qaReport);
  const beforeSummary = pickSummary(beforeQa);
  const afterSummary = pickSummary(afterQa);

  const scenarioDiff = compareScenarios(beforeQa, afterQa);
  const deltas = {
    passRatePp: pctDelta(afterSummary.passRate, beforeSummary.passRate),
    checkPassRatePp: pctDelta(afterSummary.checkPassRate, beforeSummary.checkPassRate),
    passedScenariosDelta: roundDelta(afterSummary.passedScenarios, beforeSummary.passedScenarios, 0),
    failedScenariosDelta: roundDelta(afterSummary.failedScenarios, beforeSummary.failedScenarios, 0),
    avgTurnLatencyMsDelta: roundDelta(afterSummary.avgTurnLatencyMs, beforeSummary.avgTurnLatencyMs, 2),
    stubRepliesDelta: roundDelta(afterSummary.totalStubReplies, beforeSummary.totalStubReplies, 0),
    busyRetriesDelta: roundDelta(afterSummary.totalBusyRetries, beforeSummary.totalBusyRetries, 0),
    rateLimitRetriesDelta: roundDelta(afterSummary.totalRateLimitRetries, beforeSummary.totalRateLimitRetries, 0),
  };

  let judgeDelta = [];
  if (beforeRun.judgeReport && afterRun.judgeReport) {
    const beforeJudge = mapJudgeSummary(loadJson(beforeRun.judgeReport));
    const afterJudge = mapJudgeSummary(loadJson(afterRun.judgeReport));
    const commonJudges = Array.from(new Set([...beforeJudge.keys(), ...afterJudge.keys()])).sort();

    judgeDelta = commonJudges
      .filter((judge) => beforeJudge.has(judge) && afterJudge.has(judge))
      .map((judge) => {
        const b = beforeJudge.get(judge);
        const a = afterJudge.get(judge);
        return {
          judge,
          averageUsefulnessDelta: roundDelta(a.averageUsefulness, b.averageUsefulness, 3),
          usefulRatePpDelta: pctDelta(a.usefulRate, b.usefulRate),
          userSatisfactionPpDelta: pctDelta(a.averageUserSatisfaction, b.averageUserSatisfaction),
          continueRatePpDelta: pctDelta(a.continueRate, b.continueRate),
          genericFallbackPpDelta: pctDelta(a.genericFallbackRate, b.genericFallbackRate),
          zeroUsefulnessDelta: roundDelta(a.zeroUsefulnessCount, b.zeroUsefulnessCount, 0),
        };
      });
  }

  const verdict = buildVerdict({ qaDelta: deltas, scenarioDiff, judgeDelta });
  const runId = `provider-benchmark-${nowIsoCompact()}`;

  const out = {
    runId,
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: opts.baseUrl,
      scenarios: opts.scenarios,
      maxScenarios: opts.maxScenarios,
      tags: opts.tags,
      preparePaid: opts.preparePaid,
      paidLimit: opts.paidLimit,
      skipJudge: opts.skipJudge,
      judges: opts.skipJudge ? [] : opts.judges.split(",").map((j) => j.trim()).filter(Boolean),
      judgeBatchSize: opts.judgeBatchSize,
    },
    before: {
      label: opts.beforeLabel,
      provider: opts.beforeProvider,
      model: opts.beforeModel || null,
      qaReport: beforeRun.qaReport,
      judgeReport: beforeRun.judgeReport,
      summary: beforeSummary,
    },
    after: {
      label: opts.afterLabel,
      provider: opts.afterProvider,
      model: opts.afterModel || null,
      qaReport: afterRun.qaReport,
      judgeReport: afterRun.judgeReport,
      summary: afterSummary,
    },
    deltas,
    scenarioDiff,
    judgeDelta,
    verdict,
  };

  const jsonOut = path.join(opts.reportsDir, `${runId}.json`);
  const mdOut = path.join(opts.reportsDir, `${runId}.md`);
  const latestJson = path.join(opts.reportsDir, "latest.provider-benchmark.json");
  const latestMd = path.join(opts.reportsDir, "latest.provider-benchmark.md");

  fs.writeFileSync(jsonOut, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdOut, buildMarkdown(out), "utf8");
  fs.writeFileSync(latestJson, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestMd, buildMarkdown(out), "utf8");

  console.log(`\nProvider benchmark JSON: ${jsonOut}`);
  console.log(`Provider benchmark MD:   ${mdOut}`);
  console.log(`Verdict: ${verdict.result} (score ${verdict.score})`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
