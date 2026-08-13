import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";
import { schoolScope } from "@/lib/gamification";

export type RiskStatus="on_track"|"at_risk"|"high_risk";
type Student={id:number;studentId:string;name:string;className:string};
type Result={subject?:unknown;student?:unknown;score?:unknown;date?:unknown};
function parse(value:string){try{return JSON.parse(value) as Result}catch{return {}}}

export function allowedStudents(session:Session){
  if(session.role!=="admin"&&session.role!=="teacher")return [] as Student[];
  if(session.role==="admin")return db.prepare("SELECT id,student_id studentId,name,class_name className FROM students WHERE tenant_id=? ORDER BY class_name,name").all(session.tenantId) as Student[];
  const classes=schoolScope(session).classes;if(!classes.length)return [] as Student[];
  return db.prepare(`SELECT id,student_id studentId,name,class_name className FROM students WHERE tenant_id=? AND class_name IN (${classes.map(()=>"?").join(",")}) ORDER BY class_name,name`).all(session.tenantId,...classes) as Student[];
}

export function interventionData(session:Session){
  const students=allowedStudents(session),names=new Set(students.map(item=>item.name));
  const results=(db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='results' ORDER BY updated_at,id").all(session.tenantId) as Array<{payload:string}>).map(row=>parse(row.payload)).filter(row=>names.has(String(row.student||""))&&Number.isFinite(Number(row.score)));
  return students.map(student=>{
    const bySubject=new Map<string,Array<{score:number;date:string}>>();
    for(const result of results.filter(item=>String(item.student)===student.name)){const subject=String(result.subject||"General"),values=bySubject.get(subject)||[];values.push({score:Number(result.score),date:String(result.date||"")});bySubject.set(subject,values)}
    const trends=[...bySubject].map(([subject,values])=>{values.sort((a,b)=>a.date.localeCompare(b.date));const recent=values.slice(-2),previous=values.slice(0,-2),recentAverage=Math.round(recent.reduce((sum,item)=>sum+item.score,0)/Math.max(1,recent.length)),pastAverage=previous.length?Math.round(previous.reduce((sum,item)=>sum+item.score,0)/previous.length):recentAverage;return {subject,recentAverage,pastAverage,change:recentAverage-pastAverage,assessments:values.length}});
    const failing=trends.filter(item=>item.recentAverage<50).length,worstChange=trends.length?Math.min(...trends.map(item=>item.change)):0,lowest=trends.length?Math.min(...trends.map(item=>item.recentAverage)):100;
    const riskStatus:RiskStatus=failing>=2||worstChange<=-20||lowest<45?"high_risk":worstChange<=-8||lowest<65?"at_risk":"on_track";
    const notes=db.prepare("SELECT id,author_email authorEmail,risk_status riskStatus,note,follow_up_at followUpAt,resolved,created_at createdAt,updated_at updatedAt FROM intervention_notes WHERE tenant_id=? AND student_id=? ORDER BY created_at DESC,id DESC").all(session.tenantId,student.id);
    return {...student,riskStatus,trends,notes};
  });
}
