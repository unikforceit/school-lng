import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasValidOrigin, jsonError } from "@/lib/http";
import { canReadResource, canWriteResource, resourceConfig, resourcePayloadSchema, resourceTypeSchema } from "@/lib/resources";
import { securityOriginValid } from "@/lib/security";
import { schoolScope } from "@/lib/gamification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const select = `SELECT id, resource_type AS resourceType, title, payload, created_at AS createdAt, updated_at AS updatedAt FROM resources`;

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  const type = resourceTypeSchema.safeParse((await context.params).type);
  if (!type.success) return jsonError("Unknown resource type", 404);
  if (!canReadResource(session.role, type.data)) return jsonError("This role cannot access this resource", 403);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const rows = db.prepare(`${select} WHERE tenant_id = ? AND resource_type = ? AND (? = '' OR title LIKE ? OR payload LIKE ?) ORDER BY updated_at DESC LIMIT 200`).all(session.tenantId, type.data, query, `%${query}%`, `%${query}%`) as Array<{id:number;resourceType:string;title:string;payload:string;createdAt:string;updatedAt:string}>;
  const scope=schoolScope(session);
  let children:string[]=[];
  if(session.role==="parent"){const parent=db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='parents' AND title=?").get(session.tenantId,session.name) as {payload:string}|undefined;const names=parent?String((JSON.parse(parent.payload) as Record<string,unknown>).students||""):"";children=names.split(",").map(name=>name.trim()).filter(Boolean)}
  let classes:string[]=[];
  if(session.role==="student"){const student=db.prepare("SELECT class_name className FROM students WHERE tenant_id=? AND email=?").get(session.tenantId,session.userId) as {className:string}|undefined;if(student)classes=[student.className]}
  if(session.role==="parent"&&children.length){const placeholders=children.map(()=>"?").join(",");classes=(db.prepare(`SELECT DISTINCT class_name className FROM students WHERE tenant_id=? AND name IN (${placeholders})`).all(session.tenantId,...children) as Array<{className:string}>).map(row=>row.className)}
  const data=rows.map(row=>({...row,payload:JSON.parse(row.payload) as Record<string,string|number>})).filter(row=>{
    if(session.role==="admin")return true;
    const recordClass=String(row.payload.class||"");
    if(session.role==="teacher"){
      if(type.data==="teachers")return true;
      if(type.data==="parents"){const names=String(row.payload.students||"").split(",").map(item=>item.trim()).filter(Boolean);if(!names.length)return false;const placeholders=names.map(()=>"?").join(",");return Boolean(db.prepare(`SELECT 1 FROM students WHERE tenant_id=? AND name IN (${placeholders}) AND class_name IN (${scope.classes.map(()=>"?").join(",")||"''"}) LIMIT 1`).get(session.tenantId,...names,...scope.classes))}
      if(type.data==="subjects")return scope.subjects.includes(String(row.payload.name||row.title));
      return !recordClass||recordClass.toLowerCase()==="all"||scope.classes.includes(recordClass);
    }
    if(["results","attendance"].includes(type.data)){const student=String(row.payload.student||"");return session.role==="student"?student===session.name:children.includes(student)}
    if(type.data==="assignments"){const assignedClass=String(row.payload.class||"All");return assignedClass.toLowerCase()==="all"||classes.includes(assignedClass)}
    if(["classes","lessons","exams","events","announcements"].includes(type.data))return recordClass.toLowerCase()==="all"||classes.includes(recordClass)||(type.data==="classes"&&classes.includes(String(row.payload.name||row.title)));
    if(type.data==="teachers"){const teacherClasses=String(row.payload.classes||"").split(",").map(item=>item.trim());return teacherClasses.some(item=>classes.includes(item))}
    if(type.data==="messages"){const recipient=String(row.payload.recipient||"").toLowerCase();return ["all","all users",session.name.toLowerCase(),session.role,`${session.role}s`].includes(recipient)}
    return true;
  }).map(row=>{
    if(type.data==="teachers"&&(session.role==="student"||session.role==="parent")){const {email,phone,address,...safe}=row.payload;void email;void phone;void address;return {...row,payload:safe}}
    return row;
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request, context: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const type = resourceTypeSchema.safeParse((await context.params).type);
  if (!type.success) return jsonError("Unknown resource type", 404);
  if (!canWriteResource(session.role, type.data)) return jsonError("This role cannot modify this resource", 403);
  const parsed = resourcePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid resource data", 400, parsed.error.flatten());
  const config = resourceConfig[type.data];
  const clean = Object.fromEntries(config.fields.filter(field=>field.name in parsed.data).map(field=>[field.name,parsed.data[field.name]])) as Record<string,string|number>;
  const missing = config.fields.filter((item) => item.required && String(clean[item.name] ?? "").trim() === "");
  if (missing.length) return jsonError("Required fields are missing", 400, { fields: missing.map((item) => item.name) });
  if(session.role==="teacher"){const recordClass=String(clean.class||"");if(recordClass&&recordClass.toLowerCase()!=="all"&&!schoolScope(session).classes.includes(recordClass))return jsonError("Teachers can modify records only in their assigned classes",403)}
  const title = String(clean[config.primary] ?? config.title).slice(0, 150);
  const result = db.prepare("INSERT INTO resources (tenant_id, resource_type, title, payload) VALUES (?, ?, ?, ?)").run(session.tenantId, type.data, title, JSON.stringify(clean));
  return NextResponse.json({ data: { id: Number(result.lastInsertRowid), resourceType: type.data, title, payload: clean } }, { status: 201 });
}
