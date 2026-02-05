"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ReindexClient() {
  const { t } = useLanguage();
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      }
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
                onClick={runReindex}
                disabled={running}
                className="px-4 py-2 rounded-lg font-semibold bg-[#820251] text-white hover:bg-[#6a0143] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {running ? "Запускаю..." : "Запустить реиндекс"}
              </button>
            </div>
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
