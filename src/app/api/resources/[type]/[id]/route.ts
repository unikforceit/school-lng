import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasValidOrigin, jsonError } from "@/lib/http";
import { canWriteResource, resourceConfig, resourcePayloadSchema, resourceTypeSchema } from "@/lib/resources";
import { securityOriginValid } from "@/lib/security";
import { schoolScope } from "@/lib/gamification";

const idSchema = z.coerce.number().int().positive();
async function contextData(context: { params: Promise<{ type: string; id: string }> }) {
  const params = await context.params;
  return { type: resourceTypeSchema.safeParse(params.type), id: idSchema.safeParse(params.id) };
}

export async function PUT(request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const { type, id } = await contextData(context);
  if (!type.success || !id.success) return jsonError("Invalid resource", 400);
  if (!canWriteResource(session.role, type.data)) return jsonError("This role cannot modify this resource", 403);
  const payload = resourcePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return jsonError("Invalid resource data", 400, payload.error.flatten());
  const config = resourceConfig[type.data];
  const clean = Object.fromEntries(config.fields.filter(field=>field.name in payload.data).map(field=>[field.name,payload.data[field.name]])) as Record<string,string|number>;
  const missing = config.fields.filter(field=>field.required&&String(clean[field.name]??"").trim()==="");
  if(missing.length)return jsonError("Required fields are missing",400,{fields:missing.map(field=>field.name)});
  if(session.role==="teacher"){const recordClass=String(clean.class||"");if(recordClass&&recordClass.toLowerCase()!=="all"&&!schoolScope(session).classes.includes(recordClass))return jsonError("Teachers can modify records only in their assigned classes",403)}
  const title = String(clean[config.primary] ?? config.title).slice(0, 150);
  const result = db.prepare("UPDATE resources SET title = ?, payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND resource_type = ?").run(title, JSON.stringify(clean), id.data, session.tenantId, type.data);
  if (!result.changes) return jsonError("Resource not found", 404);
  return Response.json({ data: { id: id.data, resourceType: type.data, title, payload: clean } });
}

export async function DELETE(request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const { type, id } = await contextData(context);
  if (!type.success || !id.success) return jsonError("Invalid resource", 400);
  if (!canWriteResource(session.role, type.data)) return jsonError("This role cannot modify this resource", 403);
  if(session.role==="teacher"){const row=db.prepare("SELECT payload FROM resources WHERE id=? AND tenant_id=? AND resource_type=?").get(id.data,session.tenantId,type.data) as {payload:string}|undefined;if(!row)return jsonError("Resource not found",404);const record=JSON.parse(row.payload) as Record<string,unknown>,recordClass=String(record.class||"");if(recordClass&&recordClass.toLowerCase()!=="all"&&!schoolScope(session).classes.includes(recordClass))return jsonError("Teachers can modify records only in their assigned classes",403)}
  const result = db.prepare("DELETE FROM resources WHERE id = ? AND tenant_id = ? AND resource_type = ?").run(id.data, session.tenantId, type.data);
  if (!result.changes) return jsonError("Resource not found", 404);
  return new Response(null, { status: 204 });
}
