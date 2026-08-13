import { NextResponse } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { hasValidOrigin, jsonError } from "@/lib/http";
import { signOutAccessToken } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const accessToken = request.headers.get("cookie")?.match(/(?:^|;\s*)sime_session=([^;]+)/)?.[1];
  if (accessToken) await signOutAccessToken(decodeURIComponent(accessToken));
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
