import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";

export type GamificationSettings={enabled:boolean;attendancePoints:number;assignmentPoints:number;examPoints:number;behaviorPoints:number;globalLeaderboardPublic:boolean;updatedAt:string};

export function getGamificationSettings(tenantId:string):GamificationSettings{
  db.prepare("INSERT OR IGNORE INTO gamification_settings (tenant_id) VALUES (?)").run(tenantId);
  const row=db.prepare(`SELECT enabled,attendance_points attendancePoints,assignment_points assignmentPoints,exam_points examPoints,behavior_points behaviorPoints,global_leaderboard_public globalLeaderboardPublic,updated_at updatedAt FROM gamification_settings WHERE tenant_id=?`).get(tenantId) as Record<string,number|string>;
  return {...row,enabled:Boolean(row.enabled),globalLeaderboardPublic:Boolean(row.globalLeaderboardPublic)} as GamificationSettings;
}

function list(value:unknown){return String(value||"").split(",").map(item=>item.trim()).filter(Boolean)}
function payload(value:string){try{return JSON.parse(value) as Record<string,unknown>}catch{return {}}}

export type SchoolScope={classes:string[];studentNames:string[];subjects:string[]};
export function schoolScope(session:Session):SchoolScope{
  if(session.role==="admin")return {classes:(db.prepare("SELECT DISTINCT class_name value FROM students WHERE tenant_id=? ORDER BY value").all(session.tenantId) as Array<{value:string}>).map(row=>row.value),studentNames:[],subjects:[]};
  if(session.role==="teacher"){
    const rows=db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='teachers' AND (title=? OR payload LIKE ?)").all(session.tenantId,session.name,`%${session.userId}%`) as Array<{payload:string}>;
    const values=rows.map(row=>payload(row.payload));
    return {classes:[...new Set(values.flatMap(row=>list(row.classes)))],studentNames:[],subjects:[...new Set(values.flatMap(row=>list(row.subjects)))]};
  }
  if(session.role==="student"){
    const row=db.prepare("SELECT name,class_name className FROM students WHERE tenant_id=? AND (email=? OR name=?)").get(session.tenantId,session.userId,session.name) as {name:string;className:string}|undefined;
    return {classes:row?[row.className]:[],studentNames:row?[row.name]:[],subjects:[]};
  }
  if(session.role==="parent"){
    const row=db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='parents' AND (title=? OR payload LIKE ?)").get(session.tenantId,session.name,`%${session.userId}%`) as {payload:string}|undefined;
    const names=row?list(payload(row.payload).students):[];
    if(!names.length)return {classes:[],studentNames:[],subjects:[]};
    const placeholders=names.map(()=>"?").join(",");
    const classes=(db.prepare(`SELECT DISTINCT class_name value FROM students WHERE tenant_id=? AND name IN (${placeholders})`).all(session.tenantId,...names) as Array<{value:string}>).map(item=>item.value);
    return {classes,studentNames:names,subjects:[]};
  }
  return {classes:[],studentNames:[],subjects:[]};
}

export function pointsForSource(settings:GamificationSettings,source:"attendance"|"assignment"|"exam"|"behavior"){
  return {attendance:settings.attendancePoints,assignment:settings.assignmentPoints,exam:settings.examPoints,behavior:settings.behaviorPoints}[source];
}
