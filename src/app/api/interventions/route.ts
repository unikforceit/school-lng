import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { allowedStudents,interventionData } from "@/lib/interventions";
import { jsonError,rateLimit } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

const schema=z.object({studentId:z.number().int().positive(),note:z.string().trim().min(2).max(2000),followUpAt:z.string().date().nullable().optional()});
export async function GET(){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(session.role!=="admin"&&session.role!=="teacher")return jsonError("Intervention data is private to authorized school staff",403);return Response.json({data:{students:interventionData(session)}},{headers:{"Cache-Control":"no-store"}})}
export async function POST(request:Request){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(session.role!=="admin"&&session.role!=="teacher")return jsonError("Intervention data is private to authorized school staff",403);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);if(!rateLimit(`intervention:${session.tenantId}:${session.userId}`,30).allowed)return jsonError("Too many note requests",429);const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return jsonError("Invalid coaching note",400,body.error.flatten());const student=allowedStudents(session).find(item=>item.id===body.data.studentId);if(!student)return jsonError("Student is outside your assigned scope",403);const risk=interventionData(session).find(item=>item.id===student.id)?.riskStatus||"on_track";const result=db.prepare("INSERT INTO intervention_notes (tenant_id,student_id,author_email,risk_status,note,follow_up_at) VALUES (?,?,?,?,?,?)").run(session.tenantId,student.id,session.userId,risk,body.data.note,body.data.followUpAt||null);return Response.json({data:{id:Number(result.lastInsertRowid)}},{status:201})}
