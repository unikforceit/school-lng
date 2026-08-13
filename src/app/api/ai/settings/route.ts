import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptApiKey, getAiSettings } from "@/lib/ai-settings";
import { jsonError } from "@/lib/http";
import { NextResponse } from "next/server";
import { securityOriginValid } from "@/lib/security";
const schema=z.object({apiKey:z.string().trim().max(500).optional(),model:z.string().trim().min(3).max(150),enabled:z.boolean(),floatingEnabled:z.boolean(),allowAdmin:z.boolean(),allowTeacher:z.boolean(),allowStudent:z.boolean(),allowParent:z.boolean()});
async function admin(){const s=await getSession();return s?.role==="admin"?s:null}
export async function GET(){const s=await admin();if(!s)return jsonError("Administrator access required",403);return NextResponse.json({data:getAiSettings(s.tenantId)});}
export async function PUT(request:Request){const s=await admin();if(!s)return jsonError("Administrator access required",403);if(!securityOriginValid(request,s.tenantId))return jsonError("Invalid request origin",403);const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return jsonError("Invalid AI settings",400,p.error.flatten());const d=p.data;db.prepare(`UPDATE ai_settings SET model=?,enabled=?,floating_enabled=?,allow_admin=?,allow_teacher=?,allow_student=?,allow_parent=?,api_key_encrypted=CASE WHEN ?='' THEN api_key_encrypted ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?`).run(d.model,+d.enabled,+d.floatingEnabled,+d.allowAdmin,+d.allowTeacher,+d.allowStudent,+d.allowParent,d.apiKey||"",d.apiKey?encryptApiKey(d.apiKey):"",s.tenantId);return NextResponse.json({data:getAiSettings(s.tenantId)});}
