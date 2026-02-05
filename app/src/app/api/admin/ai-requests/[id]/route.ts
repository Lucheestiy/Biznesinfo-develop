import { NextResponse } from "next/server";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getDbPool } from "@/lib/auth/db";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;
  const id = (params?.id || "").trim();
  if (!id) return NextResponse.json({ error: "BadRequest" }, { status: 400 });

  const pool = getDbPool();
  const res = await pool.query<{
    id: string;
    user_id: string;
    email: string;
    name: string | null;
    plan: string;
    company_id: string | null;
    message: string;
    created_at: Date;
    payload: any;
  }>(
    `
      SELECT r.id, r.user_id, r.company_id, r.message, r.created_at, r.payload,
             u.email, u.name, u.plan
      FROM ai_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [id],
  );

  const row = res.rows[0];
  if (!row) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  return NextResponse.json(
    {
      success: true,
      request: {
        id: row.id,
        createdAt: row.created_at,
        user: { id: row.user_id, email: row.email, name: row.name, plan: row.plan },
        companyId: row.company_id,
        message: row.message,
        payload: row.payload ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

