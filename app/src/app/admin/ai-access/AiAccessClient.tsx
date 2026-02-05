"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

type GrantPlan = "paid" | "partner";

type PlanGrantRow = {
  id: string;
  user: { id: string; email: string; name: string | null };
  plan: GrantPlan;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  source: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function isActiveGrant(grant: PlanGrantRow): boolean {
  if (grant.revokedAt) return false;
  const now = Date.now();
  const ends = new Date(grant.endsAt).getTime();
  return Number.isFinite(ends) && ends > now;
}

export default function AiAccessClient() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<PlanGrantRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [plan, setPlan] = useState<GrantPlan>("paid");
  const [durationDays, setDurationDays] = useState("30");
  const [extendIfActive, setExtendIfActive] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "300");
      if (activeOnly) qs.set("activeOnly", "1");
      if (query.trim()) qs.set("q", query.trim());
      const res = await fetch(`/api/admin/plan-grants?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Ошибка");
        setGrants([]);
        return;
      }
      setGrants(Array.isArray(data?.grants) ? data.grants : []);
    } catch {
      setError("Ошибка сети");
      setGrants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeOnly]);

  const stats = useMemo(() => {
    const total = grants.length;
    const active = grants.filter((g) => isActiveGrant(g)).length;
    const revoked = grants.filter((g) => Boolean(g.revokedAt)).length;
    return { total, active, revoked };
  }, [grants]);

  const grantAccess = async () => {
    const email = userEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Введите email пользователя");
      return;
    }
    const days = Number(durationDays.trim());
    if (!Number.isFinite(days) || days <= 0 || days > 3650) {
      setError("Неверный срок (в днях)");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plan-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          plan,
          durationDays: Math.floor(days),
          extendIfActive,
          note: note.trim() || undefined,
          source: "manual",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Ошибка");
        return;
      }
      setUserEmail("");
      setNote("");
      await load();
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plan-grants?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Ошибка");
        return;
      }
      await load();
    } catch {
      setError("Ошибка сети");
    } finally {
      setRevokingId(null);
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
                <span className="text-gray-800 font-medium">AI доступ</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mt-1">AI доступ (подписки)</h1>
              <div className="text-sm text-gray-600 mt-2">
                Активных: <span className="font-semibold">{stats.active}</span> • Всего в списке:{" "}
                <span className="font-semibold">{stats.total}</span> • Отозвано:{" "}
                <span className="font-semibold">{stats.revoked}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/ai-requests"
                className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200"
              >
                AI логи
              </Link>
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

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error === "MigrationsRequired"
                ? "Нужны миграции БД (выполните /api/admin/migrate с ADMIN_SECRET)."
                : error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="text-sm font-semibold text-gray-800">Выдать доступ</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Email пользователя</label>
                <input
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">План</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as GrantPlan)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                >
                  <option value="paid">paid</option>
                  <option value="partner">partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Срок (дней)</label>
                <input
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                />
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={extendIfActive}
                    onChange={(e) => setExtendIfActive(e.target.checked)}
                  />
                  Продлить
                </label>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">Заметка (опционально)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="например: оплата за февраль"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void grantAccess()}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-[#820251] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#6a0143] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (t("common.loading") || "Загрузка...") : "Выдать"}
              </button>
              <div className="text-xs text-gray-500">
                “Продлить” добавит дни к текущему активному доступу (если он есть).
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm overflow-x-auto border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold text-gray-800">История выдач</div>
                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      void load();
                    }}
                    placeholder="поиск по email/имени/заметке…"
                    className="w-72 max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a0006d]/20"
                  />
                  <button
                    type="button"
                    onClick={load}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Найти
                  </button>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                    Только активные
                  </label>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-gray-600">{t("common.loading") || "Загрузка..."}</div>
            ) : (
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-white text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3">Пользователь</th>
                    <th className="text-left px-4 py-3">План</th>
                    <th className="text-left px-4 py-3">Статус</th>
                    <th className="text-left px-4 py-3">Действует до</th>
                    <th className="text-left px-4 py-3">Источник</th>
                    <th className="text-left px-4 py-3">Заметка</th>
                    <th className="text-left px-4 py-3">Выдан</th>
                    <th className="text-left px-4 py-3">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grants.map((g) => {
                    const active = isActiveGrant(g);
                    const status = g.revokedAt ? "revoked" : (active ? "active" : "expired");
                    return (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{g.user.email}</div>
                          {g.user.name && <div className="text-xs text-gray-500">{g.user.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{g.plan}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                              status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : status === "revoked"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(g.endsAt)}</td>
                        <td className="px-4 py-3 text-gray-700">{g.source || "manual"}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[22rem]">
                          <div className="truncate" title={g.note || ""}>
                            {g.note || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(g.createdAt)}</td>
                        <td className="px-4 py-3">
                          {g.revokedAt ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <button
                              type="button"
                              disabled={revokingId === g.id}
                              onClick={() => void revoke(g.id)}
                              className="text-xs text-red-600 hover:underline underline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Отозвать
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {grants.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                        Нет записей
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

