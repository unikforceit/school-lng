import { db } from "@/lib/db";
import { getSession, type Role } from "@/lib/auth";
import { jsonError, rateLimit } from "@/lib/http";
import { readableResourceTypes, resourceConfig, type ResourceType } from "@/lib/resources";

export const dynamic="force-dynamic";
type SearchResult={id:string;title:string;subtitle:string;category:string;href:string;icon:string};
const schoolPages:Array<{title:string;subtitle:string;href:string;icon:string;roles?:Role[]}>= [
  {title:"Dashboard",subtitle:"School overview and activity",href:"/{role}",icon:"/home.png"},
  {title:"SAGE AI",subtitle:"Ask your school assistant",href:"/ai",icon:"/message.png"},
  {title:"ID Card",subtitle:"View and print your identification card",href:"/id-card",icon:"/profile.png"},
  {title:"Students",subtitle:"Student directory and profiles",href:"/list/students",icon:"/student.png",roles:["admin","teacher"]},
  {title:"Teachers",subtitle:"Teacher directory and profiles",href:"/list/teachers",icon:"/teacher.png"},
  {title:"Parents",subtitle:"Parent directory",href:"/list/parents",icon:"/parent.png"},
  {title:"Gamification leaderboard",subtitle:"Overall and class rankings",href:"/gamification",icon:"/result.png"},
  {title:"Gamification settings",subtitle:"Point rules and controls",href:"/gamification/settings",icon:"/setting.png",roles:["admin"]},
  {title:"Profile",subtitle:"Your account and session",href:"/profile",icon:"/profile.png"},
  {title:"Security settings",subtitle:"Authentication and tenant protection",href:"/admin/settings",icon:"/setting.png",roles:["admin"]},
];
const platformPages=[
  ["Platform overview","Super admin dashboard, school health, growth and activity","/superadmin","/home.png"],
  ["Schools","Provision and manage school tenants","/superadmin/schools","/class.png"],
  ["Licenses","Plans, limits and license lifecycle","/superadmin/licenses","/result.png"],
  ["School users","Cross-school account control","/superadmin/users","/teacher.png"],
  ["Audit log","Platform administration activity","/superadmin/audit","/attendance.png"],
  ["Platform settings","Provisioning and maintenance controls","/superadmin/settings","/setting.png"],
] as const;

export async function GET(request:Request){
  const session=await getSession();if(!session)return jsonError("Authentication required",401);
  const q=new URL(request.url).searchParams.get("q")?.trim().slice(0,80)??"";if(q.length<2)return Response.json({data:[]});
  const limited=rateLimit(`search:${session.tenantId}:${session.userId}`,60);if(!limited.allowed)return jsonError("Too many searches",429,{retryAfter:limited.retryAfter});
  const needle=q.toLowerCase(),results:SearchResult[]=[];
  const add=(item:SearchResult)=>{if(results.length<30&&!results.some(row=>row.href===item.href&&row.title===item.title))results.push(item)};
  if(session.role==="superadmin"){
    for(const [title,subtitle,href,icon] of platformPages)if(`${title} ${subtitle}`.toLowerCase().includes(needle))add({id:`page:${href}`,title,subtitle,category:"Navigation",href,icon});
    const like=`%${q}%`;
    const schools=db.prepare("SELECT id,name,plan,license_status licenseStatus FROM tenants WHERE id!='platform' AND (name LIKE ? OR id LIKE ? OR contact_email LIKE ?) ORDER BY name LIMIT 12").all(like,like,like) as Array<{id:string;name:string;plan:string;licenseStatus:string}>;
    for(const school of schools)add({id:`school:${school.id}`,title:school.name,subtitle:`${school.id} · ${school.plan} · ${school.licenseStatus}`,category:"School",href:`/superadmin/schools/${school.id}`,icon:"/class.png"});
    const users=db.prepare("SELECT u.id,u.name,u.email,u.role,t.name school FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.tenant_id!='platform' AND (u.name LIKE ? OR u.email LIKE ? OR t.name LIKE ?) ORDER BY u.name LIMIT 12").all(like,like,like) as Array<{id:number;name:string;email:string;role:string;school:string}>;
    for(const user of users)add({id:`user:${user.id}`,title:user.name,subtitle:`${user.role} · ${user.school} · ${user.email}`,category:"School user",href:`/superadmin/users?q=${encodeURIComponent(user.email)}`,icon:"/teacher.png"});
    return Response.json({data:results},{headers:{"Cache-Control":"no-store"}});
  }
  for(const page of schoolPages){if(page.roles&&!page.roles.includes(session.role))continue;if(`${page.title} ${page.subtitle}`.toLowerCase().includes(needle))add({id:`page:${page.href}`,title:page.title,subtitle:page.subtitle,category:"Navigation",href:page.href.replace("{role}",session.role),icon:page.icon})}
  const allowed=readableResourceTypes(session.role);
  for(const type of allowed){const title=resourceConfig[type].title;if(title.toLowerCase().includes(needle))add({id:`page:${type}`,title,subtitle:`Browse ${title.toLowerCase()} records`,category:"Navigation",href:`/list/${type}`,icon:iconFor(type)})}
  const like=`%${q}%`;
  if(session.role==="admin"||session.role==="teacher"){
    const students=db.prepare("SELECT id,name,student_id studentId,class_name className FROM students WHERE tenant_id=? AND (name LIKE ? OR student_id LIKE ? OR email LIKE ? OR class_name LIKE ?) ORDER BY name LIMIT 12").all(session.tenantId,like,like,like,like) as Array<{id:number;name:string;studentId:string;className:string}>;
    for(const student of students)add({id:`student:${student.id}`,title:student.name,subtitle:`${student.studentId} · Class ${student.className}`,category:"Student",href:`/list/students/${student.id}`,icon:"/student.png"});
  }
  const placeholders=allowed.map(()=>"?").join(",");
  if(placeholders){
    const rows=db.prepare(`SELECT id,resource_type type,title,payload FROM resources WHERE tenant_id=? AND resource_type IN (${placeholders}) AND (title LIKE ? OR payload LIKE ?) ORDER BY updated_at DESC LIMIT 60`).all(session.tenantId,...allowed,like,like) as Array<{id:number;type:ResourceType;title:string;payload:string}>;
    let children:string[]=[];if(session.role==="parent"){const parent=db.prepare("SELECT payload FROM resources WHERE tenant_id=? AND resource_type='parents' AND title=?").get(session.tenantId,session.name) as {payload:string}|undefined;children=parent?String((JSON.parse(parent.payload) as Record<string,unknown>).students||"").split(",").map(name=>name.trim()).filter(Boolean):[]}
    for(const row of rows){
      const payload=JSON.parse(row.payload) as Record<string,string|number>;
      if(["results","attendance"].includes(row.type)){const student=String(payload.student||"");if(session.role==="student"&&student!==session.name)continue;if(session.role==="parent"&&!children.includes(student))continue}
      if(row.type==="messages"){const recipient=String(payload.recipient||"").toLowerCase();if(!["all","all users",session.name.toLowerCase(),session.role,`${session.role}s`].includes(recipient))continue}
      let visiblePayload=payload;
      if(row.type==="teachers"&&(session.role==="student"||session.role==="parent")){const {email,phone,address,...safe}=payload;void email;void phone;void address;visiblePayload=safe}
      if(!`${row.title} ${Object.values(visiblePayload).join(" ")}`.toLowerCase().includes(needle))continue;
      const detail=row.type==="teachers"?`/list/teachers/${row.id}`:`/list/${row.type}?q=${encodeURIComponent(row.title)}`;
      const context=Object.values(visiblePayload).slice(0,3).join(" · ").slice(0,110);
      add({id:`${row.type}:${row.id}`,title:row.title,subtitle:context||resourceConfig[row.type].title,category:resourceConfig[row.type].title,href:detail,icon:iconFor(row.type)})
    }
  }
  return Response.json({data:results},{headers:{"Cache-Control":"no-store"}});
}

function iconFor(type:ResourceType){const map:Partial<Record<ResourceType,string>>={teachers:"/teacher.png",parents:"/parent.png",subjects:"/subject.png",classes:"/class.png",lessons:"/lesson.png",exams:"/exam.png",assignments:"/assignment.png",results:"/result.png",attendance:"/attendance.png",events:"/calendar.png",messages:"/message.png",announcements:"/announcement.png"};return map[type]||"/search.png"}
