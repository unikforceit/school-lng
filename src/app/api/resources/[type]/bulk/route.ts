import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";
import { canWriteResource,resourceConfig,resourcePayloadSchema,resourceTypeSchema } from "@/lib/resources";
import { schoolScope } from "@/lib/gamification";
import { activeAcademicYearId } from "@/lib/academic-years";

export const runtime="nodejs";export const dynamic="force-dynamic";
const bulkSchema=z.object({rows:z.array(resourcePayloadSchema).min(1).max(500)});
export async function POST(request:Request,context:{params:Promise<{type:string}>}){
 const session=await getSession();if(!session)return jsonError("Authentication required",401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);
 const type=resourceTypeSchema.safeParse((await context.params).type);if(!type.success)return jsonError("Unknown resource type",404);if(!canWriteResource(session.role,type.data))return jsonError("This role cannot import this resource",403);
 const parsed=bulkSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return jsonError("Import must contain 1-500 valid rows",400,parsed.error.flatten());const config=resourceConfig[type.data],scope=session.role==="teacher"?schoolScope(session):null;
 const prepared:Array<{title:string;payload:Record<string,string|number>}>=[];
 for(let index=0;index<parsed.data.rows.length;index+=1){const source=parsed.data.rows[index],payload=Object.fromEntries(config.fields.filter(field=>field.name in source).map(field=>[field.name,field.type==="number"?Number(source[field.name]):source[field.name]])) as Record<string,string|number>;const missing=config.fields.filter(field=>field.required&&String(payload[field.name]??"").trim()==="");if(missing.length)return jsonError("Required fields are missing",400,{row:index+2,fields:missing.map(field=>field.name)});if(config.fields.some(field=>field.type==="number"&&field.name in payload&&!Number.isFinite(payload[field.name])))return jsonError("A numeric field is invalid",400,{row:index+2});const recordClass=String(payload.class||"");if(scope&&recordClass&&recordClass.toLowerCase()!=="all"&&!scope.classes.includes(recordClass))return jsonError("Teachers can import only records for assigned classes",403,{row:index+2});prepared.push({title:String(payload[config.primary]??config.title).slice(0,150),payload})}
 const academicYearId=activeAcademicYearId(session.tenantId);const insert=db.prepare("INSERT INTO resources (tenant_id,resource_type,title,payload,academic_year_id) VALUES (?,?,?,?,?)");db.transaction(()=>{for(const row of prepared)insert.run(session.tenantId,type.data,row.title,JSON.stringify(row.payload),academicYearId)})();return Response.json({data:{imported:prepared.length,academicYearId}},{status:201});
}
