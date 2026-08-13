import { NextResponse } from "next/server";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function hasValidOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "same-origin") return true;
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-site" || fetchSite === "none" || !fetchSite;
  try {
    const supplied = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
    const forwardedProto = (request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "")).split(",")[0].trim();
    const expected = new Set([requestUrl.origin]);
    if (forwardedHost) expected.add(`${forwardedProto}://${forwardedHost}`);
    if (process.env.NEXT_PUBLIC_APP_URL) expected.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    if (expected.has(supplied.origin)) return true;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    return loopback.has(supplied.hostname) && [...expected].some(value => {
      const candidate = new URL(value);
      return loopback.has(candidate.hostname) && candidate.port === supplied.port && candidate.protocol === supplied.protocol;
    });
  } catch { return false; }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= max, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}
