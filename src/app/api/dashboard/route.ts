import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { readableResourceTypes } from "@/lib/resources";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  const allowed=readableResourceTypes(session.role);
  const resourceCounts = (db.prepare("SELECT resource_type AS type, COUNT(*) AS count FROM resources WHERE tenant_id=? GROUP BY resource_type").all(session.tenantId) as Array<{type:string;count:number}>).filter(item=>allowed.includes(item.type as never));
  const students = session.role==="admin"||session.role==="teacher"?(db.prepare("SELECT COUNT(*) AS count FROM students WHERE tenant_id=?").get(session.tenantId) as {count:number}).count:0;
  const genderCounts = session.role==="admin"?(db.prepare("SELECT gender,COUNT(*) count FROM students WHERE tenant_id=? GROUP BY gender ORDER BY gender").all(session.tenantId) as Array<{gender:string;count:number}>):[];
  const recent = session.role==="admin"?db.prepare("SELECT id,resource_type AS type,title,updated_at AS updatedAt FROM resources WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 8").all(session.tenantId):[];
  return Response.json({ data: { role: session.role, user: { name: session.name, email: session.userId }, students, genderCounts, resourceCounts, recent } });
}
