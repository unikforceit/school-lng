import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp, hasValidOrigin, jsonError, rateLimit } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { securityOriginValid } from "@/lib/security";
import { schoolScope } from "@/lib/gamification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const studentSchema = z.object({
  studentId: z.string().trim().min(3).max(32),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(150),
  phone: z.string().trim().max(32).default(""),
  grade: z.coerce.number().int().min(1).max(12),
  className: z.string().trim().min(1).max(32),
  address: z.string().trim().max(240).default(""),
  gender: z.enum(["female","male","other","unspecified"]).default("unspecified"),
  bloodType: z.string().trim().max(12).default("Unknown"),
  photoUrl: z.union([z.url().max(500),z.literal("")]).default(""),
});

const selectStudents = `SELECT id, student_id AS studentId, name, email, phone, grade,
  class_name AS className, address, gender, blood_type AS bloodType, photo_url AS photoUrl, created_at AS createdAt, updated_at AS updatedAt FROM students`;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required", 401);
  if (session.role !== "admin" && session.role !== "teacher") return jsonError("Student directory access is limited to administrators and teachers", 403);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const scope=session.role==="teacher"?schoolScope(session):null;
  const classes=scope?.classes||[];
  const classFilter=session.role==="teacher"?(classes.length?` AND class_name IN (${classes.map(()=>"?").join(",")})`:" AND 1=0"):"";
  const args:unknown[]=[session.tenantId,...classes];
  const rows = query
    ? db.prepare(`${selectStudents} WHERE tenant_id = ?${classFilter} AND (name LIKE ? OR email LIKE ? OR student_id LIKE ?) ORDER BY name LIMIT 100`).all(...args,...Array(3).fill(`%${query}%`))
    : db.prepare(`${selectStudents} WHERE tenant_id = ?${classFilter} ORDER BY name LIMIT 100`).all(...args);
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError("Administrator access required", session ? 403 : 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const limit = rateLimit(`students:${getClientIp(request)}`, 30);
  if (!limit.allowed) return jsonError("Too many requests", 429, { retryAfter: limit.retryAfter });
  const parsed = studentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid student data", 400, parsed.error.flatten());
  try {
    const result = db.prepare(`INSERT INTO students (student_id, name, email, phone, grade, class_name, address, gender, blood_type, photo_url, tenant_id)
      VALUES (@studentId, @name, @email, @phone, @grade, @className, @address, @gender, @bloodType, @photoUrl, @tenantId)`).run({ ...parsed.data, tenantId: session.tenantId });
    const student = db.prepare(`${selectStudents} WHERE id = ? AND tenant_id = ?`).get(result.lastInsertRowid, session.tenantId);
    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return jsonError("Student ID or email already exists", 409);
    return jsonError("Unable to create student", 500);
  }
}
