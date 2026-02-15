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

function parseModelSpec(raw, position) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const parts = text.split(":");
  const provider = normalizeProvider(parts.shift() || "");
  if (!provider) return null;
  const model = parts.join(":").trim() || null;
  const id = `${provider}:${model || ""}`;
  return {
    id,
    label: model ? `${provider}:${model}` : provider,
    provider,
    model,
    position,
  };
}

function parseModels(raw) {
  const out = [];
  const seen = new Set();
  for (const part of String(raw || "").split(",")) {
    const model = parseModelSpec(part, out.length);
    if (!model) continue;
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    out.push(model);
  }
  return out;
}

function parseArgs(argv) {
  const out = {
    baseUrl: "http://127.0.0.1:8131",
    reportsDir: path.join(repoRoot, "app", "qa", "ai-request", "reports"),
    commonScenarios: path.join(repoRoot, "app", "qa", "ai-request", "scenarios.multi-model.master.json"),
    primaryScenarios: path.join(repoRoot, "app", "qa", "ai-request", "scenarios.regressions.user-ideas-multistep-variants.json"),
    email: process.env.QA_AI_EMAIL || "qa.ai.runner@example.com",
    password: process.env.QA_AI_PASSWORD || "QaRunner!234",
    name: process.env.QA_AI_NAME || "AI QA Runner",
    preparePaid: true,
    paidLimit: Number(process.env.QA_AI_PAID_LIMIT || 2600),
    commonTags: [],
    primaryTags: [],
    maxCommonScenarios: null,
    maxPrimaryScenarios: null,
    modelsRaw: process.env.QA_AI_MODEL_MATRIX || "minimax:MiniMax-M2.5,codex:gpt-5.3-codex,openai:gpt-4o-mini",
    primaryRaw: process.env.QA_AI_PRIMARY_MODEL || "minimax:MiniMax-M2.5",
    skipJudge: false,
    judges: process.env.QA_AI_JUDGES || "kimi,minimax,codex,gemini,droid",
    judgeBatchSize: Number(process.env.QA_AI_JUDGE_BATCH_SIZE || 5),
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = String(argv[++i] || out.baseUrl);
    else if (a === "--reports-dir") out.reportsDir = path.resolve(String(argv[++i] || out.reportsDir));
    else if (a === "--common-scenarios") out.commonScenarios = path.resolve(String(argv[++i] || out.commonScenarios));
    else if (a === "--primary-scenarios") out.primaryScenarios = path.resolve(String(argv[++i] || out.primaryScenarios));
    else if (a === "--email") out.email = String(argv[++i] || out.email);
    else if (a === "--password") out.password = String(argv[++i] || out.password);
    else if (a === "--name") out.name = String(argv[++i] || out.name);
    else if (a === "--prepare-paid") out.preparePaid = true;
    else if (a === "--no-prepare-paid") out.preparePaid = false;
    else if (a === "--paid-limit") out.paidLimit = Number(argv[++i] || out.paidLimit);
    else if (a === "--common-tag") out.commonTags.push(String(argv[++i] || "").trim());
    else if (a === "--primary-tag") out.primaryTags.push(String(argv[++i] || "").trim());
    else if (a === "--max-common-scenarios") {
      const n = Number(argv[++i] || 0);
      out.maxCommonScenarios = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a === "--max-primary-scenarios") {
      const n = Number(argv[++i] || 0);
      out.maxPrimaryScenarios = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a === "--models") out.modelsRaw = String(argv[++i] || out.modelsRaw);
    else if (a === "--primary-model") out.primaryRaw = String(argv[++i] || out.primaryRaw);
    else if (a === "--skip-judge") out.skipJudge = true;
    else if (a === "--judges") out.judges = String(argv[++i] || out.judges);
    else if (a === "--judge-batch-size") out.judgeBatchSize = Math.max(1, Math.floor(Number(argv[++i] || 5) || 5));
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: node app/scripts/run_ai_model_matrix.mjs [options]",
          "",
          "Core options:",
          "  --base-url URL                 App base URL (default http://127.0.0.1:8131)",
          "  --reports-dir PATH             Output reports directory",
          "  --common-scenarios PATH        Shared regression pack for every model",
          "  --primary-scenarios PATH       Deep pack for primary model only",
          "  --models LIST                  Comma list: provider[:model],provider[:model],...",
          "  --primary-model SPEC           Primary model spec provider[:model]",
          "",
          "Run options:",
          "  --prepare-paid / --no-prepare-paid",
          "  --paid-limit N",
          "  --max-common-scenarios N",
          "  --max-primary-scenarios N",
          "  --common-tag TAG               Repeatable",
          "  --primary-tag TAG              Repeatable",
          "",
          "Judge options:",
          "  --skip-judge",
          "  --judges LIST                  default kimi,minimax,codex,gemini,droid",
          "  --judge-batch-size N",
          "",
          "Examples:",
          "  node app/scripts/run_ai_model_matrix.mjs",
          "  node app/scripts/run_ai_model_matrix.mjs --models minimax:MiniMax-M2.5,codex:gpt-5.3-codex --primary-model minimax:MiniMax-M2.5 --max-common-scenarios 120",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  out.commonTags = out.commonTags.filter(Boolean);
  out.primaryTags = out.primaryTags.filter(Boolean);
  return out;
}

function runCommand({ label, cmd, args, env, allowExitCodes = [0] }) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const res = spawnSync(cmd, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 40,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) throw res.error;
  const exitCode = Number.isFinite(Number(res.status)) ? Number(res.status) : 1;
  if (!allowExitCodes.includes(exitCode)) throw new Error(`${label} failed with exit code ${res.status}`);
  return `${res.stdout || ""}\n${res.stderr || ""}`;
}

function extractPathByPrefix(output, prefix) {
  const re = new RegExp(`${prefix}\\s*:\\s*(.+)`, "i");
  const m = re.exec(String(output || ""));
  return m?.[1]?.trim() || null;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeNum(raw, fallback = 0) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pct(raw) {
  return safeNum(raw) * 100;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(safeNum(value) * scale) / scale;
}

function signed(n, digits = 2, suffix = "") {
  if (!Number.isFinite(Number(n))) return "n/a";
  const value = round(n, digits);
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

function pickSummary(report) {
  const s = report?.summary || {};
  return {
    runId: String(s.runId || ""),
    totalScenarios: safeNum(s.totalScenarios),
    passedScenarios: safeNum(s.passedScenarios),
    failedScenarios: safeNum(s.failedScenarios),
    passRate: safeNum(s.passRate),
    totalChecks: safeNum(s.totalChecks),
    passedChecks: safeNum(s.passedChecks),
    checkPassRate: safeNum(s.checkPassRate),
    totalTurnsExecuted: safeNum(s.totalTurnsExecuted),
    avgTurnLatencyMs: safeNum(s.avgTurnLatencyMs),
    totalStubReplies: safeNum(s.totalStubReplies),
    totalBusyRetries: safeNum(s.totalBusyRetries),
    totalRateLimitRetries: safeNum(s.totalRateLimitRetries),
    totalStubRetries: safeNum(s.totalStubRetries),
    providerUsage: Array.isArray(s.providerUsage) ? s.providerUsage : [],
    modelUsage: Array.isArray(s.modelUsage) ? s.modelUsage : [],
    targetReached: Boolean(s.targetReached),
  };
}

function summarizeJudge(judgeReport) {
  const rows = Array.isArray(judgeReport?.judges) ? judgeReport.judges : [];
  if (rows.length === 0) {
    return {
      judges: [],
      avgUsefulness: null,
      avgUserSatisfaction: null,
      avgContinueRate: null,
      avgGenericFallbackRate: null,
    };
  }

  const agg = {
    usefulness: [],
    satisfaction: [],
    continueRate: [],
    genericFallback: [],
  };
  const judgeNames = [];

  for (const judge of rows) {
    const name = String(judge?.judge || "").trim().toLowerCase();
    if (name) judgeNames.push(name);
    const s = judge?.summary || {};
    if (Number.isFinite(Number(s.averageUsefulness))) agg.usefulness.push(Number(s.averageUsefulness));
    if (Number.isFinite(Number(s.averageUserSatisfaction))) agg.satisfaction.push(Number(s.averageUserSatisfaction));
    if (Number.isFinite(Number(s.continueRate))) agg.continueRate.push(Number(s.continueRate));
    if (Number.isFinite(Number(s.genericFallbackRate))) agg.genericFallback.push(Number(s.genericFallbackRate));
  }

  const mean = (arr) => (arr.length ? arr.reduce((sum, n) => sum + n, 0) / arr.length : null);
  return {
    judges: judgeNames,
    avgUsefulness: mean(agg.usefulness),
    avgUserSatisfaction: mean(agg.satisfaction),
    avgContinueRate: mean(agg.continueRate),
    avgGenericFallbackRate: mean(agg.genericFallback),
  };
}

function runQaAndJudgePack({ packLabel, modelCase, scenarios, tags, maxScenarios, opts }) {
  const env = {
    ...process.env,
    AI_ASSISTANT_ALLOW_PROVIDER_OVERRIDE: "1",
  };

  const qaArgs = [
    "app/scripts/ai-request-qa-runner.mjs",
    "--base-url",
    opts.baseUrl,
    "--scenarios",
    scenarios,
    "--reports-dir",
    opts.reportsDir,
    "--email",
    opts.email,
    "--password",
    opts.password,
    "--name",
    opts.name,
    "--provider-override",
    modelCase.provider,
  ];
  if (modelCase.model) qaArgs.push("--provider-model-override", modelCase.model);
  if (opts.preparePaid) qaArgs.push("--prepare-paid", "--paid-limit", String(Math.max(1, Math.floor(opts.paidLimit || 2600))));
  else qaArgs.push("--no-prepare-paid");
  if (maxScenarios != null) qaArgs.push("--max-scenarios", String(maxScenarios));
  for (const tag of tags || []) {
    if (tag) qaArgs.push("--tag", tag);
  }

  const qaOutput = runCommand({
    label: `${modelCase.label} | ${packLabel} | QA`,
    cmd: "node",
    args: qaArgs,
    env,
    allowExitCodes: [0, 2, 3],
  });
  const qaReportPath = extractPathByPrefix(qaOutput, "Report JSON");
  if (!qaReportPath) throw new Error(`Unable to parse QA report path for ${modelCase.label} (${packLabel})`);

  let judgeReportPath = null;
  if (!opts.skipJudge) {
    const judgeArgs = [
      "app/scripts/rate_ai_usefulness_with_judges.mjs",
      "--report",
      path.resolve(qaReportPath),
      "--out-dir",
      opts.reportsDir,
      "--judges",
      opts.judges,
      "--batch-size",
      String(opts.judgeBatchSize),
    ];
    const judgeOutput = runCommand({
      label: `${modelCase.label} | ${packLabel} | Judges (${opts.judges})`,
      cmd: "node",
      args: judgeArgs,
      env,
      allowExitCodes: [0, 3],
    });
    judgeReportPath = extractPathByPrefix(judgeOutput, "Usefulness JSON");
    if (!judgeReportPath) throw new Error(`Unable to parse judge report path for ${modelCase.label} (${packLabel})`);
  }

  const qaReport = loadJson(path.resolve(qaReportPath));
  const qaSummary = pickSummary(qaReport);
  const judgeSummary = judgeReportPath ? summarizeJudge(loadJson(path.resolve(judgeReportPath))) : null;

  return {
    qaReport: path.resolve(qaReportPath),
    judgeReport: judgeReportPath ? path.resolve(judgeReportPath) : null,
    qaSummary,
    judgeSummary,
  };
}

function loadPreviousLatest(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return loadJson(filePath);
  } catch {
    return null;
  }
}

function buildProgress(current, previousById) {
  if (!current || !previousById) return null;
  const prev = previousById.get(current.model.id);
  if (!prev || !prev.common || !prev.common.qaSummary) return null;

  const prevCommon = prev.common.qaSummary;
  const nowCommon = current.common.qaSummary;
  const prevJudge = prev.common.judgeSummary || null;
  const nowJudge = current.common.judgeSummary || null;

  return {
    passRatePp: pct(nowCommon.passRate) - pct(prevCommon.passRate),
    checkPassRatePp: pct(nowCommon.checkPassRate) - pct(prevCommon.checkPassRate),
    avgTurnLatencyMs: nowCommon.avgTurnLatencyMs - prevCommon.avgTurnLatencyMs,
    stubReplies: nowCommon.totalStubReplies - prevCommon.totalStubReplies,
    avgUsefulness: nowJudge && prevJudge ? safeNum(nowJudge.avgUsefulness, NaN) - safeNum(prevJudge.avgUsefulness, NaN) : null,
    avgUserSatisfactionPp:
      nowJudge && prevJudge
        ? pct(safeNum(nowJudge.avgUserSatisfaction, NaN)) - pct(safeNum(prevJudge.avgUserSatisfaction, NaN))
        : null,
  };
}

function formatJudgeSummary(j) {
  if (!j) return "n/a";
  const bits = [];
  if (Number.isFinite(Number(j.avgUsefulness))) bits.push(`usefulness ${round(j.avgUsefulness, 3)}`);
  if (Number.isFinite(Number(j.avgUserSatisfaction))) bits.push(`satisfaction ${round(pct(j.avgUserSatisfaction), 1)}%`);
  if (Number.isFinite(Number(j.avgContinueRate))) bits.push(`continue ${round(pct(j.avgContinueRate), 1)}%`);
  if (Number.isFinite(Number(j.avgGenericFallbackRate))) bits.push(`generic-fallback ${round(pct(j.avgGenericFallbackRate), 1)}%`);
  return bits.join(", ") || "n/a";
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# AI Model Matrix Report — ${report.runId}`);
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Base URL: ${report.config.baseUrl}`);
  lines.push(`- Common scenarios: ${report.config.commonScenarios}`);
  lines.push(`- Primary scenarios: ${report.config.primaryScenarios || "(disabled)"}`);
  lines.push(`- Primary model: ${report.config.primaryModel}`);
  lines.push(`- Judges: ${report.config.skipJudge ? "(skipped)" : report.config.judges.join(", ")}`);
  if (report.previousRunId) lines.push(`- Previous run: ${report.previousRunId}`);
  lines.push("");
  lines.push("## Common Pack Results");
  lines.push("");
  lines.push("| Model | Pass-rate | Checks | Avg latency | Stub replies | Judges |");
  lines.push("|---|---:|---:|---:|---:|---|");
  for (const row of report.results) {
    const s = row.common.qaSummary;
    lines.push(
      `| ${row.model.label} | ${round(pct(s.passRate), 1)}% (${s.passedScenarios}/${s.totalScenarios}) | ${round(pct(s.checkPassRate), 1)}% | ${round(s.avgTurnLatencyMs, 1)} ms | ${s.totalStubReplies} | ${formatJudgeSummary(row.common.judgeSummary)} |`,
    );
  }
  lines.push("");

  const primary = report.results.find((row) => row.model.id === report.primaryModelId);
  if (primary && primary.primary) {
    const s = primary.primary.qaSummary;
    lines.push("## Primary Deep Pack");
    lines.push("");
    lines.push(`- Model: ${primary.model.label}`);
    lines.push(`- Pass-rate: ${round(pct(s.passRate), 1)}% (${s.passedScenarios}/${s.totalScenarios})`);
    lines.push(`- Check pass-rate: ${round(pct(s.checkPassRate), 1)}%`);
    lines.push(`- Avg turn latency: ${round(s.avgTurnLatencyMs, 1)} ms`);
    lines.push(`- Stub replies: ${s.totalStubReplies}`);
    lines.push(`- Judges: ${formatJudgeSummary(primary.primary.judgeSummary)}`);
    lines.push("");
  }

  lines.push("## Progress (Was -> Now)");
  lines.push("");
  let progressCount = 0;
  for (const row of report.results) {
    if (!row.progress) continue;
    progressCount += 1;
    lines.push(`### ${row.model.label}`);
    lines.push(
      `- Pass-rate: ${round(pct(row.previous.common.qaSummary.passRate), 1)}% -> ${round(pct(row.common.qaSummary.passRate), 1)}% (${signed(row.progress.passRatePp, 1, " pp")})`,
    );
    lines.push(
      `- Check pass-rate: ${round(pct(row.previous.common.qaSummary.checkPassRate), 1)}% -> ${round(pct(row.common.qaSummary.checkPassRate), 1)}% (${signed(row.progress.checkPassRatePp, 1, " pp")})`,
    );
    lines.push(
      `- Avg latency: ${round(row.previous.common.qaSummary.avgTurnLatencyMs, 1)} ms -> ${round(row.common.qaSummary.avgTurnLatencyMs, 1)} ms (${signed(row.progress.avgTurnLatencyMs, 1, " ms")})`,
    );
    lines.push(
      `- Stub replies: ${row.previous.common.qaSummary.totalStubReplies} -> ${row.common.qaSummary.totalStubReplies} (${signed(row.progress.stubReplies, 0)})`,
    );
    if (Number.isFinite(Number(row.progress.avgUsefulness))) {
      const prevUsefulness = row.previous.common.judgeSummary?.avgUsefulness;
      const nowUsefulness = row.common.judgeSummary?.avgUsefulness;
      lines.push(
        `- Judge avg usefulness: ${round(prevUsefulness, 3)} -> ${round(nowUsefulness, 3)} (${signed(row.progress.avgUsefulness, 3)})`,
      );
    }
    if (Number.isFinite(Number(row.progress.avgUserSatisfactionPp))) {
      const prevSat = row.previous.common.judgeSummary?.avgUserSatisfaction;
      const nowSat = row.common.judgeSummary?.avgUserSatisfaction;
      lines.push(
        `- Judge user satisfaction: ${round(pct(prevSat), 1)}% -> ${round(pct(nowSat), 1)}% (${signed(row.progress.avgUserSatisfactionPp, 1, " pp")})`,
      );
    }
    lines.push("");
  }
  if (progressCount === 0) {
    lines.push("- No previous matrix run found; baseline established.");
    lines.push("");
  }

  lines.push("## Artifacts");
  lines.push("");
  for (const row of report.results) {
    lines.push(`- ${row.model.label} common QA: ${row.common.qaReport}`);
    if (row.common.judgeReport) lines.push(`  judges: ${row.common.judgeReport}`);
    if (row.primary) {
      lines.push(`  primary QA: ${row.primary.qaReport}`);
      if (row.primary.judgeReport) lines.push(`  primary judges: ${row.primary.judgeReport}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(opts.reportsDir, { recursive: true });

  const models = parseModels(opts.modelsRaw);
  if (models.length === 0) throw new Error("No valid models provided. Use --models provider[:model],...");

  const primarySpec = parseModelSpec(opts.primaryRaw, 0);
  const primaryModel = primarySpec
    ? models.find((m) => m.id === primarySpec.id || (m.provider === primarySpec.provider && m.model === primarySpec.model))
    : null;
  const effectivePrimary = primaryModel || models[0];

  const latestMatrixPath = path.join(opts.reportsDir, "latest.model-matrix.json");
  const previous = loadPreviousLatest(latestMatrixPath);
  const previousById = new Map(
    (Array.isArray(previous?.results) ? previous.results : [])
      .filter((row) => row && row.model && typeof row.model.id === "string")
      .map((row) => [row.model.id, row]),
  );

  const results = [];
  for (const modelCase of models) {
    const common = runQaAndJudgePack({
      packLabel: "common-pack",
      modelCase,
      scenarios: opts.commonScenarios,
      tags: opts.commonTags,
      maxScenarios: opts.maxCommonScenarios,
      opts,
    });

    let primary = null;
    if (modelCase.id === effectivePrimary.id && opts.primaryScenarios) {
      primary = runQaAndJudgePack({
        packLabel: "primary-pack",
        modelCase,
        scenarios: opts.primaryScenarios,
        tags: opts.primaryTags,
        maxScenarios: opts.maxPrimaryScenarios,
        opts,
      });
    }

    const row = {
      model: modelCase,
      common,
      primary,
      previous: previousById.get(modelCase.id) || null,
    };
    row.progress = buildProgress(row, previousById);
    results.push(row);
  }

  const runId = `model-matrix-${nowIsoCompact()}`;
  const out = {
    runId,
    generatedAt: new Date().toISOString(),
    previousRunId: String(previous?.runId || "").trim() || null,
    primaryModelId: effectivePrimary.id,
    config: {
      baseUrl: opts.baseUrl,
      reportsDir: opts.reportsDir,
      commonScenarios: opts.commonScenarios,
      primaryScenarios: opts.primaryScenarios || null,
      commonTags: opts.commonTags,
      primaryTags: opts.primaryTags,
      maxCommonScenarios: opts.maxCommonScenarios,
      maxPrimaryScenarios: opts.maxPrimaryScenarios,
      preparePaid: opts.preparePaid,
      paidLimit: opts.paidLimit,
      skipJudge: opts.skipJudge,
      judges: opts.skipJudge ? [] : opts.judges.split(",").map((x) => x.trim()).filter(Boolean),
      judgeBatchSize: opts.judgeBatchSize,
      models: models.map((m) => m.label),
      primaryModel: effectivePrimary.label,
    },
    results,
  };

  const jsonOut = path.join(opts.reportsDir, `${runId}.json`);
  const mdOut = path.join(opts.reportsDir, `${runId}.md`);
  const latestJson = path.join(opts.reportsDir, "latest.model-matrix.json");
  const latestMd = path.join(opts.reportsDir, "latest.model-matrix.md");

  fs.writeFileSync(jsonOut, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdOut, buildMarkdown(out), "utf8");
  fs.writeFileSync(latestJson, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestMd, buildMarkdown(out), "utf8");

  process.stdout.write(`\nModel matrix JSON: ${jsonOut}\n`);
  process.stdout.write(`Model matrix MD:   ${mdOut}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
