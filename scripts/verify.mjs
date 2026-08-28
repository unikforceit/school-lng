import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const port = Number(process.env.VERIFY_PORT || 6971);
const base = process.env.VERIFY_BASE || `http://127.0.0.1:${port}`;
const server = process.env.VERIFY_BASE ? null : spawn(process.execPath, ["scripts/start.mjs"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NEXT_PUBLIC_APP_URL: base } });
let logs = "";
server?.stdout.on("data", chunk => { logs += chunk; });
server?.stderr.on("data", chunk => { logs += chunk; });

const failures = [];
const checks = [];
let originalGlobalLeaderboardPublic;
function check(condition, label, detail = "") { checks.push(label); if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`); }
async function request(path, init = {}) { return fetch(`${base}${path}`, { redirect: "manual", ...init }); }
async function waitUntilReady() { for (let i=0;i<60;i+=1) { try { const r=await request("/api/health"); if(r.ok)return; } catch {} await new Promise(resolve=>setTimeout(resolve,250)); } throw new Error(`Server did not start\n${logs}`); }
function cookieFrom(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie") || ""];
  return values.filter(Boolean).map(value=>value.split(";")[0]).join("; ");
}

const accounts = {
  superadmin: ["platform", "superadmin@school-ing.gn", "SuperAdmin123!"],
  admin: ["demo-school", "admin@school-ing.gn", "ChangeMe123!"],
  teacher: ["demo-school", "teacher@school-ing.gn", "Teacher123!"],
  student: ["demo-school", "student@school-ing.gn", "Student123!"],
  parent: ["demo-school", "parent@school-ing.gn", "Parent123!"],
};
const resources = ["teachers","parents","subjects","classes","lessons","exams","assignments","results","attendance","events","messages","announcements"];
const sharedPages = ["/ai","/id-card","/profile","/settings"];
const roleResources = {
  superadmin: [],
  admin: resources,
  teacher: ["teachers","subjects","classes","lessons","exams","assignments","results","attendance","events","messages","announcements"],
  student: ["teachers","subjects","classes","lessons","exams","assignments","results","attendance","events","messages","announcements"],
  parent: ["teachers","subjects","classes","lessons","exams","assignments","results","attendance","events","messages","announcements"],
};

try {
  await waitUntilReady();
  const anonymous = await request("/api/security/settings");
  check(anonymous.status === 401, "anonymous security denial", String(anonymous.status));
  const anonymousSearch = await request("/api/search?q=dashboard");
  check(anonymousSearch.status === 401, "anonymous search denial", String(anonymousSearch.status));
  const proxySafeLogin=await request("/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin:"http://lan-proxy.internal:6969","sec-fetch-site":"same-origin"},body:JSON.stringify({tenantId:"demo-school",email:"admin@school-ing.gn",password:"ChangeMe123!"})});check(proxySafeLogin.status===200,"same-origin login survives proxy host mismatch",String(proxySafeLogin.status));
  const crossSiteLogin=await request("/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin:"https://attacker.invalid","sec-fetch-site":"cross-site"},body:JSON.stringify({tenantId:"demo-school",email:"admin@school-ing.gn",password:"ChangeMe123!"})});check(crossSiteLogin.status===403,"cross-site login rejected",String(crossSiteLogin.status));
  const platformSignIn=await request("/superadmin/sign-in");check(platformSignIn.status===200,"separate superadmin sign-in page",String(platformSignIn.status));
  const anonymousPlatform=await request("/superadmin");check(anonymousPlatform.status===307&&anonymousPlatform.headers.get("location")?.endsWith("/superadmin/sign-in"),"anonymous platform redirect",`${anonymousPlatform.status} ${anonymousPlatform.headers.get("location")}`);
  const cookies = {};
  for (const [role,[tenantId,email,password]] of Object.entries(accounts)) {
    const endpoint=role==="superadmin"?"/api/platform/auth/login":"/api/auth/login";
    const body=role==="superadmin"?{email,password}:{email,password,tenantId};
    const login = await request(endpoint, { method:"POST", headers:{"content-type":"application/json",origin:base}, body:JSON.stringify(body) });
    check(login.status === 200, `${role} login`, String(login.status));
    const setCookie = login.headers.get("set-cookie") || "";
    check(setCookie.includes("HttpOnly") && setCookie.includes("SameSite=lax"), `${role} secure cookie attributes`, setCookie);
    check(!setCookie.includes("; Secure"), `${role} local HTTP cookie usability`, setCookie);
    cookies[role] = cookieFrom(login);
    const searchResponse=await request("/api/search?q=dashboard",{headers:{cookie:cookies[role]}});
    const searchPayload=await searchResponse.json().catch(()=>null);
    check(searchResponse.status===200&&Array.isArray(searchPayload?.data),`${role} global search`,String(searchResponse.status));
    if(role==="admin"||role==="teacher"){
      const peopleSearch=await request("/api/search?q=Mariama",{headers:{cookie:cookies[role]}});const peoplePayload=await peopleSearch.json().catch(()=>null);
      check(peopleSearch.status===200&&peoplePayload?.data?.some(item=>item.category==="Student"&&item.href.startsWith("/list/students/")),`${role} student search redirect`);
    }
    if(role==="student"||role==="parent"){
      const privateSearch=await request("/api/search?q=teacher%40sime.local",{headers:{cookie:cookies[role]}});const privatePayload=await privateSearch.json().catch(()=>null);
      check(privateSearch.status===200&&!privatePayload?.data?.some(item=>item.title==="Ibrahima Condé"),`${role} search hides teacher contact fields`);
      const otherStudent=await request("/api/search?q=Nabil",{headers:{cookie:cookies[role]}});const otherPayload=await otherStudent.json().catch(()=>null);
      check(otherStudent.status===200&&!otherPayload?.data?.some(item=>["Results","Attendance","Student"].includes(item.category)),`${role} search hides other student records`);
    }
    if(role==="superadmin"){
      const schoolSearch=await request("/api/search?q=demo-school",{headers:{cookie:cookies[role]}});const schoolPayload=await schoolSearch.json().catch(()=>null);
      check(schoolSearch.status===200&&schoolPayload?.data?.some(item=>item.href==="/superadmin/schools/demo-school"),"superadmin school search redirect");
    }
    const rolePages=role==="superadmin"?["/superadmin","/superadmin/profile"]:[`/${role}`,...sharedPages];
    for (const page of rolePages) { const response=await request(page,{headers:{cookie:cookies[role]}}); check(response.status===200,`${role} page ${page}`,String(response.status)); }
    const profileResponse=await request("/api/profile",{headers:{cookie:cookies[role]}});const profilePayload=await profileResponse.json().catch(()=>null);
    check(profileResponse.status===200&&profilePayload?.data?.role===role&&profilePayload.data.email===email,`${role} editable profile access`,String(profileResponse.status));
    const savedProfile=await request("/api/profile",{method:"PATCH",headers:{cookie:cookies[role],origin:base,"content-type":"application/json"},body:JSON.stringify({displayName:profilePayload?.data?.displayName||email,phone:profilePayload?.data?.phone||"",address:profilePayload?.data?.address||"",bio:profilePayload?.data?.bio||"",avatarUrl:profilePayload?.data?.avatarUrl||""})});
    check(savedProfile.status===200,`${role} non-sensitive profile update`,String(savedProfile.status));
    const protectedProfile=await request("/api/profile",{method:"PATCH",headers:{cookie:cookies[role],origin:base,"content-type":"application/json"},body:JSON.stringify({displayName:profilePayload?.data?.displayName||email,phone:"",address:"",bio:"",avatarUrl:"",role:"superadmin"})});
    check(protectedProfile.status===400,`${role} protected profile field rejected`,String(protectedProfile.status));
    for (const type of resources) {
      const allowed=roleResources[role].includes(type);
      const response=await request(`/api/resources/${type}`,{headers:{cookie:cookies[role]}});
      check(response.status===(allowed?200:403),`${role} resource ${type} access`,String(response.status));
      const page=await request(`/list/${type}`,{headers:{cookie:cookies[role]}});
      check(page.status===(allowed?200:307),`${role} page /list/${type} access`,String(page.status));
    }
    const students=await request("/api/students",{headers:{cookie:cookies[role]}}); check(students.status===(["admin","teacher"].includes(role)?200:403),`${role} student directory access`,String(students.status));
    const studentsPage=await request("/list/students",{headers:{cookie:cookies[role]}});check(studentsPage.status===(["admin","teacher"].includes(role)?200:307),`${role} student page access`,String(studentsPage.status));
    const adminPage=await request("/admin",{headers:{cookie:cookies[role]}});check(adminPage.status===(role==="admin"?200:307),`${role} admin page access`,String(adminPage.status));
    const adminSettings=await request("/admin/settings",{headers:{cookie:cookies[role]}});check(adminSettings.status===(role==="admin"?200:307),`${role} admin settings page access`,String(adminSettings.status));
    const game=await request("/gamification",{headers:{cookie:cookies[role]}});check(game.status===(role==="superadmin"?307:200),`${role} gamification page access`,String(game.status));
    const gameSettings=await request("/gamification/settings",{headers:{cookie:cookies[role]}});check(gameSettings.status===(role==="admin"?200:307),`${role} gamification settings page access`,String(gameSettings.status));
    const platform=await request("/api/platform/overview",{headers:{cookie:cookies[role]}});check(platform.status===(role==="superadmin"?200:403),`${role} platform API access`,String(platform.status));
    const refresh=await request("/api/auth/refresh",{method:"POST",headers:{cookie:cookies[role],origin:base}}); check(refresh.status===200,`${role} session refresh`,String(refresh.status));
  }
  const crossSiteProfile=await request("/api/profile",{method:"PATCH",headers:{cookie:cookies.student,origin:"https://attacker.invalid","sec-fetch-site":"cross-site","content-type":"application/json"},body:JSON.stringify({displayName:"Blocked change",phone:"",address:"",bio:"",avatarUrl:""})});check(crossSiteProfile.status===403,"cross-site profile update rejected",String(crossSiteProfile.status));
  for(const page of ["/superadmin/schools","/superadmin/licenses","/superadmin/users","/superadmin/audit","/superadmin/settings","/superadmin/schools/demo-school"]){const response=await request(page,{headers:{cookie:cookies.superadmin}});check(response.status===200,`superadmin page ${page}`,String(response.status));}
  for(const endpoint of ["/api/platform/tenants","/api/platform/users","/api/platform/audit","/api/platform/settings"]){const response=await request(endpoint,{headers:{cookie:cookies.superadmin}});check(response.status===200,`superadmin API ${endpoint}`,String(response.status));const denied=await request(endpoint,{headers:{cookie:cookies.admin}});check(denied.status===403,`admin denied ${endpoint}`,String(denied.status));}
  const platformOnSchoolLogin=await request("/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify({email:accounts.superadmin[1],password:accounts.superadmin[2],tenantId:"platform"})});check(platformOnSchoolLogin.status===403,"school login rejects platform account",String(platformOnSchoolLogin.status));
  const schoolOnPlatformLogin=await request("/api/platform/auth/login",{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify({email:accounts.admin[1],password:accounts.admin[2]})});check(schoolOnPlatformLogin.status===403,"platform login rejects school account",String(schoolOnPlatformLogin.status));
  const cardExpectations={
    admin:{present:["Aïssatou Camara","Ibrahima Condé","Fatoumata Sylla","Mariama Bah","Mamadou Sékou Diallo","Fodé Camara","Aminata Condé"],absent:["Sékouba Keïta"]},
    teacher:{present:["Ibrahima Condé","Mariama Bah","Mamadou Sékou Diallo"],absent:["Fodé Camara","Aminata Condé","Sékouba Keïta"]},
    student:{present:["Mariama Bah"],absent:["Mamadou Sékou Diallo","Fodé Camara","Aminata Condé","Sékouba Keïta"]},
    parent:{present:["Fatoumata Sylla","Mariama Bah"],absent:["Mamadou Sékou Diallo","Fodé Camara","Aminata Condé","Sékouba Keïta"]},
  };
  for(const [role,expectation] of Object.entries(cardExpectations)){
    const response=await request("/id-card",{headers:{cookie:cookies[role]}});const html=await response.text();
    check(expectation.present.every(name=>html.includes(name)),`${role} ID card includes authorized identities`);
    check(expectation.absent.every(name=>!html.includes(name)),`${role} ID card excludes unauthorized identities`);
    check(html.includes("data:image/png;base64"),`${role} ID card contains QR code`);
  }
  const platformCard=await request("/superadmin/id-card",{headers:{cookie:cookies.superadmin}});const platformCardHtml=await platformCard.text();check(platformCard.status===200&&platformCardHtml.includes("Mamadou Diallo")&&platformCardHtml.includes("data:image/png;base64"),"superadmin platform ID card");
  const adminHeaders={cookie:cookies.admin,origin:base,"content-type":"application/json"};
  const suspendLicense=await request("/api/platform/tenants/demo-school",{method:"PATCH",headers:{cookie:cookies.superadmin,origin:base,"content-type":"application/json"},body:JSON.stringify({licenseStatus:"suspended"})});check(suspendLicense.status===200,"superadmin license suspension",String(suspendLicense.status));const licenseRevoked=await request("/api/auth/me",{headers:{cookie:cookies.admin}});check(licenseRevoked.status===401,"license immediately revokes school session",String(licenseRevoked.status));const restoreLicense=await request("/api/platform/tenants/demo-school",{method:"PATCH",headers:{cookie:cookies.superadmin,origin:base,"content-type":"application/json"},body:JSON.stringify({licenseStatus:"active",licenseExpiresAt:"2027-07-22"})});check(restoreLicense.status===200,"superadmin license restoration",String(restoreLicense.status));
  const suspendSchool=await request("/api/platform/tenants/sample-academy",{method:"PATCH",headers:{cookie:cookies.superadmin,origin:base,"content-type":"application/json"},body:JSON.stringify({active:false})});check(suspendSchool.status===200,"superadmin school suspension",String(suspendSchool.status));
  const restoreSchool=await request("/api/platform/tenants/sample-academy",{method:"PATCH",headers:{cookie:cookies.superadmin,origin:base,"content-type":"application/json"},body:JSON.stringify({active:true})});check(restoreSchool.status===200,"superadmin school reactivation",String(restoreSchool.status));
  const dashboard=await request("/api/dashboard",{headers:{cookie:cookies.admin}});const dashboardData=(await dashboard.json()).data;check(Array.isArray(dashboardData.genderCounts)&&dashboardData.genderCounts.some(item=>item.gender==="female")&&dashboardData.genderCounts.some(item=>item.gender==="male"),"admin gender analytics");
  const privacyDatabase=new Database(process.env.DATABASE_PATH||"./data/sime.db");
  originalGlobalLeaderboardPublic=(privacyDatabase.prepare("SELECT global_leaderboard_public value FROM gamification_settings WHERE tenant_id=?").get("demo-school")||{}).value;
  privacyDatabase.prepare("UPDATE gamification_settings SET global_leaderboard_public=0 WHERE tenant_id=?").run("demo-school");
  privacyDatabase.close();
  const gameLeaderboard=await request("/api/gamification/leaderboard",{headers:{cookie:cookies.student}});const gameData=(await gameLeaderboard.json()).data;check(gameLeaderboard.status===200&&gameData.overall===null&&gameData.classes.length===1&&gameData.classes[0]==="10e-A","student class-scoped private gamification leaderboard");
  const teacherAward=await request("/api/gamification/points",{method:"POST",headers:{cookie:cookies.teacher,origin:base,"content-type":"application/json"},body:JSON.stringify({studentName:"Mariama Bah",className:"10e-A",source:"behavior",note:"Verification award"})});check(teacherAward.status===201,"teacher points award",String(teacherAward.status));const awarded=await teacherAward.json().catch(()=>null);const awardId=awarded?.data?.id;
  const create=await request("/api/resources/announcements",{method:"POST",headers:adminHeaders,body:JSON.stringify({title:"Verification record",class:"All",date:"2026-07-22"})});
  check(create.status===201,"admin resource create",String(create.status));
  const created=await create.json().catch(()=>null); const id=created?.data?.id;
  if(id){const update=await request(`/api/resources/announcements/${id}`,{method:"PUT",headers:adminHeaders,body:JSON.stringify({title:"Verification updated",class:"All",date:"2026-07-22"})});check(update.status===200,"admin resource update",String(update.status));const remove=await request(`/api/resources/announcements/${id}`,{method:"DELETE",headers:{cookie:cookies.admin,origin:base}});check(remove.status===204,"admin resource delete",String(remove.status));}
  const forbidden=await request("/api/resources/announcements",{method:"POST",headers:{cookie:cookies.student,origin:base,"content-type":"application/json"},body:JSON.stringify({title:"Forbidden",class:"All",date:"2026-07-22"})});
  check(forbidden.status===403,"student mutation denial",String(forbidden.status));
  const nonAdminSecurity=await request("/api/security/settings",{headers:{cookie:cookies.student}});check(nonAdminSecurity.status===403,"student security API denial",String(nonAdminSecurity.status));
  const teacherDirectory=await request("/api/resources/teachers",{headers:{cookie:cookies.student}});const teacherRows=(await teacherDirectory.json()).data||[];check(teacherRows.every(row=>!("email" in row.payload)&&!("phone" in row.payload)&&!("address" in row.payload)),"student teacher-directory PII redaction");
  const crossSite=await request("/api/resources/announcements",{method:"POST",headers:{cookie:cookies.admin,origin:"https://attacker.invalid","content-type":"application/json"},body:JSON.stringify({title:"Blocked",class:"All",date:"2026-07-22"})});check(crossSite.status===403,"cross-site mutation denial",String(crossSite.status));
  const logoutGet=await request("/api/auth/logout",{headers:{cookie:cookies.parent}});check(!logoutGet.headers.get("set-cookie"),"GET logout has no side effect");
  const logoutPost=await request("/api/auth/logout",{method:"POST",headers:{cookie:cookies.parent,origin:base}});check(logoutPost.status===200&&(logoutPost.headers.get("set-cookie")||"").includes("Max-Age=0"),"POST logout clears session",String(logoutPost.status));
  const database=new Database(process.env.DATABASE_PATH||"./data/sime.db");
  if(awardId)database.prepare("DELETE FROM gamification_points WHERE id=?").run(awardId);
  database.prepare("UPDATE users SET active=0 WHERE tenant_id=? AND email=?").run("demo-school","parent@school-ing.gn");
  const revoked=await request("/api/auth/me",{headers:{cookie:cookies.parent}});check(revoked.status===401,"deactivated account session revocation",String(revoked.status));
  database.prepare("UPDATE users SET active=1 WHERE tenant_id=? AND email=?").run("demo-school","parent@school-ing.gn");database.close();
} finally {
  try { const database=new Database(process.env.DATABASE_PATH||"./data/sime.db");database.prepare("UPDATE users SET active=1 WHERE tenant_id=? AND email=?").run("demo-school","parent@school-ing.gn");database.prepare("UPDATE tenants SET active=1 WHERE id='sample-academy'").run();database.prepare("DELETE FROM gamification_points WHERE note='Verification award'").run();if(originalGlobalLeaderboardPublic!==undefined)database.prepare("UPDATE gamification_settings SET global_leaderboard_public=? WHERE tenant_id=?").run(originalGlobalLeaderboardPublic,"demo-school");database.close(); } catch {}
  server?.kill("SIGTERM");
}

if(failures.length){console.error(`FAILED ${failures.length}/${checks.length}\n${failures.join("\n")}\n\nServer log:\n${logs}`);process.exit(1);}
console.log(`PASS ${checks.length} integration checks across all roles, pages, APIs, CRUD, and sessions.`);
