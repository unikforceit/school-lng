import { z } from "zod";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { markAllNotificationsRead,markNotificationRead,notificationsFor } from "@/lib/notifications";
import { securityOriginValid } from "@/lib/security";

export const dynamic="force-dynamic";
export async function GET(){const session=await getSession();if(!session)return jsonError("Authentication required",401);const rows=notificationsFor(session);return Response.json({data:{notifications:rows,unread:rows.filter(row=>!row.isRead).length}},{headers:{"Cache-Control":"no-store"}})}
const schema=z.union([z.object({id:z.number().int().positive()}),z.object({all:z.literal(true)})]);
export async function PATCH(request:Request){const session=await getSession();if(!session)return jsonError("Authentication required",401);if(!securityOriginValid(request,session.tenantId))return jsonError("Invalid request origin",403);const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return jsonError("Invalid notification update",400);if("all" in body.data)markAllNotificationsRead(session);else if(!markNotificationRead(session,body.data.id))return jsonError("Notification not found",404);return Response.json({data:{updated:true}})}
