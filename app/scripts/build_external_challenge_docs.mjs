#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const externalDir = path.join(repoRoot, "app", "qa", "ai-request", "external-challenges");
const devloopDir = path.join(repoRoot, "devloop");

const MODEL_CONFIG = [
  {
    key: "gemini",
    title: "Gemini",
    sources: ["gemini-50.json", "gemini-100-more.json"],
    outFile: "AI_ASSISTANT_TEST_QUESTIONS_GEMINI.md",
  },
  {
    key: "kimi",
    title: "Kimi",
    sources: ["kimi-50.json", "kimi-100-more.json"],
    outFile: "AI_ASSISTANT_TEST_QUESTIONS_KIMI.md",
  },
  {
    key: "minimax",
    title: "MiniMax M2.1",
    sources: ["minimax-50.json", "minimax-100-more.json"],
    outFile: "AI_ASSISTANT_TEST_QUESTIONS_MINIMAX.md",
  },
];

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toTurns(rawScenario) {
  const turns = Array.isArray(rawScenario?.turns) ? rawScenario.turns : [];
  return turns
    .map((t) => {
      if (typeof t === "string") return t.trim();
      if (!t || typeof t !== "object") return "";
      return String(t.user || t.message || t.content || "").trim();
    })
    .filter(Boolean);
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function collectScenarios(sourceFiles) {
  const merged = [];
  for (const fileName of sourceFiles) {
    const fullPath = path.join(externalDir, fileName);
    const doc = readJsonSafe(fullPath);
    if (!doc || !Array.isArray(doc.scenarios)) continue;
    merged.push(...doc.scenarios);
  }
  const deduped = uniqBy(merged, (s) => String(s?.id || ""));
  deduped.sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || ""), "en"));
  return deduped;
}

function collectShortQueries(scenarios, limit = 120) {
  const all = [];
  for (const s of scenarios) {
    for (const turn of toTurns(s)) all.push(turn);
  }
  const unique = uniqBy(all, (x) => x.toLowerCase());
  return unique.slice(0, limit);
}

function collectDirtyQueries(queries, limit = 10) {
  const dirty = queries.filter((q) => {
    const text = q.toLowerCase();
    const shortish = text.length <= 70;
    const noFinalPunct = !/[.!?]$/.test(text);
    const hasBusinessTokens =
      /(минск|гомел|брест|унп|опт|цена|доставка|монтаж|сертификат|аутсорс|бух|типограф|короб|реклама|тендер|подряд)/iu.test(text);
    return shortish && noFinalPunct && hasBusinessTokens;
  });
  const unique = uniqBy(dirty, (x) => x.toLowerCase());
  return unique.slice(0, limit);
}

function renderModelDoc({ title, key, sources, scenarios }) {
  const generatedAt = new Date().toISOString();
  const topScenarios = scenarios.slice(0, 15);
  const shortQueries = collectShortQueries(scenarios, 120);
  const dirty = collectDirtyQueries(shortQueries, 10);

  const lines = [];
  lines.push(`# Вопросы Для Тестирования ИИ-Ассистента (${title})`);
  lines.push("");
  lines.push(
    `Источник: автоматически собранный набор модели ${title} из \`app/qa/ai-request/external-challenges/${sources.join(", ")}\`.`,
  );
  lines.push(`Сформировано: ${generatedAt}`);
  lines.push("");

  if (scenarios.length === 0) {
    lines.push(`Данных пока нет для модели ${title}.`);
    lines.push("");
    lines.push("Что сделать дальше:");
    lines.push("1. Сгенерировать JSON-сценарии этой моделью в external-challenges.");
    lines.push("2. Повторно запустить `npm --prefix app run qa:external:docs`.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("1) Реальные сценарии клиентов (multi-turn)");
  lines.push("");
  for (let i = 0; i < topScenarios.length; i++) {
    const s = topScenarios[i];
    lines.push(`Сценарий ${i + 1}. ${String(s?.title || `Scenario ${i + 1}`)}`);
    lines.push("");
    lines.push(`Персона/цель: ${String(s?.personaGoal || "Найти релевантные компании и принять решение.")}`);
    lines.push("Сообщения клиента:");
    for (const t of toTurns(s)) {
      lines.push(`• “${t}”`);
    }
    if (Array.isArray(s?.expectedBehavior) && s.expectedBehavior.length > 0) {
      lines.push("Ожидаемое поведение ассистента:");
      for (const item of s.expectedBehavior.slice(0, 5)) {
        lines.push(`• ${String(item)}`);
      }
    }
    lines.push("");
    lines.push("⸻");
    lines.push("");
  }

  lines.push("2) Банк коротких “реальных” запросов (120 штук)");
  lines.push("");
  for (let i = 0; i < shortQueries.length; i++) {
    lines.push(`${i + 1}. “${shortQueries[i]}”`);
  }
  lines.push("");
  lines.push("Бонус: 10 “грязных” запросов");
  lines.push("");
  for (const q of dirty) {
    lines.push(`• “${q}”`);
  }
  lines.push("");
  lines.push(`Теги источника: ${key}`);

  return `${lines.join("\n")}\n`;
}

function main() {
  fs.mkdirSync(devloopDir, { recursive: true });

  for (const cfg of MODEL_CONFIG) {
    const scenarios = collectScenarios(cfg.sources);
    const markdown = renderModelDoc({
      title: cfg.title,
      key: cfg.key,
      sources: cfg.sources,
      scenarios,
    });
    const outPath = path.join(devloopDir, cfg.outFile);
    fs.writeFileSync(outPath, markdown, "utf8");
    process.stdout.write(`Built: ${path.relative(repoRoot, outPath)} (scenarios=${scenarios.length})\n`);
  }
}

main();
