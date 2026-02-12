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
    maxSynthesizedRate: null,
    maxSchemaRetryRate: null,
    maxNonJsonRetryRate: null,
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
    } else if (a === "--max-synthesized-rate") {
      out.maxSynthesizedRate = parseRateOrNull(argv[++i]);
    } else if (a === "--max-schema-retry-rate") {
      out.maxSchemaRetryRate = parseRateOrNull(argv[++i]);
    } else if (a === "--max-non-json-retry-rate") {
      out.maxNonJsonRetryRate = parseRateOrNull(argv[++i]);
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
        "  --max-synthesized-rate R    Max rate of synthesized ratings from summary-only judge output (0..1 or %)",
        "  --max-schema-retry-rate R   Max batch-rate of schema-retry usage (0..1 or %)",
        "  --max-non-json-retry-rate R Max batch-rate of non-JSON parse retry usage (0..1 or %)",
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
    opts.minMinimaxUsefulRate != null ||
    opts.maxSynthesizedRate != null ||
    opts.maxSchemaRetryRate != null ||
    opts.maxNonJsonRetryRate != null
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
  const expectedScenarioIds = (scenarios || []).map((s) => String(s?.id || "").trim()).filter(Boolean);
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
      "You MUST return top-level key `ratings` as an array.",
      "ratings length MUST equal expectedScenarioIds length.",
      "Every scenarioId in ratings MUST be from expectedScenarioIds and appear exactly once.",
      "Do not return summary-only JSON. If uncertain, still output a conservative per-scenario rating with low confidence.",
    ],
    expectedScenarioIds,
    requiredJsonSchema: {
      judge: judgeName,
      ratings: [
        {
          scenarioId: expectedScenarioIds[0] || "UV001",
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
    const primaryModel = String(process.env.QA_GEMINI_MODEL || "").trim();
    const fallbackModels = String(process.env.QA_GEMINI_FALLBACK_MODELS || process.env.QA_GEMINI_FALLBACK_MODEL || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const modelQueue = [...new Set([primaryModel, ...fallbackModels].filter(Boolean))];
    if (modelQueue.length === 0) modelQueue.push("");

    let last = null;
    for (const model of modelQueue) {
      const args = [
        "--output-format",
        "text",
        "-p",
        "Rate the scenarios and return JSON only.",
      ];
      if (model) args.unshift("--model", model);

      const proc = spawnSync(
        "gemini",
        args,
        {
          cwd: repoRoot,
          encoding: "utf8",
          input: prompt,
          maxBuffer: 1024 * 1024 * 10,
        },
      );

      const res = {
        ok: proc.status === 0,
        status: proc.status,
        stdout: String(proc.stdout || ""),
        stderr: String(proc.stderr || ""),
      };

      if (res.ok) return res;
      last = res;

      const capacityError = /(429|no\s+capacity\s+available|resource[_\s-]?exhausted|quota)/iu.test(
        `${res.stderr}\n${res.stdout}`,
      );
      if (!capacityError) return res;
    }

    return (
      last || {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "Gemini judge failed before execution",
      }
    );
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

function normalizeJudgeRatings(parsed, expectedIds = []) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

  const directRatings = Array.isArray(parsed.ratings) ? parsed.ratings : [];
  if (directRatings.length > 0) return directRatings;

  const nestedArrays = [];
  for (const key of ["evaluations", "results", "items", "scores"]) {
    const value = parsed[key];
    if (Array.isArray(value) && value.length > 0) nestedArrays.push(...value);
  }
  const nestedSummary = parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary) ? parsed.summary : null;
  if (nestedSummary) {
    for (const key of ["ratings", "evaluations", "results", "items", "scores"]) {
      const value = nestedSummary[key];
      if (Array.isArray(value) && value.length > 0) nestedArrays.push(...value);
    }
  }
  const nestedData = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) ? parsed.data : null;
  if (nestedData) {
    for (const key of ["ratings", "evaluations", "results", "items", "scores"]) {
      const value = nestedData[key];
      if (Array.isArray(value) && value.length > 0) nestedArrays.push(...value);
    }
  }
  if (nestedArrays.length > 0) return nestedArrays;

  const expectedSet = new Set((expectedIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  const looksLikeScenarioId = (raw) => {
    const id = String(raw || "").trim();
    if (!id) return false;
    if (expectedSet.size > 0) return expectedSet.has(id);
    return /^[A-Za-z]{1,6}\d{2,6}$/u.test(id);
  };

  const convertMapRow = (scenarioId, source) => {
    const id = String(scenarioId || "").trim();
    if (!looksLikeScenarioId(id)) return null;
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const payload =
      source.rating && typeof source.rating === "object" && !Array.isArray(source.rating) ? source.rating : source;

    const row = {
      scenarioId: id,
      usefulness: payload.usefulness,
      verdict: payload.verdict,
      confidence: payload.confidence,
      userSatisfaction: payload.userSatisfaction,
      wouldContinue: payload.wouldContinue,
      feltGenericFallback: payload.feltGenericFallback,
      continuityScore: payload.continuityScore,
      reasons: Array.isArray(payload.reasons) ? payload.reasons : [],
      criticalIssues: Array.isArray(payload.criticalIssues) ? payload.criticalIssues : [],
      strengths: Array.isArray(payload.strengths) ? payload.strengths : [],
      nextUserProbe: payload.nextUserProbe,
    };

    const keyIssue = truncate(String(payload.key_issue || payload.keyIssue || ""), 220);
    if (keyIssue && row.criticalIssues.length === 0) row.criticalIssues = [keyIssue];
    return row;
  };

  const mapRows = [];
  const summary = parsed.summary;
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    for (const [scenarioId, value] of Object.entries(summary)) {
      const row = convertMapRow(scenarioId, value);
      if (row) mapRows.push(row);
    }
  }
  if (mapRows.length > 0) return mapRows;

  const topLevelMapRows = [];
  for (const [scenarioId, value] of Object.entries(parsed)) {
    const row = convertMapRow(scenarioId, value);
    if (row) topLevelMapRows.push(row);
  }
  return topLevelMapRows;
}

function buildSummaryFallbackRatings(parsed, expectedIds, judge) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const ids = (expectedIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const summary =
    parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary) ? parsed.summary : null;
  if (!summary) return [];

  const normalizeRate = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n > 1) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
  };
  const clampScore = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(5, n));
  };

  const avgUsefulnessRaw = clampScore(
    summary.averageUsefulness ?? summary.avgUsefulness ?? summary.averageScore ?? summary.score ?? summary.avg,
  );
  const avgUsefulness = avgUsefulnessRaw == null ? null : Math.round(avgUsefulnessRaw);
  const usefulCountRaw = Number(summary.usefulCount ?? summary.positiveCount ?? summary.goodCount);
  const usefulCount = Number.isFinite(usefulCountRaw)
    ? Math.max(0, Math.min(ids.length, Math.round(usefulCountRaw)))
    : null;
  const avgUserSatisfaction = normalizeRate(
    summary.averageUserSatisfaction ?? summary.userSatisfaction ?? summary.avgSatisfaction,
  );
  const continueRate = normalizeRate(summary.wouldContinueRate ?? summary.continueRate ?? summary.userContinueRate);
  const genericFallbackRate = normalizeRate(
    summary.genericFallbackRate ?? summary.feltGenericFallbackRate ?? summary.fallbackRate,
  );

  const findingsSource = [
    ...(Array.isArray(parsed.keyFindings) ? parsed.keyFindings : []),
    ...(Array.isArray(parsed.findings) ? parsed.findings : []),
    ...(Array.isArray(parsed.recommendations) ? parsed.recommendations : []),
    ...(Array.isArray(parsed.issues) ? parsed.issues : []),
  ];
  const findingsSeen = new Set();
  const findings = [];
  for (const item of findingsSource) {
    const value = truncate(String(item || "").trim(), 220);
    if (!value) continue;
    const key = value.toLowerCase();
    if (findingsSeen.has(key)) continue;
    findingsSeen.add(key);
    findings.push(value);
    if (findings.length >= 8) break;
  }

  if (avgUsefulness == null && usefulCount == null && findings.length === 0) return [];

  const baselineUsefulness =
    avgUsefulness != null ? avgUsefulness : usefulCount != null ? (usefulCount > 0 ? 3 : 2) : 2;
  const baselineSatisfaction =
    avgUserSatisfaction != null ? avgUserSatisfaction : Number((Math.max(0, Math.min(5, baselineUsefulness)) / 5).toFixed(3));
  const baselineContinue = continueRate != null ? continueRate >= 0.5 : baselineUsefulness >= 3;
  const baselineGenericFallback = genericFallbackRate != null ? genericFallbackRate >= 0.5 : false;

  const positiveSignals = /(полез|хорош|лучш|сильн|работа|useful|good|great)/iu;
  const negativeSignals = /(критич|сбой|ошиб|нерелев|hallucin|мусор|провал|бесполез|not[_\s-]?useful|irrelevant)/iu;
  const scenarioPos = new Map(ids.map((id, idx) => [id, idx]));
  const forcedLow = new Set();
  const forcedHigh = new Set();
  for (const finding of findings) {
    const lower = String(finding || "").toLowerCase();
    const mentioned = ids.filter((id) => lower.includes(id.toLowerCase()));
    if (mentioned.length === 0) continue;
    for (const id of mentioned) {
      if (negativeSignals.test(finding)) forcedLow.add(id);
      if (positiveSignals.test(finding)) forcedHigh.add(id);
    }
  }

  const rows = [];
  for (let idx = 0; idx < ids.length; idx++) {
    const scenarioId = ids[idx];
    let usefulness = baselineUsefulness;
    if (usefulCount != null) {
      usefulness = idx < usefulCount ? Math.max(usefulness, 3) : Math.min(usefulness, 2);
    }
    if (forcedLow.has(scenarioId)) usefulness = Math.min(usefulness, 1);
    if (forcedHigh.has(scenarioId)) usefulness = Math.max(usefulness, 4);
    usefulness = Math.max(0, Math.min(5, Math.round(usefulness)));

    const localReasons = [
      "Per-scenario ratings were synthesized from summary-only judge output.",
      ...(findings.length > 0 ? [findings[0]] : []),
    ];

    rows.push({
      scenarioId,
      usefulness,
      verdict: usefulness >= 3 ? "useful" : "not_useful",
      confidence: 0.3,
      userSatisfaction: baselineSatisfaction,
      wouldContinue: baselineContinue,
      feltGenericFallback: baselineGenericFallback,
      continuityScore: usefulness,
      reasons: localReasons,
      criticalIssues: forcedLow.has(scenarioId) ? [findings.find((f) => String(f).toLowerCase().includes(scenarioId.toLowerCase())) || "summary-only fallback"] : [],
      strengths: forcedHigh.has(scenarioId) ? ["mentioned as relatively stronger in summary findings"] : [],
      nextUserProbe: null,
      judge,
      synthesized: true,
      _fallback: "summary_only",
      _scenarioOrder: scenarioPos.get(scenarioId) ?? idx,
    });
  }

  return rows;
}

function validateJudgeBatch(parsed, judge, expectedIds) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("judge output is not an object");
  }

  let ratings = normalizeJudgeRatings(parsed, expectedIds);
  if (ratings.length === 0) {
    const fallbackRatings = buildSummaryFallbackRatings(parsed, expectedIds, judge);
    if (fallbackRatings.length > 0) {
      ratings = fallbackRatings;
      process.stdout.write(
        `[${judge}] warning: synthesized ${fallbackRatings.length} per-scenario ratings from summary-only judge output\n`,
      );
    } else {
      const keys = Object.keys(parsed || {}).slice(0, 10);
      throw new Error(`ratings array is empty (keys: ${keys.join(", ") || "none"})`);
    }
  }

  const byId = new Map();
  const expectedSet = new Set((expectedIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  for (let idx = 0; idx < ratings.length; idx++) {
    const row = ratings[idx];
    let scenarioId = String(row?.scenarioId || "").trim();
    if (scenarioId && expectedSet.size > 0 && !expectedSet.has(scenarioId)) {
      const alias = scenarioId.match(/^S0*(\d{1,4})$/iu);
      if (alias?.[1]) {
        const pos = Number.parseInt(alias[1], 10) - 1;
        if (Number.isFinite(pos) && pos >= 0 && pos < expectedIds.length) {
          scenarioId = expectedIds[pos];
        }
      } else if (idx < expectedIds.length) {
        scenarioId = expectedIds[idx];
      }
    }
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
      synthesized: Boolean(row?.synthesized || row?._fallback === "summary_only"),
    });
  }

  let missing = expectedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const fallbackMissing = buildSummaryFallbackRatings(parsed, missing, judge);
    for (const row of fallbackMissing) {
      if (!row || !row.scenarioId || byId.has(row.scenarioId)) continue;
      byId.set(row.scenarioId, {
        scenarioId: row.scenarioId,
        usefulness: Math.max(0, Math.min(5, Math.round(Number(row.usefulness) || 0))),
        verdict: String(row.verdict || "").toLowerCase() === "useful" || Number(row.usefulness) >= 3 ? "useful" : "not_useful",
        confidence: Number.isFinite(Number(row.confidence)) ? Math.max(0, Math.min(1, Number(row.confidence))) : 0.3,
        userSatisfaction: Number.isFinite(Number(row.userSatisfaction))
          ? Math.max(0, Math.min(1, Number(row.userSatisfaction)))
          : Number(((Number(row.usefulness) || 0) / 5).toFixed(3)),
        wouldContinue: typeof row.wouldContinue === "boolean" ? row.wouldContinue : Number(row.usefulness) >= 3,
        feltGenericFallback: Boolean(row.feltGenericFallback),
        continuityScore: Number.isFinite(Number(row.continuityScore))
          ? Math.max(0, Math.min(5, Math.round(Number(row.continuityScore))))
          : Math.max(0, Math.min(5, Math.round(Number(row.usefulness) || 0))),
        reasons: Array.isArray(row.reasons) ? row.reasons : [],
        criticalIssues: Array.isArray(row.criticalIssues) ? row.criticalIssues : [],
        strengths: Array.isArray(row.strengths) ? row.strengths : [],
        nextUserProbe: row.nextUserProbe || null,
        judge,
        synthesized: Boolean(row?.synthesized || row?._fallback === "summary_only"),
      });
    }
    missing = expectedIds.filter((id) => !byId.has(id));
  }
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
  const synthesizedRatingCount = ratings.filter((r) => Boolean(r.synthesized)).length;
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
    synthesizedRatingCount,
    synthesizedRatingRate: Number((synthesizedRatingCount / Math.max(1, n)).toFixed(4)),
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
    const diagnostics = row.diagnostics || {};
    const avg = Number(summary.averageUsefulness);
    const usefulRate = Number(summary.usefulRate);
    const zeroCount = Number(summary.zeroUsefulnessCount);
    const userSatisfaction = Number(summary.averageUserSatisfaction);
    const continueRate = Number(summary.continueRate);
    const genericFallbackRate = Number(summary.genericFallbackRate);
    const synthesizedRatingRate = Number(summary.synthesizedRatingRate);
    const schemaRetryRate = Number(diagnostics.schemaRetryRate);
    const nonJsonRetryRate = Number(diagnostics.nonJsonRetryRate);

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

    if (params.opts.maxSynthesizedRate != null) {
      const pass = Number.isFinite(synthesizedRatingRate) && synthesizedRatingRate <= params.opts.maxSynthesizedRate;
      checks.push({
        judge: judgeName,
        metric: "synthesizedRatingRate",
        actual: synthesizedRatingRate,
        expected: `<= ${params.opts.maxSynthesizedRate}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} synthesizedRatingRate ${synthesizedRatingRate} > ${params.opts.maxSynthesizedRate}`);
    }

    if (params.opts.maxSchemaRetryRate != null) {
      const pass = Number.isFinite(schemaRetryRate) && schemaRetryRate <= params.opts.maxSchemaRetryRate;
      checks.push({
        judge: judgeName,
        metric: "schemaRetryRate",
        actual: schemaRetryRate,
        expected: `<= ${params.opts.maxSchemaRetryRate}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} schemaRetryRate ${schemaRetryRate} > ${params.opts.maxSchemaRetryRate}`);
    }

    if (params.opts.maxNonJsonRetryRate != null) {
      const pass = Number.isFinite(nonJsonRetryRate) && nonJsonRetryRate <= params.opts.maxNonJsonRetryRate;
      checks.push({
        judge: judgeName,
        metric: "nonJsonRetryRate",
        actual: nonJsonRetryRate,
        expected: `<= ${params.opts.maxNonJsonRetryRate}`,
        pass,
      });
      if (!pass) failures.push(`${judgeName} nonJsonRetryRate ${nonJsonRetryRate} > ${params.opts.maxNonJsonRetryRate}`);
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
    md.push(`- Synthesized rating rate: ${(Number(judge.summary.synthesizedRatingRate || 0) * 100).toFixed(1)}%`);
    if (judge.diagnostics) {
      md.push(
        `- Retry diagnostics: nonJSON ${(Number(judge.diagnostics.nonJsonRetryRate || 0) * 100).toFixed(1)}%, schema ${(Number(judge.diagnostics.schemaRetryRate || 0) * 100).toFixed(1)}%`,
      );
    }
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
    const diagnostics = {
      totalBatches: batches.length,
      nonJsonRetryBatches: 0,
      schemaRetryBatches: 0,
      synthesizedBatches: 0,
      synthesizedRatingCount: 0,
    };

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
      let usedNonJsonRetry = false;
      try {
        parsed = JSON.parse(candidate);
      } catch (e) {
        usedNonJsonRetry = true;
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
      if (usedNonJsonRetry) diagnostics.nonJsonRetryBatches += 1;

      let rows;
      try {
        rows = validateJudgeBatch(parsed, judgeName, expectedIds);
      } catch (validationErr) {
        const message = validationErr instanceof Error ? validationErr.message : String(validationErr);
        const schemaFailure = /(ratings array is empty|missing scenario ratings)/iu.test(message);
        if (!schemaFailure) throw validationErr;
        diagnostics.schemaRetryBatches += 1;

        const schemaRepairPrompt = [
          prompt,
          "",
          "IMPORTANT SCHEMA FIX:",
          "Your previous JSON did not include valid per-scenario ratings.",
          `Return STRICT JSON with top-level keys: judge, ratings.`,
          `ratings must contain exactly ${expectedIds.length} objects for scenarioId values: ${expectedIds.join(", ")}.`,
          "Each rating object must include: scenarioId, usefulness, verdict, confidence, userSatisfaction, wouldContinue, feltGenericFallback, continuityScore, reasons, criticalIssues, strengths, nextUserProbe.",
          "Do not return markdown. Do not return summary-only JSON.",
        ].join("\n");

        const schemaRepairRes = runJudge(judgeName, schemaRepairPrompt);
        const schemaRepairRawFile = path.join(
          rawDir,
          `${judgeName}.batch${String(bi + 1).padStart(2, "0")}.schema-retry.txt`,
        );
        fs.writeFileSync(schemaRepairRawFile, schemaRepairRes.stdout || schemaRepairRes.stderr || "", "utf8");

        if (!schemaRepairRes.ok) {
          throw new Error(
            `${judgeName} schema-retry failed on batch ${bi + 1}/${batches.length}: exit=${schemaRepairRes.status} ${truncate(schemaRepairRes.stderr, 280)}`,
          );
        }

        const schemaRepairCandidate = stripJsonHostileControlChars(extractJsonCandidate(schemaRepairRes.stdout));
        let parsedRepair;
        try {
          parsedRepair = JSON.parse(schemaRepairCandidate);
        } catch (repairParseErr) {
          throw new Error(
            `${judgeName} schema-retry returned non-JSON on batch ${bi + 1}: ${
              repairParseErr instanceof Error ? repairParseErr.message : String(repairParseErr)
            }`,
          );
        }

        rows = validateJudgeBatch(parsedRepair, judgeName, expectedIds);
      }

      allRatings.push(...rows);
      const synthesizedInBatch = rows.filter((row) => Boolean(row?.synthesized)).length;
      if (synthesizedInBatch > 0) {
        diagnostics.synthesizedBatches += 1;
        diagnostics.synthesizedRatingCount += synthesizedInBatch;
      }
      process.stdout.write(`[${judgeName}] batch ${bi + 1}/${batches.length} ok (${rows.length} ratings)\n`);
    }

    const summary = aggregate(allRatings);
    const totalBatches = Math.max(1, diagnostics.totalBatches);
    const totalRatings = Math.max(1, allRatings.length);
    diagnostics.nonJsonRetryRate = Number((diagnostics.nonJsonRetryBatches / totalBatches).toFixed(4));
    diagnostics.schemaRetryRate = Number((diagnostics.schemaRetryBatches / totalBatches).toFixed(4));
    diagnostics.synthesizedBatchRate = Number((diagnostics.synthesizedBatches / totalBatches).toFixed(4));
    diagnostics.synthesizedRatingRate = Number((diagnostics.synthesizedRatingCount / totalRatings).toFixed(4));
    judges.push({ judge: judgeName, summary, diagnostics, ratings: allRatings });
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
