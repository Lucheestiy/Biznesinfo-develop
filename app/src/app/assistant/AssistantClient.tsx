"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

type UserPlan = "free" | "paid" | "partner";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function formatPlanLabel(plan: UserPlan): string {
  if (plan === "free") return "Free";
  if (plan === "paid") return "Paid";
  return "Partner";
}

export default function AssistantClient({
  user,
  initialUsage,
}: {
  user: { name: string | null; email: string; plan: UserPlan; aiRequestsPerDay: number };
  initialUsage?: { used: number; limit: number; day: string };
}) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const companyIdFromUrl = (searchParams.get("companyId") || "").trim();
  const companyNameFromUrl = (searchParams.get("companyName") || "").trim();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number; day: string } | null>(initialUsage ?? null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prefillAppliedRef = useRef(false);

  const canChat = user.plan === "paid" || user.plan === "partner";
  const planLabel = useMemo(() => formatPlanLabel(user.plan), [user.plan]);

  const companyContext = useMemo(() => {
    const companyId = companyIdFromUrl || null;
    const companyName = companyNameFromUrl || null;
    if (!companyId && !companyName) return null;
    return { companyId, companyName };
  }, [companyIdFromUrl, companyNameFromUrl]);

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Привет! Я помогу разобраться с рубриками, сформулировать запрос поставщикам и быстро найти нужные компании. (Пока в режиме заглушки.)",
    },
  ]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!companyContext) return;

    const label = companyContext.companyName
      ? `«${companyContext.companyName}»`
      : (companyContext.companyId ? `#${companyContext.companyId}` : "");

    setDraft((prev) => {
      if (prev.trim()) return prev;
      return label
        ? `Составь краткую справку о компании ${label}: чем занимается и какие товары/услуги предлагает.`
        : "Составь краткую справку об этой компании: чем занимается и какие товары/услуги предлагает.";
    });

    prefillAppliedRef.current = true;
  }, [companyContext]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!canChat) return;

    setDraft("");
    setError(null);
    setSending(true);
    const userMessage: AssistantMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const payload: Record<string, unknown> = { source: "assistant_page", page: "/assistant" };
      if (companyContext) payload.context = companyContext;

      const requestBody: Record<string, unknown> = {
        message: text,
        payload,
      };
      if (companyContext?.companyId) requestBody.companyId = companyContext.companyId;

      const res = await fetch("/api/ai/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && data?.error === "QuotaExceeded") {
          const used = typeof data?.used === "number" ? data.used : null;
          const limit = typeof data?.limit === "number" ? data.limit : null;
          const day = typeof data?.day === "string" ? data.day : null;
          if (used !== null && limit !== null && day) setQuota({ used, limit, day });
          setError(
            used !== null && limit !== null
              ? `Лимит AI на сегодня: ${used}/${limit}`
              : (t("ai.limitExceeded") || "Лимит AI на сегодня исчерпан"),
          );
          return;
        }
        if (res.status === 401) {
          setError(t("auth.loginRequired") || "Нужно войти в кабинет.");
          return;
        }
        setError(data?.message || data?.error || (t("common.error") || "Ошибка"));
        return;
      }

      if (typeof data?.used === "number" && typeof data?.limit === "number" && typeof data?.day === "string") {
        setQuota({ used: data.used, limit: data.limit, day: data.day });
      }

      const replyText =
        typeof data?.reply?.text === "string"
          ? data.reply.text
          : "Запрос сохранён. Скоро здесь появится полноценный чат-ассистент с ответами в реальном времени. (stub)";

      const assistantMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyText,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setError(t("common.networkError") || "Ошибка сети");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100">
      <Header />

      <main className="flex-grow">
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link href="/" className="hover:text-[#820251]">
                {t("common.home")}
              </Link>
              <span>/</span>
              <span className="text-[#820251] font-medium">{t("ai.title")}</span>
            </div>
          </div>
        </div>

        <div className="container mx-auto py-10 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <h1 className="text-3xl font-bold text-gray-900">{t("ai.title")}</h1>
              <p className="mt-2 text-gray-600">{t("ai.personalAssistant")}</p>

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm text-gray-600">
                  <div>
                    <span className="text-gray-500">Email:</span> {user.email}
                  </div>
                  <div className="mt-1">
                    <span className="text-gray-500">План:</span> {planLabel}
                  </div>
                  <div className="mt-1">
                    <span className="text-gray-500">Лимит:</span> {user.aiRequestsPerDay} запросов/день
                  </div>
                  {quota && (
                    <div className="mt-1">
                      <span className="text-gray-500">Сегодня ({quota.day}):</span> {quota.used}/{quota.limit}
                      {quota.limit > 0 && (
                        <span className="text-gray-500"> • Осталось:</span>
                      )}
                      {quota.limit > 0 && (
                        <span> {Math.max(0, quota.limit - quota.used)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!canChat ? (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="font-semibold text-amber-900">Доступно в платном плане</div>
                  <p className="mt-2 text-sm text-amber-800">
                    У вас план Free — чат-ассистент доступен для <span className="font-semibold">Paid</span> и{" "}
                    <span className="font-semibold">Partner</span>.
                  </p>
                  <p className="mt-3 text-sm text-amber-800">
                    Если вы уже оплатили доступ, но видите Free — напишите нам через{" "}
                    <Link href="/ad-request" className="underline underline-offset-2 hover:text-amber-900">
                      заявку
                    </Link>{" "}
                    или в{" "}
                    <Link href="/cabinet" className="underline underline-offset-2 hover:text-amber-900">
                      личном кабинете
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div
                    ref={scrollRef}
                    className="h-[420px] overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-gray-50"
                  >
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            m.role === "user"
                              ? "bg-[#820251] text-white rounded-br-md"
                              : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white">
                    {error && <div className="mb-3 text-sm text-red-700">{error}</div>}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Напишите сообщение…"
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#a0006d]/30"
                        disabled={sending}
                      />
                      <button
                        type="button"
                        onClick={send}
                        disabled={sending || !draft.trim()}
                        className="inline-flex items-center justify-center rounded-xl bg-[#820251] text-white px-6 py-3 font-semibold hover:bg-[#6a0143] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {sending ? (t("common.loading") || "Загрузка...") : "Отправить"}
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Отправка сообщения создаёт запись в системе AI-запросов (пока без ответа модели).
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
