import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getUserEffectivePlan } from "@/lib/auth/plans";
import AssistantClient from "./AssistantClient";

export default async function AssistantPage() {
  if (!isAuthEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/assistant");

  const effective = await getUserEffectivePlan(user);

  return (
    <AssistantClient
      user={{
        name: user.name,
        email: user.email,
        plan: effective.plan,
        aiRequestsPerDay: effective.aiRequestsPerDay,
      }}
    />
  );
}

