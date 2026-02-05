export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import AiAccessClient from "./AiAccessClient";

export default async function AdminAiAccessPage() {
  if (!isAuthEnabled()) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/ai-access");
  if (user.role !== "admin") redirect("/cabinet");
  return <AiAccessClient />;
}

