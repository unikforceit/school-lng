import { z } from "zod";
import { getSession } from "@/lib/auth";
import { conversationMessages, deleteConversation, getConversation } from "@/lib/ai-chat";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";
const idSchema=z.uuid();
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return jsonError("Authentication required",401);const id=idSchema.safeParse((await params).id);if(!id.success)return jsonError("Invalid conversation",400);const conversation=getConversation(session,id.data),messages=conversationMessages(session,id.data);if(!conversation||!messages)return jsonError("Conversation not found",404);return Response.json({data:{conversation,messages}},{headers:{"Cache-Control":"no-store"}})}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);const id=idSchema.safeParse((await params).id);if(!id.success)return jsonError("Invalid conversation",400);if(!deleteConversation(session,id.data))return jsonError("Conversation not found",404);return new Response(null,{status:204})}
