import nextEnv from "@next/env";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

nextEnv.loadEnvConfig(process.cwd());
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const searchModule = require("../.next/server/app/api/search/route.js");
const schoolLoginModule = require("../.next/server/app/api/auth/login/route.js");
const platformLoginModule = require("../.next/server/app/api/platform/auth/login/route.js");
const base = "http://127.0.0.1:6969";

const accounts = {
  superadmin: ["platform", "superadmin@sime.local", "SuperAdmin123!"],
  admin: ["demo-school", "admin@sime.local", "ChangeMe123!"],
  teacher: ["demo-school", "teacher@sime.local", "Teacher123!"],
  student: ["demo-school", "student@sime.local", "Student123!"],
  parent: ["demo-school", "parent@sime.local", "Parent123!"],
};
const failures = [];
let checks = 0;
function check(condition, label) { checks += 1; if (!condition) failures.push(label); }
function context() { return { params: undefined, prerenderManifest: { preview: { previewModeId: "", previewModeSigningKey: "", previewModeEncryptionKey: "" } }, renderOpts: { supportsDynamicResponse: true, experimental: { authInterrupts: false }, cacheComponents: false, waitUntil: () => {}, onClose: () => {}, onAfterTaskError: undefined, onInstrumentationRequestError: () => {} }, sharedContext: { buildId: "search-verification" } }; }
async function search(cookie, query) {
  const response = await searchModule.routeModule.handle(new NextRequest(`${base}/api/search?q=${encodeURIComponent(query)}`, { headers: cookie ? { cookie } : {} }), context());
  return { status: response.status, data: (await response.json().catch(() => null))?.data || [] };
}
async function login(role) {
  const [tenantId, email, password] = accounts[role];
  const platform = role === "superadmin";
  const module = platform ? platformLoginModule : schoolLoginModule;
  const url = platform ? "/api/platform/auth/login" : "/api/auth/login";
  const body = platform ? { email, password } : { tenantId, email, password };
  const response = await module.routeModule.userland.POST(new Request(`${base}${url}`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(body) }));
  check(response.status === 200, `${role} login for search`);
  return (response.headers.get("set-cookie") || "").split(";")[0];
}

const anonymous = await search("", "dashboard");
check(anonymous.status === 401, "anonymous search is denied");
for (const role of Object.keys(accounts)) {
  const cookie = await login(role);
  const navigation = await search(cookie, "dashboard");
  check(navigation.status === 200 && navigation.data.some(item => item.category === "Navigation"), `${role} navigation search`);
  if (role === "admin" || role === "teacher") {
    const person = await search(cookie, "Jessica");
    check(person.data.some(item => item.category === "Student" && item.href.startsWith("/list/students/")), `${role} student destination`);
  }
  if (role === "student" || role === "parent") {
    const privateTeacher = await search(cookie, "teacher@sime.local");
    check(!privateTeacher.data.some(item => item.title === "Emily Anderson"), `${role} cannot search hidden teacher email`);
    const otherStudent = await search(cookie, "Nabil");
    check(!otherStudent.data.some(item => ["Results", "Attendance", "Student"].includes(item.category)), `${role} cannot search another student's records`);
    const ownRecord = await search(cookie, "Jessica");
    check(ownRecord.data.some(item => ["Results", "Attendance"].includes(item.category)), `${role} can search authorized student records`);
  }
  if (role === "superadmin") {
    const school = await search(cookie, "demo-school");
    check(school.data.some(item => item.href === "/superadmin/schools/demo-school"), "superadmin school destination");
  }
}

if (failures.length) {
  console.error(`FAILED ${failures.length}/${checks}\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`PASS ${checks} compiled search checks across anonymous access and all five roles.`);
