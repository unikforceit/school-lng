import { scryptSync, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { auditPlatform, requirePlatform, schoolSelect } from "@/lib/platform";

const createSchema=z.object({id:z.string().regex(/^[a-z0-9-]{3,40}$/),name:z.string().trim().min(2).max(100),contactEmail:z.email().max(150),adminName:z.string().trim().min(2).max(100),adminEmail:z.email().max(150),adminPassword:z.string().min(12).max(200),plan:z.enum(["starter","growth","enterprise"]),trialDays:z.number().int().min(1).max(365).default(30),maxStudents:z.number().int().min(1).max(1000000),maxUsers:z.number().int().min(1).max(100000)});
function passwordHash(password:string){const salt=randomBytes(16).toString("hex");return `${salt}:${scryptSync(password,salt,64).toString("hex")}`}

export async function GET(){const auth=await requirePlatform();if("error" in auth)return auth.error;const schools=db.prepare(`${schoolSelect} WHERE t.id!='platform' ORDER BY t.name`).all();return Response.json({data:schools},{headers:{"Cache-Control":"no-store"}})}
export async function POST(request:Request){
  const auth=await requirePlatform(request);if("error" in auth)return auth.error;
  const settings=db.prepare("SELECT allow_new_schools allowNewSchools FROM platform_settings WHERE id=1").get() as {allowNewSchools:number}|undefined;if(!settings?.allowNewSchools)return jsonError("New school provisioning is disabled in platform settings",403);
  const body=createSchema.safeParse(await request.json().catch(()=>null));if(!body.success)return jsonError("Invalid school information",400,body.error.flatten());
  try{db.transaction(()=>{db.prepare(`INSERT INTO tenants (id,name,active,plan,license_status,license_starts_at,license_expires_at,max_students,max_users,contact_email) VALUES (?,?,1,?,'trial',datetime('now'),datetime('now',?),?,?,?)`).run(body.data.id,body.data.name,body.data.plan,`+${body.data.trialDays} days`,body.data.maxStudents,body.data.maxUsers,body.data.contactEmail.toLowerCase());db.prepare("INSERT INTO users (tenant_id,email,name,role,password_hash) VALUES (?,?,?,'admin',?)").run(body.data.id,body.data.adminEmail.toLowerCase(),body.data.adminName,passwordHash(body.data.adminPassword));db.prepare("INSERT INTO security_settings (tenant_id) VALUES (?)").run(body.data.id);db.prepare("INSERT INTO ai_settings (tenant_id) VALUES (?)").run(body.data.id);db.prepare("INSERT INTO gamification_settings (tenant_id) VALUES (?)").run(body.data.id);auditPlatform(auth.session.userId,"school.created",body.data.id,{plan:body.data.plan,trialDays:body.data.trialDays})})();return Response.json({data:{id:body.data.id}},{status:201})}catch(error){return jsonError(error instanceof Error&&error.message.includes("UNIQUE")?"School ID or administrator email already exists":"Unable to create school",error instanceof Error&&error.message.includes("UNIQUE")?409:500)}
}
