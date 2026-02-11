export const dynamic = "force-dynamic";

import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type LoadedScenarioTurn = {
  user: string;
  checksCount: number;
};

type LoadedScenario = {
  id: string;
  title: string;
  personaGoal: string;
  tags: string[];
  turns: LoadedScenarioTurn[];
  anchor: string;
};

type LoadedScenarioPack = {
  fileName: string;
  title: string;
  description: string;
  scenarios: LoadedScenario[];
  anchor: string;
};

type JsonObject = Record<string, unknown>;

const PACK_TITLE_OVERRIDES: Record<string, string> = {
  "scenarios.json": "Базовый набор",
  "scenarios.regressions.cross-domain.json": "Регрессии: кросс-домен",
  "scenarios.regressions.geo-ambiguity.json": "Регрессии: гео-неоднозначность",
  "scenarios.regressions.geo.json": "Регрессии: география",
  "scenarios.regressions.branching-live-judge.json": "Регрессии: branching + live judge",
  "scenarios.regressions.guardrails-extensions.json": "Регрессии: guardrails extensions",
  "scenarios.regressions.link-integrity.json": "Регрессии: целостность ссылок",
  "scenarios.regressions.milk-brest-mogilev.json": "Регрессии: молоко Брест/Могилев",
  "scenarios.regressions.milk-onion-city-switch.json": "Регрессии: молоко/лук + смена города",
  "scenarios.regressions.multi-step-journeys.json": "Регрессии: многоходовые путешествия",
  "scenarios.regressions.negation-exclude.json": "Регрессии: исключения/negation",
  "scenarios.regressions.ranking-followups.json": "Регрессии: ranking follow-ups",
  "scenarios.regressions.switchback-topic.json": "Регрессии: возврат к теме",
  "scenarios.regressions.template-announcement.json": "Регрессии: шаблон объявления",
  "scenarios.regressions.tires-brest.json": "Регрессии: шины (Брест)",
  "scenarios.regressions.user-3-scenarios.json": "Пользовательский набор: 3 сценария",
  "scenarios.regressions.user-6-scenarios.json": "Пользовательский набор: 6 сценариев",
  "scenarios.regressions.user-9-scenarios.json": "Пользовательский набор: 9 сценариев",
  "scenarios.regressions.user-12-scenarios.json": "Пользовательский набор: 12 сценариев",
  "scenarios.regressions.user-15-scenarios.json": "Пользовательский набор: 15 сценариев",
  "scenarios.regressions.user-ideas-multistep-variants.json": "Пользовательские идеи: вариации и многоходовка",
  "scenarios.regressions.user-120-bank-a-company-search.json": "Банк 120: A (поиск компании)",
  "scenarios.regressions.user-120-bank-b-suppliers-contractors.json": "Банк 120: B (поставщики/подрядчики)",
  "scenarios.regressions.user-120-bank-c-comparison-selection.json": "Банк 120: C (сравнение/выбор)",
  "scenarios.regressions.user-120-bank-d-counterparty-requisites.json": "Банк 120: D (контрагент/реквизиты)",
  "scenarios.regressions.user-120-bank-e-placement-editing.json": "Банк 120: E (размещение/редактирование)",
  "scenarios.regressions.user-120-bank-f-text-templates.json": "Банк 120: F (тексты/шаблоны)",
  "scenarios.regressions.user-120-bank-g-errors-stress.json": "Банк 120: G (ошибки/стресс)",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeScenario(raw: unknown, index: number, packAnchor: string): LoadedScenario | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const id = asString(obj.id) || `SCN-${index + 1}`;
  const title = asString(obj.title) || `Сценарий ${index + 1}`;
  const personaGoal = asString(obj.personaGoal);
  const tags = asStringArray(obj.tags);

  const rawTurns = Array.isArray(obj.turns) ? obj.turns : [];
  const turns: LoadedScenarioTurn[] = rawTurns
    .map((turnRaw) => {
      const turnObj = asObject(turnRaw);
      if (!turnObj) return null;
      const user = asString(turnObj.user);
      const checksCount = Array.isArray(turnObj.checks) ? turnObj.checks.length : 0;
      if (!user) return null;
      return { user, checksCount };
    })
    .filter((turn): turn is LoadedScenarioTurn => turn !== null);

  const anchor = `${packAnchor}-${slugify(id) || `scenario-${index + 1}`}`;

  return { id, title, personaGoal, tags, turns, anchor };
}

function inferPackTitle(fileName: string): string {
  const fromMap = PACK_TITLE_OVERRIDES[fileName];
  if (fromMap) return fromMap;
  return fileName.replace(/^scenarios\./, "").replace(/\.json$/, "");
}

async function loadScenarioPacks(): Promise<LoadedScenarioPack[]> {
  const qaDir = path.join(process.cwd(), "qa", "ai-request");
  const allFiles = await fs.readdir(qaDir);

  const scenarioFiles = allFiles
    .filter((name) => name === "scenarios.json" || /^scenarios\.regressions\..+\.json$/i.test(name))
    .sort((a, b) => {
      if (a === "scenarios.json") return -1;
      if (b === "scenarios.json") return 1;
      return a.localeCompare(b);
    });

  const packs: LoadedScenarioPack[] = [];

  for (const fileName of scenarioFiles) {
    const absPath = path.join(qaDir, fileName);
    const rawText = await fs.readFile(absPath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;

    const parsedObject = asObject(parsed);
    const meta = parsedObject ? asObject(parsedObject.meta) : null;
    const rawScenarios = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsedObject?.scenarios)
        ? (parsedObject?.scenarios as unknown[])
        : [];

    const packAnchor = `pack-${slugify(fileName.replace(/\.json$/i, ""))}`;
    const scenarios = rawScenarios
      .map((item, idx) => normalizeScenario(item, idx, packAnchor))
      .filter((item): item is LoadedScenario => item !== null);

    const title = asString(meta?.title) || inferPackTitle(fileName);
    const description = asString(meta?.description);

    packs.push({
      fileName,
      title,
      description,
      scenarios,
      anchor: packAnchor,
    });
  }

  return packs;
}

export default async function ScenariosPage() {
  const packs = await loadScenarioPacks();
  const totalScenarios = packs.reduce((acc, pack) => acc + pack.scenarios.length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header />

      <main className="flex-grow">
        <section className="bg-gradient-to-br from-[#a0006d] to-[#6a0143] text-white py-10">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold">Навигация по QA-сценариям AI-ассистента</h1>
            <p className="mt-3 text-pink-100 max-w-4xl">
              На этой странице выведены все активные сценарии для обязательного прогона: базовый набор и полный регрессионный
              банк, включая многоходовые user-ideas кейсы (consistency, anti-link-gate, website scan). Можно переходить по
              пакетам, сценариям и ходам диалога.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                Пакетов: {packs.length}
              </span>
              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                Сценариев: {totalScenarios}
              </span>
              <Link
                href="/assistant"
                className="inline-flex items-center rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-[#7a014f] hover:bg-yellow-300 transition-colors"
              >
                Открыть AI-ассистента
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 self-start rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Пакеты сценариев</h2>
              <p className="mt-1 text-sm text-gray-600">Быстрые переходы по наборам.</p>
              <ul className="mt-4 space-y-2 max-h-[70vh] overflow-auto pr-1">
                {packs.map((pack) => (
                  <li key={pack.fileName}>
                    <a
                      href={`#${pack.anchor}`}
                      className="block rounded-xl border border-gray-200 px-3 py-2 hover:border-[#a0006d] hover:bg-[#fff6fb] transition-colors"
                    >
                      <div className="text-sm font-semibold text-gray-900">{pack.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {pack.scenarios.length} сценариев • {pack.fileName}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="space-y-8">
              {packs.map((pack) => (
                <section
                  key={pack.fileName}
                  id={pack.anchor}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{pack.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">{pack.fileName}</p>
                      {pack.description ? <p className="text-sm text-gray-700 mt-2">{pack.description}</p> : null}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#f8e8f3] px-3 py-1 text-sm font-semibold text-[#7a014f]">
                      {pack.scenarios.length} сценариев
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pack.scenarios.map((scenario) => (
                      <a
                        key={scenario.anchor}
                        href={`#${scenario.anchor}`}
                        className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-[#a0006d] hover:text-[#7a014f] transition-colors"
                      >
                        {scenario.id}
                      </a>
                    ))}
                  </div>

                  <div className="mt-5 space-y-4">
                    {pack.scenarios.map((scenario) => (
                      <article
                        key={scenario.anchor}
                        id={scenario.anchor}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-bold text-[#7a014f] border border-[#e6bfd8]">
                            {scenario.id}
                          </span>
                          <h3 className="text-base font-semibold text-gray-900">{scenario.title}</h3>
                        </div>

                        {scenario.personaGoal ? (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold">Цель:</span> {scenario.personaGoal}
                          </p>
                        ) : null}

                        {scenario.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {scenario.tags.map((tag) => (
                              <span
                                key={`${scenario.anchor}-${tag}`}
                                className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 border border-gray-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {scenario.turns.length > 0 ? (
                          <ol className="mt-3 space-y-2">
                            {scenario.turns.map((turn, idx) => (
                              <li key={`${scenario.anchor}-turn-${idx}`} className="text-sm text-gray-800">
                                <span className="font-semibold">Ход {idx + 1}:</span> {turn.user}
                                {turn.checksCount > 0 ? (
                                  <span className="ml-2 text-xs text-gray-500">(checks: {turn.checksCount})</span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">В сценарии нет ходов.</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
