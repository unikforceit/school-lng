import { NextResponse } from "next/server";
import { z } from "zod";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { getClientIp, hasValidOrigin, jsonError, rateLimit } from "@/lib/http";
import { sessionFromUser, signInWithPassword, tokenExpiry } from "@/lib/supabase-auth";

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
  if(!hasValidOrigin(request))return jsonError("Invalid request origin",403);
  const ip=getClientIp(request),email=credentials.email;
  const limit=rateLimit(`login:${tenantId}:${email.toLowerCase()}:${ip}`,30,15*60_000);
  if(!limit.allowed)return jsonError("Account temporarily locked after too many attempts",429,{retryAfter:limit.retryAfter});
  let tokens;
  try{tokens=await signInWithPassword(email,credentials.password)}catch{return jsonError("Invalid credentials",401)}
  const user=sessionFromUser(tokens.user,tokenExpiry(tokens.access_token));
  const permitted=Boolean(user&&user.tenantId===tenantId&&(scope==="platform"?user.role==="superadmin":user.role!=="superadmin"));
  if(!user||!permitted)return jsonError("This account is not assigned to the selected school or role",403);
  const maxAge=Math.max(60,tokens.expires_in||3600);
  const forwardedHttps=request.headers.get("x-forwarded-proto")?.split(",")[0].trim()==="https";
  const isHttps=forwardedHttps||new URL(request.url).protocol==="https:";
  const response=NextResponse.json({data:{email:user.userId,name:user.name,role:user.role,tenantId,redirectTo:user.role==="superadmin"?"/superadmin":`/${user.role}`}});
  response.cookies.set(SESSION_COOKIE,tokens.access_token,{httpOnly:true,secure:isHttps,sameSite:"lax",path:"/",maxAge});
  response.cookies.set(REFRESH_COOKIE,tokens.refresh_token,{httpOnly:true,secure:isHttps,sameSite:"lax",path:"/",maxAge:30*24*60*60});
  return response;
}
