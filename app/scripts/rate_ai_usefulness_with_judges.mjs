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

function parseArgs(argv) {
  const out = {
    report: path.join(repoRoot, "app", "qa", "ai-request", "reports", "latest.json"),
    outDir: path.join(repoRoot, "app", "qa", "ai-request", "reports"),
    judges: ["gemini", "kimi"],
    batchSize: 5,
    maxScenarios: null,
    onlyScenarioIds: [],
    minAvg: null,
    minUsefulRate: null,
    maxZeroUsefulness: null,
    minUserSatisfaction: null,
    minContinueRate: null,
    maxGenericFallbackRate: null,
    minGeminiAvg: null,
    minKimiAvg: null,
    minMinimaxAvg: null,
    minGeminiUsefulRate: null,
    minKimiUsefulRate: null,
    minMinimaxUsefulRate: null,
    failExitCode: 3,
  };

  const parseNumberOrNull = (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const parseRateOrNull = (raw) => {
    const n = parseNumberOrNull(raw);
    if (n == null) return null;
    if (n > 1) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
  };
  const normalizeJudge = (raw) => {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) return null;
    if (key === "gemini") return "gemini";
    if (key === "kimi") return "kimi";
    if (key === "minimax" || key === "mini-max" || key === "m2.1" || key === "m2_1") return "minimax";
    return null;
  };
  let explicitJudgeSelection = false;
  const setJudges = (values) => {
    const outJudges = [];
    const seen = new Set();
    for (const raw of values) {
      const judge = normalizeJudge(raw);
      if (!judge || seen.has(judge)) continue;
      seen.add(judge);
      outJudges.push(judge);
    }
    if (outJudges.length > 0) out.judges = outJudges;
  };
  const addJudge = (value, options = {}) => {
    const preserveDefaults = Boolean(options?.preserveDefaults);
    if (!explicitJudgeSelection && !preserveDefaults) {
      out.judges = [];
      explicitJudgeSelection = true;
    }
    const judge = normalizeJudge(value);
    if (!judge) return;
    if (!out.judges.includes(judge)) out.judges.push(judge);
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") out.report = path.resolve(argv[++i]);
    else if (a === "--out-dir") out.outDir = path.resolve(argv[++i]);
    else if (a === "--judges") {
      explicitJudgeSelection = true;
      setJudges(String(argv[++i] || "").split(/[,\s]+/u));
    }
    else if (a === "--judge") addJudge(argv[++i]);
    else if (a === "--with-minimax") addJudge("minimax", { preserveDefaults: true });
    else if (a === "--batch-size") out.batchSize = Math.max(1, Number(argv[++i] || 5));
    else if (a === "--max-scenarios") {
      const n = Number(argv[++i] || 0);
      out.maxScenarios = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a === "--id") {
      const id = String(argv[++i] || "").trim();
      if (id) out.onlyScenarioIds.push(id);
    } else if (a === "--min-avg") {
      out.minAvg = parseNumberOrNull(argv[++i]);
    } else if (a === "--min-useful-rate") {
      out.minUsefulRate = parseRateOrNull(argv[++i]);
    } else if (a === "--max-zero-usefulness") {
      out.maxZeroUsefulness = Math.max(0, Math.floor(Number(argv[++i] || 0)));
    } else if (a === "--min-user-satisfaction") {
      out.minUserSatisfaction = parseRateOrNull(argv[++i]);
    } else if (a === "--min-continue-rate") {
      out.minContinueRate = parseRateOrNull(argv[++i]);
    } else if (a === "--max-generic-fallback-rate") {
      out.maxGenericFallbackRate = parseRateOrNull(argv[++i]);
    } else if (a === "--min-gemini-avg") {
      out.minGeminiAvg = parseNumberOrNull(argv[++i]);
    } else if (a === "--min-kimi-avg") {
      out.minKimiAvg = parseNumberOrNull(argv[++i]);
    } else if (a === "--min-minimax-avg") {
      out.minMinimaxAvg = parseNumberOrNull(argv[++i]);
    } else if (a === "--min-gemini-useful-rate") {
      out.minGeminiUsefulRate = parseRateOrNull(argv[++i]);
    } else if (a === "--min-kimi-useful-rate") {
      out.minKimiUsefulRate = parseRateOrNull(argv[++i]);
    } else if (a === "--min-minimax-useful-rate") {
      out.minMinimaxUsefulRate = parseRateOrNull(argv[++i]);
    } else if (a === "--fail-exit-code") {
      const code = Number(argv[++i] || 3);
      out.failExitCode = Number.isFinite(code) ? Math.max(1, Math.floor(code)) : 3;
    } else if (a === "--help" || a === "-h") {
      console.log([
        "Usage: node app/scripts/rate_ai_usefulness_with_judges.mjs [options]",
        "",
        "Options:",
        "  --report PATH            QA report JSON with multi-turn assistant replies",
        "  --out-dir PATH           Output directory for judge reports",
        "  --judges LIST            Judges list (comma-separated): gemini,kimi,minimax",
        "  --judge NAME             Add a judge (repeatable): gemini|kimi|minimax",
        "  --with-minimax           Include MiniMax judge via Droid CLI",
        "  --batch-size N           Scenarios per judge prompt (default 5)",
        "  --max-scenarios N        Rate first N scenarios",
        "  --id SCENARIO_ID         Rate only selected scenario id (repeatable)",
        "  --min-avg N              Minimum average usefulness required for each judge (0..5)",
        "  --min-useful-rate R      Minimum useful-rate required for each judge (0..1 or 0..100%)",
        "  --max-zero-usefulness N  Maximum zero-usefulness count allowed for each judge",
        "  --min-user-satisfaction R     Minimum real-user satisfaction (0..1 or 0..100%)",
        "  --min-continue-rate R         Minimum rate where judge says user would continue (0..1 or 0..100%)",
        "  --max-generic-fallback-rate R Maximum rate of generic fallback answers (0..1 or 0..100%)",
        "  --min-gemini-avg N       Minimum Gemini average usefulness",
        "  --min-kimi-avg N         Minimum Kimi average usefulness",
        "  --min-minimax-avg N      Minimum MiniMax average usefulness",
        "  --min-gemini-useful-rate R  Minimum Gemini useful-rate (0..1 or %)",
        "  --min-kimi-useful-rate R    Minimum Kimi useful-rate (0..1 or %)",
        "  --min-minimax-useful-rate R  Minimum MiniMax useful-rate (0..1 or %)",
        "  --fail-exit-code N       Exit code when quality gate fails (default 3)",
      ].join("\n"));
      process.exit(0);
    }
  }

  return out;
}

function isGateConfigured(opts) {
  return (
    opts.minAvg != null ||
    opts.minUsefulRate != null ||
    opts.maxZeroUsefulness != null ||
    opts.minUserSatisfaction != null ||
    opts.minContinueRate != null ||
    opts.maxGenericFallbackRate != null ||
    opts.minGeminiAvg != null ||
    opts.minKimiAvg != null ||
    opts.minMinimaxAvg != null ||
    opts.minGeminiUsefulRate != null ||
    opts.minKimiUsefulRate != null ||
    opts.minMinimaxUsefulRate != null
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function truncate(raw, n) {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return `${s.slice(0, Math.max(0, n - 1)).trim()}…`;
}

function extractJsonCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  const body = fenced?.[1] ? fenced[1].trim() : raw;
  if (!body) return "";

  if (body.startsWith("{") && body.endsWith("}")) return body;
  if (body.startsWith("[") && body.endsWith("]")) return body;

  const firstObj = body.indexOf("{");
  const lastObj = body.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) return body.slice(firstObj, lastObj + 1).trim();

  const firstArr = body.indexOf("[");
  const lastArr = body.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) return body.slice(firstArr, lastArr + 1).trim();

  return body;
}

function stripJsonHostileControlChars(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function mkScenarioPayload(s) {
  return {
    id: s.id,
    title: s.title,
    personaGoal: s.personaGoal || "",
    passInStrictHarness: Boolean(s.pass),
    turns: (s.turns || []).map((t) => ({
      turn: t.turn,
      user: truncate(t.user || "", 260),
      assistant: truncate(t.reply || "", 900),
    })),
  };
}

function buildJudgePrompt(judgeName, scenarios) {
  const payload = {
    judge: judgeName,
    task: "Rate usefulness as a real frustrated business user in realistic multi-turn sourcing conversations.",
    rubric: {
      scale: {
        0: "Бесполезно: не по запросу, ломает контекст, дает мусор.",
        1: "Почти бесполезно: очень слабая практическая ценность.",
        2: "Частично полезно: есть польза, но много критичных проблем.",
        3: "Рабочий минимум: можно использовать с правками.",
        4: "Полезно: хорошо помогает в задаче.",
        5: "Очень полезно: точный, практичный и надежный ответ.",
      },
      dimensions: [
        "Relevance to user intent",
        "Geo adherence and context continuity",
        "Actionability and concrete next steps",
        "Non-hallucination and honesty about limits",
        "Formatting quality for requested mode (ranking/template/checklist)",
        "Real-user trust: would a rushed buyer continue this dialog?",
        "Penalty: generic fallback after user gives concrete constraints",
      ],
      usefulThreshold: 3,
    },
    instructions: [
      "Act as a real paying user and judge if this is actually helpful in practice.",
      "Penalize wrong city, irrelevant supplier list, generic filler, refusal-only behavior.",
      "Strongly penalize when assistant previously gave concrete candidates but later falls back to generic rubric advice after user clarification.",
      "If user gives extra constraints (quality/spec/logistics), continuity is mandatory.",
      "Do not use any external tools; evaluate only transcript content.",
      "Return JSON only.",
    ],
    requiredJsonSchema: {
      judge: judgeName,
      ratings: [
        {
          scenarioId: "S001",
          usefulness: "integer 0..5",
          verdict: "useful|not_useful",
          confidence: "number 0..1",
          userSatisfaction: "number 0..1 (how satisfied real user would be)",
          wouldContinue: "boolean (would real user continue conversation?)",
          feltGenericFallback: "boolean (assistant dropped to generic advice instead of concrete progress)",
          continuityScore: "integer 0..5",
          reasons: ["short reason 1", "short reason 2"],
          criticalIssues: ["optional issue"],
          strengths: ["optional strength"],
          nextUserProbe: "optional short realistic follow-up message that user might type",
        },
      ],
    },
    scenarios,
  };

  return [
    "You are an external QA judge for Biznesinfo AI assistant.",
    "Return ONLY valid JSON. No markdown, no comments, no extra keys outside schema intent.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function runJudge(judge, prompt) {
  if (judge === "gemini") {
    const proc = spawnSync(
      "gemini",
      [
        "--output-format",
        "text",
        "-p",
        "Rate the scenarios and return JSON only.",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        input: prompt,
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  if (judge === "kimi") {
    const proc = spawnSync(
      "kimi",
      ["--print", "--no-thinking", "--output-format", "text", "--final-message-only", "-p", prompt],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  if (judge === "minimax") {
    const proc = spawnSync(
      "droid",
      ["exec", "--output-format", "text", "--model", "custom:MiniMax-M2.1"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        input: prompt,
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  throw new Error(`Unknown judge: ${judge}`);
}

function validateJudgeBatch(parsed, judge, expectedIds) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("judge output is not an object");
  }

  const ratings = Array.isArray(parsed.ratings) ? parsed.ratings : [];
  if (ratings.length === 0) throw new Error("ratings array is empty");

  const byId = new Map();
  for (const row of ratings) {
    const scenarioId = String(row?.scenarioId || "").trim();
    if (!scenarioId) continue;
    const usefulnessNum = Number(row?.usefulness);
    const usefulness = Number.isFinite(usefulnessNum) ? Math.max(0, Math.min(5, Math.round(usefulnessNum))) : null;
    if (usefulness == null) continue;

    const verdict = String(row?.verdict || "").trim().toLowerCase() === "useful" || usefulness >= 3 ? "useful" : "not_useful";
    const confidenceRaw = Number(row?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : null;
    const userSatisfactionRaw = Number(row?.userSatisfaction);
    const userSatisfaction = Number.isFinite(userSatisfactionRaw)
      ? Math.max(0, Math.min(1, userSatisfactionRaw))
      : Number((usefulness / 5).toFixed(3));
    const wouldContinue = typeof row?.wouldContinue === "boolean" ? row.wouldContinue : usefulness >= 3;
    const feltGenericFallback = Boolean(row?.feltGenericFallback);
    const continuityRaw = Number(row?.continuityScore);
    const continuityScore = Number.isFinite(continuityRaw) ? Math.max(0, Math.min(5, Math.round(continuityRaw))) : usefulness;
    const nextUserProbe = truncate(String(row?.nextUserProbe || ""), 180);

    const reasons = Array.isArray(row?.reasons) ? row.reasons.map((x) => truncate(String(x || ""), 220)).filter(Boolean) : [];
    const criticalIssues = Array.isArray(row?.criticalIssues)
      ? row.criticalIssues.map((x) => truncate(String(x || ""), 220)).filter(Boolean)
      : [];
    const strengths = Array.isArray(row?.strengths) ? row.strengths.map((x) => truncate(String(x || ""), 220)).filter(Boolean) : [];

    byId.set(scenarioId, {
      scenarioId,
      usefulness,
      verdict,
      confidence,
      userSatisfaction,
      wouldContinue,
      feltGenericFallback,
      continuityScore,
      reasons,
      criticalIssues,
      strengths,
      nextUserProbe: nextUserProbe || null,
      judge,
    });
  }

  const missing = expectedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`missing scenario ratings: ${missing.join(", ")}`);
  }

  return expectedIds.map((id) => byId.get(id));
}

function aggregate(ratings) {
  const n = ratings.length;
  const scores = ratings.map((r) => r.usefulness).filter((x) => Number.isFinite(x));
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const useful = ratings.filter((r) => r.verdict === "useful").length;
  const notUseful = n - useful;
  const zero = ratings.filter((r) => r.usefulness === 0).length;
  const satisfactionScores = ratings.map((r) => Number(r.userSatisfaction)).filter((x) => Number.isFinite(x));
  const avgUserSatisfaction =
    satisfactionScores.length > 0 ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length : 0;
  const continueCount = ratings.filter((r) => Boolean(r.wouldContinue)).length;
  const genericFallbackCount = ratings.filter((r) => Boolean(r.feltGenericFallback)).length;
  const continuityScores = ratings.map((r) => Number(r.continuityScore)).filter((x) => Number.isFinite(x));
  const averageContinuityScore =
    continuityScores.length > 0 ? continuityScores.reduce((a, b) => a + b, 0) / continuityScores.length : 0;

  const issues = new Map();
  for (const r of ratings) {
    for (const issue of r.criticalIssues || []) {
      const key = String(issue || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key) continue;
      issues.set(key, (issues.get(key) || 0) + 1);
    }
  }

  const topIssues = Array.from(issues.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const worst = [...ratings]
    .sort((a, b) => a.usefulness - b.usefulness || ((a.confidence || 0) - (b.confidence || 0)))
    .slice(0, 10)
    .map((r) => ({
      scenarioId: r.scenarioId,
      usefulness: r.usefulness,
      verdict: r.verdict,
      userSatisfaction: r.userSatisfaction,
      wouldContinue: r.wouldContinue,
      feltGenericFallback: r.feltGenericFallback,
      continuityScore: r.continuityScore,
      reasons: (r.reasons || []).slice(0, 2),
      criticalIssues: (r.criticalIssues || []).slice(0, 2),
    }));

  return {
    total: n,
    averageUsefulness: Number(avg.toFixed(3)),
    usefulCount: useful,
    notUsefulCount: notUseful,
    usefulRate: Number((useful / Math.max(1, n)).toFixed(4)),
    zeroUsefulnessCount: zero,
    averageUserSatisfaction: Number(avgUserSatisfaction.toFixed(4)),
    continueCount,
    continueRate: Number((continueCount / Math.max(1, n)).toFixed(4)),
    genericFallbackCount,
    genericFallbackRate: Number((genericFallbackCount / Math.max(1, n)).toFixed(4)),
    averageContinuityScore: Number(averageContinuityScore.toFixed(3)),
    topIssues,
    worstScenarios: worst,
  };
}

function evaluateQualityGate(params) {
  const failures = [];
  const checks = [];
  const byJudge = new Map((params.judges || []).map((j) => [String(j.judge || "").toLowerCase(), j]));
  const judgeNames = Array.from(new Set((params.opts?.judges || []).map((j) => String(j || "").toLowerCase()).filter(Boolean)));

  const threshold = {
    gemini: {
      minAvg: params.opts.minGeminiAvg ?? params.opts.minAvg,
      minUsefulRate: params.opts.minGeminiUsefulRate ?? params.opts.minUsefulRate,
    },
    kimi: {
      minAvg: params.opts.minKimiAvg ?? params.opts.minAvg,
      minUsefulRate: params.opts.minKimiUsefulRate ?? params.opts.minUsefulRate,
    },
    minimax: {
      minAvg: params.opts.minMinimaxAvg ?? params.opts.minAvg,
      minUsefulRate: params.opts.minMinimaxUsefulRate ?? params.opts.minUsefulRate,
    },
  };

  for (const judgeName of judgeNames) {
    const row = byJudge.get(judgeName);
    if (!row) {
      failures.push(`Missing judge results: ${judgeName}`);
      continue;
    }

    const summary = row.summary || {};
    const avg = Number(summary.averageUsefulness);
    const usefulRate = Number(summary.usefulRate);
    const zeroCount = Number(summary.zeroUsefulnessCount);
    const userSatisfaction = Number(summary.averageUserSatisfaction);
    const continueRate = Number(summary.continueRate);
    const genericFallbackRate = Number(summary.genericFallbackRate);

    const minAvg = (threshold[judgeName] || {}).minAvg;
    if (minAvg != null) {
      const pass = Number.isFinite(avg) && avg >= minAvg;
      checks.push({ judge: judgeName, metric: "averageUsefulness", actual: avg, expected: `>= ${minAvg}`, pass });
      if (!pass) failures.push(`${judgeName} averageUsefulness ${avg} < ${minAvg}`);
    }

    const minUsefulRate = (threshold[judgeName] || {}).minUsefulRate;
    if (minUsefulRate != null) {
      const pass = Number.isFinite(usefulRate) && usefulRate >= minUsefulRate;
      checks.push({ judge: judgeName, metric: "usefulRate", actual: usefulRate, expected: `>= ${minUsefulRate}`, pass });
      if (!pass) failures.push(`${judgeName} usefulRate ${usefulRate} < ${minUsefulRate}`);
    }

    if (params.opts.maxZeroUsefulness != null) {
      const pass = Number.isFinite(zeroCount) && zeroCount <= params.opts.maxZeroUsefulness;
      checks.push({
        judge: judgeName,
        metric: "zeroUsefulnessCount",
        actual: zeroCount,
        expected: `<= ${params.opts.maxZeroUsefulness}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} zeroUsefulnessCount ${zeroCount} > ${params.opts.maxZeroUsefulness}`);
    }

    if (params.opts.minUserSatisfaction != null) {
      const pass = Number.isFinite(userSatisfaction) && userSatisfaction >= params.opts.minUserSatisfaction;
      checks.push({
        judge: judgeName,
        metric: "averageUserSatisfaction",
        actual: userSatisfaction,
        expected: `>= ${params.opts.minUserSatisfaction}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} averageUserSatisfaction ${userSatisfaction} < ${params.opts.minUserSatisfaction}`);
    }

    if (params.opts.minContinueRate != null) {
      const pass = Number.isFinite(continueRate) && continueRate >= params.opts.minContinueRate;
      checks.push({
        judge: judgeName,
        metric: "continueRate",
        actual: continueRate,
        expected: `>= ${params.opts.minContinueRate}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} continueRate ${continueRate} < ${params.opts.minContinueRate}`);
    }

    if (params.opts.maxGenericFallbackRate != null) {
      const pass = Number.isFinite(genericFallbackRate) && genericFallbackRate <= params.opts.maxGenericFallbackRate;
      checks.push({
        judge: judgeName,
        metric: "genericFallbackRate",
        actual: genericFallbackRate,
        expected: `<= ${params.opts.maxGenericFallbackRate}`,
        pass,
      });
      if (!pass) {
        failures.push(`${judgeName} genericFallbackRate ${genericFallbackRate} > ${params.opts.maxGenericFallbackRate}`);
      }
    }
  }

  return {
    enabled: isGateConfigured(params.opts),
    pass: failures.length === 0,
    failures,
    checks,
  };
}

function buildMarkdown(out) {
  const md = [];
  md.push(`# External Usefulness Report — ${out.runId}`);
  md.push("");
  md.push(`- Source report: ${out.sourceReport}`);
  md.push(`- Scenarios rated: ${out.totalScenarios}`);
  md.push(`- Generated at: ${out.generatedAt}`);
  md.push("");

  for (const judge of out.judges) {
    md.push(`## ${judge.judge}`);
    md.push("");
    md.push(`- Average usefulness: ${judge.summary.averageUsefulness}/5`);
    md.push(`- Useful (>=3): ${judge.summary.usefulCount}/${judge.summary.total} (${(judge.summary.usefulRate * 100).toFixed(1)}%)`);
    md.push(`- Zero-usefulness: ${judge.summary.zeroUsefulnessCount}`);
    md.push(`- Real-user satisfaction: ${(judge.summary.averageUserSatisfaction * 100).toFixed(1)}%`);
    md.push(`- Would continue rate: ${(judge.summary.continueRate * 100).toFixed(1)}%`);
    md.push(`- Generic fallback rate: ${(judge.summary.genericFallbackRate * 100).toFixed(1)}%`);
    md.push(`- Continuity score avg: ${judge.summary.averageContinuityScore}/5`);
    md.push("");
    md.push(`### Top Issues (${judge.judge})`);
    md.push("");
    if (judge.summary.topIssues.length === 0) {
      md.push("- none");
    } else {
      for (const row of judge.summary.topIssues) md.push(`- ${row.issue} — ${row.count}`);
    }
    md.push("");
    md.push(`### Worst Scenarios (${judge.judge})`);
    md.push("");
    if (judge.summary.worstScenarios.length === 0) {
      md.push("- none");
    } else {
      for (const row of judge.summary.worstScenarios) {
        md.push(`- ${row.scenarioId}: usefulness ${row.usefulness}/5 (${row.verdict})`);
        md.push(
          `  userSatisfaction=${(Number(row.userSatisfaction || 0) * 100).toFixed(0)}%` +
            ` continue=${row.wouldContinue ? "yes" : "no"}` +
            ` genericFallback=${row.feltGenericFallback ? "yes" : "no"}` +
            ` continuity=${row.continuityScore}/5`,
        );
        for (const reason of row.reasons || []) md.push(`  reason: ${reason}`);
        for (const issue of row.criticalIssues || []) md.push(`  issue: ${issue}`);
      }
    }
    md.push("");
  }

  const compare = out.comparison || null;
  if (compare) {
    md.push("## Comparison");
    md.push("");
    if (Number.isFinite(compare.geminiAvg)) md.push(`- Average (Gemini): ${compare.geminiAvg}/5`);
    if (Number.isFinite(compare.kimiAvg)) md.push(`- Average (Kimi): ${compare.kimiAvg}/5`);
    if (Number.isFinite(compare.minimaxAvg)) md.push(`- Average (MiniMax): ${compare.minimaxAvg}/5`);
    if (Number.isFinite(compare.geminiUserSatisfaction)) {
      md.push(`- Real-user satisfaction (Gemini): ${(compare.geminiUserSatisfaction * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.kimiUserSatisfaction)) {
      md.push(`- Real-user satisfaction (Kimi): ${(compare.kimiUserSatisfaction * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.geminiContinueRate)) {
      md.push(`- Continue rate (Gemini): ${(compare.geminiContinueRate * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.kimiContinueRate)) {
      md.push(`- Continue rate (Kimi): ${(compare.kimiContinueRate * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.geminiGenericFallbackRate)) {
      md.push(`- Generic fallback rate (Gemini): ${(compare.geminiGenericFallbackRate * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.kimiGenericFallbackRate)) {
      md.push(`- Generic fallback rate (Kimi): ${(compare.kimiGenericFallbackRate * 100).toFixed(1)}%`);
    }
    if (Number.isFinite(compare.avgGap)) md.push(`- Average gap (Gemini - Kimi): ${compare.avgGap}`);
    if (Number.isFinite(compare.usefulRateGap)) md.push(`- Useful-rate gap (Gemini - Kimi): ${compare.usefulRateGap}`);
    if (Array.isArray(compare.pairwise) && compare.pairwise.length > 0) {
      for (const row of compare.pairwise) {
        md.push(
          `- Gap (${row.left} - ${row.right}): avg=${row.avgGap}, usefulRate=${row.usefulRateGap}, ` +
            `userSat=${row.userSatisfactionGap}, continue=${row.continueRateGap}, genericFallback=${row.genericFallbackRateGap}`,
        );
      }
    }
    md.push("");
  }

  if (out.gate?.enabled) {
    md.push("## Quality Gate");
    md.push("");
    md.push(`- Pass: ${out.gate.pass ? "yes" : "no"}`);
    if (Array.isArray(out.gate.failures) && out.gate.failures.length > 0) {
      md.push("- Failures:");
      for (const item of out.gate.failures) md.push(`  - ${item}`);
    } else {
      md.push("- Failures: none");
    }
    md.push("");
  }

  return `${md.join("\n")}\n`;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(opts.report)) {
    throw new Error(`Report not found: ${opts.report}`);
  }

  const source = JSON.parse(fs.readFileSync(opts.report, "utf8"));
  const runId = `judge-${nowIsoCompact()}`;

  let scenarios = Array.isArray(source.scenarios) ? source.scenarios : [];
  if (opts.onlyScenarioIds.length > 0) {
    const wanted = new Set(opts.onlyScenarioIds.map((x) => x.toLowerCase()));
    scenarios = scenarios.filter((s) => wanted.has(String(s.id || "").toLowerCase()));
  }
  if (opts.maxScenarios) scenarios = scenarios.slice(0, opts.maxScenarios);
  if (scenarios.length === 0) throw new Error("No scenarios selected for judging");

  const payloadScenarios = scenarios.map(mkScenarioPayload);
  const batches = chunk(payloadScenarios, Math.max(1, opts.batchSize));

  fs.mkdirSync(opts.outDir, { recursive: true });
  const rawDir = path.join(opts.outDir, `${runId}.raw`);
  fs.mkdirSync(rawDir, { recursive: true });

  const judges = [];
  for (const judgeName of opts.judges) {
    const allRatings = [];

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const expectedIds = batch.map((s) => s.id);
      const prompt = buildJudgePrompt(judgeName, batch);
      const res = runJudge(judgeName, prompt);

      const rawFile = path.join(rawDir, `${judgeName}.batch${String(bi + 1).padStart(2, "0")}.txt`);
      fs.writeFileSync(rawFile, res.stdout || res.stderr || "", "utf8");

      if (!res.ok) {
        throw new Error(`${judgeName} failed on batch ${bi + 1}/${batches.length}: exit=${res.status} ${truncate(res.stderr, 280)}`);
      }

      const candidate = stripJsonHostileControlChars(extractJsonCandidate(res.stdout));
      let parsed;
      try {
        parsed = JSON.parse(candidate);
      } catch (e) {
        const retryPrompt = [
          prompt,
          "",
          "IMPORTANT: return STRICT JSON only.",
          "Do not include markdown, comments, or any text before/after JSON.",
        ].join("\n");
        const retryRes = runJudge(judgeName, retryPrompt);
        const retryRawFile = path.join(rawDir, `${judgeName}.batch${String(bi + 1).padStart(2, "0")}.retry.txt`);
        fs.writeFileSync(retryRawFile, retryRes.stdout || retryRes.stderr || "", "utf8");

        if (!retryRes.ok) {
          throw new Error(
            `${judgeName} returned non-JSON on batch ${bi + 1} and retry failed: ${retryRes.status} ${truncate(retryRes.stderr, 280)}`,
          );
        }

        const retryCandidate = stripJsonHostileControlChars(extractJsonCandidate(retryRes.stdout));
        try {
          parsed = JSON.parse(retryCandidate);
        } catch (retryErr) {
          throw new Error(
            `${judgeName} returned non-JSON on batch ${bi + 1} (after retry): ${
              retryErr instanceof Error ? retryErr.message : String(retryErr)
            }`,
          );
        }
      }

      const rows = validateJudgeBatch(parsed, judgeName, expectedIds);
      allRatings.push(...rows);
      process.stdout.write(`[${judgeName}] batch ${bi + 1}/${batches.length} ok (${rows.length} ratings)\n`);
    }

    const summary = aggregate(allRatings);
    judges.push({ judge: judgeName, summary, ratings: allRatings });
  }

  const byJudge = new Map(judges.map((j) => [j.judge, j]));
  const gemini = byJudge.get("gemini");
  const kimi = byJudge.get("kimi");
  const minimax = byJudge.get("minimax");

  const pairwise = [];
  for (let i = 0; i < judges.length; i++) {
    for (let k = i + 1; k < judges.length; k++) {
      const left = judges[i];
      const right = judges[k];
      pairwise.push({
        left: left.judge,
        right: right.judge,
        avgGap: Number((left.summary.averageUsefulness - right.summary.averageUsefulness).toFixed(3)),
        usefulRateGap: Number((left.summary.usefulRate - right.summary.usefulRate).toFixed(4)),
        userSatisfactionGap: Number((left.summary.averageUserSatisfaction - right.summary.averageUserSatisfaction).toFixed(4)),
        continueRateGap: Number((left.summary.continueRate - right.summary.continueRate).toFixed(4)),
        genericFallbackRateGap: Number((left.summary.genericFallbackRate - right.summary.genericFallbackRate).toFixed(4)),
      });
    }
  }

  const comparison = {
    geminiAvg: gemini ? gemini.summary.averageUsefulness : null,
    kimiAvg: kimi ? kimi.summary.averageUsefulness : null,
    minimaxAvg: minimax ? minimax.summary.averageUsefulness : null,
    geminiUserSatisfaction: gemini ? gemini.summary.averageUserSatisfaction : null,
    kimiUserSatisfaction: kimi ? kimi.summary.averageUserSatisfaction : null,
    geminiContinueRate: gemini ? gemini.summary.continueRate : null,
    kimiContinueRate: kimi ? kimi.summary.continueRate : null,
    geminiGenericFallbackRate: gemini ? gemini.summary.genericFallbackRate : null,
    kimiGenericFallbackRate: kimi ? kimi.summary.genericFallbackRate : null,
    avgGap: gemini && kimi ? Number((gemini.summary.averageUsefulness - kimi.summary.averageUsefulness).toFixed(3)) : null,
    usefulRateGap: gemini && kimi ? Number((gemini.summary.usefulRate - kimi.summary.usefulRate).toFixed(4)) : null,
    pairwise,
  };

  const out = {
    runId,
    generatedAt: new Date().toISOString(),
    sourceReport: opts.report,
    sourceSummary: source.summary || null,
    totalScenarios: payloadScenarios.length,
    judges,
    comparison,
    gate: evaluateQualityGate({ judges, opts }),
  };

  const jsonFile = path.join(opts.outDir, `${runId}.usefulness.json`);
  const mdFile = path.join(opts.outDir, `${runId}.usefulness.md`);
  const latestJson = path.join(opts.outDir, "latest.usefulness.json");
  const latestMd = path.join(opts.outDir, "latest.usefulness.md");

  fs.writeFileSync(jsonFile, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdFile, buildMarkdown(out), "utf8");
  fs.writeFileSync(latestJson, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestMd, buildMarkdown(out), "utf8");

  console.log(`Usefulness JSON: ${jsonFile}`);
  console.log(`Usefulness MD:   ${mdFile}`);
  if (out.gate?.enabled) {
    console.log(`Quality gate: ${out.gate.pass ? "PASS" : "FAIL"}`);
    if (!out.gate.pass) {
      for (const failure of out.gate.failures || []) console.log(` - ${failure}`);
      process.exit(opts.failExitCode);
    }
  }
}

main();
