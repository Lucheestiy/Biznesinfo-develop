import { getDbPool } from "./db";
import type { UserPlan } from "./users";

export type ActivePlanGrant = {
  plan: Exclude<UserPlan, "free">;
  endsAt: string;
};

export async function findActivePlanGrant(userId: string): Promise<ActivePlanGrant | null> {
  const pool = getDbPool();
  try {
    const res = await pool.query<{ plan: Exclude<UserPlan, "free">; ends_at: Date }>(
      `
        SELECT plan, ends_at
        FROM user_plan_grants
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND starts_at <= now()
          AND ends_at > now()
        ORDER BY ends_at DESC
        LIMIT 1
      `,
      [userId],
    );

    const row = res.rows[0];
    if (!row) return null;
    return { plan: row.plan, endsAt: row.ends_at.toISOString() };
  } catch (error) {
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "";
    if (code === "42P01") return null; // undefined_table (migrations not applied yet)
    throw error;
  }
}

