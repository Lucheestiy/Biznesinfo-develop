import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import ReindexClient from "./ReindexClient";

export default async function AdminReindexPage() {
  if (!isAuthEnabled()) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/reindex");
  if (user.role !== "admin") redirect("/cabinet");
  return <ReindexClient />;
}

