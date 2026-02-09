export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import AiChatsClient from "./AiChatsClient";

export default async function AiChatsPage() {
  if (!isAuthEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/ai-chats");

  return (
    <AiChatsClient
      currentUser={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }}
    />
  );
}

