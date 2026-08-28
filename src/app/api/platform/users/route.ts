import { randomBytes, scryptSync } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { notify } from "@/lib/notifications";
import { auditPlatform, requirePlatform } from "@/lib/platform";
const roles = z.enum(["admin", "teacher", "student", "parent"]),
  createSchema = z.object({
    tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/),
    email: z.email().max(150),
    name: z.string().trim().min(2).max(100),
    role: roles,
    password: z.string().min(12).max(200),
  }),
  patchSchema = z
    .object({
      id: z.number().int().positive(),
      active: z.boolean().optional(),
      name: z.string().trim().min(2).max(100).optional(),
      role: roles.optional(),
      password: z.string().min(12).max(200).optional(),
    })
    .refine((value) => Object.keys(value).length > 1);
function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export async function GET() {
  const auth = await requirePlatform();
  if ("error" in auth) return auth.error;
  const users = db
    .prepare(
      "SELECT u.id,u.tenant_id tenantId,t.name school,u.email,u.name,u.role,u.active,u.created_at createdAt FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.tenant_id!='platform' ORDER BY t.name,u.role,u.name",
    )
    .all();
  return Response.json(
    { data: users },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  const auth = await requirePlatform(request);
  if ("error" in auth) return auth.error;
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return jsonError("Invalid school account", 400, body.error.flatten());
  const school = db
    .prepare("SELECT 1 FROM tenants WHERE id=? AND id!='platform'")
    .get(body.data.tenantId);
  if (!school) return jsonError("School not found", 404);
  const capacity = db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM users WHERE tenant_id=t.id) count,max_users maxUsers FROM tenants t WHERE id=?",
    )
    .get(body.data.tenantId) as { count: number; maxUsers: number };
  if (capacity.count >= capacity.maxUsers)
    return jsonError("School user capacity reached", 409);
  try {
    const email = body.data.email.toLowerCase();
    const result = db.transaction(() => {
      const created = db
        .prepare(
          "INSERT INTO users (tenant_id,email,name,role,password_hash) VALUES (?,?,?,?,?)",
        )
        .run(
          body.data.tenantId,
          email,
          body.data.name,
          body.data.role,
          passwordHash(body.data.password),
        );
      auditPlatform(
        auth.session.userId,
        "school.account_created",
        body.data.tenantId,
        { id: Number(created.lastInsertRowid), email, role: body.data.role },
      );
      notify({
        tenantId: body.data.tenantId,
        roles: [body.data.role],
        userEmail: email,
        category: "account",
        title: "Welcome to School-InG",
        message: "Your school account is ready to use.",
        link: "/profile",
      });
      if (body.data.role !== "admin")
        notify({
          tenantId: body.data.tenantId,
          roles: ["admin"],
          category: "account",
          title: "School account created",
          message: `${body.data.name} was added as ${body.data.role}.`,
          link: "/list/teachers",
        });
      return created;
    })();
    return Response.json(
      { data: { id: Number(result.lastInsertRowid) } },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(
      error instanceof Error && error.message.includes("UNIQUE")
        ? "That email already exists in this school"
        : "Unable to create account",
      error instanceof Error && error.message.includes("UNIQUE") ? 409 : 500,
    );
  }
}
export async function PATCH(request: Request) {
  const auth = await requirePlatform(request);
  if ("error" in auth) return auth.error;
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return jsonError("Invalid user update", 400, body.error.flatten());
  const row = db
    .prepare(
      "SELECT tenant_id tenantId,email,name,role,active FROM users WHERE id=? AND tenant_id!='platform'",
    )
    .get(body.data.id) as
    | {
        tenantId: string;
        email: string;
        name: string;
        role: string;
        active: number;
      }
    | undefined;
  if (!row) return jsonError("School account not found", 404);
  const next = {
    name: body.data.name ?? row.name,
    role: body.data.role ?? row.role,
    active:
      body.data.active === undefined ? row.active : Number(body.data.active),
  };
  db.transaction(() => {
    db.prepare(
      "UPDATE users SET name=?,role=?,active=? WHERE id=? AND tenant_id!='platform'",
    ).run(next.name, next.role, next.active, body.data.id);
    if (body.data.password)
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        passwordHash(body.data.password),
        body.data.id,
      );
    auditPlatform(auth.session.userId, "school.account_updated", row.tenantId, {
      id: body.data.id,
      email: row.email,
      role: next.role,
      active: Boolean(next.active),
      passwordReset: Boolean(body.data.password),
    });
  })();
  return Response.json({ data: { id: body.data.id, ...next } });
}
