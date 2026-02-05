"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useLanguage } from "@/contexts/LanguageContext";

type MeiliStatsResponse =
  | {
      success: true;
      healthy: boolean;
      databaseSize: number | null;
      lastUpdate: string | null;
      companies:
        | {
            uid: string;
            numberOfDocuments: number | null;
            isIndexing: boolean | null;
            fieldDistribution: Record<string, number> | null;
          }
        | null;
    }
  | {
      success: false;
      healthy: boolean;
      error: string;
      message: string;
    };

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : (value >= 10 ? 1 : 2);
  return `${value.toFixed(digits)} ${units[i]}`;
}

export default function ReindexClient() {
  const { t } = useLanguage();
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MeiliStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/meili/stats", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as MeiliStatsResponse;
      setStats(data);
      if (!res.ok) {
        setStatsError((data as any)?.error || (data as any)?.message || (t("common.error") || "Ошибка"));
      }
    } catch {
      setStatsError(t("common.networkError") || "Ошибка сети");
    } finally {
      setStatsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const runReindex = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch("/api/admin/reindex", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setResponse(data);
      if (!res.ok) {
        setError(data?.error || data?.message || (t("common.error") || "Ошибка"));
        return;
      }
      await loadStats();
    } catch {
      setError(t("common.networkError") || "Ошибка сети");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100">
      <Header />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Реиндексация</h1>
              <p className="mt-1 text-sm text-gray-600">
                Запускает полную индексацию компаний в Meilisearch (может занять несколько минут).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg font-semibold border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              >
                ← Админка
              </Link>
              <button
                type="button"
                onClick={loadStats}
                disabled={statsLoading}
                className="px-4 py-2 rounded-lg font-semibold border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {statsLoading ? "Обновляю..." : "Статистика"}
              </button>
              <button
                type="button"
                onClick={runReindex}
                disabled={running}
                className="px-4 py-2 rounded-lg font-semibold bg-[#820251] text-white hover:bg-[#6a0143] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {running ? "Запускаю..." : "Запустить реиндекс"}
              </button>
            </div>
          </div>

          <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-semibold text-gray-800">Meilisearch</div>
              <div className="text-xs text-gray-500">
                {stats?.success ? (stats.lastUpdate ? `lastUpdate: ${stats.lastUpdate}` : "") : ""}
              </div>
            </div>

            {statsError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                {statsError}
              </div>
            )}

            {!stats && !statsLoading ? (
              <div className="mt-3 text-sm text-gray-500">Нет данных</div>
            ) : !stats ? (
              <div className="mt-3 text-sm text-gray-500">{t("common.loading") || "Загрузка..."}</div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Health</div>
                    <div className={`mt-1 font-semibold ${stats.healthy ? "text-green-700" : "text-red-700"}`}>
                      {stats.healthy ? "OK" : "DOWN"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">DB size</div>
                    <div className="mt-1 font-semibold text-gray-800">
                      {stats.success ? formatBytes(stats.databaseSize) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">companies docs</div>
                    <div className="mt-1 font-semibold text-gray-800">
                      {stats.success ? (stats.companies?.numberOfDocuments ?? "—") : "—"}
                      {stats.success && stats.companies?.isIndexing ? (
                        <span className="ml-2 text-xs text-amber-700 font-medium">indexing…</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {stats.success && stats.companies?.fieldDistribution ? (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-600 cursor-pointer select-none hover:text-[#820251]">
                      Field distribution (raw)
                    </summary>
                    <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap break-words text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      {JSON.stringify(stats.companies.fieldDistribution, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {response == null ? null : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-800 mb-2">Ответ</div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
