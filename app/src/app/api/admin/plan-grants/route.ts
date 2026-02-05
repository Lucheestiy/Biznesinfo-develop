import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/origin";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { getDbPool } from "@/lib/auth/db";
import type { UserPlan } from "@/lib/auth/users";

export const runtime = "nodejs";

type GrantPlan = Exclude<UserPlan, "free">;

function isAllowedPlan(plan: string): plan is GrantPlan {
  return plan === "paid" || plan === "partner";
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseDate(raw: string): Date | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

export async function GET(request: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = clampInt(Number(searchParams.get("limit") || "200"), 1, 500);
  const offset = clampInt(Number(searchParams.get("offset") || "0"), 0, 50_000);
  const activeOnly = searchParams.get("activeOnly") === "1";
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const pool = getDbPool();
  try {
    const where: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (activeOnly) {
      where.push("g.revoked_at IS NULL AND g.starts_at <= now() AND g.ends_at > now()");
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(`(u.email ILIKE $${idx} OR COALESCE(u.name,'') ILIKE $${idx} OR g.note ILIKE $${idx})`);
      idx += 1;
    }

    values.push(limit);
    values.push(offset);

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const res = await pool.query<{
      id: string;
      user_id: string;
      email: string;
      name: string | null;
      plan: GrantPlan;
      starts_at: Date;
      ends_at: Date;
      revoked_at: Date | null;
      source: string;
      note: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT g.id, g.user_id, u.email, u.name, g.plan, g.starts_at, g.ends_at, g.revoked_at, g.source, g.note, g.created_at, g.updated_at
        FROM user_plan_grants g
        JOIN users u ON u.id = g.user_id
        ${whereSql}
        ORDER BY g.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `,
      values,
    );

    return NextResponse.json(
      {
        success: true,
        grants: res.rows.map((r) => ({
          id: r.id,
          user: { id: r.user_id, email: r.email, name: r.name },
          plan: r.plan,
          startsAt: r.starts_at.toISOString(),
          endsAt: r.ends_at.toISOString(),
          revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
          source: r.source,
          note: r.note,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "";
    if (code === "42P01") {
      return NextResponse.json({ error: "MigrationsRequired" }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "InternalError", message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });

  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit({ key: `admin:plan-grants:${ip}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "RateLimited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  }

  const userEmail = typeof (body as any)?.userEmail === "string" ? String((body as any).userEmail).trim().toLowerCase() : "";
  const userId = typeof (body as any)?.userId === "string" ? String((body as any).userId).trim() : "";
  const plan = typeof (body as any)?.plan === "string" ? String((body as any).plan).trim() : "";
  const durationDaysRaw = (body as any)?.durationDays;
  const durationDays = durationDaysRaw == null ? null : Number(durationDaysRaw);
  const endsAtRaw = typeof (body as any)?.endsAt === "string" ? String((body as any).endsAt) : "";
  const note = typeof (body as any)?.note === "string" ? String((body as any).note).trim().slice(0, 500) : null;
  const source = typeof (body as any)?.source === "string" ? String((body as any).source).trim().slice(0, 32) : "manual";
  const extendIfActive = (body as any)?.extendIfActive !== false;

  if (!isAllowedPlan(plan)) return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  if (!userEmail && !userId) return NextResponse.json({ error: "BadRequest" }, { status: 400 });

  const pool = getDbPool();
  try {
    const userRes = userId
      ? await pool.query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [userId])
      : await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);

    const targetUserId = userRes.rows[0]?.id;
    if (!targetUserId) return NextResponse.json({ error: "UserNotFound" }, { status: 404 });

    const now = new Date();
    const endsAtParsed = endsAtRaw ? parseDate(endsAtRaw) : null;

    let base = now;
    if (extendIfActive) {
      const activeRes = await pool.query<{ ends_at: Date }>(
        `
          SELECT ends_at
          FROM user_plan_grants
          WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= now() AND ends_at > now()
          ORDER BY ends_at DESC
          LIMIT 1
        `,
        [targetUserId],
      );
      const currentEnds = activeRes.rows[0]?.ends_at;
      if (currentEnds && currentEnds.getTime() > base.getTime()) base = currentEnds;
    }

    let endsAt: Date | null = null;
    if (endsAtParsed) {
      endsAt = endsAtParsed;
    } else if (durationDays != null) {
      if (!Number.isFinite(durationDays) || durationDays <= 0 || durationDays > 3650) {
        return NextResponse.json({ error: "BadRequest" }, { status: 400 });
      }
      endsAt = new Date(base.getTime() + Math.floor(durationDays) * 24 * 60 * 60 * 1000);
    } else {
      endsAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    if (endsAt.getTime() <= now.getTime() + 60_000) {
      return NextResponse.json({ error: "BadRequest" }, { status: 400 });
    }

    const id = randomUUID();
    await pool.query(
      `
        INSERT INTO user_plan_grants (id, user_id, plan, starts_at, ends_at, source, note)
        VALUES ($1, $2, $3, now(), $4, $5, $6)
      `,
      [id, targetUserId, plan, endsAt, source || "manual", note],
    );

    return NextResponse.json({ success: true, id, userId: targetUserId, plan, endsAt: endsAt.toISOString() });
  } catch (error) {
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "";
    if (code === "42P01") {
      return NextResponse.json({ error: "MigrationsRequired" }, { status: 409 });
    }
    return NextResponse.json({ error: "InternalError", message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });

  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "BadRequest" }, { status: 400 });

  const pool = getDbPool();
  try {
    const res = await pool.query("UPDATE user_plan_grants SET revoked_at = now(), updated_at = now() WHERE id = $1", [id]);
    if ((res.rowCount || 0) === 0) return NextResponse.json({ error: "NotFound" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "";
    if (code === "42P01") {
      return NextResponse.json({ error: "MigrationsRequired" }, { status: 409 });
    }
    return NextResponse.json({ error: "InternalError", message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

