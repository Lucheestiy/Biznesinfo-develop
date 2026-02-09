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

function truncate(raw, n) {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return `${s.slice(0, Math.max(0, n - 1)).trim()}…`;
}

function parseArgs(argv) {
  const out = {
    report: path.join(repoRoot, "app", "qa", "ai-request", "reports", "latest.json"),
    judged: path.join(repoRoot, "app", "qa", "ai-request", "reports", "latest.usefulness.json"),
    outDir: path.join(repoRoot, "app", "qa", "ai-request", "reports"),
    advisors: ["gemini", "kimi"],
    topScenarios: 20,
    maxFailedChecksPerScenario: 5,
    maxReplyChars: 520,
    maxIssueItemsPerScenario: 4,
  };

  const normalizeAdvisor = (raw) => {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) return null;
    if (key === "gemini") return "gemini";
    if (key === "kimi") return "kimi";
    if (key === "minimax" || key === "mini-max" || key === "m2.1" || key === "m2_1") return "minimax";
    return null;
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") out.report = path.resolve(argv[++i]);
    else if (a === "--judged") out.judged = path.resolve(argv[++i]);
    else if (a === "--out-dir") out.outDir = path.resolve(argv[++i]);
    else if (a === "--advisors") {
      const values = String(argv[++i] || "")
        .split(/[,\s]+/u)
        .map((x) => normalizeAdvisor(x))
        .filter(Boolean);
      if (values.length > 0) out.advisors = Array.from(new Set(values));
    } else if (a === "--advisor") {
      const adv = normalizeAdvisor(argv[++i]);
      if (adv && !out.advisors.includes(adv)) out.advisors.push(adv);
    } else if (a === "--top-scenarios") out.topScenarios = Math.max(1, Number(argv[++i] || 20));
    else if (a === "--max-failed-checks") out.maxFailedChecksPerScenario = Math.max(1, Number(argv[++i] || 5));
    else if (a === "--max-reply-chars") out.maxReplyChars = Math.max(120, Number(argv[++i] || 520));
    else if (a === "--max-issues") out.maxIssueItemsPerScenario = Math.max(1, Number(argv[++i] || 4));
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: node app/scripts/advise_ai_with_judges.mjs [options]",
          "",
          "Options:",
          "  --report PATH          QA run report JSON (default reports/latest.json)",
          "  --judged PATH          Judge report JSON (default reports/latest.usefulness.json)",
          "  --out-dir PATH         Output dir for advice reports",
          "  --advisors LIST        Advisors list: gemini,kimi,minimax",
          "  --advisor NAME         Add advisor (repeatable)",
          "  --top-scenarios N      Max scenarios sent to advisors (default 20)",
          "  --max-failed-checks N  Failed checks kept per scenario (default 5)",
          "  --max-reply-chars N    Max assistant reply excerpt chars (default 520)",
          "  --max-issues N         Max judge issues kept per scenario (default 4)",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  return out;
}

function extractJsonCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  const body = fenced?.[1] ? fenced[1].trim() : raw;
  if (!body) return "";

  if ((body.startsWith("{") && body.endsWith("}")) || (body.startsWith("[") && body.endsWith("]"))) return body;

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

function runAdvisor(advisor, prompt) {
  if (advisor === "gemini") {
    const proc = spawnSync("gemini", ["--output-format", "text", "-p", "Return JSON only."], {
      cwd: repoRoot,
      encoding: "utf8",
      input: prompt,
      maxBuffer: 1024 * 1024 * 10,
    });
    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  if (advisor === "kimi") {
    const proc = spawnSync("kimi", ["--print", "--no-thinking", "--output-format", "text", "--final-message-only", "-p", prompt], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });
    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  if (advisor === "minimax") {
    const proc = spawnSync("droid", ["exec", "--output-format", "text", "--model", "custom:MiniMax-M2.1"], {
      cwd: repoRoot,
      encoding: "utf8",
      input: prompt,
      maxBuffer: 1024 * 1024 * 10,
    });
    return {
      ok: proc.status === 0,
      status: proc.status,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
    };
  }

  throw new Error(`Unknown advisor: ${advisor}`);
}

function buildScenarioPriority({ runReport, judgeReport, opts }) {
  const runScenarios = Array.isArray(runReport?.scenarios) ? runReport.scenarios : [];
  const judgeRows = Array.isArray(judgeReport?.judges) ? judgeReport.judges : [];

  const byScenario = new Map();
  for (const s of runScenarios) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    byScenario.set(id, {
      id,
      title: s?.title || id,
      tags: Array.isArray(s?.tags) ? s.tags : [],
      strictPass: Boolean(s?.pass),
      failedChecks: Array.isArray(s?.failedChecks) ? s.failedChecks : [],
      hardError: s?.hardError || null,
      turns: Array.isArray(s?.turns) ? s.turns : [],
      judges: [],
      avgUsefulness: null,
      usefulRate: null,
      issueHints: [],
    });
  }

  for (const judge of judgeRows) {
    const judgeName = String(judge?.judge || "").trim().toLowerCase() || "judge";
    const ratings = Array.isArray(judge?.ratings) ? judge.ratings : [];
    for (const rating of ratings) {
      const id = String(rating?.scenarioId || "").trim();
      if (!id || !byScenario.has(id)) continue;
      const row = byScenario.get(id);
      row.judges.push({
        judge: judgeName,
        usefulness: Number.isFinite(Number(rating?.usefulness)) ? Math.max(0, Math.min(5, Math.round(Number(rating.usefulness)))) : null,
        verdict: String(rating?.verdict || "").trim().toLowerCase() === "useful" ? "useful" : "not_useful",
        reasons: Array.isArray(rating?.reasons) ? rating.reasons.map((x) => truncate(x, 180)).filter(Boolean).slice(0, 3) : [],
        issues: Array.isArray(rating?.criticalIssues)
          ? rating.criticalIssues.map((x) => truncate(x, 160)).filter(Boolean).slice(0, opts.maxIssueItemsPerScenario)
          : [],
      });
    }
  }

  const scored = [];
  for (const row of byScenario.values()) {
    const scores = row.judges.map((j) => j.usefulness).filter((x) => Number.isFinite(x));
    const useful = row.judges.filter((j) => j.verdict === "useful").length;
    row.avgUsefulness = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)) : null;
    row.usefulRate = row.judges.length > 0 ? Number((useful / row.judges.length).toFixed(3)) : null;
    row.issueHints = Array.from(
      new Set(
        row.judges
          .flatMap((j) => j.issues || [])
          .map((x) => String(x || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, opts.maxIssueItemsPerScenario);
    scored.push(row);
  }

  scored.sort((a, b) => {
    const af = a.strictPass ? 1 : 0;
    const bf = b.strictPass ? 1 : 0;
    if (af !== bf) return af - bf;
    const aAvg = Number.isFinite(a.avgUsefulness) ? a.avgUsefulness : 99;
    const bAvg = Number.isFinite(b.avgUsefulness) ? b.avgUsefulness : 99;
    if (aAvg !== bAvg) return aAvg - bAvg;
    const aFailChecks = Array.isArray(a.failedChecks) ? a.failedChecks.length : 0;
    const bFailChecks = Array.isArray(b.failedChecks) ? b.failedChecks.length : 0;
    return bFailChecks - aFailChecks;
  });

  return scored.slice(0, Math.max(1, opts.topScenarios)).map((row) => {
    const lastTurn = row.turns[row.turns.length - 1] || null;
    const failedChecks = (row.failedChecks || []).slice(0, opts.maxFailedChecksPerScenario).map((x) => ({
      id: x?.id || null,
      type: x?.type || null,
      description: truncate(x?.description || "", 180) || null,
      reason: truncate(x?.reason || "", 180) || null,
    }));

    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      strictPass: row.strictPass,
      strictFailedCheckCount: Array.isArray(row.failedChecks) ? row.failedChecks.length : 0,
      avgUsefulness: row.avgUsefulness,
      usefulRate: row.usefulRate,
      hardError: row.hardError
        ? {
            status: row.hardError?.status ?? null,
            error: truncate(row.hardError?.error || "", 64) || null,
            message: truncate(row.hardError?.message || "", 180) || null,
          }
        : null,
      failedChecks,
      judgeIssueHints: row.issueHints,
      judgeReasons: row.judges.map((j) => ({
        judge: j.judge,
        usefulness: j.usefulness,
        verdict: j.verdict,
        reasons: (j.reasons || []).slice(0, 2),
      })),
      lastReply: truncate(lastTurn?.reply || "", opts.maxReplyChars),
      lastUser: truncate(lastTurn?.user || "", 220),
    };
  });
}

function buildAdvisorPrompt({ advisor, runReport, judgeReport, focusScenarios }) {
  const payload = {
    advisor,
    task: "Act as a senior AI product+prompt advisor. Propose concrete, testable improvements for Biznesinfo assistant.",
    rules: [
      "Focus on practical fixes that can be implemented in small safe PRs.",
      "Prioritize improvements that reduce strict-check failures and low usefulness scores.",
      "Do not suggest secrets, policy bypasses, or unsafe behavior.",
      "Use only provided evidence.",
      "Return JSON only.",
    ],
    outputSchema: {
      advisor,
      executiveSummary: "string",
      priorityPlan: [
        {
          priority: "P0|P1|P2",
          title: "string",
          why: "string",
          expectedImpact: "string",
          validationScenarios: ["scenarioId"],
        },
      ],
      recommendations: [
        {
          id: "R1",
          area: "prompt|retrieval|geo|ranking|template|guardrails|ui|qa",
          title: "string",
          action: "specific change proposal",
          implementationHint: "file/function-level hint",
          expectedImpact: "string",
          risk: "string",
          effort: "S|M|L",
          validationScenarios: ["scenarioId"],
        },
      ],
      testPlan: {
        mustPassScenarios: ["scenarioId"],
        regressionSuites: ["suite/file names"],
        successMetrics: ["metric and threshold"],
      },
    },
    currentState: {
      qaSummary: runReport?.summary || null,
      judgeSummary: {
        runId: judgeReport?.runId || null,
        totalScenarios: judgeReport?.totalScenarios ?? null,
        byJudge: Array.isArray(judgeReport?.judges)
          ? judgeReport.judges.map((j) => ({
              judge: j?.judge || null,
              averageUsefulness: j?.summary?.averageUsefulness ?? null,
              usefulRate: j?.summary?.usefulRate ?? null,
              topIssues: Array.isArray(j?.summary?.topIssues) ? j.summary.topIssues.slice(0, 6) : [],
            }))
          : [],
      },
      focusScenarios,
    },
  };

  return [
    "You are an external advisory reviewer for Biznesinfo AI assistant QA loop.",
    "Provide concrete engineering advice, not generic text.",
    "Return ONLY valid JSON.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function normalizeAdvisorOutput(advisor, parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("advisor output is not an object");
  }

  const executiveSummary = truncate(parsed.executiveSummary || "", 1200);
  const priorityPlan = Array.isArray(parsed.priorityPlan)
    ? parsed.priorityPlan
        .map((x, idx) => ({
          priority: /^(P0|P1|P2)$/u.test(String(x?.priority || "")) ? String(x.priority) : idx < 2 ? "P0" : "P1",
          title: truncate(x?.title || "", 180),
          why: truncate(x?.why || "", 260),
          expectedImpact: truncate(x?.expectedImpact || "", 220),
          validationScenarios: Array.isArray(x?.validationScenarios)
            ? x.validationScenarios.map((v) => truncate(v, 32)).filter(Boolean).slice(0, 8)
            : [],
        }))
        .filter((x) => x.title)
        .slice(0, 12)
    : [];

  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .map((x, idx) => ({
          id: truncate(x?.id || `R${idx + 1}`, 16),
          area: /^(prompt|retrieval|geo|ranking|template|guardrails|ui|qa)$/u.test(String(x?.area || ""))
            ? String(x.area)
            : "qa",
          title: truncate(x?.title || "", 180),
          action: truncate(x?.action || "", 420),
          implementationHint: truncate(x?.implementationHint || "", 240),
          expectedImpact: truncate(x?.expectedImpact || "", 220),
          risk: truncate(x?.risk || "", 180),
          effort: /^(S|M|L)$/u.test(String(x?.effort || "")) ? String(x.effort) : "M",
          validationScenarios: Array.isArray(x?.validationScenarios)
            ? x.validationScenarios.map((v) => truncate(v, 32)).filter(Boolean).slice(0, 8)
            : [],
        }))
        .filter((x) => x.title && x.action)
        .slice(0, 25)
    : [];

  const testPlan = parsed?.testPlan && typeof parsed.testPlan === "object" && !Array.isArray(parsed.testPlan)
    ? {
        mustPassScenarios: Array.isArray(parsed.testPlan.mustPassScenarios)
          ? parsed.testPlan.mustPassScenarios.map((x) => truncate(x, 32)).filter(Boolean).slice(0, 20)
          : [],
        regressionSuites: Array.isArray(parsed.testPlan.regressionSuites)
          ? parsed.testPlan.regressionSuites.map((x) => truncate(x, 120)).filter(Boolean).slice(0, 20)
          : [],
        successMetrics: Array.isArray(parsed.testPlan.successMetrics)
          ? parsed.testPlan.successMetrics.map((x) => truncate(x, 200)).filter(Boolean).slice(0, 20)
          : [],
      }
    : { mustPassScenarios: [], regressionSuites: [], successMetrics: [] };

  if (recommendations.length === 0) {
    throw new Error(`advisor ${advisor} returned zero valid recommendations`);
  }

  return {
    advisor,
    executiveSummary,
    priorityPlan,
    recommendations,
    testPlan,
  };
}

function buildConsensus(adviceRows) {
  const areaCounts = new Map();
  const titleCounts = new Map();

  for (const row of adviceRows) {
    for (const rec of row.recommendations || []) {
      const area = String(rec.area || "").toLowerCase();
      if (area) areaCounts.set(area, (areaCounts.get(area) || 0) + 1);

      const key = String(rec.title || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (key) titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    }
  }

  const topAreas = Array.from(areaCounts.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const recurringTitles = Array.from(titleCounts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { topAreas, recurringTitles };
}

function buildMarkdown(out) {
  const md = [];
  md.push(`# Advisor Report — ${out.runId}`);
  md.push("");
  md.push(`- Generated: ${out.generatedAt}`);
  md.push(`- QA report: ${out.sourceReport}`);
  md.push(`- Judge report: ${out.sourceJudgeReport}`);
  md.push(`- Focus scenarios: ${out.focusScenarios.length}`);
  md.push(`- Advisors: ${out.advice.map((x) => x.advisor).join(", ")}`);
  md.push("");

  md.push("## Focus Scenarios");
  md.push("");
  for (const s of out.focusScenarios) {
    const status = s.strictPass ? "pass" : "fail";
    const avg = Number.isFinite(s.avgUsefulness) ? `${s.avgUsefulness}/5` : "n/a";
    md.push(`- ${s.id} (${status}, usefulness ${avg}): ${s.title}`);
  }
  md.push("");

  md.push("## Consensus");
  md.push("");
  if (out.consensus.topAreas.length === 0) md.push("- Top areas: none");
  else {
    md.push("- Top areas:");
    for (const row of out.consensus.topAreas) md.push(`  - ${row.area}: ${row.count}`);
  }
  if (out.consensus.recurringTitles.length === 0) md.push("- Recurring recommendations: none");
  else {
    md.push("- Recurring recommendations:");
    for (const row of out.consensus.recurringTitles) md.push(`  - ${row.title} (${row.count})`);
  }
  md.push("");

  for (const advice of out.advice) {
    md.push(`## ${advice.advisor}`);
    md.push("");
    if (advice.executiveSummary) md.push(`- Summary: ${advice.executiveSummary}`);
    md.push("");
    md.push("### Priority Plan");
    md.push("");
    if (!Array.isArray(advice.priorityPlan) || advice.priorityPlan.length === 0) {
      md.push("- none");
    } else {
      for (const row of advice.priorityPlan) {
        md.push(`- ${row.priority} — ${row.title}`);
        if (row.why) md.push(`  why: ${row.why}`);
        if (row.expectedImpact) md.push(`  impact: ${row.expectedImpact}`);
        if (Array.isArray(row.validationScenarios) && row.validationScenarios.length > 0) {
          md.push(`  validate: ${row.validationScenarios.join(", ")}`);
        }
      }
    }
    md.push("");
    md.push("### Recommendations");
    md.push("");
    for (const rec of advice.recommendations || []) {
      md.push(`- [${rec.id}] (${rec.area}, effort ${rec.effort}) ${rec.title}`);
      md.push(`  action: ${rec.action}`);
      if (rec.implementationHint) md.push(`  hint: ${rec.implementationHint}`);
      if (rec.expectedImpact) md.push(`  impact: ${rec.expectedImpact}`);
      if (rec.risk) md.push(`  risk: ${rec.risk}`);
      if (Array.isArray(rec.validationScenarios) && rec.validationScenarios.length > 0) {
        md.push(`  validate: ${rec.validationScenarios.join(", ")}`);
      }
    }
    md.push("");
  }

  return `${md.join("\n")}\n`;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(opts.report)) throw new Error(`QA report not found: ${opts.report}`);
  if (!fs.existsSync(opts.judged)) throw new Error(`Judge report not found: ${opts.judged}`);

  const runReport = JSON.parse(fs.readFileSync(opts.report, "utf8"));
  const judgeReport = JSON.parse(fs.readFileSync(opts.judged, "utf8"));
  const runId = `advisor-${nowIsoCompact()}`;

  const focusScenarios = buildScenarioPriority({ runReport, judgeReport, opts });
  if (focusScenarios.length === 0) throw new Error("No scenarios available for advisor analysis");

  fs.mkdirSync(opts.outDir, { recursive: true });
  const rawDir = path.join(opts.outDir, `${runId}.raw`);
  fs.mkdirSync(rawDir, { recursive: true });

  const advice = [];
  for (const advisor of opts.advisors) {
    const prompt = buildAdvisorPrompt({ advisor, runReport, judgeReport, focusScenarios });
    const result = runAdvisor(advisor, prompt);
    const rawFile = path.join(rawDir, `${advisor}.txt`);
    fs.writeFileSync(rawFile, result.stdout || result.stderr || "", "utf8");

    if (!result.ok) {
      throw new Error(`${advisor} failed: exit=${result.status} ${truncate(result.stderr, 260)}`);
    }

    const candidate = stripJsonHostileControlChars(extractJsonCandidate(result.stdout));
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (error) {
      const retryPrompt = [
        prompt,
        "",
        "IMPORTANT: return STRICT JSON only.",
        "Do not include markdown, comments, or any text before/after JSON.",
      ].join("\n");
      const retry = runAdvisor(advisor, retryPrompt);
      const retryRawPath = path.join(rawDir, `${advisor}.retry.txt`);
      fs.writeFileSync(retryRawPath, retry.stdout || retry.stderr || "", "utf8");
      if (!retry.ok) {
        throw new Error(`${advisor} returned non-JSON and retry failed: ${retry.status} ${truncate(retry.stderr, 260)}`);
      }
      try {
        parsed = JSON.parse(stripJsonHostileControlChars(extractJsonCandidate(retry.stdout)));
      } catch (retryError) {
        throw new Error(`${advisor} returned non-JSON (after retry): ${retryError instanceof Error ? retryError.message : String(retryError)}`);
      }
    }

    const normalized = normalizeAdvisorOutput(advisor, parsed);
    advice.push(normalized);
    process.stdout.write(`[${advisor}] advice ok (${normalized.recommendations.length} recommendations)\n`);
  }

  const out = {
    runId,
    generatedAt: new Date().toISOString(),
    sourceReport: opts.report,
    sourceJudgeReport: opts.judged,
    focusScenarios,
    advice,
    consensus: buildConsensus(advice),
  };

  const jsonFile = path.join(opts.outDir, `${runId}.advice.json`);
  const mdFile = path.join(opts.outDir, `${runId}.advice.md`);
  const latestJson = path.join(opts.outDir, "latest.advice.json");
  const latestMd = path.join(opts.outDir, "latest.advice.md");

  fs.writeFileSync(jsonFile, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdFile, buildMarkdown(out), "utf8");
  fs.writeFileSync(latestJson, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestMd, buildMarkdown(out), "utf8");

  console.log(`Advice JSON: ${jsonFile}`);
  console.log(`Advice MD:   ${mdFile}`);
}

main();
