import nextEnv from "@next/env";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
nextEnv.loadEnvConfig(process.cwd());globalThis.AsyncLocalStorage=AsyncLocalStorage;
const require=createRequire(import.meta.url),{NextRequest}=require("next/server"),Database=require("better-sqlite3");
const modules={
 schoolLogin:require("../.next/server/app/api/auth/login/route.js"),platformLogin:require("../.next/server/app/api/platform/auth/login/route.js"),
 board:require("../.next/server/app/api/gamification/leaderboard/route.js"),progress:require("../.next/server/app/api/gamification/progress/route.js"),interventions:require("../.next/server/app/api/interventions/route.js"),
 platformData:require("../.next/server/app/api/platform/tenants/[id]/data/route.js"),platformUsers:require("../.next/server/app/api/platform/users/route.js"),students:require("../.next/server/app/api/students/route.js")
};
const base="http://127.0.0.1:6969",failures=[];let checks=0;
const database=new Database(process.env.DATABASE_PATH||"./data/sime.db"),originalLeaderboardSetting=(database.prepare("SELECT global_leaderboard_public value FROM gamification_settings WHERE tenant_id=?").get("demo-school")||{}).value;let restored=false;
function restoreSettings(){if(restored)return;restored=true;if(originalLeaderboardSetting!==undefined)database.prepare("UPDATE gamification_settings SET global_leaderboard_public=? WHERE tenant_id=?").run(originalLeaderboardSetting,"demo-school");database.close()}
process.once("exit",restoreSettings);
function check(value,label,detail=""){checks++;if(!value)failures.push(`${label}${detail?`: ${detail}`:""}`)}
function context(id=""){return {params:id?{id}:{},prerenderManifest:{preview:{previewModeId:"",previewModeSigningKey:"",previewModeEncryptionKey:""}},renderOpts:{supportsDynamicResponse:true,experimental:{authInterrupts:false},cacheComponents:false,waitUntil:()=>{},onClose:()=>{},onAfterTaskError:undefined,onInstrumentationRequestError:()=>{}},sharedContext:{buildId:"role-feedback-verification"}}}
async function login(role){const accounts={superadmin:["superadmin@sime.local","SuperAdmin123!"],admin:["admin@sime.local","ChangeMe123!"],teacher:["teacher@sime.local","Teacher123!"],student:["student@sime.local","Student123!"],parent:["parent@sime.local","Parent123!"]},[email,password]=accounts[role],platform=role==="superadmin",module=platform?modules.platformLogin:modules.schoolLogin,path=platform?"/api/platform/auth/login":"/api/auth/login",body=platform?{email,password}:{tenantId:"demo-school",email,password};const response=await module.routeModule.userland.POST(new Request(`${base}${path}`,{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify(body)}));check(response.status===200,`${role} login`);return (response.headers.get("set-cookie")||"").split(";")[0]}
async function call(module,path,cookie,id=""){const response=await module.routeModule.handle(new NextRequest(`${base}${path}`,{headers:{cookie}}),context(id));return {response,payload:await response.json().catch(()=>null)}}
const cookies={};for(const role of ["superadmin","admin","teacher","student","parent"])cookies[role]=await login(role);
database.prepare("UPDATE gamification_settings SET global_leaderboard_public=0 WHERE tenant_id=?").run("demo-school");
const studentBoard=await call(modules.board,"/api/gamification/leaderboard",cookies.student);check(studentBoard.response.status===200,"student leaderboard loads");check(studentBoard.payload?.data?.overall===null,"private global leaderboard hidden from student");check(studentBoard.payload?.data?.classes?.length===1&&studentBoard.payload.data.classes[0]==="8-A","student leaderboard limited to own class");
const parentBoard=await call(modules.board,"/api/gamification/leaderboard",cookies.parent);check(parentBoard.payload?.data?.classes?.length===1&&parentBoard.payload.data.classes[0]==="8-A","parent leaderboard limited to child class");
const teacherBoard=await call(modules.board,"/api/gamification/leaderboard",cookies.teacher);check(teacherBoard.payload?.data?.classes?.every(value=>["8-A","9-B"].includes(value)),"teacher leaderboard limited to assigned classes");
for(const role of ["student","parent","teacher","admin"]){const result=await call(modules.progress,"/api/gamification/progress",cookies[role]);check(result.response.status===200&&Array.isArray(result.payload?.data?.students),`${role} subject progression`)}
for(const role of ["student","parent","superadmin"]){const result=await call(modules.interventions,"/api/interventions",cookies[role]);check(result.response.status===403,`${role} intervention denial`,String(result.response.status))}
for(const role of ["teacher","admin"]){const result=await call(modules.interventions,"/api/interventions",cookies[role]);check(result.response.status===200&&Array.isArray(result.payload?.data?.students),`${role} intervention access`,String(result.response.status))}
const teacherStudents=await call(modules.students,"/api/students",cookies.teacher);check(teacherStudents.payload?.data?.every(student=>["8-A","9-B"].includes(student.className)),"teacher directory limited to assigned classes");
const platformData=await call(modules.platformData,"/api/platform/tenants/demo-school/data?dataset=students",cookies.superadmin,"demo-school");check(platformData.response.status===200&&Array.isArray(platformData.payload?.data?.rows),"superadmin audited school operations access");
const platformUsers=await call(modules.platformUsers,"/api/platform/users",cookies.superadmin);check(platformUsers.payload?.data?.some(user=>user.role==="student")&&platformUsers.payload?.data?.some(user=>user.role==="parent"),"superadmin sees all school account roles");
const card=readFileSync("src/lib/id-card-data.ts","utf8"),cardUi=readFileSync("src/components/IdCard.tsx","utf8");check(card.includes("schoolScope(session)")&&card.includes('source:"student"')&&card.includes('source:"user"'),"Smart Card role scope enforced server-side");check(cardUi.includes('t("bloodType")')&&cardUi.includes('print("selected")')&&cardUi.includes('print("all")')&&cardUi.includes("qrCode"),"Smart Card includes printable identity and QR fields");
restoreSettings();
if(failures.length){console.error(`FAILED ${failures.length}/${checks}\n${failures.join("\n")}`);process.exit(1)}console.log(`PASS ${checks} role-feedback checks for scoped gamification, interventions, Smart Cards, and audited platform operations.`);
