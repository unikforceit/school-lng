import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

export async function requirePlatform(request?:Request){
  const session=await getSession();
  if(!session||session.role!=="superadmin"||session.tenantId!=="platform")return {error:jsonError("Platform administrator access required",session?403:401)} as const;
  if(request&&!securityOriginValid(request,"platform"))return {error:jsonError("Invalid request origin",403)} as const;
  return {session} as const;
}

export function auditPlatform(actorEmail:string,action:string,tenantId:string|null,details:Record<string,unknown>={}){
  db.prepare("INSERT INTO platform_audit (actor_email,action,tenant_id,details) VALUES (?,?,?,?)").run(actorEmail,action,tenantId,JSON.stringify(details));
}

export const schoolSelect=`SELECT t.id,t.name,t.active,t.plan,t.license_status licenseStatus,t.license_starts_at licenseStartsAt,
  t.license_expires_at licenseExpiresAt,t.max_students maxStudents,t.max_users maxUsers,t.contact_email contactEmail,t.created_at createdAt,
  (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id AND u.active=1) users,
  (SELECT COUNT(*) FROM students s WHERE s.tenant_id=t.id) students,
  (SELECT COUNT(*) FROM resources r WHERE r.tenant_id=t.id) resources
  FROM tenants t`;
