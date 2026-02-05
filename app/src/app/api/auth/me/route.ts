import { NextResponse } from "next/server";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getUserEffectivePlan } from "@/lib/auth/plans";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ enabled: false, user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ enabled: true, user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const effective = await getUserEffectivePlan(user);
  return NextResponse.json(
    {
      enabled: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: effective.plan,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
