import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";
import {
  generateReportCards,
  publishReportVersion,
} from "@/lib/academic-years";
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("generate"),
    yearId: z.number().int().positive(),
    correctionReason: z.string().trim().max(500).default(""),
  }),
  z.object({
    operation: z.literal("publish"),
    yearId: z.number().int().positive(),
    reportId: z.number().int().positive(),
  }),
]);
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentification requise.", 401);
  if (!["admin", "teacher"].includes(session.role))
    return jsonError("Accès refusé.", 403);
  const yearId = Number(new URL(request.url).searchParams.get("yearId"));
  if (!Number.isInteger(yearId) || yearId < 1)
    return jsonError("Année invalide.", 400);
  const rows = db
    .prepare(
      `SELECT r.id,r.version,r.status,r.snapshot_json snapshot,r.correction_reason correctionReason,r.created_by createdBy,r.created_at createdAt,r.published_at publishedAt,s.name student FROM report_card_versions r JOIN students s ON s.id=r.student_id WHERE r.tenant_id=? AND r.academic_year_id=? ORDER BY s.name,r.version DESC`,
    )
    .all(session.tenantId, yearId) as Array<
    Record<string, unknown> & { snapshot: string }
  >;
  return Response.json({
    data: rows.map((row) => ({ ...row, snapshot: JSON.parse(row.snapshot) })),
  });
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentification requise.", 401);
  if (session.role !== "admin")
    return jsonError("Réservé à l’administration.", 403);
  if (!securityOriginValid(request, session.tenantId))
    return jsonError("Origine invalide.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError("Opération invalide.", 400, parsed.error.flatten());
  try {
    if (parsed.data.operation === "generate")
      return Response.json({
        data: generateReportCards(
          session.tenantId,
          parsed.data.yearId,
          session.userId,
          parsed.data.correctionReason,
        ),
      });
    publishReportVersion(
      session.tenantId,
      parsed.data.yearId,
      parsed.data.reportId,
      session.userId,
    );
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Opération impossible.",
      400,
    );
  }
}
