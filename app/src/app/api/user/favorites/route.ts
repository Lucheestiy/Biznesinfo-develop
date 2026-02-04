import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/origin";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/currentUser";
import { addFavorite, listFavorites, removeFavorite, setFavorites } from "@/lib/auth/favorites";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await listFavorites(user.id);
  return NextResponse.json({ favorites }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });

  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit({ key: `user:fav:${ip}`, limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "RateLimited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  }

  const action = typeof (body as any)?.action === "string" ? (body as any).action : "";
  const companyId = typeof (body as any)?.companyId === "string" ? (body as any).companyId : "";

  if (!companyId.trim()) return NextResponse.json({ error: "BadRequest" }, { status: 400 });

  if (action === "remove") {
    await removeFavorite(user.id, companyId.trim());
  } else {
    await addFavorite(user.id, companyId.trim());
  }

  const favorites = await listFavorites(user.id);
  return NextResponse.json({ favorites });
}

export async function PUT(request: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ error: "AuthDisabled" }, { status: 404 });

  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  }

  const favorites = Array.isArray((body as any)?.favorites) ? (body as any).favorites : [];
  const ids = favorites.filter((v: any) => typeof v === "string");

  await setFavorites(user.id, ids);
  const updated = await listFavorites(user.id);
  return NextResponse.json({ favorites: updated });
}

