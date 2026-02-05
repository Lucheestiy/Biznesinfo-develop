"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

type ProviderStatus = {
  provider: "stub" | "openai" | "codex";
  openai: { model: string; baseUrl: string; hasKey: boolean };
  codex: { model: string; baseUrl: string; hasAuthPath: boolean };
};

type AiRequestListRow = {
  id: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  plan: string;
  companyId: string | null;
  companyIds: string[];
  messagePreview: string;
  provider: string;
  model: string | null;
  isStub: boolean;
  providerError: { name: string; message: string } | null;
  injectionFlagged: boolean;
  injectionSignals: string[];
  guardrailsVersion: number | null;
  hasPrompt: boolean;
  replyPreview: string | null;
  template: { hasSubject: boolean; hasBody: boolean; hasWhatsApp: boolean; isCompliant: boolean } | null;
  canceled: boolean;
  durationMs: number | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  feedback: { rating: "up" | "down"; reason: string | null; createdAt: string | null } | null;
};

type AiRequestDetail = {
  id: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null; plan: string };
  companyId: string | null;
  message: string;
  payload: unknown;
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function formatDurationShort(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  const n = Math.max(0, Math.floor(ms));
  if (n < 1000) return `${n}ms`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}s`;
  if (n < 60_000) return `${Math.round(n / 1000)}s`;
  const m = Math.floor(n / 60_000);
  const s = Math.round((n - m * 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatTokens(n: number): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 100_000) return `${Math.round(v / 1000)}k`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(v);
}

export default function AiRequestsClient() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [requests, setRequests] = useState<AiRequestListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<"all" | "stub" | "openai" | "codex">("all");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlyInjected, setOnlyInjected] = useState(false);
  const [onlyNonStub, setOnlyNonStub] = useState(false);
  const [onlyRated, setOnlyRated] = useState(false);
  const [onlyDown, setOnlyDown] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AiRequestDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-requests?limit=200", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Ошибка");
        return;
      }
      setStatus(data?.status || null);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = requests.length;
    const stub = requests.filter((r) => r.isStub).length;
    const nonStub = total - stub;
    const errors = requests.filter((r) => Boolean(r.providerError)).length;
    const injected = requests.filter((r) => r.injectionFlagged).length;
    const rated = requests.filter((r) => Boolean(r.feedback)).length;
    const down = requests.filter((r) => r.feedback?.rating === "down").length;
    const templateOk = requests.filter((r) => r.template?.isCompliant).length;
    return { total, stub, nonStub, errors, injected, rated, down, templateOk };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (providerFilter !== "all") {
        const p = (r.provider || "").toLowerCase();
        if (providerFilter === "stub" && p !== "stub") return false;
        if (providerFilter === "openai" && p !== "openai") return false;
        if (providerFilter === "codex" && p !== "codex") return false;
      }
      if (onlyErrors && !r.providerError) return false;
      if (onlyInjected && !r.injectionFlagged) return false;
      if (onlyNonStub && r.isStub) return false;
      if (onlyRated && !r.feedback) return false;
      if (onlyDown && r.feedback?.rating !== "down") return false;
      if (!q) return true;

      const hay = [
        r.id,
        r.user.email,
        r.user.name || "",
        r.companyId || "",
        r.messagePreview || "",
        r.replyPreview || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, query, providerFilter, onlyErrors, onlyInjected, onlyNonStub, onlyRated, onlyDown]);

  const openDetails = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-requests/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailError(data?.error || "Ошибка");
        return;
      }
      setDetail(data?.request || null);
    } catch {
      setDetailError("Ошибка сети");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setOpenId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const copyJson = async (value: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100">
      <Header />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <div>
              <div className="text-sm text-gray-500">
                <Link href="/admin" className="hover:text-[#820251]">
                  {t("admin.title") || "Админка"}
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-800 font-medium">AI</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mt-1">AI запросы</h1>
              <div className="text-sm text-gray-600 mt-2">
                Загружено: <span className="font-semibold">{stats.total}</span> • Stub:{" "}
                <span className="font-semibold">{stats.stub}</span> • Non-stub:{" "}
                <span className="font-semibold">{stats.nonStub}</span> • Ошибки:{" "}
                <span className="font-semibold">{stats.errors}</span> • Injection:{" "}
                <span className="font-semibold">{stats.injected}</span> • Rated:{" "}
                <span className="font-semibold">{stats.rated}</span> • 👎:{" "}
                <span className="font-semibold">{stats.down}</span> • Template OK:{" "}
                <span className="font-semibold">{stats.templateOk}</span>
              </div>
              {status && (
                <div className="text-xs text-gray-500 mt-2">
                  Provider: <span className="font-semibold">{status.provider}</span>
                  {status.provider === "openai" && (
                    <>
                      {" "}
                      • Model: <span className="font-semibold">{status.openai.model}</span> • Key:{" "}
                      <span className="font-semibold">{status.openai.hasKey ? "yes" : "no"}</span>
                    </>
                  )}
                  {status.provider === "codex" && (
                    <>
                      {" "}
                      • Model: <span className="font-semibold">{status.codex.model}</span> • Auth path:{" "}
                      <span className="font-semibold">{status.codex.hasAuthPath ? "yes" : "no"}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/reindex"
                className="bg-[#820251] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6a0143]"
              >
                Реиндекс
              </Link>
              <button
                type="button"
                onClick={load}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-black"
              >
                {t("admin.refresh") || "Обновить"}
              </button>
            </div>
          </div>

          {(error || detailError) && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error || detailError}
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-lg p-8 text-gray-600">{t("common.loading") || "Загрузка..."}</div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Поиск</label>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="email, companyId, текст…"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Provider</label>
                    <select
                      value={providerFilter}
                      onChange={(e) => setProviderFilter(e.target.value as any)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                    >
                      <option value="all">Все</option>
                      <option value="stub">stub</option>
                      <option value="openai">openai</option>
                      <option value="codex">codex</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
                      Ошибки
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={onlyInjected} onChange={(e) => setOnlyInjected(e.target.checked)} />
                      Injection
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={onlyNonStub} onChange={(e) => setOnlyNonStub(e.target.checked)} />
                      Non-stub
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={onlyRated} onChange={(e) => setOnlyRated(e.target.checked)} />
                      Rated
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={onlyDown} onChange={(e) => setOnlyDown(e.target.checked)} />
                      👎 only
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-white rounded-lg shadow-sm overflow-x-auto border border-gray-200">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3">Время</th>
                      <th className="text-left px-4 py-3">User</th>
                      <th className="text-left px-4 py-3">Plan</th>
                      <th className="text-left px-4 py-3">Company</th>
                      <th className="text-left px-4 py-3">Provider</th>
                      <th className="text-left px-4 py-3">Flags</th>
                      <th className="text-left px-4 py-3">Feedback</th>
                      <th className="text-left px-4 py-3">Message</th>
                      <th className="text-left px-4 py-3">Reply</th>
                      <th className="text-left px-4 py-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{r.user.email}</div>
                          {r.user.name && <div className="text-xs text-gray-500">{r.user.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.plan || "—"}</td>
                        <td className="px-4 py-3">
                          {r.companyId ? (
                            <Link href={`/company/${r.companyId}`} className="text-[#820251] hover:underline">
                              {r.companyId}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {r.companyIds?.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">+{r.companyIds.length} shortlist</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div className="font-medium">{r.provider}</div>
                          <div className="text-xs text-gray-500">
                            {r.isStub ? "stub" : "live"}
                            {r.canceled ? " • canceled" : ""}
                            {r.model ? ` • ${r.model}` : ""}
                            {r.durationMs != null ? ` • ${formatDurationShort(r.durationMs)}` : ""}
                            {r.usage?.totalTokens ? ` • ${formatTokens(r.usage.totalTokens)} tok` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {r.providerError && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">
                                error
                              </span>
                            )}
                            {r.injectionFlagged && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">
                                injection
                              </span>
                            )}
                            {r.canceled && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                                canceled
                              </span>
                            )}
                            {r.template && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                  r.template.isCompliant ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                tpl
                              </span>
                            )}
                            {r.guardrailsVersion != null && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                                g{r.guardrailsVersion}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.feedback ? (
                            <div className="text-xs">
                              <div className="font-semibold">{r.feedback.rating === "up" ? "👍" : "👎"}</div>
                              {r.feedback.reason && <div className="text-gray-500 mt-1">{r.feedback.reason}</div>}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[22rem]">
                          <div className="truncate" title={r.messagePreview}>
                            {r.messagePreview || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[22rem]">
                          <div className="truncate" title={r.replyPreview || ""}>
                            {r.replyPreview || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void openDetails(r.id)}
                            className="text-xs text-[#820251] hover:underline underline-offset-2"
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          Ничего не найдено
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />

      {openId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="min-w-0">
                <div className="text-sm text-gray-500 truncate">AI request</div>
                <div className="font-semibold text-gray-900 truncate">{openId}</div>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Close"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 max-h-[80vh] overflow-y-auto">
              {detailLoading ? (
                <div className="text-gray-600">{t("common.loading") || "Загрузка..."}</div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-700">
                    <div>
                      <span className="text-gray-500">Когда:</span> {formatDateTime(detail.createdAt)}
                    </div>
                    <div className="mt-1">
                      <span className="text-gray-500">User:</span> {detail.user.email}{" "}
                      <span className="text-gray-500">({detail.user.plan})</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-gray-500">Company:</span>{" "}
                      {detail.companyId ? (
                        <Link href={`/company/${detail.companyId}`} className="text-[#820251] hover:underline">
                          {detail.companyId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-2">Message</div>
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900">
                      {detail.message}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-xs font-semibold text-gray-600">Payload (JSON)</div>
                      <button
                        type="button"
                        onClick={() => void copyJson(detail.payload)}
                        className="text-xs text-[#820251] hover:underline underline-offset-2"
                      >
                        Copy JSON
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-900 overflow-x-auto">
                      {JSON.stringify(detail.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">Нет данных</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
