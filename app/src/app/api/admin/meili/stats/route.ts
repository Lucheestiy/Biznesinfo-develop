import { NextResponse } from "next/server";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { COMPANIES_INDEX, getMeiliClient } from "@/lib/meilisearch/client";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = getMeiliClient();

  let healthy = false;
  try {
    await client.health();
    healthy = true;
  } catch {
    healthy = false;
  }

  try {
    const stats: any = await client.getStats();
    const companiesIndex = stats?.indexes?.[COMPANIES_INDEX] ?? null;

    return NextResponse.json(
      {
        success: true,
        healthy,
        databaseSize: typeof stats?.databaseSize === "number" ? stats.databaseSize : null,
        lastUpdate: typeof stats?.lastUpdate === "string" ? stats.lastUpdate : null,
        companies: companiesIndex
          ? {
              uid: COMPANIES_INDEX,
              numberOfDocuments: typeof companiesIndex?.numberOfDocuments === "number" ? companiesIndex.numberOfDocuments : null,
              isIndexing: typeof companiesIndex?.isIndexing === "boolean" ? companiesIndex.isIndexing : null,
              fieldDistribution: typeof companiesIndex?.fieldDistribution === "object" ? companiesIndex.fieldDistribution : null,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        healthy,
        error: "MeiliStatsFailed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

