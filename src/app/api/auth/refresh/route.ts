import { NextResponse } from "next/server";
import { createSessionToken, getSession, SESSION_COOKIE } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getSecuritySettings, securityOriginValid } from "@/lib/security";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const settings = getSecuritySettings(session.tenantId);
  const maxAge = settings.sessionHours * 60 * 60;
  const response = NextResponse.json({ data: { refreshed: true, expiresAt: Date.now() + maxAge * 1000 } });
  response.cookies.set(SESSION_COOKIE, createSessionToken({ ...session, exp: Date.now() + maxAge * 1000 }), {
    httpOnly: true,
    secure: settings.secureCookies && new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
