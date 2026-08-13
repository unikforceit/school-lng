import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getGamificationSettings } from "@/lib/gamification";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

const schema=z.object({enabled:z.boolean(),attendancePoints:z.number().int().min(0).max(500),assignmentPoints:z.number().int().min(0).max(500),examPoints:z.number().int().min(0).max(500),behaviorPoints:z.number().int().min(0).max(500),globalLeaderboardPublic:z.boolean()});
async function admin(){const session=await getSession();return session?.role==="admin"?session:null}
export async function GET(){const session=await admin();return session?Response.json({data:getGamificationSettings(session.tenantId)}):jsonError("Administrator access required",403)}
export async function PUT(request:Request){const session=await admin();if(!session)return jsonError("Administrator access required",403);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError("Invalid gamification settings",400,parsed.error.flatten());const value=parsed.data;db.prepare(`UPDATE gamification_settings SET enabled=?,attendance_points=?,assignment_points=?,exam_points=?,behavior_points=?,global_leaderboard_public=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?`).run(Number(value.enabled),value.attendancePoints,value.assignmentPoints,value.examPoints,value.behaviorPoints,Number(value.globalLeaderboardPublic),session.tenantId);return Response.json({data:getGamificationSettings(session.tenantId)})}
