import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Role } from "@/lib/auth";

export type AiSettings = { model:string; enabled:boolean; floatingEnabled:boolean; allowAdmin:boolean; allowTeacher:boolean; allowStudent:boolean; allowParent:boolean; hasApiKey:boolean };
type Row = { api_key_encrypted:string; model:string; enabled:number; floating_enabled:number; allow_admin:number; allow_teacher:number; allow_student:number; allow_parent:number };
const key = () => createHash("sha256").update(process.env.AUTH_SECRET || "development-only-change-this-secret-before-production").digest();
export function encryptApiKey(value:string) { const iv=randomBytes(12); const cipher=createCipheriv("aes-256-gcm",key(),iv); const body=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]); return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),body.toString("base64url")].join("."); }
export function decryptApiKey(value:string) { if(!value) return ""; try { const [i,t,b]=value.split("."); const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(i,"base64url")); decipher.setAuthTag(Buffer.from(t,"base64url")); return Buffer.concat([decipher.update(Buffer.from(b,"base64url")),decipher.final()]).toString("utf8"); } catch { return ""; } }
export function getAiSettings(tenantId:string) { db.prepare("INSERT OR IGNORE INTO ai_settings (tenant_id) VALUES (?)").run(tenantId); const r=db.prepare("SELECT * FROM ai_settings WHERE tenant_id=?").get(tenantId) as Row; return { model:r.model,enabled:!!r.enabled,floatingEnabled:!!r.floating_enabled,allowAdmin:!!r.allow_admin,allowTeacher:!!r.allow_teacher,allowStudent:!!r.allow_student,allowParent:!!r.allow_parent,hasApiKey:!!r.api_key_encrypted||!!process.env.OPENROUTER_API_KEY } satisfies AiSettings; }
export function getAiSecret(tenantId:string) { const r=db.prepare("SELECT api_key_encrypted FROM ai_settings WHERE tenant_id=?").get(tenantId) as {api_key_encrypted:string}|undefined; return decryptApiKey(r?.api_key_encrypted||"") || process.env.OPENROUTER_API_KEY || ""; }
export function roleAllowed(s:AiSettings, role:Role) { return s.enabled && ({superadmin:s.allowAdmin,admin:s.allowAdmin,teacher:s.allowTeacher,student:s.allowStudent,parent:s.allowParent})[role]; }

export type OpenRouterModel={id:string;name:string;contextLength:number;free:boolean;promptPrice:string;completionPrice:string};
export async function fetchOpenRouterModels(apiKey:string){
  const response=await fetch("https://openrouter.ai/api/v1/models",{headers:{Authorization:`Bearer ${apiKey}`,"HTTP-Referer":process.env.NEXT_PUBLIC_APP_URL??"http://localhost:6969","X-Title":"SIME SAGE"},cache:"no-store",signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error(response.status===401?"The OpenRouter API key is invalid.":`OpenRouter connection failed (${response.status}).`);
  const payload=await response.json() as {data?:Array<{id?:string;name?:string;context_length?:number;pricing?:{prompt?:string;completion?:string}}>};
  return (payload.data??[]).filter(item=>item.id).map(item=>{const prompt=String(item.pricing?.prompt??""),completion=String(item.pricing?.completion??"");return {id:item.id!,name:item.name||item.id!,contextLength:Number(item.context_length)||0,free:Number(prompt)===0&&Number(completion)===0,promptPrice:prompt,completionPrice:completion} satisfies OpenRouterModel}).sort((a,b)=>Number(b.free)-Number(a.free)||a.name.localeCompare(b.name));
}
