import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getGamificationSettings, pointsForSource, schoolScope } from "@/lib/gamification";
import { jsonError, rateLimit } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

const schema=z.object({studentName:z.string().trim().min(2).max(100),className:z.string().trim().min(1).max(32),source:z.enum(["attendance","assignment","exam","behavior"]),note:z.string().trim().max(240).default("")});
export async function POST(request:Request){
  const session=await getSession();
  if(!session||!(session.role==="admin"||session.role==="teacher"))return jsonError("Administrator or teacher access required",session?403:401);
  if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);
  if(!rateLimit(`game-award:${session.tenantId}:${session.userId}`,30).allowed)return jsonError("Too many award requests",429);
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError("Invalid points award",400,parsed.error.flatten());
  if(session.role==="teacher"&&!schoolScope(session).classes.includes(parsed.data.className))return jsonError("Teachers can award points only in their assigned classes",403);
  const student=db.prepare("SELECT name,class_name className FROM students WHERE tenant_id=? AND name=? AND class_name=?").get(session.tenantId,parsed.data.studentName,parsed.data.className) as {name:string;className:string}|undefined;
  if(!student)return jsonError("Student not found in this school and class",404);
  const settings=getGamificationSettings(session.tenantId);if(!settings.enabled)return jsonError("Gamification is disabled",409);
  const points=pointsForSource(settings,parsed.data.source);
  const result=db.prepare("INSERT INTO gamification_points (tenant_id,student_name,class_name,points,source,note,awarded_by) VALUES (?,?,?,?,?,?,?)").run(session.tenantId,student.name,student.className,points,parsed.data.source,parsed.data.note,session.userId);
  return Response.json({data:{id:Number(result.lastInsertRowid),studentName:student.name,className:student.className,points,source:parsed.data.source}},{status:201});
}
