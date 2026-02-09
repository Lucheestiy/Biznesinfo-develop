#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const qaDir = path.join(repoRoot, "app", "qa", "ai-request");

const inputFiles = [
  "scenarios.chatgpt-pro.master.json",
  "external-challenges/scenarios.normalized.json",
];

const outputFile = path.join(qaDir, "scenarios.multi-model.master.json");

function loadScenarios(relPath) {
  const fullPath = path.join(qaDir, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing source: ${fullPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  if (!Array.isArray(parsed?.scenarios)) {
    throw new Error(`Invalid scenarios file (no scenarios array): ${fullPath}`);
  }
  return {
    relPath,
    fullPath,
    meta: parsed.meta || {},
    scenarios: parsed.scenarios,
  };
}

function main() {
  const sources = inputFiles.map(loadScenarios);
  const merged = [];
  const seenIds = new Set();
  const duplicates = [];

  for (const src of sources) {
    for (const s of src.scenarios) {
      const id = String(s?.id || "").trim();
      if (!id) {
        throw new Error(`Scenario without id in ${src.relPath}`);
      }
      if (seenIds.has(id)) {
        duplicates.push({ id, from: src.relPath });
        continue;
      }
      seenIds.add(id);
      merged.push(s);
    }
  }

  if (duplicates.length > 0) {
    const preview = duplicates.slice(0, 10).map((d) => `${d.id} (${d.from})`).join(", ");
    throw new Error(`Duplicate scenario IDs detected across sources: ${preview}`);
  }

  const out = {
    meta: {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      source: "multi-model-master",
      description:
        "Combined QA pack from ChatGPT Pro question bank and external model challenger sets (Gemini/Kimi/MiniMax where available).",
      sourceScenarioFiles: sources.map((s) => ({
        file: `app/qa/ai-request/${s.relPath}`,
        scenarioCount: s.scenarios.length,
        source: s.meta?.source || null,
      })),
      totalScenarios: merged.length,
    },
    scenarios: merged,
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Built: app/qa/ai-request/scenarios.multi-model.master.json`);
  console.log(`Scenarios: ${merged.length}`);
}

main();
