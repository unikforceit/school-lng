import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import IdCard,{type IdCardPerson} from "@/components/IdCard";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { schoolScope } from "@/lib/gamification";
import { createIdCardToken,currentAcademicYear } from "@/lib/id-card";

type Student={id:number;studentId:string;name:string;email:string;grade:number;className:string;bloodType:string;photoUrl:string};
const select="SELECT id,student_id studentId,name,email,grade,class_name className,blood_type bloodType,photo_url photoUrl FROM students";

export default async function IdCardPage(){
 const session=await getSession();if(!session)redirect("/sign-in");if(session.role==="superadmin")redirect("/superadmin");
 const scope=schoolScope(session);let students:Student[]=[];
 if(session.role==="admin")students=db.prepare(`${select} WHERE tenant_id=? ORDER BY class_name,name`).all(session.tenantId) as Student[];
 else if(session.role==="teacher"&&scope.classes.length)students=db.prepare(`${select} WHERE tenant_id=? AND class_name IN (${scope.classes.map(()=>"?").join(",")}) ORDER BY class_name,name`).all(session.tenantId,...scope.classes) as Student[];
 else if(scope.studentNames.length)students=db.prepare(`${select} WHERE tenant_id=? AND name IN (${scope.studentNames.map(()=>"?").join(",")}) ORDER BY name`).all(session.tenantId,...scope.studentNames) as Student[];
 const tenant=db.prepare("SELECT name FROM tenants WHERE id=?").get(session.tenantId) as {name:string}|undefined,school=tenant?.name||"SIME School";
 const {label:academicYear,validUntil}=currentAcademicYear(),requestHeaders=await headers(),forwardedHost=(requestHeaders.get("x-forwarded-host")||requestHeaders.get("host")||"").split(",")[0].trim(),forwardedProto=(requestHeaders.get("x-forwarded-proto")||"http").split(",")[0].trim()==="https"?"https":"http",configuredOrigin=process.env.NEXT_PUBLIC_APP_URL,safeHost=/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(forwardedHost)?forwardedHost:"",origin=safeHost?`${forwardedProto}://${safeHost}`:configuredOrigin&&/^https?:\/\//.test(configuredOrigin)?configuredOrigin.replace(/\/$/,""):"http://localhost:6969";
 const people:IdCardPerson[]=await Promise.all(students.map(async student=>{const token=createIdCardToken({tenantId:session.tenantId,source:"student",recordId:student.id,cardId:student.studentId,name:student.name,role:"student",exp:Math.floor(validUntil.getTime()/1000)}),verifyUrl=new URL("/api/id-card/verify",origin);verifyUrl.searchParams.set("token",token);return {key:`student:${student.id}`,id:student.studentId,name:student.name,role:"student",email:student.email,details:`Grade ${student.grade} · Class ${student.className}`,grade:student.grade,className:student.className,bloodType:student.bloodType||"Unknown",photoUrl:student.photoUrl||"",qrCode:await QRCode.toDataURL(verifyUrl.toString(),{errorCorrectionLevel:"M",margin:1,width:220,color:{dark:"#0c2237",light:"#ffffff"}})}}));
 return <IdCard people={people} currentKey={people[0]?.key||""} school={school} academicYear={academicYear}/>;
}
