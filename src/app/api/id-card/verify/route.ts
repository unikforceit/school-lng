import { db } from "@/lib/db";
import { isIdCardSigningConfigured, verifyIdCardToken } from "@/lib/id-card";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if(!isIdCardSigningConfigured())return jsonError("ID card verification is not configured",503);
  const token = new URL(request.url).searchParams.get("token") || "";
  const identity = verifyIdCardToken(token);
  if (!identity) return jsonError("This ID card is invalid or expired", 400);
  let active:{name:string}|undefined;
  if(identity.source==="user")active=db.prepare("SELECT name FROM users WHERE id=? AND tenant_id=? AND active=1").get(identity.recordId,identity.tenantId) as {name:string}|undefined;
  else if(identity.source==="student")active=db.prepare("SELECT name FROM students WHERE id=? AND tenant_id=?").get(identity.recordId,identity.tenantId) as {name:string}|undefined;
  else {
    const row=db.prepare("SELECT payload FROM resources WHERE id=? AND tenant_id=? AND resource_type=?").get(identity.recordId,identity.tenantId,`${identity.role}s`) as {payload:string}|undefined;
    if(row){try{const name=String((JSON.parse(row.payload) as Record<string,unknown>).name||"");if(name)active={name}}catch{active=undefined}}
  }
  if (!active) return jsonError("This ID card is no longer active", 404);
  const tenant = db.prepare("SELECT name FROM tenants WHERE id=?").get(identity.tenantId) as {name:string}|undefined;
  return Response.json({ data: { valid: true, school: tenant?.name || "SIME School", cardId: identity.cardId, name: active.name, role: identity.role, validUntil: new Date(identity.exp * 1000).toISOString() } }, { headers: { "Cache-Control": "no-store" } });
}
