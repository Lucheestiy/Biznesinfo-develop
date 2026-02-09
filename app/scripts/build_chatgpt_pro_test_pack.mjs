#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const qaDir = path.join(repoRoot, "app", "qa", "ai-request");

const sourceScenarioFiles = [
  "scenarios.regressions.user-3-scenarios.json",
  "scenarios.regressions.user-6-scenarios.json",
  "scenarios.regressions.user-9-scenarios.json",
  "scenarios.regressions.user-12-scenarios.json",
  "scenarios.regressions.user-15-scenarios.json",
  "scenarios.regressions.user-120-bank-a-company-search.json",
  "scenarios.regressions.user-120-bank-b-suppliers-contractors.json",
  "scenarios.regressions.user-120-bank-c-comparison-selection.json",
  "scenarios.regressions.user-120-bank-d-counterparty-requisites.json",
  "scenarios.regressions.user-120-bank-e-placement-editing.json",
  "scenarios.regressions.user-120-bank-f-text-templates.json",
  "scenarios.regressions.user-120-bank-g-errors-stress.json",
  "scenarios.dirty.realworld.json",
];

const sourceDocument = path.join(repoRoot, "devloop", "AI_ASSISTANT_TEST_QUESTIONS_CHATGPT_PRO.md");
const outputFile = path.join(qaDir, "scenarios.chatgpt-pro.master.json");

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.scenarios)) {
    throw new Error(`Invalid scenarios JSON (missing scenarios array): ${filePath}`);
  }
  return parsed;
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function build() {
  if (!fs.existsSync(sourceDocument)) {
    throw new Error(`Source document not found: ${sourceDocument}`);
  }

  const merged = [];
  const seenIds = new Set();
  const provenance = [];

  for (const fileName of sourceScenarioFiles) {
    const fullPath = path.join(qaDir, fileName);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Scenario source not found: ${fullPath}`);
    }

    const pack = loadJson(fullPath);
    provenance.push({
      file: toRepoRelative(fullPath),
      scenarioCount: pack.scenarios.length,
      source: pack?.meta?.source || null,
    });

    for (const scenario of pack.scenarios) {
      const id = String(scenario?.id || "").trim();
      if (!id) throw new Error(`Scenario without id in ${fullPath}`);
      if (seenIds.has(id)) throw new Error(`Duplicate scenario id detected: ${id}`);
      seenIds.add(id);
      merged.push(scenario);
    }
  }

  const out = {
    meta: {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      source: "chatgpt-pro-test-document",
      sourceDocument: toRepoRelative(sourceDocument),
      description:
        "Master QA scenario pack aggregated from scenarios derived from ChatGPT Pro user question bank (15 multi-turn + 120 short bank + dirty real-world bonus).",
      sourceScenarioFiles: provenance,
      totalScenarios: merged.length,
    },
    scenarios: merged,
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`Built: ${toRepoRelative(outputFile)}`);
  console.log(`Scenarios: ${merged.length}`);
  console.log(`Source doc: ${toRepoRelative(sourceDocument)}`);
}

build();
