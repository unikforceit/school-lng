import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { schoolScope } from "@/lib/gamification";
import { jsonError } from "@/lib/http";

type Student={id:number;name:string;className:string};
type ResultRow={payload:string};
type Result={subject?:unknown;student?:unknown;score?:unknown;date?:unknown};
function parse(value:string){try{return JSON.parse(value) as Result}catch{return {}}}

export async function GET(){
  const session=await getSession();if(!session)return jsonError("Authentication required",401);if(session.role==="superadmin")return jsonError("School account required",403);
  const scope=schoolScope(session);let students:Student[]=[];
  if(session.role==="admin")students=db.prepare("SELECT id,name,class_name className FROM students WHERE tenant_id=? ORDER BY name").all(session.tenantId) as Student[];
  else if(scope.studentNames.length){const marks=scope.studentNames.map(()=>"?").join(",");students=db.prepare(`SELECT id,name,class_name className FROM students WHERE tenant_id=? AND name IN (${marks}) ORDER BY name`).all(session.tenantId,...scope.studentNames) as Student[]}
  else if(scope.classes.length){const marks=scope.classes.map(()=>"?").join(",");students=db.prepare(`SELECT id,name,class_name className FROM students WHERE tenant_id=? AND class_name IN (${marks}) ORDER BY class_name,name`).all(session.tenantId,...scope.classes) as Student[]}
  const names=new Set(students.map(item=>item.name));
  const rows=(db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='results' ORDER BY updated_at,id").all(session.tenantId) as ResultRow[]).map(row=>parse(row.payload)).filter(row=>names.has(String(row.student||"")));
  const data=students.map(student=>{
    const subjects=new Map<string,{xp:number;latestScore:number;assessments:number}>();
    for(const row of rows.filter(item=>String(item.student)===student.name)){
      const subject=String(row.subject||"General"),score=Number(row.score);if(!Number.isFinite(score))continue;
      const current=subjects.get(subject)||{xp:0,latestScore:0,assessments:0};current.xp+=Math.max(0,Math.round(score));current.latestScore=score;current.assessments++;subjects.set(subject,current);
    }
    const ranked=db.prepare("SELECT student_name studentName,SUM(points) points FROM gamification_points WHERE tenant_id=? AND class_name=? GROUP BY student_name ORDER BY points DESC,student_name").all(session.tenantId,student.className) as Array<{studentName:string;points:number}>;
    const rank=ranked.findIndex(item=>item.studentName===student.name)+1;
    return {id:student.id,name:student.name,className:student.className,classRank:rank||null,classSize:ranked.length,subjects:[...subjects].map(([subject,item])=>({subject,level:Math.floor(item.xp/500)+1,currentXp:item.xp%500,targetXp:500,totalXp:item.xp,latestScore:item.latestScore,assessments:item.assessments}))};
  });
  return Response.json({data:{students:data,scope:session.role==="admin"?"school":session.role==="teacher"?"assigned_classes":"own"}},{headers:{"Cache-Control":"no-store"}});
}
