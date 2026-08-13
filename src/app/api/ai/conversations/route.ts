import { z } from "zod";
import { getSession } from "@/lib/auth";
import { clearConversations, createConversation, listConversations } from "@/lib/ai-chat";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";
const createSchema=z.object({title:z.string().trim().max(80).optional()});
export async function GET(){const session=await getSession();if(!session)return jsonError("Authentication required",401);return Response.json({data:listConversations(session)},{headers:{"Cache-Control":"no-store"}})}
export async function POST(request:Request){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);const parsed=createSchema.safeParse(await request.json().catch(()=>({})));if(!parsed.success)return jsonError("Invalid conversation",400);return Response.json({data:createConversation(session,parsed.data.title)},{status:201})}
export async function DELETE(request:Request){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);return Response.json({data:{deleted:clearConversations(session)}})}
