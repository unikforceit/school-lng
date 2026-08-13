import { db } from "@/lib/db";
import { requirePlatform, schoolSelect } from "@/lib/platform";

export const dynamic="force-dynamic";
export async function GET(){
  const auth=await requirePlatform();if("error" in auth)return auth.error;
  const schools=db.prepare(`${schoolSelect} WHERE t.id!='platform' ORDER BY t.created_at,t.name`).all();
  const totals=db.prepare(`SELECT
    (SELECT COUNT(*) FROM tenants WHERE id!='platform') schools,
    (SELECT COUNT(*) FROM tenants WHERE id!='platform' AND active=1) activeSchools,
    (SELECT COUNT(*) FROM users WHERE tenant_id!='platform' AND active=1) users,
    (SELECT COUNT(*) FROM students) students,
    (SELECT COUNT(*) FROM tenants WHERE id!='platform' AND license_status IN ('trial','active') AND (license_expires_at IS NULL OR datetime(license_expires_at)>=datetime('now'))) licensedSchools,
    (SELECT COUNT(*) FROM tenants WHERE id!='platform' AND (license_status IN ('expired','suspended') OR (license_expires_at IS NOT NULL AND datetime(license_expires_at)<datetime('now')))) licenseAttention`).get();
  const growth=db.prepare(`SELECT strftime('%Y-%m',created_at) month,COUNT(*) schools FROM tenants WHERE id!='platform' GROUP BY month ORDER BY month DESC LIMIT 6`).all().reverse();
  const activity=db.prepare("SELECT id,actor_email actorEmail,action,tenant_id tenantId,created_at createdAt FROM platform_audit ORDER BY id DESC LIMIT 8").all();
  return Response.json({data:{totals,schools,growth,activity}},{headers:{"Cache-Control":"no-store"}});
}
