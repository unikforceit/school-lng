import QRCode from "qrcode";
import { db } from "@/lib/db";
import type { Session,Role } from "@/lib/auth";
import { schoolScope } from "@/lib/gamification";
import { createIdCardToken,currentAcademicYear,type IdCardPerson } from "@/lib/id-card";

type Student={id:number;studentId:string;name:string;email:string;grade:number;className:string;bloodType:string;photoUrl:string};
type User={id:number;name:string;email:string;role:Role};
type Identity={source:"student"|"user";recordId:number;id:string;name:string;email:string;role:Role;kind:IdCardPerson["kind"];grade:string|number;className:string;bloodType:string;photoUrl:string};
const studentSelect="SELECT id,student_id studentId,name,email,grade,class_name className,blood_type bloodType,photo_url photoUrl FROM students";

function userIdentity(user:User):Identity{
  const kind=user.role==="superadmin"?"platform":user.role==="parent"?"guardian":"staff";
  return {source:"user",recordId:user.id,id:`SIME-${user.role.slice(0,3).toUpperCase()}-${String(user.id).padStart(4,"0")}`,name:user.name,email:user.email,role:user.role,kind,grade:"—",className:user.role==="superadmin"?"Platform":user.role==="parent"?"Guardian":"Staff",bloodType:"—",photoUrl:""};
}

function studentIdentity(student:Student):Identity{
  return {source:"student",recordId:student.id,id:student.studentId,name:student.name,email:student.email,role:"student",kind:"student",grade:student.grade,className:student.className,bloodType:student.bloodType||"Unknown",photoUrl:student.photoUrl||""};
}

export async function buildIdCardData(session:Session,origin:string){
  const scope=schoolScope(session),identities:Identity[]=[];
  const currentUser=db.prepare("SELECT id,name,email,role FROM users WHERE tenant_id=? AND email=? AND active=1").get(session.tenantId,session.userId) as User|undefined;
  if(session.role==="superadmin"){
    if(currentUser)identities.push(userIdentity(currentUser));
  }else if(session.role==="admin"){
    const users=db.prepare("SELECT id,name,email,role FROM users WHERE tenant_id=? AND active=1 AND role!='student' AND role!='superadmin' ORDER BY role,name").all(session.tenantId) as User[];
    identities.push(...users.map(userIdentity));
    const students=db.prepare(`${studentSelect} WHERE tenant_id=? ORDER BY class_name,name`).all(session.tenantId) as Student[];
    identities.push(...students.map(studentIdentity));
  }else if(session.role==="teacher"){
    if(currentUser)identities.push(userIdentity(currentUser));
    if(scope.classes.length){const students=db.prepare(`${studentSelect} WHERE tenant_id=? AND class_name IN (${scope.classes.map(()=>"?").join(",")}) ORDER BY class_name,name`).all(session.tenantId,...scope.classes) as Student[];identities.push(...students.map(studentIdentity))}
  }else if(session.role==="parent"){
    if(currentUser)identities.push(userIdentity(currentUser));
    if(scope.studentNames.length){const students=db.prepare(`${studentSelect} WHERE tenant_id=? AND name IN (${scope.studentNames.map(()=>"?").join(",")}) ORDER BY name`).all(session.tenantId,...scope.studentNames) as Student[];identities.push(...students.map(studentIdentity))}
  }else{
    const student=db.prepare(`${studentSelect} WHERE tenant_id=? AND (email=? OR name=?) ORDER BY CASE WHEN email=? THEN 0 ELSE 1 END LIMIT 1`).get(session.tenantId,session.userId,session.name,session.userId) as Student|undefined;
    if(student)identities.push(studentIdentity(student));else if(currentUser)identities.push(userIdentity(currentUser));
  }
  const unique=[...new Map(identities.map(item=>[`${item.source}:${item.recordId}`,item])).values()];
  const {label:academicYear,validUntil}=currentAcademicYear();
  const people:IdCardPerson[]=await Promise.all(unique.map(async item=>{
    const token=createIdCardToken({tenantId:session.tenantId,source:item.source,recordId:item.recordId,cardId:item.id,name:item.name,role:item.role,exp:Math.floor(validUntil.getTime()/1000)});
    const verifyUrl=new URL("/api/id-card/verify",origin);verifyUrl.searchParams.set("token",token);
    return {key:`${item.source}:${item.recordId}`,id:item.id,name:item.name,role:item.role,email:item.email,kind:item.kind,grade:item.grade,className:item.className,bloodType:item.bloodType,photoUrl:item.photoUrl,qrCode:await QRCode.toDataURL(verifyUrl.toString(),{errorCorrectionLevel:"M",margin:1,width:220,color:{dark:"#0c2237",light:"#ffffff"}})};
  }));
  const tenant=db.prepare("SELECT name FROM tenants WHERE id=?").get(session.tenantId) as {name:string}|undefined;
  const own=people.find(item=>item.email.toLowerCase()===session.userId.toLowerCase());
  return {people,currentKey:own?.key||people[0]?.key||"",school:tenant?.name||"SIME School",academicYear};
}

export function safeRequestOrigin(headers:Headers){
  const forwardedHost=(headers.get("x-forwarded-host")||headers.get("host")||"").split(",")[0].trim();
  const forwardedProto=(headers.get("x-forwarded-proto")||"http").split(",")[0].trim()==="https"?"https":"http";
  const safeHost=/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(forwardedHost)?forwardedHost:"";
  const configured=process.env.NEXT_PUBLIC_APP_URL;
  return safeHost?`${forwardedProto}://${safeHost}`:configured&&/^https?:\/\//.test(configured)?configured.replace(/\/$/,""):"http://localhost:6969";
}
