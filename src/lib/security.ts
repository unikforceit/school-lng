import { db } from "@/lib/db";
import { hasValidOrigin } from "@/lib/http";

export type SecuritySettings = {
  maxLoginAttempts: number; lockoutMinutes: number; sessionHours: number; aiRequestsPerMinute: number;
  requireStrongPasswords: boolean; enforceSameOrigin: boolean; secureCookies: boolean; auditLogging: boolean; updatedAt: string;
};

export function getSecuritySettings(tenantId: string): SecuritySettings {
  db.prepare("INSERT OR IGNORE INTO security_settings (tenant_id) VALUES (?)").run(tenantId);
  const row = db.prepare(`SELECT max_login_attempts maxLoginAttempts, lockout_minutes lockoutMinutes, session_hours sessionHours,
    ai_requests_per_minute aiRequestsPerMinute, require_strong_passwords requireStrongPasswords, enforce_same_origin enforceSameOrigin,
    secure_cookies secureCookies, audit_logging auditLogging, updated_at updatedAt FROM security_settings WHERE tenant_id=?`).get(tenantId) as Record<string, number|string>;
  return { ...row, requireStrongPasswords: Boolean(row.requireStrongPasswords), enforceSameOrigin: Boolean(row.enforceSameOrigin), secureCookies: Boolean(row.secureCookies), auditLogging: Boolean(row.auditLogging) } as SecuritySettings;
}

export function isLoginLocked(tenantId: string, email: string, ip: string, settings: SecuritySettings) {
  const since = new Date(Date.now() - settings.lockoutMinutes * 60_000).toISOString().replace("T", " ").slice(0, 19);
  const row = db.prepare("SELECT COUNT(*) count FROM login_attempts WHERE tenant_id=? AND email=? AND ip=? AND success=0 AND created_at>=?").get(tenantId, email.toLowerCase(), ip, since) as { count: number };
  return row.count >= settings.maxLoginAttempts;
}

export function recordLoginAttempt(tenantId: string, email: string, ip: string, success: boolean, enabled = true) {
  if (!enabled) return;
  db.prepare("INSERT INTO login_attempts (tenant_id,email,ip,success) VALUES (?,?,?,?)").run(tenantId, email.toLowerCase(), ip, success ? 1 : 0);
  if (success) db.prepare("DELETE FROM login_attempts WHERE tenant_id=? AND email=? AND ip=? AND success=0").run(tenantId, email.toLowerCase(), ip);
}

export function securityOriginValid(request: Request, tenantId: string) {
  return !getSecuritySettings(tenantId).enforceSameOrigin || hasValidOrigin(request);
}
