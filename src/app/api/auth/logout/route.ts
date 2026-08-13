import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { hasValidOrigin, jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
