"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { renderLinkifiedText } from "@/lib/utils/linkify";

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

async function writeTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.top = "-1000px";
      el.style.left = "-1000px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
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
  const [copiedAnswerId, setCopiedAnswerId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const prefillAppliedRef = useRef(false);
  const copiedAnswerTimeoutRef = useRef<number | null>(null);

  const canChat = user.plan === "paid" || user.plan === "partner";
  const planLabel = useMemo(() => formatPlanLabel(user.plan), [user.plan]);

  const companyContext = useMemo(() => {
    const companyId = companyIdFromUrl || null;
    const companyName = companyNameFromUrl || null;
    if (!companyId && !companyName) return null;
    return { companyId, companyName };
  }, [companyIdFromUrl, companyNameFromUrl]);

  const buildIntroMessage = (): AssistantMessage => ({
    id: "intro",
    role: "assistant",
    content:
      t("ai.chatIntro") ||
      "Привет! Я помогу разобраться с рубриками, сформулировать запрос поставщикам и быстро найти нужные компании. (Пока в режиме заглушки.)",
  });

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [buildIntroMessage()]);
  const showSuggestionChips = canChat && messages.length <= 1 && !draft.trim();
  const suggestionChips = useMemo(
    () => [
      { id: "findSuppliers", text: t("ai.quick.findSuppliers") },
      { id: "draftOutreach", text: t("ai.quick.draftOutreach") },
      { id: "explainRubrics", text: t("ai.quick.explainRubrics") },
      { id: "checkCompany", text: t("ai.quick.checkCompany") },
    ],
    [t],
  );

  const companyPrefillPrompt = useMemo(() => {
    if (!companyContext) return null;
    const label = companyContext.companyName
      ? `«${companyContext.companyName}»`
      : (companyContext.companyId ? `#${companyContext.companyId}` : "");
    return label
      ? `Составь краткую справку о компании ${label}: чем занимается и какие товары/услуги предлагает.`
      : "Составь краткую справку об этой компании: чем занимается и какие товары/услуги предлагает.";
  }, [companyContext]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!companyPrefillPrompt) return;

    setDraft((prev) => {
      if (prev.trim()) return prev;
      return companyPrefillPrompt;
    });

    prefillAppliedRef.current = true;
  }, [companyPrefillPrompt]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  useEffect(() => {
    return () => {
      if (copiedAnswerTimeoutRef.current) window.clearTimeout(copiedAnswerTimeoutRef.current);
    };
  }, []);

  const resetChat = () => {
    setSending(false);
    setError(null);
    setCopiedAnswerId(null);
    if (copiedAnswerTimeoutRef.current) window.clearTimeout(copiedAnswerTimeoutRef.current);
    setMessages([buildIntroMessage()]);

    if (companyPrefillPrompt) {
      setDraft(companyPrefillPrompt);
      prefillAppliedRef.current = true;
    } else {
      setDraft("");
      prefillAppliedRef.current = false;
    }

    setTimeout(() => draftRef.current?.focus(), 0);
  };

  const copyAnswer = async (message: AssistantMessage) => {
    if (message.role !== "assistant") return;
    const ok = await writeTextToClipboard(message.content);
    if (!ok) return;

    setCopiedAnswerId(message.id);
    if (copiedAnswerTimeoutRef.current) window.clearTimeout(copiedAnswerTimeoutRef.current);
    copiedAnswerTimeoutRef.current = window.setTimeout(() => setCopiedAnswerId(null), 2000);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!canChat) return;

    const history = messages
      .filter((m) => m.id !== "intro")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

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
        history,
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
                  <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {companyContext ? (
                        <div className="text-xs text-gray-600 truncate">
                          <span className="text-gray-500">Контекст:</span>{" "}
                          <span className="font-semibold text-[#820251]">
                            {companyContext.companyName || (companyContext.companyId ? `#${companyContext.companyId}` : "—")}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {t("ai.chatMemoryHint") || "Контекст диалога: последние 12 сообщений"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {companyContext && (
                        <Link
                          href="/assistant"
                          className="text-xs text-[#820251] hover:underline underline-offset-2"
                        >
                          Сбросить
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={resetChat}
                        disabled={sending}
                        className="text-xs text-gray-600 hover:text-[#820251] hover:underline underline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        {t("ai.newChat") || "Новый чат"}
                      </button>
                    </div>
                  </div>
                  <div
                    ref={scrollRef}
                    className="h-[clamp(320px,55dvh,520px)] sm:h-[420px] overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-gray-50"
                  >
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            m.role === "user"
                              ? "bg-[#820251] text-white rounded-br-md"
                              : "relative group bg-white border border-gray-200 text-gray-900 rounded-bl-md pr-11 whitespace-pre-wrap break-words"
                          }`}
                        >
                          {m.role === "assistant" && (
                            <button
                              type="button"
                              onClick={() => void copyAnswer(m)}
                              aria-label={copiedAnswerId === m.id ? t("ai.copied") : t("ai.copyAnswer")}
                              title={copiedAnswerId === m.id ? t("ai.copied") : t("ai.copyAnswer")}
                              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              {copiedAnswerId === m.id ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7a2 2 0 012-2h7a2 2 0 012 2v7m-1 4H8a2 2 0 01-2-2V7a2 2 0 012-2h7"
                                  />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 5v4a2 2 0 002 2h4" />
                                </svg>
                              )}
                            </button>
                          )}
                          {m.role === "assistant" ? renderLinkifiedText(m.content) : m.content}
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm bg-white border border-gray-200 text-gray-500 rounded-bl-md animate-pulse">
                          {t("common.loading") || "Загрузка..."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-white">
                    {error && <div className="mb-3 text-sm text-red-700">{error}</div>}
                    {showSuggestionChips && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {suggestionChips.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => {
                              setDraft(chip.text);
                              draftRef.current?.focus();
                            }}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors border border-gray-200"
                          >
                            {chip.text}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <textarea
                        ref={draftRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (sending) return;
                          if (e.key !== "Enter") return;
                          if (e.shiftKey) return;
                          if (e.nativeEvent.isComposing) return;
                          e.preventDefault();
                          void send();
                        }}
                        placeholder={t("ai.placeholder") || "Опишите, что вам нужно найти или заказать..."}
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
                        {sending ? (t("common.loading") || "Загрузка...") : (t("ai.sendRequest") || "Отправить")}
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {t("ai.disclaimer") ||
                        "Ответы генерируются AI и могут быть неточными. Не передавайте чувствительные данные и проверяйте важную информацию."}
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
