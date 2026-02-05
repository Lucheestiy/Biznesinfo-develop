import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/origin";
import { indexCompanies } from "@/lib/meilisearch/indexer";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "dev-secret-change-me";

export async function POST(request: Request) {
  // Auth: allow either Bearer token (for automation) or admin session (for UI).
  const authHeader = request.headers.get("Authorization");
  const tokenAuthorized = authHeader === `Bearer ${ADMIN_SECRET}`;
  if (!tokenAuthorized) {
    if (!isAuthEnabled()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      assertSameOrigin(request);
    } catch {
      return NextResponse.json({ error: "CSRF" }, { status: 403 });
    }

    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jsonlPath = process.env.BIZNESINFO_COMPANIES_JSONL_PATH
    || "/app/public/data/biznesinfo/companies.jsonl";

  try {
    console.log(`Starting reindex from: ${jsonlPath}`);
    const result = await indexCompanies(jsonlPath);

    return NextResponse.json({
      success: true,
      indexed: result.indexed,
      total: result.total,
      message: `Successfully indexed ${result.indexed} companies`,
    });
  } catch (error) {
    console.error("Reindex failed:", error);
    return NextResponse.json({
      success: false,
      error: "Indexing failed",
      message: String(error),
    }, { status: 500 });
  }
}

// Also support GET for health check of admin endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/reindex",
    method: "POST",
    auth: "Bearer token or admin session required",
    description: "Triggers a full reindex of the Meilisearch companies index",
  });
}
