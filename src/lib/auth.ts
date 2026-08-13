import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessionFromUser, tokenExpiry, userFromAccessToken } from "@/lib/supabase-auth";

export type Role = "superadmin" | "admin" | "teacher" | "student" | "parent";
export type Session = { userId: string; name: string; role: Role; tenantId: string; exp: number };
export const SESSION_COOKIE = "sime_session";
export const REFRESH_COOKIE = "sime_refresh_token";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || tokenExpiry(token) <= Date.now()) return null;
  const user = await userFromAccessToken(token);
  const session = user ? sessionFromUser(user, tokenExpiry(token)) : null;
  if (!session) return null;
  const active = db.prepare("SELECT 1 FROM users JOIN tenants ON tenants.id=users.tenant_id WHERE users.tenant_id=? AND users.email=? AND users.role=? AND users.active=1 AND tenants.active=1 AND (tenants.id='platform' OR (tenants.license_status IN ('trial','active') AND (tenants.license_expires_at IS NULL OR datetime(tenants.license_expires_at)>=datetime('now'))))").get(session.tenantId,session.userId,session.role);
  return active ? session : null;
}
