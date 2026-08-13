import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasValidOrigin, jsonError } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { securityOriginValid } from "@/lib/security";

export const runtime = "nodejs";
const idSchema = z.coerce.number().int().positive();
const studentSchema = z.object({ studentId: z.string().trim().min(3).max(32), name: z.string().trim().min(2).max(100), email: z.email().max(150), phone: z.string().trim().max(32).default(""), grade: z.coerce.number().int().min(1).max(12), className: z.string().trim().min(1).max(32), address: z.string().trim().max(240).default(""), gender:z.enum(["female","male","other","unspecified"]).default("unspecified"),bloodType:z.string().trim().max(12).default("Unknown"),photoUrl:z.union([z.url().max(500),z.literal("")]).default("") });
const selectStudent = `SELECT id, student_id AS studentId, name, email, phone, grade, class_name AS className, address, gender, blood_type AS bloodType, photo_url AS photoUrl, created_at AS createdAt, updated_at AS updatedAt FROM students`;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError("Administrator access required", session ? 403 : 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const id = idSchema.safeParse((await context.params).id);
  const body = studentSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return jsonError("Invalid student data", 400, body.success ? undefined : body.error.flatten());
  try {
    const result = db.prepare(`UPDATE students SET student_id=@studentId, name=@name, email=@email, phone=@phone, grade=@grade, class_name=@className, address=@address, gender=@gender, blood_type=@bloodType, photo_url=@photoUrl, updated_at=CURRENT_TIMESTAMP WHERE id=@id AND tenant_id=@tenantId`).run({ ...body.data, id: id.data, tenantId: session.tenantId });
    if (!result.changes) return jsonError("Student not found", 404);
    return Response.json({ data: db.prepare(`${selectStudent} WHERE id = ? AND tenant_id = ?`).get(id.data, session.tenantId) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return jsonError("Student ID or email already exists", 409);
    return jsonError("Unable to update student", 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError("Administrator access required", session ? 403 : 401);
  if (!securityOriginValid(request, session.tenantId)) return jsonError("Invalid request origin", 403);
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success) return jsonError("Invalid student id", 400);
  const result = db.prepare("DELETE FROM students WHERE id = ? AND tenant_id = ?").run(parsed.data, session.tenantId);
  if (!result.changes) return jsonError("Student not found", 404);
  return new NextResponse(null, { status: 204 });
}
