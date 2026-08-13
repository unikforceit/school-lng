import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSecuritySettings } from "@/lib/security";
import { hasValidOrigin, jsonError } from "@/lib/http";

const schema = z.object({
  maxLoginAttempts: z.number().int().min(3).max(20), lockoutMinutes: z.number().int().min(1).max(1440),
  sessionHours: z.number().int().min(1).max(168), aiRequestsPerMinute: z.number().int().min(1).max(100),
  requireStrongPasswords: z.boolean(), enforceSameOrigin: z.boolean(), secureCookies: z.boolean(), auditLogging: z.boolean(),
});
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError("Administrator access required", session ? 403 : 401);
  const recent = db.prepare("SELECT email,ip,success,created_at createdAt FROM login_attempts WHERE tenant_id=? ORDER BY created_at DESC LIMIT 20").all(session.tenantId);
  return Response.json({ data: { settings: getSecuritySettings(session.tenantId), recentAttempts: recent } });
}

export async function PUT(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError("Administrator access required", session ? 403 : 401);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid security settings", 400, body.error.flatten());
  const value = body.data;
  db.prepare(`UPDATE security_settings SET max_login_attempts=?,lockout_minutes=?,session_hours=?,ai_requests_per_minute=?,
    require_strong_passwords=?,enforce_same_origin=?,secure_cookies=?,audit_logging=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?`).run(
    value.maxLoginAttempts,value.lockoutMinutes,value.sessionHours,value.aiRequestsPerMinute,Number(value.requireStrongPasswords),
    Number(value.enforceSameOrigin),Number(value.secureCookies),Number(value.auditLogging),session.tenantId);
  return Response.json({ data: getSecuritySettings(session.tenantId) });
}
