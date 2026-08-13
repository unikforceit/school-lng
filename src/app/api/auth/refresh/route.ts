import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { hasValidOrigin } from "@/lib/http";
import { refreshSupabaseSession, sessionFromUser, tokenExpiry } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return jsonError("Authentication required", 401);
  let tokens;
  try { tokens = await refreshSupabaseSession(refreshToken); } catch { return jsonError("Authentication required", 401); }
  const expiresAt = tokenExpiry(tokens.access_token);
  if (!sessionFromUser(tokens.user, expiresAt)) return jsonError("Account role is not configured", 403);
  const secure = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || new URL(request.url).protocol === "https:";
  const response = NextResponse.json({ data: { refreshed: true, expiresAt } });
  response.cookies.set(SESSION_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, tokens.expires_in || 3600),
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30*24*60*60 });
  return response;
}
