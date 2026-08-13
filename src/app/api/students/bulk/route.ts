import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";

const student=z.object({studentId:z.string().trim().min(3).max(32),name:z.string().trim().min(2).max(100),email:z.email().max(150),phone:z.string().trim().max(32).default(""),grade:z.coerce.number().int().min(1).max(12),className:z.string().trim().min(1).max(32),address:z.string().trim().max(240).default(""),gender:z.enum(["female","male","other","unspecified"]).default("unspecified"),bloodType:z.string().trim().max(12).default("Unknown"),photoUrl:z.union([z.url().max(500),z.literal("")]).default("")});
const bulk=z.object({rows:z.array(z.record(z.string(),z.union([z.string(),z.number()]))).min(1).max(500)});

export async function POST(request:Request){
 const session=await getSession();if(!session||session.role!=="admin")return jsonError("Administrator access required",session?403:401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);
 const body=bulk.safeParse(await request.json().catch(()=>null));if(!body.success)return jsonError("Import must contain 1-500 rows",400);
 const rows:Array<z.infer<typeof student>>=[];
 for(let index=0;index<body.data.rows.length;index+=1){const parsed=student.safeParse(body.data.rows[index]);if(!parsed.success)return jsonError("Invalid student data",400,{row:index+2,fields:parsed.error.flatten().fieldErrors});rows.push(parsed.data)}
 try{const insert=db.prepare("INSERT INTO students (student_id,name,email,phone,grade,class_name,address,gender,blood_type,photo_url,tenant_id) VALUES (@studentId,@name,@email,@phone,@grade,@className,@address,@gender,@bloodType,@photoUrl,@tenantId)");db.transaction(()=>{for(const row of rows)insert.run({...row,tenantId:session.tenantId})})();return Response.json({data:{imported:rows.length}},{status:201})}catch(error){return jsonError(error instanceof Error&&error.message.includes("UNIQUE")?"Student ID or email already exists":"Unable to import students",error instanceof Error&&error.message.includes("UNIQUE")?409:500)}
}
