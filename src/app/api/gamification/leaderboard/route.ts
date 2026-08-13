import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getGamificationSettings,schoolScope } from "@/lib/gamification";
import { jsonError } from "@/lib/http";

export const dynamic="force-dynamic";
const schoolRoles=new Set(["admin","teacher","student","parent"]);
const ranking=`SELECT student_name studentName,class_name className,SUM(points) points,COUNT(*) activities FROM gamification_points`;

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return jsonError("Authentication required",401);
  if(!schoolRoles.has(session.role))return jsonError("School account required",403);
  const settings=getGamificationSettings(session.tenantId),scope=schoolScope(session);
  const allClasses=(db.prepare("SELECT DISTINCT class_name className FROM gamification_points WHERE tenant_id=? ORDER BY class_name").all(session.tenantId) as Array<{className:string}>).map(item=>item.className);
  const classes=session.role==="admin"?allClasses:allClasses.filter(item=>scope.classes.includes(item));
  const requestedClass=new URL(request.url).searchParams.get("class")?.trim().slice(0,32)||"";
  const selectedClass=requestedClass&&classes.includes(requestedClass)?requestedClass:classes[0]||"";
  const classLeaderboard=selectedClass?db.prepare(`${ranking} WHERE tenant_id=? AND class_name=? GROUP BY student_name,class_name ORDER BY points DESC,student_name LIMIT 50`).all(session.tenantId,selectedClass):[];
  const globalVisible=session.role==="admin"||settings.globalLeaderboardPublic;
  let overall:unknown[]|null=null;
  if(globalVisible)overall=db.prepare(`${ranking} WHERE tenant_id=? GROUP BY student_name,class_name ORDER BY points DESC,student_name LIMIT 50`).all(session.tenantId);
  else if(session.role==="teacher"&&classes.length){const marks=classes.map(()=>"?").join(",");overall=db.prepare(`${ranking} WHERE tenant_id=? AND class_name IN (${marks}) GROUP BY student_name,class_name ORDER BY points DESC,student_name LIMIT 50`).all(session.tenantId,...classes)}
  const filters=["tenant_id=?"],values:unknown[]=[session.tenantId];
  if(session.role!=="admin"){
    if((session.role==="student"||session.role==="parent")&&scope.studentNames.length){filters.push(`student_name IN (${scope.studentNames.map(()=>"?").join(",")})`);values.push(...scope.studentNames)}
    else if(classes.length){filters.push(`class_name IN (${classes.map(()=>"?").join(",")})`);values.push(...classes)}
    else filters.push("1=0");
  }
  const recent=db.prepare(`SELECT id,student_name studentName,class_name className,points,source,note,created_at createdAt FROM gamification_points WHERE ${filters.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT 12`).all(...values);
  return Response.json({data:{classes,selectedClass,overall,classLeaderboard,recent,settings,globalVisible,canAward:session.role==="admin"||session.role==="teacher",canConfigure:session.role==="admin"}},{headers:{"Cache-Control":"no-store"}});
}
