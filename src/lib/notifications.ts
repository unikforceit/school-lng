import { db } from "@/lib/db";
import type { Role,Session } from "@/lib/auth";

export type NotificationCategory="academic"|"communication"|"security"|"platform"|"account"|"system";
export type NotificationInput={tenantId:string;roles?:Role[]|"all";userEmail?:string;category?:NotificationCategory;title:string;message:string;link?:string};

export function notify(input:NotificationInput){
 const roles=input.roles==="all"||!input.roles?["all"]:input.roles;
 const insert=db.prepare("INSERT INTO notifications (tenant_id,audience_role,user_email,category,title,message,link) VALUES (?,?,?,?,?,?,?)");
 const transaction=db.transaction(()=>{for(const role of roles)insert.run(input.tenantId,role,input.userEmail?.toLowerCase()||"",input.category||"system",input.title.slice(0,120),input.message.slice(0,500),input.link?.slice(0,300)||"")});transaction();
}

export function notificationsFor(session:Session,limit=40){
 return db.prepare(`SELECT n.id,n.category,n.title,n.message,n.link,n.created_at createdAt,
   CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END isRead
   FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.tenant_id=? AND r.user_email=?
   WHERE n.tenant_id=? AND (n.audience_role='all' OR n.audience_role=?) AND (n.user_email='' OR n.user_email=?)
   ORDER BY n.id DESC LIMIT ?`).all(session.tenantId,session.userId,session.tenantId,session.role,session.userId,limit) as Array<{id:number;category:string;title:string;message:string;link:string;createdAt:string;isRead:number}>;
}

export function latestNotificationId(session:Session){
 const row=db.prepare("SELECT COALESCE(MAX(id),0) id FROM notifications WHERE tenant_id=? AND (audience_role='all' OR audience_role=?) AND (user_email='' OR user_email=?)").get(session.tenantId,session.role,session.userId) as {id:number};return row.id;
}

export function markNotificationRead(session:Session,id:number){
 const visible=db.prepare("SELECT 1 FROM notifications WHERE id=? AND tenant_id=? AND (audience_role='all' OR audience_role=?) AND (user_email='' OR user_email=?)").get(id,session.tenantId,session.role,session.userId);if(!visible)return false;
 db.prepare("INSERT OR IGNORE INTO notification_reads (notification_id,tenant_id,user_email) VALUES (?,?,?)").run(id,session.tenantId,session.userId);return true;
}

export function markAllNotificationsRead(session:Session){
 db.prepare(`INSERT OR IGNORE INTO notification_reads (notification_id,tenant_id,user_email)
   SELECT id,?,? FROM notifications WHERE tenant_id=? AND (audience_role='all' OR audience_role=?) AND (user_email='' OR user_email=?)`).run(session.tenantId,session.userId,session.tenantId,session.role,session.userId);
}
