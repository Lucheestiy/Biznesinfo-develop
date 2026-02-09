#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    mode: "triad",
    scope: "extended",
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") {
      const raw = String(argv[++i] || "").trim().toLowerCase();
      if (raw === "triad" || raw === "dual") out.mode = raw;
    } else if (a === "--scope") {
      const raw = String(argv[++i] || "").trim().toLowerCase();
      if (raw === "geo" || raw === "extended") out.scope = raw;
    } else if (a === "--help" || a === "-h") {
      console.log([
        "Usage: node app/scripts/run_geo_ambiguity_long_cycle.mjs [options]",
        "",
        "Options:",
        "  --mode triad|dual        Judge/advisor contour (default triad)",
        "  --scope geo|extended     Scenario scope (default extended)",
      ].join("\n"));
      process.exit(0);
    }
  }

  return out;
}

function runStep(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const proc = spawnSync(cmd, args, {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
  });

  const code = Number.isFinite(proc.status) ? proc.status : 1;
  if (code === 0) {
    console.log(`--- ${label}: OK`);
  } else {
    console.log(`--- ${label}: FAIL (exit ${code})`);
  }
  return code;
}

function main() {
  const opts = parseArgs(process.argv);
  const judgeScript = opts.mode === "dual" ? "qa:judge:dual" : "qa:judge:triad";
  const adviseScript = opts.mode === "dual" ? "qa:advise:dual" : "qa:advise:triad";

  const steps =
    opts.scope === "geo"
      ? [
          { label: "Geo QA Run", args: ["run", "qa:run:geo-ambiguity"] },
          { label: `Geo Judge (${opts.mode})`, args: ["run", judgeScript] },
          { label: `Geo Advice (${opts.mode})`, args: ["run", adviseScript] },
          { label: "Geo Trend", args: ["run", "qa:trend:geo-ambiguity"] },
        ]
      : [
          { label: "Core QA Run", args: ["run", "qa:run"] },
          { label: `Core Judge (${opts.mode})`, args: ["run", judgeScript] },
          { label: `Core Advice (${opts.mode})`, args: ["run", adviseScript] },
          { label: "Multi-step QA Run", args: ["run", "qa:run:multi-step"] },
          { label: `Multi-step Judge (${opts.mode})`, args: ["run", judgeScript] },
          { label: `Multi-step Advice (${opts.mode})`, args: ["run", adviseScript] },
          { label: "Geo QA Run", args: ["run", "qa:run:geo-ambiguity"] },
          { label: `Geo Judge (${opts.mode})`, args: ["run", judgeScript] },
          { label: `Geo Advice (${opts.mode})`, args: ["run", adviseScript] },
          { label: "Geo Trend", args: ["run", "qa:trend:geo-ambiguity"] },
        ];

  const results = [];
  for (const step of steps) {
    const code = runStep(step.label, "npm", step.args);
    results.push({ ...step, code });
  }

  console.log(`\n=== Long Cycle Summary (${opts.scope}) ===`);
  for (const r of results) {
    const mark = r.code === 0 ? "OK" : `FAIL(${r.code})`;
    console.log(`- ${r.label}: ${mark}`);
  }

  const firstFail = results.find((x) => x.code !== 0);
  return firstFail ? firstFail.code : 0;
}

try {
  const code = main();
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
