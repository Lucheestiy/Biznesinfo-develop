export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getUserEffectivePlan } from "@/lib/auth/plans";
import { getAiUsage } from "@/lib/auth/aiUsage";
import AssistantClient from "./AssistantClient";

function getAssistantRuntime() {
  const providerRaw = (process.env.AI_ASSISTANT_PROVIDER || "stub").trim().toLowerCase();
  const allowUiSwitch = (process.env.AI_ASSISTANT_ALLOW_PROVIDER_OVERRIDE_UI || "").trim() === "1";
  const openaiModel = (process.env.OPENAI_MODEL || "").trim() || "gpt-4o-mini";
  const openaiHasKey = Boolean((process.env.OPENAI_API_KEY || "").trim());
  const codexModel = (process.env.CODEX_MODEL || "").trim() || "gpt-5.2-codex";
  const codexHasAuthPath = Boolean((process.env.CODEX_AUTH_JSON_PATH || "").trim());
  const minimaxModel = (process.env.MINIMAX_MODEL || "").trim() || "MiniMax-M2.5";
  const minimaxHasKey = Boolean((process.env.MINIMAX_API_KEY || "").trim());

  const providers = [
    { id: "minimax", label: "MiniMax", model: minimaxModel, available: minimaxHasKey },
    { id: "codex", label: "Codex", model: codexModel, available: codexHasAuthPath },
    { id: "openai", label: "OpenAI", model: openaiModel, available: openaiHasKey },
    { id: "stub", label: "Stub", model: null as string | null, available: true },
  ];

  if (providerRaw === "openai") {
    return {
      provider: "openai",
      model: openaiModel,
      canSwitch: allowUiSwitch,
      providers,
    };
  }

  if (providerRaw === "codex" || providerRaw === "codex-auth" || providerRaw === "codex_cli") {
    return {
      provider: "codex",
      model: codexModel,
      canSwitch: allowUiSwitch,
      providers,
    };
  }

  if (providerRaw === "minimax" || providerRaw === "mini-max" || providerRaw === "minimax-api" || providerRaw === "m2.5") {
    return {
      provider: "minimax",
      model: minimaxModel,
      canSwitch: allowUiSwitch,
      providers,
    };
  }

  return { provider: "stub", model: null as string | null, canSwitch: allowUiSwitch, providers };
}

export default async function AssistantPage() {
  if (!isAuthEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/assistant");

  const effective = await getUserEffectivePlan(user);
  const usage = await getAiUsage({ userId: user.id });

  return (
    <AssistantClient
      user={{
        name: user.name,
        email: user.email,
        plan: effective.plan,
        aiRequestsPerDay: effective.aiRequestsPerDay,
      }}
      initialUsage={{ day: usage.day, used: usage.used, limit: effective.aiRequestsPerDay }}
      assistantRuntime={getAssistantRuntime()}
    />
  );
}
