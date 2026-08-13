import nextEnv from "@next/env";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

nextEnv.loadEnvConfig(process.cwd());
globalThis.AsyncLocalStorage = AsyncLocalStorage;

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const Database = require("better-sqlite3");
const notifications = require("../.next/server/app/api/notifications/route.js");
const stream = require("../.next/server/app/api/notifications/stream/route.js");
const schoolLogin = require("../.next/server/app/api/auth/login/route.js");
const platformLogin = require("../.next/server/app/api/platform/auth/login/route.js");
const base = "http://127.0.0.1:6969";
const failures = [];
let checks = 0;

function check(value, label, detail = "") {
  checks++;
  if (!value) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function context() {
  return {
    params: {},
    prerenderManifest: {
      preview: {
        previewModeId: "",
        previewModeSigningKey: "",
        previewModeEncryptionKey: "",
      },
    },
    renderOpts: {
      supportsDynamicResponse: true,
      experimental: { authInterrupts: false },
      cacheComponents: false,
      waitUntil: () => {},
      onClose: () => {},
      onAfterTaskError: undefined,
      onInstrumentationRequestError: () => {},
    },
    sharedContext: { buildId: "notification-verification" },
  };
}

async function login(role) {
  const values = {
    superadmin: [platformLogin, "/api/platform/auth/login", { email: "superadmin@sime.local", password: "SuperAdmin123!" }],
    admin: [schoolLogin, "/api/auth/login", { tenantId: "demo-school", email: "admin@sime.local", password: "ChangeMe123!" }],
    teacher: [schoolLogin, "/api/auth/login", { tenantId: "demo-school", email: "teacher@sime.local", password: "Teacher123!" }],
    student: [schoolLogin, "/api/auth/login", { tenantId: "demo-school", email: "student@sime.local", password: "Student123!" }],
    parent: [schoolLogin, "/api/auth/login", { tenantId: "demo-school", email: "parent@sime.local", password: "Parent123!" }],
  };
  const [routeModule, path, body] = values[role];
  const response = await routeModule.routeModule.userland.POST(
    new Request(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify(body),
    }),
  );
  check(response.status === 200, `${role} login`);
  return (response.headers.get("set-cookie") || "").split(";")[0];
}

async function call(routeModule, path, cookie, method = "GET", body) {
  return routeModule.routeModule.handle(
    new NextRequest(`${base}${path}`, {
      method,
      headers: {
        cookie,
        ...(method !== "GET" ? { origin: base, "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    context(),
  );
}

const database = new Database(process.env.DATABASE_PATH || "./data/sime.db");
const ids = [];

try {
  const cookies = {};
  for (const role of ["superadmin", "admin", "teacher", "student", "parent"]) {
    cookies[role] = await login(role);
  }

  const insert = database.prepare(
    "INSERT INTO notifications(tenant_id,audience_role,user_email,category,title,message,link) VALUES(?,?,?,?,?,?,?)",
  );
  ids.push(
    Number(insert.run("demo-school", "all", "", "system", "Realtime verification", "Visible to every school role", "").lastInsertRowid),
    Number(insert.run("demo-school", "student", "student@sime.local", "academic", "Private verification", "Visible only to Jessica", "").lastInsertRowid),
    Number(insert.run("platform", "superadmin", "", "platform", "Platform verification", "Visible only in platform console", "").lastInsertRowid),
  );

  for (const role of ["admin", "teacher", "student", "parent"]) {
    const response = await call(notifications, "/api/notifications", cookies[role]);
    const payload = await response.json();
    check(response.status === 200 && payload.data.notifications.some((item) => item.title === "Realtime verification"), `${role} receives school notification`);
    check((role === "student") === payload.data.notifications.some((item) => item.title === "Private verification"), `${role} notification audience isolation`);
  }

  const platformResponse = await call(notifications, "/api/notifications", cookies.superadmin);
  const platformPayload = await platformResponse.json();
  check(
    platformResponse.status === 200 &&
      platformPayload.data.notifications.some((item) => item.title === "Platform verification") &&
      !platformPayload.data.notifications.some((item) => item.title === "Realtime verification"),
    "platform notification tenant isolation",
  );

  const marked = await call(notifications, "/api/notifications", cookies.student, "PATCH", { id: ids[1] });
  check(marked.status === 200, "notification marked read");
  const afterMark = await call(notifications, "/api/notifications", cookies.student);
  const afterPayload = await afterMark.json();
  check(afterPayload.data.notifications.find((item) => item.id === ids[1])?.isRead === 1, "read state persists");

  const streamed = await call(stream, "/api/notifications/stream?after=0", cookies.admin);
  const reader = streamed.body.getReader();
  const chunk = await reader.read();
  await reader.cancel();
  check(
    streamed.headers.get("content-type")?.includes("text/event-stream") &&
      new TextDecoder().decode(chunk.value).includes("event: notification"),
    "server-sent notification stream emits live event",
  );
} finally {
  for (const id of ids) database.prepare("DELETE FROM notifications WHERE id=?").run(id);
  database.close();
}

if (failures.length) {
  console.error(`FAILED ${failures.length}/${checks}\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`PASS ${checks} notification checks across all roles, tenant/audience isolation, persisted reads, and live SSE delivery.`);
