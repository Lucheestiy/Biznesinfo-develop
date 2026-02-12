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

function makeRunId() {
  const pid = typeof process.pid === "number" ? process.pid : 0;
  const rand = Math.random().toString(36).slice(2, 7);
  return `run-${nowIsoCompact()}-${pid}-${rand}`;
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
    paidLimit: Number(process.env.QA_AI_PAID_LIMIT || 1000),
    maxScenarios: null,
    onlyTags: [],
    maxRateLimitRetries: Number(process.env.QA_AI_MAX_RATE_LIMIT_RETRIES || 4),
    maxBusyRetries: Number(process.env.QA_AI_MAX_BUSY_RETRIES || 8),
    busyRetryBaseMs: Number(process.env.QA_AI_BUSY_RETRY_BASE_MS || 900),
    busyRetryMaxMs: Number(process.env.QA_AI_BUSY_RETRY_MAX_MS || 180000),
    maxBusyTotalWaitMs: Number(process.env.QA_AI_MAX_BUSY_TOTAL_WAIT_MS || 300000),
    useRunLock: process.env.QA_AI_USE_RUN_LOCK === "0" ? false : true,
    runLockFile: process.env.QA_AI_RUN_LOCK_FILE || path.join(repoRoot, "app", "qa", "ai-request", ".qa-runner.lock"),
    runLockTimeoutMs: Number(process.env.QA_AI_RUN_LOCK_TIMEOUT_MS || 900000),
    runLockPollMs: Number(process.env.QA_AI_RUN_LOCK_POLL_MS || 1000),
    runLockStaleMs: Number(process.env.QA_AI_RUN_LOCK_STALE_MS || 5400000),
    maxStubRetries: Number(process.env.QA_AI_MAX_STUB_RETRIES || 2),
    minTurnDelayMs: Number(process.env.QA_AI_MIN_TURN_DELAY_MS || 120),
    stubOutageThreshold: Number(process.env.QA_AI_STUB_OUTAGE_THRESHOLD || 12),
    targetPassCount: null,
    targetPassRate: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--scenarios") out.scenarios = path.resolve(argv[++i]);
    else if (a === "--reports-dir") out.reportsDir = path.resolve(argv[++i]);
    else if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--no-prepare-paid") out.preparePaid = false;
    else if (a === "--prepare-paid") out.preparePaid = true;
    else if (a === "--paid-limit") out.paidLimit = Number(argv[++i] || 1000);
    else if (a === "--max-scenarios") out.maxScenarios = Number(argv[++i] || 0) || null;
    else if (a === "--tag") out.onlyTags.push((argv[++i] || "").trim());
    else if (a === "--max-rate-limit-retries") out.maxRateLimitRetries = Number(argv[++i] || 4);
    else if (a === "--max-busy-retries") out.maxBusyRetries = Number(argv[++i] || 8);
    else if (a === "--busy-retry-base-ms") out.busyRetryBaseMs = Number(argv[++i] || 900);
    else if (a === "--busy-retry-max-ms") out.busyRetryMaxMs = Number(argv[++i] || 180000);
    else if (a === "--max-busy-total-wait-ms") out.maxBusyTotalWaitMs = Number(argv[++i] || 300000);
    else if (a === "--no-run-lock") out.useRunLock = false;
    else if (a === "--run-lock-file") out.runLockFile = path.resolve(argv[++i]);
    else if (a === "--run-lock-timeout-ms") out.runLockTimeoutMs = Number(argv[++i] || 900000);
    else if (a === "--run-lock-poll-ms") out.runLockPollMs = Number(argv[++i] || 1000);
    else if (a === "--run-lock-stale-ms") out.runLockStaleMs = Number(argv[++i] || 5400000);
    else if (a === "--max-stub-retries") out.maxStubRetries = Number(argv[++i] || 2);
    else if (a === "--min-turn-delay-ms") out.minTurnDelayMs = Number(argv[++i] || 0);
    else if (a === "--stub-outage-threshold") out.stubOutageThreshold = Number(argv[++i] || 12);
    else if (a === "--target-pass-count") {
      const n = Number(argv[++i] || 0);
      out.targetPassCount = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a === "--target-pass-rate") {
      const n = Number(argv[++i] || 0);
      if (!Number.isFinite(n) || n <= 0) out.targetPassRate = null;
      else out.targetPassRate = n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
    }
    else if (a === "--help" || a === "-h") {
      console.log([
        "Usage: node app/scripts/ai-request-qa-runner.mjs [options]",
        "",
        "Options:",
        "  --base-url URL                Base URL (default http://127.0.0.1:8131)",
        "  --scenarios PATH              Scenario JSON path",
        "  --reports-dir PATH            Directory for run reports",
        "  --email EMAIL                 QA user email",
        "  --password PASSWORD           QA user password",
        "  --name NAME                   QA user display name",
        "  --prepare-paid                Promote QA user to paid and increase paid limit",
        "  --no-prepare-paid             Skip DB plan preparation",
        "  --paid-limit N                Paid daily limit (default 1000)",
        "  --max-scenarios N             Run first N scenarios",
        "  --tag TAG                     Run only scenarios that include TAG (repeatable)",
        "  --max-rate-limit-retries N    Retries for API 429 RateLimited (default 4)",
        "  --max-busy-retries N          Retries for API 409 AiBusy (default 8)",
        "  --busy-retry-base-ms N        Base wait for AiBusy retries (default 900)",
        "  --busy-retry-max-ms N         Max single wait for AiBusy (default 180000)",
        "  --max-busy-total-wait-ms N    Max cumulative wait per turn for AiBusy (default 300000)",
        "  --no-run-lock                 Disable run-level lock (not recommended)",
        "  --run-lock-file PATH          File path for run-level lock",
        "  --run-lock-timeout-ms N       Max wait for lock acquisition (default 900000)",
        "  --run-lock-poll-ms N          Poll interval while waiting lock (default 1000)",
        "  --run-lock-stale-ms N         Stale lock TTL before auto-cleanup (default 5400000)",
        "  --max-stub-retries N          Retries when provider returns stub reply (default 2)",
        "  --min-turn-delay-ms N         Delay between turn requests to reduce burst load (default 120)",
        "  --stub-outage-threshold N     Stop run after N consecutive global stub replies (default 12)",
        "  --target-pass-count N         Required number of passed scenarios (default: 45 for 50-scenario suite; otherwise derived)",
        "  --target-pass-rate R          Required pass-rate (0..1 or 0..100); used to derive target-pass-count",
      ].join("\n"));
      process.exit(0);
    }
  }

  return out;
}

class SimpleCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  storeFrom(headers) {
    if (!headers) return;
    const headerValue = headers.get("set-cookie");
    if (!headerValue) return;

    // Works for this app where a single session cookie is set.
    const first = headerValue.split(",")[0];
    const pair = first.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) return;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) return;
    this.cookies.set(name, value);
  }

  toHeader() {
    if (this.cookies.size === 0) return "";
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

function escapeSqlLiteral(raw) {
  return String(raw || "").replace(/'/g, "''");
}

function loadDotEnv(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    out[key] = val;
  }
  return out;
}

function runDockerSql({ email, paidLimit }) {
  const envFile = loadDotEnv(path.join(repoRoot, ".env"));
  const pgUser = envFile.POSTGRES_USER || "biznesinfo";
  const pgDb = envFile.POSTGRES_DB || "biznesinfo";
  const safeEmail = escapeSqlLiteral(email);
  const safeLimit = Number.isFinite(paidLimit) ? Math.max(1, Math.floor(paidLimit)) : 1000;

  const sql = [
    `UPDATE users SET plan='paid', updated_at=now() WHERE lower(email)=lower('${safeEmail}');`,
    `INSERT INTO plan_limits (plan, ai_requests_per_day, updated_at) VALUES ('paid', ${safeLimit}, now())`,
    `ON CONFLICT (plan) DO UPDATE SET ai_requests_per_day = EXCLUDED.ai_requests_per_day, updated_at = now();`,
    `SELECT email, plan FROM users WHERE lower(email)=lower('${safeEmail}');`,
    "SELECT plan, ai_requests_per_day FROM plan_limits WHERE plan='paid';",
  ].join(" ");

  const cmd = [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    pgUser,
    "-d",
    pgDb,
    "-c",
    sql,
  ];

  const proc = spawnSync("docker", cmd, { cwd: repoRoot, encoding: "utf8" });
  if (proc.status !== 0) {
    throw new Error(`Failed to run docker SQL bootstrap: ${proc.stderr || proc.stdout || "unknown error"}`);
  }

  return {
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readLockMeta(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function acquireRunLock(opts, runId) {
  if (!opts.useRunLock) {
    return { acquired: false, lockFile: null, release: () => {} };
  }

  const lockFile = path.resolve(opts.runLockFile);
  const timeoutMs = Math.max(0, Math.floor(opts.runLockTimeoutMs || 0));
  const pollMs = Math.max(50, Math.floor(opts.runLockPollMs || 1000));
  const staleMs = Math.max(1000, Math.floor(opts.runLockStaleMs || 5400000));
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });

  for (;;) {
    const payload = {
      runId,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
    };
    try {
      fs.writeFileSync(lockFile, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "wx" });
      const release = () => safeUnlink(lockFile);
      return { acquired: true, lockFile, release };
    } catch (error) {
      const code = error && typeof error === "object" ? error.code : "";
      if (code !== "EEXIST") throw error;

      let isStale = false;
      let lockAgeMs = null;
      try {
        const stat = fs.statSync(lockFile);
        lockAgeMs = Date.now() - stat.mtimeMs;
        if (lockAgeMs > staleMs) isStale = true;
      } catch {
        // If lock disappeared between checks, retry immediately.
      }

      if (isStale) {
        const staleMeta = readLockMeta(lockFile);
        safeUnlink(lockFile);
        process.stdout.write(
          `[run-lock] removed stale lock ${lockFile} (age=${Math.round((lockAgeMs || 0) / 1000)}s, runId=${staleMeta?.runId || "unknown"})\n`,
        );
        continue;
      }

      const waitedMs = Date.now() - startedAt;
      if (timeoutMs > 0 && waitedMs >= timeoutMs) {
        const meta = readLockMeta(lockFile);
        throw new Error(
          `Timeout waiting run lock ${lockFile} after ${Math.round(waitedMs / 1000)}s. ` +
          `Holder runId=${meta?.runId || "unknown"}, pid=${meta?.pid || "unknown"}, startedAt=${meta?.startedAt || "unknown"}`,
        );
      }

      await sleep(pollMs);
    }
  }
}

function compileRegex(pattern) {
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return null;
  }
}

function countMatches(re, text) {
  if (!re || !text) return 0;
  let n = 0;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  while (g.exec(text)) n++;
  return n;
}

function extractCompanyPaths(text) {
  if (typeof text !== "string" || !text) return [];
  const re = /\/company\/[a-z0-9-]+/giu;
  const seen = new Set();
  const out = [];
  for (const match of text.matchAll(re)) {
    const raw = String(match[0] || "");
    const path = raw.replace(/[)\].,;!?]+$/g, "");
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

const COMPANY_PATH_NOT_FOUND_RE =
  /(компания\s+не\s+найден[ао]|карточка\s+компании\s+не\s+найден[ао]|company\s+not\s+found)/iu;

function buildCompanyPathProbe({ status, bodyText, errorMessage = "" }) {
  const okStatus = Number.isFinite(status) && status >= 200 && status < 400;
  const notFoundByBody = COMPANY_PATH_NOT_FOUND_RE.test(String(bodyText || ""));
  return {
    status: Number.isFinite(status) ? status : 0,
    okStatus,
    notFoundByBody,
    resolved: okStatus && !notFoundByBody,
    error: String(errorMessage || ""),
  };
}

function checkTreeHasType(check, targetTypes) {
  if (!check || typeof check !== "object") return false;
  if (targetTypes.has(String(check.type || ""))) return true;
  const nested = Array.isArray(check.checks) ? check.checks : [];
  return nested.some((sub) => checkTreeHasType(sub, targetTypes));
}

function needsCompanyPathProbe(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return false;
  const targetTypes = new Set(["company_paths_resolve_min", "company_paths_resolve_all"]);
  return checks.some((check) => checkTreeHasType(check, targetTypes));
}

function toFinitePositiveNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function parseJsonSafe(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveAiBusyRetryAfterMs(api) {
  const fromHeader = toFinitePositiveNumber(api?.res?.headers?.get?.("retry-after"));
  if (fromHeader > 0) return Math.floor(fromHeader * 1000);

  const top = api?.json && typeof api.json === "object" ? api.json : null;
  const topRetrySeconds = toFinitePositiveNumber(top?.retryAfterSeconds);
  if (topRetrySeconds > 0) return Math.floor(topRetrySeconds * 1000);

  const topLockRetrySeconds = toFinitePositiveNumber(top?.lock?.retryAfterSeconds);
  if (topLockRetrySeconds > 0) return Math.floor(topLockRetrySeconds * 1000);

  const parsedMessage = parseJsonSafe(top?.message || "");
  const msgRetrySeconds = toFinitePositiveNumber(parsedMessage?.retryAfterSeconds);
  if (msgRetrySeconds > 0) return Math.floor(msgRetrySeconds * 1000);

  const msgLockRetrySeconds = toFinitePositiveNumber(parsedMessage?.lock?.retryAfterSeconds);
  if (msgLockRetrySeconds > 0) return Math.floor(msgLockRetrySeconds * 1000);

  return 0;
}

function evaluateCheck(check, ctx) {
  const text = String(ctx.currentReplyText || "");
  const lower = text.toLowerCase();

  const ok = (passed, reason, details = {}) => ({ passed, reason, details });

  switch (check.type) {
    case "not_stub": {
      const isStub = Boolean(ctx.currentIsStub) || /\(stub\)/iu.test(text);
      return ok(!isStub, isStub ? "Reply is stub" : "Reply is non-stub", { isStub });
    }

    case "includes_any": {
      const patterns = Array.isArray(check.patterns) ? check.patterns : [];
      const hits = patterns.filter((p) => {
        const re = compileRegex(p);
        return re ? re.test(text) : false;
      });
      return ok(hits.length > 0, hits.length > 0 ? "Matched at least one pattern" : "No required patterns matched", {
        patterns,
        hits,
      });
    }

    case "includes_all": {
      const patterns = Array.isArray(check.patterns) ? check.patterns : [];
      const missed = patterns.filter((p) => {
        const re = compileRegex(p);
        return !(re && re.test(text));
      });
      return ok(missed.length === 0, missed.length === 0 ? "All patterns matched" : "Some required patterns are missing", {
        patterns,
        missed,
      });
    }

    case "excludes_all": {
      const patterns = Array.isArray(check.patterns) ? check.patterns : [];
      const hits = patterns.filter((p) => {
        const re = compileRegex(p);
        return re ? re.test(text) : false;
      });
      return ok(hits.length === 0, hits.length === 0 ? "No forbidden patterns found" : "Forbidden patterns found", {
        patterns,
        hits,
      });
    }

    case "company_path_min_count": {
      const min = Number(check.min || 0);
      const re = /\/company\/[a-z0-9-]+/giu;
      const count = countMatches(re, text);
      return ok(count >= min, count >= min ? "Enough /company links" : "Not enough /company links", { min, count });
    }

    case "company_paths_resolve_min": {
      const min = Number(check.min || 1);
      const paths = Array.isArray(ctx.companyPaths) ? ctx.companyPaths : [];
      const probes = ctx.companyPathProbes && typeof ctx.companyPathProbes === "object" ? ctx.companyPathProbes : {};
      const resolvedPaths = paths.filter((path) => Boolean(probes[path]?.resolved));
      const unresolvedPaths = paths.filter((path) => !Boolean(probes[path]?.resolved));
      const passed = resolvedPaths.length >= min;
      return ok(
        passed,
        passed ? "Enough /company links resolve successfully" : "Not enough /company links resolve successfully",
        {
          min,
          pathCount: paths.length,
          resolvedCount: resolvedPaths.length,
          resolvedPaths,
          unresolvedPaths,
          probes,
        },
      );
    }

    case "company_paths_resolve_all": {
      const paths = Array.isArray(ctx.companyPaths) ? ctx.companyPaths : [];
      const probes = ctx.companyPathProbes && typeof ctx.companyPathProbes === "object" ? ctx.companyPathProbes : {};
      const allowNone = Boolean(check.allowNone);
      const unresolvedPaths = paths.filter((path) => !Boolean(probes[path]?.resolved));
      const hasAny = paths.length > 0;
      const passed = unresolvedPaths.length === 0 && (allowNone || hasAny);
      return ok(
        passed,
        passed ? "All /company links resolve successfully" : "Some /company links are broken or missing",
        {
          allowNone,
          pathCount: paths.length,
          unresolvedPaths,
          probes,
        },
      );
    }

    case "numbered_list_min": {
      const min = Number(check.min || 0);
      const re = /(^|\n)\s*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:\*\*)?\d+[).]/giu;
      const count = countMatches(re, text);
      return ok(count >= min, count >= min ? "Enough numbered items" : "Not enough numbered items", { min, count });
    }

    case "question_count_min": {
      const min = Number(check.min || 0);
      const count = (text.match(/\?/g) || []).length;
      return ok(count >= min, count >= min ? "Enough questions" : "Not enough questions", { min, count });
    }

    case "question_count_max": {
      const max = Number(check.max || 0);
      const count = (text.match(/\?/g) || []).length;
      return ok(count <= max, count <= max ? "Question count within limit" : "Too many questions", { max, count });
    }

    case "reply_length_min": {
      const min = Number(check.min || 0);
      const len = text.trim().length;
      return ok(len >= min, len >= min ? "Reply length sufficient" : "Reply too short", { min, len });
    }

    case "mentions_any_terms": {
      const terms = Array.isArray(check.terms) ? check.terms : [];
      const min = Number(check.min || 1);
      const hits = terms.filter((t) => lower.includes(String(t || "").toLowerCase()));
      return ok(hits.length >= min, hits.length >= min ? "Enough terms mentioned" : "Not enough terms mentioned", {
        terms,
        min,
        hits,
      });
    }

    case "template_blocks": {
      const hasSubject = /(^|\n)\s*Subject\s*[:\-—]/iu.test(text);
      const hasBody = /(^|\n)\s*Body\s*[:\-—]/iu.test(text);
      const hasWhatsapp = /(^|\n)\s*WhatsApp\s*[:\-—]/iu.test(text);
      const passed = hasSubject && hasBody && hasWhatsapp;
      return ok(passed, passed ? "Template blocks present" : "Template blocks missing", {
        hasSubject,
        hasBody,
        hasWhatsapp,
      });
    }

    case "not_refusal_only": {
      const refusal = /(не могу|не смогу|cannot|can't|нет доступа|не имею доступа|not able)/iu.test(text);
      if (!refusal) return ok(true, "No refusal markers", { refusal: false });

      const useful = /(\/company\/|рубр|ключев|критер|уточн|вопрос|subject\s*:|body\s*:|whatsapp\s*:|\?|\n\s*(?:\*\*)?\d+[).])/iu.test(
        text,
      );
      return ok(useful, useful ? "Refusal is accompanied by useful guidance" : "Refusal-only answer", {
        refusal,
        useful,
      });
    }

    case "any_of": {
      const checks = Array.isArray(check.checks) ? check.checks : [];
      const sub = checks.map((subCheck) => ({ check: subCheck, result: evaluateCheck(subCheck, ctx) }));
      const passed = sub.some((x) => x.result.passed);
      return ok(passed, passed ? "At least one sub-check passed" : "No sub-check passed", {
        sub: sub.map((x) => ({ type: x.check.type, passed: x.result.passed, reason: x.result.reason })),
      });
    }

    case "all_of": {
      const checks = Array.isArray(check.checks) ? check.checks : [];
      const sub = checks.map((subCheck) => ({ check: subCheck, result: evaluateCheck(subCheck, ctx) }));
      const passed = sub.every((x) => x.result.passed);
      return ok(passed, passed ? "All sub-checks passed" : "Some sub-checks failed", {
        sub: sub.map((x) => ({ type: x.check.type, passed: x.result.passed, reason: x.result.reason })),
      });
    }

    default:
      return ok(false, `Unknown check type: ${check.type}`, { unknownType: check.type });
  }
}

function normalizeTurnNumber(value, maxTurns) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const turnNumber = Math.floor(n);
  if (turnNumber < 1 || turnNumber > maxTurns) return null;
  return turnNumber;
}

function asArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function branchWhenMatches(when, ctx) {
  if (!when || typeof when !== "object") return true;

  if (typeof when.verdict === "string") {
    const expected = String(when.verdict || "").trim().toLowerCase();
    if (expected && expected !== ctx.verdict) return false;
  }

  const failedAny = asArrayOfStrings(when.failedCheckIdsAny);
  if (failedAny.length > 0 && !failedAny.some((id) => ctx.failedCheckIds.has(id))) return false;

  const failedAll = asArrayOfStrings(when.failedCheckIdsAll);
  if (failedAll.length > 0 && !failedAll.every((id) => ctx.failedCheckIds.has(id))) return false;

  const passedAny = asArrayOfStrings(when.passedCheckIdsAny);
  if (passedAny.length > 0 && !passedAny.some((id) => ctx.passedCheckIds.has(id))) return false;

  const passedAll = asArrayOfStrings(when.passedCheckIdsAll);
  if (passedAll.length > 0 && !passedAll.every((id) => ctx.passedCheckIds.has(id))) return false;

  const checksAll = Array.isArray(when.checksAll)
    ? when.checksAll
    : Array.isArray(when.checks)
      ? when.checks
      : [];
  if (checksAll.length > 0) {
    for (const check of checksAll) {
      if (!check || typeof check !== "object") return false;
      const result = evaluateCheck(check, ctx);
      if (!result.passed) return false;
    }
  }

  const checksAny = Array.isArray(when.checksAny) ? when.checksAny : [];
  if (checksAny.length > 0) {
    let matched = false;
    for (const check of checksAny) {
      if (!check || typeof check !== "object") continue;
      const result = evaluateCheck(check, ctx);
      if (result.passed) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }

  return true;
}

function resolveTurnTransition(params) {
  const {
    turn,
    maxTurns,
    currentTurnNumber,
    verdict,
    failedCheckIds,
    passedCheckIds,
    currentReplyText,
    currentIsStub,
    companyPaths,
    companyPathProbes,
    history,
    scenario,
    turnIndex,
  } = params;
  const failedSet = new Set(asArrayOfStrings(failedCheckIds));
  const passedSet = new Set(asArrayOfStrings(passedCheckIds));
  const branchCtx = {
    verdict,
    failedCheckIds: failedSet,
    passedCheckIds: passedSet,
    currentReplyText: String(currentReplyText || ""),
    currentIsStub: Boolean(currentIsStub),
    companyPaths: Array.isArray(companyPaths) ? companyPaths : [],
    companyPathProbes: companyPathProbes && typeof companyPathProbes === "object" ? companyPathProbes : {},
    history: Array.isArray(history) ? history : [],
    scenario: scenario || null,
    turn: turn || null,
    turnIndex: Number.isFinite(turnIndex) ? turnIndex : null,
  };

  const branches = Array.isArray(turn?.branches) ? turn.branches : [];
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (!branchWhenMatches(branch?.when, branchCtx)) continue;
    const nextTurnNumber = normalizeTurnNumber(branch?.nextTurnNumber, maxTurns);
    if (nextTurnNumber == null) continue;
    const branchId = String(branch?.id || `branch_${i + 1}`);
    return {
      nextTurnNumber,
      source: "branch",
      branchId,
      viaFailPath: verdict === "fail",
    };
  }

  if (verdict === "pass") {
    const nextOnPass = normalizeTurnNumber(turn?.nextOnPassTurnNumber, maxTurns);
    if (nextOnPass != null) {
      return {
        nextTurnNumber: nextOnPass,
        source: "nextOnPass",
        branchId: null,
        viaFailPath: false,
      };
    }
  } else if (verdict === "fail") {
    const nextOnFail = normalizeTurnNumber(turn?.nextOnFailTurnNumber, maxTurns);
    if (nextOnFail != null) {
      return {
        nextTurnNumber: nextOnFail,
        source: "nextOnFail",
        branchId: null,
        viaFailPath: true,
      };
    }
  }

  const sequential = currentTurnNumber + 1;
  return {
    nextTurnNumber: sequential <= maxTurns ? sequential : null,
    source: "sequential",
    branchId: null,
    viaFailPath: false,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const startedAt = new Date();
  const runId = makeRunId();
  const runLock = await acquireRunLock(opts, runId);
  if (runLock.acquired) {
    process.stdout.write(`[run-lock] acquired ${runLock.lockFile}\n`);
  }

  try {
    if (!fs.existsSync(opts.scenarios)) {
      throw new Error(`Scenario file not found: ${opts.scenarios}`);
    }

  const scenarioDoc = JSON.parse(fs.readFileSync(opts.scenarios, "utf8"));
  let scenarios = Array.isArray(scenarioDoc.scenarios) ? scenarioDoc.scenarios : [];

  if (opts.onlyTags.length > 0) {
    const tagSet = new Set(opts.onlyTags.map((x) => x.toLowerCase()));
    scenarios = scenarios.filter((s) => Array.isArray(s.tags) && s.tags.some((t) => tagSet.has(String(t).toLowerCase())));
  }
  if (opts.maxScenarios && opts.maxScenarios > 0) {
    scenarios = scenarios.slice(0, opts.maxScenarios);
  }

  if (scenarios.length === 0) {
    throw new Error("No scenarios selected");
  }

  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const jar = new SimpleCookieJar();

  async function requestJson(pathname, init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Content-Type") && init.body != null) headers.set("Content-Type", "application/json");
    const cookie = jar.toHeader();
    if (cookie) headers.set("Cookie", cookie);

    const reqInit = {
      method: init.method || "GET",
      headers,
      body: init.body != null ? JSON.stringify(init.body) : undefined,
    };

    const res = await fetch(`${baseUrl}${pathname}`, reqInit);
    jar.storeFrom(res.headers);

    const raw = await res.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    return { res, raw, json };
  }

  async function ensureUserSession() {
    const login = await requestJson("/api/auth/login", {
      method: "POST",
      body: { email: opts.email, password: opts.password },
    });

    if (login.res.status === 401 || (login.json && login.json.error === "InvalidCredentials")) {
      const reg = await requestJson("/api/auth/register", {
        method: "POST",
        body: { email: opts.email, password: opts.password, name: opts.name },
      });
      if (!reg.res.ok && reg.res.status !== 409) {
        throw new Error(`Register failed: HTTP ${reg.res.status} ${reg.raw}`);
      }
      if (reg.res.status === 409) {
        // Existing account, try login once more.
        const retry = await requestJson("/api/auth/login", {
          method: "POST",
          body: { email: opts.email, password: opts.password },
        });
        if (!retry.res.ok) {
          throw new Error(`Login retry failed after EmailTaken: HTTP ${retry.res.status} ${retry.raw}`);
        }
      }
    } else if (!login.res.ok) {
      throw new Error(`Login failed: HTTP ${login.res.status} ${login.raw}`);
    }

    const me = await requestJson("/api/auth/me");
    if (!me.res.ok) throw new Error(`Unable to read /api/auth/me: HTTP ${me.res.status} ${me.raw}`);
    if (!me.json?.user?.email) throw new Error(`No authenticated user in /api/auth/me response: ${me.raw}`);

    return me.json;
  }

  const authBefore = await ensureUserSession();

  if (opts.preparePaid) {
    runDockerSql({ email: opts.email, paidLimit: opts.paidLimit });
    await ensureUserSession();
  }

  // Best-effort daily reset at start of run.
  await requestJson("/api/ai/reset-usage", { method: "POST", body: {} }).catch(() => null);

  const authAfter = await requestJson("/api/auth/me");
  const userMeta = authAfter.json?.user || authBefore.user || null;

  const scenarioResults = [];
  const failurePatterns = new Map();
  const companyPathProbeCache = new Map();

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let consecutiveGlobalStubs = 0;
  let outageStop = null;

  for (let si = 0; si < scenarios.length; si++) {
    const scenario = scenarios[si];
    const scenarioStart = Date.now();
    const scenarioTurns = Array.isArray(scenario.turns) ? scenario.turns : [];
    const history = [];
    let scenarioConversationId = null;
    const turnResults = [];
    const blockingFailedChecksList = [];
    const toleratedFailedChecksList = [];
    let nextTurnNumber = scenarioTurns.length > 0 ? 1 : null;
    let scenarioStep = 0;
    const maxScenarioSteps = Math.max(8, scenarioTurns.length * 4);

    let scenarioHardError = null;

    while (nextTurnNumber != null) {
      if (scenarioStep >= maxScenarioSteps) {
        scenarioHardError = {
          status: 0,
          error: "BranchingLoopDetected",
          message: `Exceeded max scenario steps (${maxScenarioSteps}) while executing branching transitions.`,
        };
        failurePatterns.set("flow:BranchingLoopDetected", (failurePatterns.get("flow:BranchingLoopDetected") || 0) + 1);
        break;
      }
      scenarioStep += 1;

      const ti = nextTurnNumber - 1;
      const turn = scenarioTurns[ti];
      if (!turn || typeof turn !== "object") {
        scenarioHardError = {
          status: 0,
          error: "InvalidTurnReference",
          message: `Turn ${nextTurnNumber} is missing or invalid in scenario ${scenario.id}.`,
        };
        failurePatterns.set("flow:InvalidTurnReference", (failurePatterns.get("flow:InvalidTurnReference") || 0) + 1);
        break;
      }
      const requestBody = {
        message: turn.user,
        history,
        ...(scenario.context || {}),
        ...(turn.request || {}),
      };
      if (!requestBody.conversationId && !requestBody.sessionId && scenarioConversationId) {
        requestBody.conversationId = scenarioConversationId;
      }
      const payloadBase =
        requestBody.payload && typeof requestBody.payload === "object" && !Array.isArray(requestBody.payload)
          ? { ...requestBody.payload }
          : {};
      if (!payloadBase.source) payloadBase.source = "qa_runner";
      requestBody.payload = payloadBase;
      const requestBodySnapshot = JSON.parse(JSON.stringify(requestBody));

      const turnStart = Date.now();

      let api;
      let retriedQuota = false;
      let retriedBusy = 0;
      let retriedBusyWaitMs = 0;
      let retriedRateLimited = 0;
      let retriedStub = 0;

      for (;;) {
        if (opts.minTurnDelayMs > 0) {
          await sleep(Math.max(0, opts.minTurnDelayMs));
        }

        api = await requestJson("/api/ai/request", { method: "POST", body: requestBody });

        if (api.res.status === 429 && api.json?.error === "QuotaExceeded" && !retriedQuota) {
          retriedQuota = true;
          await requestJson("/api/ai/reset-usage", { method: "POST", body: {} }).catch(() => null);
          continue;
        }

        if (api.res.status === 429 && api.json?.error === "RateLimited" && retriedRateLimited < Math.max(0, opts.maxRateLimitRetries)) {
          retriedRateLimited += 1;
          const retryAfterHeader = Number(api.res.headers.get("retry-after") || "0");
          const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 800 * retriedRateLimited;
          await sleep(waitMs);
          continue;
        }

        if (api.res.status === 409 && api.json?.error === "AiBusy") {
          const retriesAllowed = Math.max(0, Math.floor(opts.maxBusyRetries));
          const maxTotalWaitMs = Math.max(0, Math.floor(opts.maxBusyTotalWaitMs));
          const baseWaitMs = Math.max(0, Math.floor(opts.busyRetryBaseMs));
          const maxSingleWaitMs = Math.max(baseWaitMs, Math.floor(opts.busyRetryMaxMs));
          const canRetryByCount = retriedBusy < retriesAllowed;
          const canRetryByBudget = maxTotalWaitMs <= 0 || retriedBusyWaitMs < maxTotalWaitMs;

          if (canRetryByCount && canRetryByBudget) {
            retriedBusy += 1;
            const serverSuggestedWaitMs = resolveAiBusyRetryAfterMs(api);
            const progressiveWaitMs = Math.min(maxSingleWaitMs, baseWaitMs * Math.max(1, retriedBusy));
            let waitMs = Math.max(progressiveWaitMs, serverSuggestedWaitMs);

            if (maxTotalWaitMs > 0) {
              const remainingBudgetMs = Math.max(0, maxTotalWaitMs - retriedBusyWaitMs);
              waitMs = Math.min(waitMs, remainingBudgetMs);
            }

            // Always wait at least once before giving up on a transient lock race.
            waitMs = Math.max(waitMs, Math.min(250, maxSingleWaitMs));
            retriedBusyWaitMs += waitMs;
            await sleep(waitMs);
            continue;
          }
        }

        if (api.res.ok && retriedStub < Math.max(0, opts.maxStubRetries)) {
          const replyText = String(api.json?.reply?.text || "");
          const isStub = Boolean(api.json?.reply?.isStub);
          const explicitStub = /\(stub\)/iu.test(replyText);
          if (isStub || explicitStub) {
            retriedStub += 1;
            await sleep(1000 * retriedStub);
            continue;
          }
        }

        break;
      }

      const latencyMs = Date.now() - turnStart;

      if (!api.res.ok) {
        const apiError = {
          status: api.res.status,
          error: api.json?.error || "HTTPError",
          message: api.json?.message || api.raw || "",
        };

        turnResults.push({
          turn: ti + 1,
          user: turn.user,
          requestBody: requestBodySnapshot,
          latencyMs,
          apiOk: false,
          apiError,
          checks: [],
          reply: null,
        });

        scenarioHardError = apiError;
        const key = `api:${apiError.error}:${apiError.status}`;
        failurePatterns.set(key, (failurePatterns.get(key) || 0) + 1);
        break;
      }

      const replyText = String(api.json?.reply?.text || "");
      const isStub = Boolean(api.json?.reply?.isStub);
      const responseConversationId =
        typeof api.json?.conversationId === "string" ? String(api.json.conversationId).trim() : "";
      if (responseConversationId) {
        scenarioConversationId = responseConversationId;
      }

      const checkResults = [];
      const checks = Array.isArray(turn.checks) ? turn.checks : [];
      const shouldProbeCompanyPaths = needsCompanyPathProbe(checks);
      const companyPaths = shouldProbeCompanyPaths ? extractCompanyPaths(replyText) : [];
      const companyPathProbes = {};

      if (shouldProbeCompanyPaths && companyPaths.length > 0) {
        const cookie = jar.toHeader();
        const baseHeaders = new Headers();
        if (cookie) baseHeaders.set("Cookie", cookie);

        for (const companyPath of companyPaths) {
          if (companyPathProbeCache.has(companyPath)) {
            companyPathProbes[companyPath] = companyPathProbeCache.get(companyPath);
            continue;
          }

          let probe;
          try {
            const pageRes = await fetch(`${baseUrl}${companyPath}`, {
              method: "GET",
              headers: baseHeaders,
            });
            const bodyText = await pageRes.text();
            probe = buildCompanyPathProbe({ status: pageRes.status, bodyText });
          } catch (error) {
            probe = buildCompanyPathProbe({
              status: 0,
              bodyText: "",
              errorMessage: error && typeof error === "object" ? error.message || String(error) : String(error || ""),
            });
          }

          companyPathProbeCache.set(companyPath, probe);
          companyPathProbes[companyPath] = probe;
        }
      }

      for (const check of checks) {
        totalChecks += 1;
        const result = evaluateCheck(check, {
          currentReplyText: replyText,
          currentIsStub: isStub,
          companyPaths,
          companyPathProbes,
          history,
          scenario,
          turn,
          turnIndex: ti,
        });
        const passed = Boolean(result.passed);
        if (passed) passedChecks += 1;
        else {
          failedChecks += 1;
          const patternKey = `check:${check.type}:${check.description || check.id || "(no-desc)"}`;
          failurePatterns.set(patternKey, (failurePatterns.get(patternKey) || 0) + 1);
        }

        checkResults.push({
          id: check.id || null,
          type: check.type,
          description: check.description || null,
          passed,
          reason: result.reason,
          details: result.details || {},
        });
      }

      const failedTurnChecks = checkResults.filter((item) => !item.passed);
      const failedTurnCheckIds = failedTurnChecks.map((item) => String(item.id || "").trim()).filter(Boolean);
      const passedTurnCheckIds = checkResults
        .filter((item) => item.passed)
        .map((item) => String(item.id || "").trim())
        .filter(Boolean);
      const turnVerdict = failedTurnChecks.length === 0 ? "pass" : "fail";
      const transition = resolveTurnTransition({
        turn,
        maxTurns: scenarioTurns.length,
        currentTurnNumber: nextTurnNumber,
        verdict: turnVerdict,
        failedCheckIds: failedTurnCheckIds,
        passedCheckIds: passedTurnCheckIds,
        currentReplyText: replyText,
        currentIsStub: isStub,
        companyPaths,
        companyPathProbes,
        history,
        scenario,
        turnIndex: ti,
      });
      const failHandledByBranch = failedTurnChecks.length > 0 && transition.viaFailPath;
      if (failHandledByBranch) {
        for (const item of checkResults) {
          if (item.passed) continue;
          item.tolerated = true;
          item.blocking = false;
        }
        for (const item of failedTurnChecks) {
          toleratedFailedChecksList.push({
            ...item,
            turn: ti + 1,
            tolerated: true,
            blocking: false,
          });
        }
      } else {
        for (const item of failedTurnChecks) {
          blockingFailedChecksList.push({
            ...item,
            turn: ti + 1,
            tolerated: false,
            blocking: true,
          });
        }
      }

      turnResults.push({
        turn: ti + 1,
        user: turn.user,
        requestBody: requestBodySnapshot,
        latencyMs,
        apiOk: true,
        status: api.res.status,
        retryMeta: {
          quota: retriedQuota ? 1 : 0,
          busy: retriedBusy,
          busyWaitMs: retriedBusyWaitMs,
          rateLimited: retriedRateLimited,
          stub: retriedStub,
        },
        requestId: api.json?.requestId || null,
        conversationId: responseConversationId || scenarioConversationId || null,
        isStub,
        reply: replyText,
        companyPathProbeSummary: shouldProbeCompanyPaths
          ? {
              paths: companyPaths,
              probes: companyPathProbes,
            }
          : null,
        transition: {
          source: transition.source,
          branchId: transition.branchId || null,
          verdict: turnVerdict,
          nextTurnNumber: transition.nextTurnNumber,
          failHandledByBranch,
        },
        checks: checkResults,
      });

      const normalizedReply = replyText.trim();
      const looksLikeGlobalStub =
        isStub ||
        /\b\(stub\)\b/iu.test(normalizedReply) ||
        /заглушк|режиме\s+заглушки|stub mode|soon here/i.test(normalizedReply);
      if (looksLikeGlobalStub) {
        consecutiveGlobalStubs += 1;
      } else {
        consecutiveGlobalStubs = 0;
      }

      if (!outageStop && opts.stubOutageThreshold > 0 && consecutiveGlobalStubs >= opts.stubOutageThreshold) {
        outageStop = {
          type: "ProviderStubOutage",
          message:
            `Detected ${consecutiveGlobalStubs} consecutive stub replies. ` +
            "Stopping early because provider appears unavailable (quota/auth/backend outage).",
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          turn: ti + 1,
        };
        scenarioHardError = {
          status: 200,
          error: outageStop.type,
          message: outageStop.message,
        };
        const key = `runstop:${outageStop.type}`;
        failurePatterns.set(key, (failurePatterns.get(key) || 0) + 1);
        break;
      }

      history.push({ role: "user", content: turn.user });
      history.push({ role: "assistant", content: replyText });
      nextTurnNumber = transition.nextTurnNumber;
    }

    const pass = !scenarioHardError && blockingFailedChecksList.length === 0;
    const scenarioTurnLatencyMs = turnResults.reduce((sum, turnResult) => sum + Number(turnResult.latencyMs || 0), 0);
    const scenarioStubReplies = turnResults.filter((turnResult) => Boolean(turnResult.isStub)).length;
    const scenarioBusyRetries = turnResults.reduce(
      (sum, turnResult) => sum + Number(turnResult.retryMeta?.busy || 0),
      0,
    );
    const scenarioRateLimitRetries = turnResults.reduce(
      (sum, turnResult) => sum + Number(turnResult.retryMeta?.rateLimited || 0),
      0,
    );
    const scenarioStubRetries = turnResults.reduce(
      (sum, turnResult) => sum + Number(turnResult.retryMeta?.stub || 0),
      0,
    );
    const scenarioBranchTrace = turnResults
      .map((turnResult) => {
        const tr = turnResult.transition;
        if (!tr || typeof tr !== "object") return null;
        const branch = tr.branchId ? `(${tr.branchId})` : "";
        const next = tr.nextTurnNumber == null ? "end" : String(tr.nextTurnNumber);
        return `${turnResult.turn}:${tr.source}${branch}->${next}`;
      })
      .filter(Boolean);

    scenarioResults.push({
      id: scenario.id,
      title: scenario.title,
      tags: scenario.tags || [],
      personaGoal: scenario.personaGoal,
      totalTurns: scenarioTurns.length,
      completedTurns: turnResults.length,
      pass,
      hardError: scenarioHardError,
      failedChecks: blockingFailedChecksList,
      toleratedFailedChecks: toleratedFailedChecksList,
      turnLatencyMs: scenarioTurnLatencyMs,
      stubReplies: scenarioStubReplies,
      busyRetries: scenarioBusyRetries,
      rateLimitRetries: scenarioRateLimitRetries,
      stubRetries: scenarioStubRetries,
      branchTrace: scenarioBranchTrace,
      turns: turnResults,
      durationMs: Date.now() - scenarioStart,
    });

    const statusEmoji = pass ? "PASS" : "FAIL";
    const passCount = scenarioResults.filter((r) => r.pass).length;
    process.stdout.write(`[${si + 1}/${scenarios.length}] ${statusEmoji} ${scenario.id} ${scenario.title} | passed=${passCount}\n`);

    if (outageStop) {
      process.stdout.write(`Early stop: ${outageStop.message}\n`);
      break;
    }
  }

  const passedScenarios = scenarioResults.filter((r) => r.pass).length;
  const failedScenarios = scenarioResults.length - passedScenarios;
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();
  const totalTurnsExecuted = scenarioResults.reduce((sum, scenarioResult) => sum + Number(scenarioResult.completedTurns || 0), 0);
  const totalTurnLatencyMs = scenarioResults.reduce((sum, scenarioResult) => sum + Number(scenarioResult.turnLatencyMs || 0), 0);
  const totalStubReplies = scenarioResults.reduce((sum, scenarioResult) => sum + Number(scenarioResult.stubReplies || 0), 0);
  const totalBusyRetries = scenarioResults.reduce((sum, scenarioResult) => sum + Number(scenarioResult.busyRetries || 0), 0);
  const totalRateLimitRetries = scenarioResults.reduce(
    (sum, scenarioResult) => sum + Number(scenarioResult.rateLimitRetries || 0),
    0,
  );
  const totalStubRetries = scenarioResults.reduce((sum, scenarioResult) => sum + Number(scenarioResult.stubRetries || 0), 0);

  const sortedPatterns = Array.from(failurePatterns.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  const derivedTargetRate = opts.targetPassRate ?? (scenarioResults.length === 50 ? 0.9 : 0.8);
  const derivedTargetPassCount = Math.max(1, Math.ceil(scenarioResults.length * derivedTargetRate));
  const targetPassCount = Math.max(
    1,
    Math.min(
      scenarioResults.length,
      opts.targetPassCount != null ? Math.floor(opts.targetPassCount) : derivedTargetPassCount,
    ),
  );

  const summary = {
    runId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs,
    baseUrl,
    scenarioFile: opts.scenarios,
    totalScenarios: scenarioResults.length,
    passedScenarios,
    failedScenarios,
    passRate: Number((passedScenarios / Math.max(1, scenarioResults.length)).toFixed(4)),
    totalChecks,
    passedChecks,
    failedChecks,
    checkPassRate: Number((passedChecks / Math.max(1, totalChecks)).toFixed(4)),
    targetPassCount,
    targetPassRate: Number(derivedTargetRate.toFixed(4)),
    targetReached: passedScenarios >= targetPassCount,
    authUser: userMeta,
    totalTurnsExecuted,
    avgTurnLatencyMs: Number((totalTurnLatencyMs / Math.max(1, totalTurnsExecuted)).toFixed(2)),
    totalTurnLatencyMs,
    totalStubReplies,
    totalBusyRetries,
    totalRateLimitRetries,
    totalStubRetries,
    stoppedEarly: Boolean(outageStop),
    stopReason: outageStop,
  };

  const report = {
    meta: {
      scenarioMeta: scenarioDoc.meta || null,
      options: {
        baseUrl: opts.baseUrl,
        email: opts.email,
        preparePaid: opts.preparePaid,
        paidLimit: opts.paidLimit,
        maxScenarios: opts.maxScenarios,
        onlyTags: opts.onlyTags,
        maxRateLimitRetries: opts.maxRateLimitRetries,
        maxBusyRetries: opts.maxBusyRetries,
        busyRetryBaseMs: opts.busyRetryBaseMs,
        busyRetryMaxMs: opts.busyRetryMaxMs,
        maxBusyTotalWaitMs: opts.maxBusyTotalWaitMs,
        useRunLock: opts.useRunLock,
        runLockFile: opts.runLockFile,
        runLockTimeoutMs: opts.runLockTimeoutMs,
        runLockPollMs: opts.runLockPollMs,
        runLockStaleMs: opts.runLockStaleMs,
        maxStubRetries: opts.maxStubRetries,
        minTurnDelayMs: opts.minTurnDelayMs,
        stubOutageThreshold: opts.stubOutageThreshold,
        targetPassCount: opts.targetPassCount,
        targetPassRate: opts.targetPassRate,
      },
    },
    summary,
    runStop: outageStop,
    topFailurePatterns: sortedPatterns.slice(0, 20),
    scenarios: scenarioResults,
  };

  fs.mkdirSync(opts.reportsDir, { recursive: true });
  const jsonOut = path.join(opts.reportsDir, `${runId}.json`);
  const mdOut = path.join(opts.reportsDir, `${runId}.md`);
  const latestJson = path.join(opts.reportsDir, "latest.json");
  const latestMd = path.join(opts.reportsDir, "latest.md");

  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = [];
  md.push(`# AI Request QA Report — ${runId}`);
  md.push("");
  md.push(`- Started: ${summary.startedAt}`);
  md.push(`- Ended: ${summary.endedAt}`);
  md.push(`- Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
  md.push(`- Base URL: ${summary.baseUrl}`);
  md.push(`- Auth user: ${summary.authUser?.email || "(unknown)"} (${summary.authUser?.plan || "unknown"})`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Scenarios: ${summary.totalScenarios}`);
  md.push(`- Passed: ${summary.passedScenarios}`);
  md.push(`- Failed: ${summary.failedScenarios}`);
  md.push(`- Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
  md.push(`- Checks: ${summary.passedChecks}/${summary.totalChecks} passed (${(summary.checkPassRate * 100).toFixed(1)}%)`);
  md.push(`- Turns executed: ${summary.totalTurnsExecuted}`);
  md.push(`- Avg turn latency: ${summary.avgTurnLatencyMs} ms`);
  md.push(`- Busy retries: ${summary.totalBusyRetries}, rate-limit retries: ${summary.totalRateLimitRetries}, stub retries: ${summary.totalStubRetries}`);
  md.push(`- Stub replies observed: ${summary.totalStubReplies}`);
  md.push(`- Target ${summary.targetPassCount}/${summary.totalScenarios} reached: ${summary.targetReached ? "yes" : "no"}`);
  md.push("");

  md.push("## Top Failure Patterns");
  md.push("");
  if (sortedPatterns.length === 0) {
    md.push("- none");
  } else {
    for (const row of sortedPatterns.slice(0, 15)) {
      md.push(`- ${row.key} — ${row.count}`);
    }
  }
  md.push("");

  md.push("## Failed Scenarios");
  md.push("");
  const failed = scenarioResults.filter((r) => !r.pass);
  if (failed.length === 0) {
    md.push("- none");
  } else {
    for (const s of failed) {
      md.push(`### ${s.id} — ${s.title}`);
      md.push("");
      if (s.hardError) {
        md.push(`- API error: ${s.hardError.status} ${s.hardError.error} ${s.hardError.message || ""}`);
      }
      for (const fc of s.failedChecks.slice(0, 8)) {
        md.push(`- [${fc.id || fc.type}] ${fc.description || fc.type} -> ${fc.reason}`);
      }
      const lastTurn = s.turns[s.turns.length - 1];
      if (lastTurn?.reply) {
        const excerpt = String(lastTurn.reply).replace(/\s+/g, " ").slice(0, 260);
        md.push(`- Last reply excerpt: ${excerpt}${excerpt.length >= 260 ? "..." : ""}`);
      }
      md.push("");
    }
  }
  md.push("");

  md.push("## Scenario Ledger");
  md.push("");
  for (const s of scenarioResults) {
    const verdict = s.pass ? "PASS" : "FAIL";
    const branchPreview = Array.isArray(s.branchTrace) && s.branchTrace.length > 0 ? s.branchTrace.join(" | ") : "none";
    const scenarioAvgLatencyMs = Number(
      (Number(s.turnLatencyMs || 0) / Math.max(1, Number(s.completedTurns || 0))).toFixed(1),
    );
    md.push(
      `- ${verdict} ${s.id} — turns ${s.completedTurns}/${s.totalTurns}, blocking fails ${s.failedChecks.length}, tolerated fails ${s.toleratedFailedChecks.length}, avg latency ${scenarioAvgLatencyMs} ms`,
    );
    md.push(`  branch: ${branchPreview}`);
  }
  md.push("");

    fs.writeFileSync(mdOut, `${md.join("\n")}\n`, "utf8");
    fs.writeFileSync(latestMd, `${md.join("\n")}\n`, "utf8");

    console.log(`Report JSON: ${jsonOut}`);
    console.log(`Report MD:   ${mdOut}`);
    console.log(`Result: ${passedScenarios}/${scenarioResults.length} scenarios passed.`);

    if (outageStop) return 3;
    return summary.targetReached ? 0 : 2;
  } finally {
    if (runLock.acquired) {
      runLock.release();
      process.stdout.write(`[run-lock] released ${runLock.lockFile}\n`);
    }
  }
}

main()
  .then((code) => {
    process.exit(Number.isFinite(Number(code)) ? Number(code) : 0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
