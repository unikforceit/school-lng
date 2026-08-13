import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";
import { canWriteResource, readableResourceTypes, resourceConfig, resourcePayloadSchema, resourceTypeSchema, type ResourceType } from "@/lib/resources";

export type AiMessage={id:number;role:"user"|"assistant";content:string;model:string;actions:Array<Record<string,unknown>>;createdAt:string};
export type AiConversation={id:string;title:string;createdAt:string;updatedAt:string};
export type ToolCall={id:string;type:"function";function:{name:string;arguments:string}};
export type ExecutedAction={tool:string;ok:boolean;message:string;href?:string;recordId?:number};

const studentSchema=z.object({studentId:z.string().trim().min(3).max(32),name:z.string().trim().min(2).max(100),email:z.email().max(150),phone:z.string().trim().max(32).default(""),grade:z.coerce.number().int().min(1).max(12),className:z.string().trim().min(1).max(32),address:z.string().trim().max(240).default(""),gender:z.enum(["female","male","other","unspecified"]).default("unspecified")});

export function createConversation(session:Session,title="New conversation"){
  const id=randomUUID();
  db.prepare("INSERT INTO ai_conversations (id,tenant_id,user_email,title) VALUES (?,?,?,?)").run(id,session.tenantId,session.userId,title.trim().slice(0,80)||"New conversation");
  return getConversation(session,id)!;
}
export function getConversation(session:Session,id:string){return db.prepare("SELECT id,title,created_at createdAt,updated_at updatedAt FROM ai_conversations WHERE id=? AND tenant_id=? AND user_email=?").get(id,session.tenantId,session.userId) as AiConversation|undefined}
export function listConversations(session:Session){return db.prepare("SELECT id,title,created_at createdAt,updated_at updatedAt FROM ai_conversations WHERE tenant_id=? AND user_email=? ORDER BY updated_at DESC LIMIT 50").all(session.tenantId,session.userId) as AiConversation[]}
export function conversationMessages(session:Session,id:string,limit=100){if(!getConversation(session,id))return null;const rows=db.prepare("SELECT id,role,content,model,action_json actions,created_at createdAt FROM ai_messages WHERE conversation_id=? AND tenant_id=? AND user_email=? ORDER BY id DESC LIMIT ?").all(id,session.tenantId,session.userId,limit) as Array<Omit<AiMessage,"actions">&{actions:string}>;return rows.reverse().map(row=>({...row,actions:JSON.parse(row.actions) as Array<Record<string,unknown>>}))}
export function saveMessage(session:Session,conversationId:string,role:"user"|"assistant",content:string,model="",actions:ExecutedAction[]=[]){
  const result=db.prepare("INSERT INTO ai_messages (conversation_id,tenant_id,user_email,role,content,model,action_json) VALUES (?,?,?,?,?,?,?)").run(conversationId,session.tenantId,session.userId,role,content,model,JSON.stringify(actions));
  if(role==="user")db.prepare("UPDATE ai_conversations SET title=CASE WHEN title='New conversation' THEN ? ELSE title END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND user_email=?").run(content.replace(/\s+/g," ").slice(0,64),conversationId,session.tenantId,session.userId);
  else db.prepare("UPDATE ai_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND user_email=?").run(conversationId,session.tenantId,session.userId);
  return Number(result.lastInsertRowid);
}
export function deleteConversation(session:Session,id:string){return db.prepare("DELETE FROM ai_conversations WHERE id=? AND tenant_id=? AND user_email=?").run(id,session.tenantId,session.userId).changes>0}
export function clearConversations(session:Session){return db.prepare("DELETE FROM ai_conversations WHERE tenant_id=? AND user_email=?").run(session.tenantId,session.userId).changes}

function resourceRows(session:Session,type:ResourceType){
  const rows=db.prepare("SELECT title,payload FROM resources WHERE tenant_id=? AND resource_type=? ORDER BY updated_at DESC LIMIT 30").all(session.tenantId,type) as Array<{title:string;payload:string}>;
  let children:string[]=[];
  if(session.role==="parent"){const own=db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='parents' AND title=?").get(session.tenantId,session.name) as {payload:string}|undefined;children=own?String((JSON.parse(own.payload) as Record<string,unknown>).students||"").split(",").map(v=>v.trim()).filter(Boolean):[]}
  return rows.map(row=>({title:row.title,payload:JSON.parse(row.payload) as Record<string,string|number>})).filter(row=>{
    if(session.role==="admin"||session.role==="teacher")return true;
    if(["results","attendance"].includes(type)){const student=String(row.payload.student||"");return session.role==="student"?student===session.name:children.includes(student)}
    if(type==="messages"){const recipient=String(row.payload.recipient||"").toLowerCase();return ["all","all users",session.name.toLowerCase(),session.role,`${session.role}s`].includes(recipient)}
    return true;
  }).map(row=>{if(type==="teachers"&&(session.role==="student"||session.role==="parent")){const {email,phone,address,...safe}=row.payload;void email;void phone;void address;return {...row,payload:safe}}return row});
}

export function buildSchoolContext(session:Session){
  const tenant=db.prepare("SELECT name,plan,license_status licenseStatus FROM tenants WHERE id=?").get(session.tenantId) as Record<string,string>|undefined;
  const allowed=readableResourceTypes(session.role);
  const resources=Object.fromEntries(allowed.map(type=>[type,resourceRows(session,type)]));
  let students:unknown[]=[];
  if(session.role==="admin"||session.role==="teacher")students=db.prepare("SELECT student_id studentId,name,email,phone,grade,class_name className,address,gender FROM students WHERE tenant_id=? ORDER BY name LIMIT 100").all(session.tenantId);
  else if(session.role==="student")students=db.prepare("SELECT student_id studentId,name,email,phone,grade,class_name className,address,gender FROM students WHERE tenant_id=? AND name=? LIMIT 1").all(session.tenantId,session.name);
  else if(session.role==="parent"){const parent=resourceRows(session,"parents" as ResourceType).find(row=>row.title===session.name);const names=String(parent?.payload.students||"").split(",").map(v=>v.trim()).filter(Boolean);if(names.length){const placeholders=names.map(()=>"?").join(",");students=db.prepare(`SELECT student_id studentId,name,grade,class_name className,gender FROM students WHERE tenant_id=? AND name IN (${placeholders})`).all(session.tenantId,...names)}}
  return JSON.stringify({school:tenant,currentUser:{name:session.name,role:session.role},students,resources});
}

export function localDatabaseAnswer(session:Session,message:string){
  const context=JSON.parse(buildSchoolContext(session)) as {school?:{name?:string};students?:Array<Record<string,unknown>>;resources?:Record<string,Array<{title:string;payload:Record<string,unknown>}>>},query=message.toLowerCase(),resources=context.resources??{};
  const heading="OpenRouter is temporarily unavailable, so I used SIME's secure local database summary instead.";
  if(query.includes("assignment")){const rows=resources.assignments??[];return `${heading}\n\nAssignments (${rows.length}):${rows.length?`\n${rows.slice(0,12).map(row=>`• ${row.title} — ${String(row.payload.class||"No class")} — due ${String(row.payload.dueDate||"not set")}`).join("\n")}`:" No authorized assignment records were found."}`}
  if(query.includes("attendance")){const rows=resources.attendance??[],present=rows.filter(row=>String(row.payload.status).toLowerCase()==="present").length;return `${heading}\n\nAttendance: ${rows.length} authorized records; ${present} marked present and ${rows.length-present} with another status.${rows.length?`\n${rows.slice(0,10).map(row=>`• ${row.title}: ${String(row.payload.status||"Unknown")} on ${String(row.payload.date||"date unavailable")}`).join("\n")}`:""}`}
  if(query.includes("result")||query.includes("score")||query.includes("grade")){const rows=resources.results??[],scores=rows.map(row=>Number(row.payload.score)).filter(Number.isFinite),average=scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length):null;return `${heading}\n\nResults: ${rows.length} authorized records${average===null?"":`; average score ${average}%`}.${rows.length?`\n${rows.slice(0,10).map(row=>`• ${row.title}: ${String(row.payload.subject||"Subject")} — ${String(row.payload.score??"No score")}`).join("\n")}`:""}`}
  if(query.includes("student")){const rows=context.students??[];return `${heading}\n\nStudents (${rows.length} authorized profiles):${rows.length?`\n${rows.slice(0,20).map(row=>`• ${String(row.name||"Unknown")} — ${String(row.className||"No class")} — ID ${String(row.studentId||"unavailable")}`).join("\n")}`:" No student profiles are available to your role."}`}
  const counts=Object.entries(resources).map(([type,rows])=>`${type}: ${rows.length}`).join(", ");return `${heading}\n\n${context.school?.name||"Your school"} overview for ${session.name} (${session.role}): ${context.students?.length??0} authorized student profiles. Available record counts: ${counts||"none"}. Ask specifically about assignments, attendance, results, or students for more detail.`;
}

export function availableTools(session:Session){
  const tools:Array<Record<string,unknown>>=[];
  if(session.role==="admin")tools.push({type:"function",function:{name:"create_student",description:"Create a student in this school after the user supplies all required details. Only administrators can use this.",parameters:{type:"object",additionalProperties:false,properties:{studentId:{type:"string",description:"Unique school student ID"},name:{type:"string"},email:{type:"string"},phone:{type:"string"},grade:{type:"integer",minimum:1,maximum:12},className:{type:"string"},address:{type:"string"},gender:{type:"string",enum:["female","male","other","unspecified"]}},required:["studentId","name","email","grade","className"]}}});
  const writable=readableResourceTypes(session.role).filter(type=>canWriteResource(session.role,type));
  for(const type of writable){const config=resourceConfig[type],properties=Object.fromEntries(config.fields.map(field=>[field.name,{type:field.type==="number"?"number":"string",description:field.label}]));tools.push({type:"function",function:{name:`create_${type}`,description:`Create one ${config.title.toLowerCase()} record only when the user explicitly asks to add or create it and provides the required fields.`,parameters:{type:"object",additionalProperties:false,properties,required:config.fields.filter(field=>field.required).map(field=>field.name)}}})}
  return tools;
}

function audit(session:Session,conversationId:string,action:string,targetType:string,targetId:string,args:unknown,status:"success"|"denied"|"error"){db.prepare("INSERT INTO ai_action_audit (tenant_id,user_email,conversation_id,action,target_type,target_id,arguments_json,status) VALUES (?,?,?,?,?,?,?,?)").run(session.tenantId,session.userId,conversationId,action,targetType,targetId,JSON.stringify(args),status)}
export function executeTool(session:Session,conversationId:string,call:ToolCall):ExecutedAction{
  let args:unknown={};try{args=JSON.parse(call.function.arguments||"{}")}catch{return {tool:call.function.name,ok:false,message:"The AI produced invalid action data; nothing was changed."}}
  if(call.function.name==="create_student"){
    if(session.role!=="admin"){audit(session,conversationId,"create_student","student","",args,"denied");return {tool:"create_student",ok:false,message:"Permission denied: only administrators can create students."}}
    const parsed=studentSchema.safeParse(args);if(!parsed.success){audit(session,conversationId,"create_student","student","",args,"error");return {tool:"create_student",ok:false,message:`Student was not created. Missing or invalid fields: ${parsed.error.issues.map(issue=>issue.path.join(".")).join(", ")}.`}}
    try{const result=db.prepare("INSERT INTO students (tenant_id,student_id,name,email,phone,grade,class_name,address,gender) VALUES (@tenantId,@studentId,@name,@email,@phone,@grade,@className,@address,@gender)").run({...parsed.data,tenantId:session.tenantId});const id=Number(result.lastInsertRowid);audit(session,conversationId,"create_student","student",String(id),parsed.data,"success");return {tool:"create_student",ok:true,message:`Created student ${parsed.data.name} (${parsed.data.studentId}) in class ${parsed.data.className}.`,href:`/list/students/${id}`,recordId:id}}catch(error){const message=error instanceof Error&&error.message.includes("UNIQUE")?"Student ID or email already exists.":"The student could not be created.";audit(session,conversationId,"create_student","student","",args,"error");return {tool:"create_student",ok:false,message}}
  }
  if(call.function.name.startsWith("create_")){
    const type=resourceTypeSchema.safeParse(call.function.name.slice(7));if(!type.success||!canWriteResource(session.role,type.data)){audit(session,conversationId,call.function.name,type.success?type.data:"unknown","",args,"denied");return {tool:call.function.name,ok:false,message:"Permission denied for that record type."}}
    const payload=resourcePayloadSchema.safeParse(args);if(!payload.success){audit(session,conversationId,call.function.name,type.data,"",args,"error");return {tool:call.function.name,ok:false,message:"The record fields are invalid or incomplete."}}
    const config=resourceConfig[type.data],clean=Object.fromEntries(config.fields.filter(field=>field.name in payload.data).map(field=>[field.name,payload.data[field.name]])) as Record<string,string|number>;const missing=config.fields.filter(field=>field.required&&String(clean[field.name]??"").trim()==="");if(missing.length){audit(session,conversationId,call.function.name,type.data,"",args,"error");return {tool:call.function.name,ok:false,message:`Record was not created. Required fields: ${missing.map(field=>field.label).join(", ")}.`}}
    const title=String(clean[config.primary]??config.title).slice(0,150),result=db.prepare("INSERT INTO resources (tenant_id,resource_type,title,payload) VALUES (?,?,?,?)").run(session.tenantId,type.data,title,JSON.stringify(clean)),id=Number(result.lastInsertRowid);audit(session,conversationId,call.function.name,type.data,String(id),clean,"success");return {tool:call.function.name,ok:true,message:`Created ${config.title.toLowerCase()} record “${title}”.`,href:`/list/${type.data}?q=${encodeURIComponent(title)}`,recordId:id};
  }
  audit(session,conversationId,call.function.name,"unknown","",args,"denied");return {tool:call.function.name,ok:false,message:"Unknown action. Nothing was changed."};
}
