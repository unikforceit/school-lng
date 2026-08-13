import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClientIp, jsonError } from "@/lib/http";
import { getSecuritySettings, isLoginLocked, recordLoginAttempt, securityOriginValid } from "@/lib/security";

const schoolSchema=z.object({email:z.email().max(150),password:z.string().min(8).max(200),tenantId:z.string().regex(/^[a-z0-9-]{3,40}$/)});
const platformSchema=z.object({email:z.email().max(150),password:z.string().min(8).max(200)});

export async function handleLogin(request:Request,scope:"school"|"platform"){
  const input=await request.json().catch(()=>null);
  const schoolInput=scope==="school"?schoolSchema.safeParse(input):null;
  const platformInput=scope==="platform"?platformSchema.safeParse(input):null;
  if((schoolInput&&!schoolInput.success)||(platformInput&&!platformInput.success))return jsonError("Invalid credentials",401);
  const credentials=schoolInput?.success?schoolInput.data:platformInput?.success?platformInput.data:null;
  if(!credentials)return jsonError("Invalid credentials",401);
  const tenantId=schoolInput?.success?schoolInput.data.tenantId:"platform";
  if(scope==="school"&&tenantId==="platform")return jsonError("Use the platform administrator sign-in page",403);
  const tenant=db.prepare("SELECT id FROM tenants WHERE id=? AND active=1").get(tenantId);
  if(!tenant)return jsonError("Invalid credentials",401);
  if(scope==="school"){
    const platformSettings=db.prepare("SELECT maintenance_mode maintenanceMode FROM platform_settings WHERE id=1").get() as {maintenanceMode:number}|undefined;
    if(platformSettings?.maintenanceMode)return jsonError("School access is temporarily unavailable during scheduled maintenance",503);
  }
  const settings=getSecuritySettings(tenantId);
  if(!securityOriginValid(request,tenantId))return jsonError("Invalid request origin",403);
  const ip=getClientIp(request),email=credentials.email;
  if(isLoginLocked(tenantId,email,ip,settings))return jsonError("Account temporarily locked after too many attempts",429,{retryAfter:settings.lockoutMinutes*60});
  const user=authenticateUser(tenantId,email,credentials.password);
  const permitted=Boolean(user&&(scope==="platform"?user.role==="superadmin":user.role!=="superadmin"));
  recordLoginAttempt(tenantId,email,ip,permitted,settings.auditLogging);
  if(!user||!permitted)return jsonError("Invalid credentials",401);
  const maxAge=settings.sessionHours*60*60;
  const forwardedHttps=request.headers.get("x-forwarded-proto")?.split(",")[0].trim()==="https";
  const isHttps=forwardedHttps||new URL(request.url).protocol==="https:";
  const response=NextResponse.json({data:{email:user.email,name:user.name,role:user.role,tenantId,redirectTo:user.role==="superadmin"?"/superadmin":`/${user.role}`}});
  response.cookies.set(SESSION_COOKIE,createSessionToken({userId:user.email,name:user.name,role:user.role,tenantId,exp:Date.now()+maxAge*1000}),{httpOnly:true,secure:settings.secureCookies&&isHttps,sameSite:"lax",path:"/",maxAge});
  return response;
}
