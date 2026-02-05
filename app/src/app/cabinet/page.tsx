export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getUserEffectivePlan } from "@/lib/auth/plans";
import { findActivePlanGrant } from "@/lib/auth/planGrants";
import CabinetClient from "./CabinetClient";

export default async function CabinetPage() {
  if (!isAuthEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cabinet");

  const effective = await getUserEffectivePlan(user);
  const grant = await findActivePlanGrant(user.id);

  return (
    <CabinetClient
      user={{
        email: user.email,
        name: user.name,
        plan: effective.plan,
        role: user.role,
        aiAccessEndsAt: grant?.endsAt ?? null,
      }}
    />
  );
}
