#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function parseRateOrNull(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function parseArgs(argv) {
  const out = {
    reportsDir: path.join(repoRoot, "app", "qa", "ai-request", "reports"),
    scenarioFile: path.join(repoRoot, "app", "qa", "ai-request", "scenarios.regressions.geo-ambiguity.json"),
    outJson: path.join(repoRoot, "app", "qa", "ai-request", "reports", "geo-ambiguity-trend.json"),
    outMd: path.join(repoRoot, "app", "qa", "ai-request", "reports", "geo-ambiguity-trend.md"),
    window: 20,
    minLatestPassRate: null,
    requireTargetReached: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reports-dir") out.reportsDir = path.resolve(argv[++i]);
    else if (a === "--scenario-file") out.scenarioFile = path.resolve(argv[++i]);
    else if (a === "--out-json") out.outJson = path.resolve(argv[++i]);
    else if (a === "--out-md") out.outMd = path.resolve(argv[++i]);
    else if (a === "--window") out.window = Math.max(1, Math.floor(Number(argv[++i] || 20)));
    else if (a === "--min-latest-pass-rate") out.minLatestPassRate = parseRateOrNull(argv[++i]);
    else if (a === "--require-target-reached") out.requireTargetReached = true;
    else if (a === "--help" || a === "-h") {
      console.log([
        "Usage: node app/scripts/track_geo_ambiguity_pass_rate_trend.mjs [options]",
        "",
        "Options:",
        "  --reports-dir PATH          Directory with run-*.json reports",
        "  --scenario-file PATH        Scenario file to filter by",
        "  --out-json PATH             Output JSON path",
        "  --out-md PATH               Output Markdown path",
        "  --window N                  Number of recent runs in trend table (default 20)",
        "  --min-latest-pass-rate R    Optional gate for latest pass-rate (0..1 or 0..100)",
        "  --require-target-reached    Optional gate: fail if latest targetReached=false",
      ].join("\n"));
      process.exit(0);
    }
  }

  return out;
}

function round4(n) {
  return Number(Number(n || 0).toFixed(4));
}

function percent(n) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`;
}

const SPARKLINE_ASCII = "._-:=+*#@";

function sparklineFromRates(rates, charset = SPARKLINE_ASCII) {
  if (!Array.isArray(rates) || rates.length === 0) return "n/a";
  const maxIdx = Math.max(0, charset.length - 1);
  return rates
    .map((raw) => {
      const rate = Math.max(0, Math.min(1, Number(raw || 0)));
      const idx = Math.max(0, Math.min(maxIdx, Math.round(rate * maxIdx)));
      return charset[idx] || charset[maxIdx] || "@";
    })
    .join("");
}

function formatCompactDuration(msRaw) {
  const ms = Number(msRaw);
  if (!Number.isFinite(ms) || ms < 0) return "n/a";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function normalizePathLike(raw) {
  return String(raw || "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function matchesScenario(candidate, target) {
  const c = normalizePathLike(candidate).toLowerCase();
  const t = normalizePathLike(target).toLowerCase();
  if (!c || !t) return false;
  if (c === t) return true;

  const cBase = path.posix.basename(c);
  const tBase = path.posix.basename(t);
  if (cBase && cBase === tBase) return true;

  if (c.endsWith(`/${t}`) || c.endsWith(t)) return true;
  if (t.endsWith(`/${c}`) || t.endsWith(c)) return true;
  return false;
}

function toNumber(raw, fallback = 0) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(raw, fallback = 0) {
  return Math.floor(toNumber(raw, fallback));
}

function parseSummary(filePath) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
  const s = report?.summary;
  if (!s || typeof s !== "object") return null;

  const startedAt = String(s.startedAt || "").trim();
  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) return null;

  const totalScenarios = Math.max(0, toInt(s.totalScenarios, 0));
  const passedScenarios = Math.max(0, toInt(s.passedScenarios, 0));
  const failedScenarios = Math.max(0, toInt(s.failedScenarios, totalScenarios - passedScenarios));
  const totalChecks = Math.max(0, toInt(s.totalChecks, 0));
  const passedChecks = Math.max(0, toInt(s.passedChecks, 0));
  const failedChecks = Math.max(0, toInt(s.failedChecks, totalChecks - passedChecks));
  const passRate =
    parseRateOrNull(s.passRate) ??
    round4(passedScenarios / Math.max(1, totalScenarios));
  const checkPassRate =
    parseRateOrNull(s.checkPassRate) ??
    round4(passedChecks / Math.max(1, totalChecks));

  return {
    runId: String(s.runId || path.basename(filePath, ".json")),
    startedAt,
    startedAtMs,
    endedAt: String(s.endedAt || "").trim() || null,
    scenarioFile: String(s.scenarioFile || "").trim(),
    totalScenarios,
    passedScenarios,
    failedScenarios,
    passRate: round4(passRate),
    totalChecks,
    passedChecks,
    failedChecks,
    checkPassRate: round4(checkPassRate),
    targetPassCount: toInt(s.targetPassCount, 0),
    targetPassRate: parseRateOrNull(s.targetPassRate),
    targetReached: Boolean(s.targetReached),
    stoppedEarly: Boolean(s.stoppedEarly),
    stopReasonType: s.stopReason?.type || null,
    sourceFile: filePath,
  };
}

function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, n) => acc + Number(n || 0), 0);
  return sum / numbers.length;
}

function buildTrend(opts) {
  const reportsDir = path.resolve(opts.reportsDir);
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`Reports directory not found: ${reportsDir}`);
  }

  const files = fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^run-.*\.json$/u.test(entry.name))
    .map((entry) => path.join(reportsDir, entry.name));

  const runs = [];
  for (const filePath of files) {
    const parsed = parseSummary(filePath);
    if (!parsed) continue;
    if (!matchesScenario(parsed.scenarioFile, opts.scenarioFile)) continue;
    runs.push(parsed);
  }

  runs.sort((a, b) => a.startedAtMs - b.startedAtMs || a.runId.localeCompare(b.runId));
  if (runs.length === 0) {
    throw new Error(
      `No matching runs found for ${path.basename(opts.scenarioFile)} in ${reportsDir}. ` +
      "Run qa:run:geo-ambiguity first.",
    );
  }

  const latest = runs[runs.length - 1];
  const previous = runs.length > 1 ? runs[runs.length - 2] : null;
  const recentWindow = Math.max(1, Math.min(opts.window, runs.length));
  const recentRuns = runs.slice(-recentWindow);
  const recentSparklineWindow = Math.max(1, Math.min(7, runs.length));
  const recentSparklineRuns = runs.slice(-recentSparklineWindow);
  const lastGreenRun = [...runs].reverse().find((x) => x.targetReached) || null;
  const nowMs = Date.now();
  const lastGreenAgeMs = lastGreenRun ? Math.max(0, nowMs - lastGreenRun.startedAtMs) : null;

  const passRates = runs.map((x) => x.passRate);
  const checkPassRates = runs.map((x) => x.checkPassRate);
  const latestDelta = previous ? round4(latest.passRate - previous.passRate) : null;
  const trendDirection = latestDelta == null ? "flat" : latestDelta > 0 ? "up" : latestDelta < 0 ? "down" : "flat";
  const failingRuns = runs.filter((x) => !x.targetReached).length;
  const targetMissRate = round4(failingRuns / Math.max(1, runs.length));

  return {
    generatedAt: new Date().toISOString(),
    reportsDir,
    scenarioFileTarget: path.resolve(opts.scenarioFile),
    scenarioFileBasename: path.basename(opts.scenarioFile),
    totalRuns: runs.length,
    recentWindow,
    stats: {
      latestPassRate: latest.passRate,
      latestCheckPassRate: latest.checkPassRate,
      latestTargetReached: latest.targetReached,
      latestPassedScenarios: latest.passedScenarios,
      latestTotalScenarios: latest.totalScenarios,
      latestDeltaFromPrevious: latestDelta,
      trendDirection,
      averagePassRate: round4(average(passRates)),
      averageCheckPassRate: round4(average(checkPassRates)),
      recentAveragePassRate: round4(average(recentRuns.map((x) => x.passRate))),
      recentAverageCheckPassRate: round4(average(recentRuns.map((x) => x.checkPassRate))),
      bestPassRate: round4(Math.max(...passRates)),
      worstPassRate: round4(Math.min(...passRates)),
      failingRuns,
      targetMissRate,
      recentSparklineWindow,
      recentSparkline: sparklineFromRates(recentSparklineRuns.map((x) => x.passRate)),
      lastGreenRunId: lastGreenRun ? lastGreenRun.runId : null,
      lastGreenStartedAt: lastGreenRun ? lastGreenRun.startedAt : null,
      lastGreenAgeMs,
    },
    latestRun: latest,
    recentRuns,
    allRuns: runs,
  };
}

function writeOutputs(opts, trend) {
  fs.mkdirSync(path.dirname(opts.outJson), { recursive: true });
  fs.mkdirSync(path.dirname(opts.outMd), { recursive: true });

  fs.writeFileSync(opts.outJson, `${JSON.stringify(trend, null, 2)}\n`, "utf8");

  const md = [];
  md.push("# Geo Ambiguity QA Pass-Rate Trend");
  md.push("");
  md.push(`- Generated: ${trend.generatedAt}`);
  md.push(`- Reports dir: ${trend.reportsDir}`);
  md.push(`- Scenario: ${trend.scenarioFileTarget}`);
  md.push(`- Matched runs: ${trend.totalRuns}`);
  md.push(`- Latest run: ${trend.latestRun.runId}`);
  md.push(`- Latest pass-rate: ${percent(trend.stats.latestPassRate)}`);
  md.push(`- Latest check pass-rate: ${percent(trend.stats.latestCheckPassRate)}`);
  md.push(`- Latest target reached: ${trend.stats.latestTargetReached ? "yes" : "no"}`);
  md.push(
    `- Last ${trend.stats.recentSparklineWindow}-run sparkline (old->new): ` +
    `${trend.stats.recentSparkline} (low='${SPARKLINE_ASCII[0]}', high='${SPARKLINE_ASCII[SPARKLINE_ASCII.length - 1]}')`,
  );
  if (trend.stats.lastGreenRunId && trend.stats.lastGreenStartedAt) {
    md.push(
      `- Time since last green run: ${formatCompactDuration(trend.stats.lastGreenAgeMs)} ` +
      `(since ${trend.stats.lastGreenStartedAt}, ${trend.stats.lastGreenRunId})`,
    );
  } else {
    md.push("- Time since last green run: n/a (no target-reached runs yet)");
  }
  if (trend.stats.latestDeltaFromPrevious != null) {
    const sign = trend.stats.latestDeltaFromPrevious > 0 ? "+" : "";
    md.push(`- Delta vs previous: ${sign}${(trend.stats.latestDeltaFromPrevious * 100).toFixed(1)} pp`);
  }
  md.push(`- Trend direction: ${trend.stats.trendDirection}`);
  md.push(`- Average pass-rate (all): ${percent(trend.stats.averagePassRate)}`);
  md.push(`- Average pass-rate (recent ${trend.recentWindow}): ${percent(trend.stats.recentAveragePassRate)}`);
  md.push(`- Target miss-rate: ${percent(trend.stats.targetMissRate)} (${trend.stats.failingRuns}/${trend.totalRuns})`);
  md.push("");
  md.push("## Recent Runs (latest first)");
  md.push("");
  md.push("| Started (UTC) | Run ID | Pass | Checks | Target |");
  md.push("| --- | --- | --- | --- | --- |");

  for (const run of [...trend.recentRuns].reverse()) {
    md.push(
      `| ${run.startedAt} | ${run.runId} | ${percent(run.passRate)} (${run.passedScenarios}/${run.totalScenarios}) | ` +
      `${percent(run.checkPassRate)} (${run.passedChecks}/${run.totalChecks}) | ${run.targetReached ? "yes" : "no"} |`,
    );
  }

  md.push("");
  if (!trend.latestRun.targetReached) {
    md.push("## Regression Alert");
    md.push("");
    md.push(`Latest run did not hit target pass count (${trend.latestRun.passedScenarios}/${trend.latestRun.totalScenarios}).`);
    md.push("Run `npm run qa:run:geo-ambiguity` and inspect `app/qa/ai-request/reports/latest.md` for failed checks.");
    md.push("");
  }

  fs.writeFileSync(opts.outMd, `${md.join("\n")}\n`, "utf8");
}

function checkGates(opts, trend) {
  if (opts.requireTargetReached && !trend.latestRun.targetReached) {
    console.error("Gate failed: latest geo-ambiguity run has targetReached=false.");
    return 3;
  }

  if (opts.minLatestPassRate != null && trend.latestRun.passRate < opts.minLatestPassRate) {
    console.error(
      `Gate failed: latest pass-rate ${percent(trend.latestRun.passRate)} < required ${percent(opts.minLatestPassRate)}.`,
    );
    return 2;
  }

  return 0;
}

function main() {
  const opts = parseArgs(process.argv);
  const trend = buildTrend(opts);
  writeOutputs(opts, trend);

  console.log(`Geo trend JSON: ${opts.outJson}`);
  console.log(`Geo trend MD:   ${opts.outMd}`);
  console.log(
    `Latest geo-ambiguity pass-rate: ${percent(trend.latestRun.passRate)} ` +
    `(${trend.latestRun.passedScenarios}/${trend.latestRun.totalScenarios})`,
  );

  return checkGates(opts, trend);
}

try {
  const code = main();
  process.exit(Number.isFinite(Number(code)) ? Number(code) : 0);
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
