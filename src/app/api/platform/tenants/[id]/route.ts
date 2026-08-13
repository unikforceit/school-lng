import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { auditPlatform, requirePlatform, schoolSelect } from "@/lib/platform";

const idSchema=z.string().regex(/^[a-z0-9-]{3,40}$/);
const bodySchema=z.object({active:z.boolean().optional(),name:z.string().trim().min(2).max(100).optional(),contactEmail:z.email().max(150).optional(),plan:z.enum(["starter","growth","enterprise"]).optional(),licenseStatus:z.enum(["trial","active","expired","suspended"]).optional(),licenseExpiresAt:z.string().date().nullable().optional(),maxStudents:z.number().int().min(1).max(1000000).optional(),maxUsers:z.number().int().min(1).max(100000).optional()}).refine(value=>Object.keys(value).length>0);
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const auth=await requirePlatform();if("error" in auth)return auth.error;const id=idSchema.safeParse((await params).id);if(!id.success||id.data==="platform")return jsonError("Invalid school",400);const school=db.prepare(`${schoolSelect} WHERE t.id=? AND t.id!='platform'`).get(id.data);if(!school)return jsonError("School not found",404);const users=db.prepare("SELECT id,email,name,role,active,created_at createdAt FROM users WHERE tenant_id=? ORDER BY role,name").all(id.data);return Response.json({data:{school,users,recent:[]}},{headers:{"Cache-Control":"no-store"}})}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requirePlatform(request);if("error" in auth)return auth.error;
  const id=idSchema.safeParse((await params).id);const body=bodySchema.safeParse(await request.json().catch(()=>null));if(!id.success||id.data==="platform"||!body.success)return jsonError("Invalid school update",400);
  const current=db.prepare("SELECT * FROM tenants WHERE id=? AND id!='platform'").get(id.data) as Record<string,unknown>|undefined;if(!current)return jsonError("School not found",404);
  const next={active:body.data.active===undefined?Number(current.active):Number(body.data.active),name:body.data.name??String(current.name),contactEmail:body.data.contactEmail?.toLowerCase()??String(current.contact_email),plan:body.data.plan??String(current.plan),licenseStatus:body.data.licenseStatus??String(current.license_status),licenseExpiresAt:body.data.licenseExpiresAt===undefined?current.license_expires_at:body.data.licenseExpiresAt,maxStudents:body.data.maxStudents??Number(current.max_students),maxUsers:body.data.maxUsers??Number(current.max_users)};
  db.prepare("UPDATE tenants SET active=@active,name=@name,contact_email=@contactEmail,plan=@plan,license_status=@licenseStatus,license_expires_at=@licenseExpiresAt,max_students=@maxStudents,max_users=@maxUsers WHERE id=@id AND id!='platform'").run({...next,id:id.data});auditPlatform(auth.session.userId,"school.updated",id.data,body.data);
  return Response.json({data:{id:id.data,...next}});
}
