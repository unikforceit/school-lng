import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { allowedStudents } from "@/lib/interventions";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

const idSchema=z.coerce.number().int().positive(),schema=z.object({note:z.string().trim().min(2).max(2000),followUpAt:z.string().date().nullable().optional(),resolved:z.boolean()});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(session.role!=="admin"&&session.role!=="teacher")return jsonError("Intervention data is private to authorized school staff",403);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);const id=idSchema.safeParse((await params).id),body=schema.safeParse(await request.json().catch(()=>null));if(!id.success||!body.success)return jsonError("Invalid coaching note",400);const note=db.prepare("SELECT student_id studentId FROM intervention_notes WHERE id=? AND tenant_id=?").get(id.data,session.tenantId) as {studentId:number}|undefined;if(!note)return jsonError("Coaching note not found",404);if(!allowedStudents(session).some(item=>item.id===note.studentId))return jsonError("Student is outside your assigned scope",403);db.prepare("UPDATE intervention_notes SET note=?,follow_up_at=?,resolved=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").run(body.data.note,body.data.followUpAt||null,Number(body.data.resolved),id.data,session.tenantId);return Response.json({data:{id:id.data}})}
