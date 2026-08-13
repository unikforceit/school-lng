import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type Role = "superadmin" | "admin" | "teacher" | "student" | "parent";
export type Session = { userId: string; name: string; role: Role; tenantId: string; exp: number };
export const SESSION_COOKIE = "sime_session";

function secret() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required in production");
  return process.env.AUTH_SECRET || "development-only-change-this-secret-before-production";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!(session.exp > Date.now() && session.tenantId && session.role && session.userId)) return null;
    const user = db.prepare("SELECT users.name,users.role FROM users JOIN tenants ON tenants.id=users.tenant_id WHERE users.tenant_id=? AND users.email=? AND users.active=1 AND tenants.active=1 AND (tenants.id='platform' OR (tenants.license_status IN ('trial','active') AND (tenants.license_expires_at IS NULL OR datetime(tenants.license_expires_at)>=datetime('now'))))").get(session.tenantId,session.userId) as {name:string;role:Role}|undefined;
    return user && user.role===session.role ? {...session,name:user.name} : null;
  } catch { return null; }
}

export async function getSession() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export function authenticateUser(tenantId: string, email: string, password: string) {
  const user = db.prepare("SELECT users.email,users.name,users.role,users.password_hash AS passwordHash FROM users JOIN tenants ON tenants.id=users.tenant_id WHERE users.tenant_id=? AND users.email=? AND users.active=1 AND tenants.active=1 AND (tenants.id='platform' OR (tenants.license_status IN ('trial','active') AND (tenants.license_expires_at IS NULL OR datetime(tenants.license_expires_at)>=datetime('now'))))").get(tenantId, email.toLowerCase()) as { email: string; name: string; role: Role; passwordHash: string } | undefined;
  if (!user) return null;
  const [salt, hash] = user.passwordHash.split(":");
  if (!salt || !hash) return null;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? user : null;
}
