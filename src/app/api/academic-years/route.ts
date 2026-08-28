import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { securityOriginValid } from "@/lib/security";
import {
  academicYearSchema,
  createAcademicYear,
  rolloverAcademicYear,
  rolloverPreview,
  setTermState,
  transitionAcademicYear,
} from "@/lib/academic-years";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const operationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("transition"),
    yearId: z.number().int().positive(),
    action: z.enum(["schedule", "activate", "close", "reopen", "archive"]),
    reason: z.string().trim().max(500).default(""),
  }),
  z.object({
    operation: z.literal("term"),
    yearId: z.number().int().positive(),
    termId: z.number().int().positive(),
    status: z.enum(["open", "closed"]),
    reportsPublished: z.boolean(),
  }),
  z.object({
    operation: z.literal("rollover-preview"),
    yearId: z.number().int().positive(),
  }),
  z.object({
    operation: z.literal("rollover"),
    yearId: z.number().int().positive(),
    targetYearId: z.number().int().positive(),
  }),
  z.object({
    operation: z.literal("structure-add"),
    yearId: z.number().int().positive(),
    itemType: z.enum(["cycle", "level", "stream", "section", "class", "subject"]),
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(2).max(80),
  }),
  z.object({
    operation: z.literal("structure-delete"),
    yearId: z.number().int().positive(),
    itemId: z.number().int().positive(),
  }),
]);

async function admin() {
  const session = await getSession();
  if (!session)
    return { error: jsonError("Authentification requise.", 401) } as const;
  if (session.role !== "admin")
    return {
      error: jsonError("Réservé aux administrateurs autorisés.", 403),
    } as const;
  const permission = db
    .prepare(
      "SELECT can_manage canManage,can_reopen canReopen FROM academic_year_permissions WHERE tenant_id=? AND user_email=?",
    )
    .get(session.tenantId, session.userId) as
    { canManage: number; canReopen: number } | undefined;
  if (!permission?.canManage)
    return {
      error: jsonError(
        "Permission de gestion des années scolaires requise.",
        403,
      ),
    } as const;
  return { session, permission } as const;
}

export async function GET() {
  const auth = await admin();
  if ("error" in auth) return auth.error;
  const years = db
    .prepare(
      `SELECT id,name,code,country,timezone,default_language defaultLanguage,currency,start_date startDate,end_date endDate,enrollment_start enrollmentStart,enrollment_end enrollmentEnd,period_system periodSystem,status,school_opening_date schoolOpeningDate,grading_json grading,promotion_json promotion,created_at createdAt,updated_at updatedAt FROM academic_years WHERE tenant_id=? ORDER BY start_date DESC`,
    )
    .all(auth.session.tenantId) as Array<
    Record<string, unknown> & { id: number; grading: string; promotion: string }
  >;
  const data = years.map((year) => ({
    ...year,
    grading: JSON.parse(year.grading),
    promotion: JSON.parse(year.promotion),
    terms: db
      .prepare(
        "SELECT id,name,code,position,start_date startDate,end_date endDate,composition_start compositionStart,composition_end compositionEnd,report_publication_date reportPublicationDate,status,reports_published reportsPublished FROM academic_terms WHERE academic_year_id=? ORDER BY position",
      )
      .all(year.id),
    structure: db
      .prepare(
        "SELECT id,item_type itemType,code,name,parent_id parentId,sort_order sortOrder FROM academic_structure_items WHERE academic_year_id=? ORDER BY item_type,sort_order",
      )
      .all(year.id),
    audit: db
      .prepare(
        "SELECT id,actor_email actor,action,previous_status previousStatus,new_status newStatus,reason,created_at createdAt FROM academic_year_audit WHERE academic_year_id=? ORDER BY id DESC LIMIT 30",
      )
      .all(year.id),
  }));
  return Response.json({
    data,
    permissions: { canReopen: Boolean(auth.permission.canReopen) },
  });
}

export async function POST(request: Request) {
  const auth = await admin();
  if ("error" in auth) return auth.error;
  if (!securityOriginValid(request, auth.session.tenantId))
    return jsonError("Origine de requête invalide.", 403);
  const raw = await request.json().catch(() => null);
  const operation = operationSchema.safeParse(raw);
  try {
    if (operation.success) {
      const value = operation.data;
      if (value.operation === "transition")
        return Response.json({
          data: {
            status: transitionAcademicYear(
              auth.session.tenantId,
              value.yearId,
              auth.session.userId,
              value.action,
              value.reason,
            ),
          },
        });
      if (value.operation === "term") {
        setTermState(
          auth.session.tenantId,
          value.yearId,
          value.termId,
          auth.session.userId,
          value.status,
          value.reportsPublished,
        );
        return Response.json({ data: { ok: true } });
      }
      if (value.operation === "rollover-preview")
        return Response.json({
          data: rolloverPreview(auth.session.tenantId, value.yearId),
        });
      if (value.operation === "rollover") return Response.json({
        data: rolloverAcademicYear(
          auth.session.tenantId,
          value.yearId,
          value.targetYearId,
          auth.session.userId,
        ),
      });
      const year=db.prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?").get(value.yearId,auth.session.tenantId) as {status:string}|undefined;
      if(!year||["closed","archived"].includes(year.status))throw new Error("La structure de cette année est en lecture seule.");
      if(value.operation==="structure-add"){
        const result=db.prepare("INSERT INTO academic_structure_items(tenant_id,academic_year_id,item_type,code,name,sort_order) VALUES(?,?,?,?,?,COALESCE((SELECT MAX(sort_order)+1 FROM academic_structure_items WHERE academic_year_id=? AND item_type=?),0))").run(auth.session.tenantId,value.yearId,value.itemType,value.code.toUpperCase(),value.name,value.yearId,value.itemType);
        db.prepare("INSERT INTO academic_year_audit(tenant_id,academic_year_id,actor_email,action,previous_status,new_status,details_json) VALUES(?,?,?,?,?,?,?)").run(auth.session.tenantId,value.yearId,auth.session.userId,"structure_added",year.status,year.status,JSON.stringify({itemId:Number(result.lastInsertRowid),itemType:value.itemType,code:value.code}));
        return Response.json({data:{id:Number(result.lastInsertRowid)}},{status:201});
      }
      const removed=db.prepare("DELETE FROM academic_structure_items WHERE id=? AND academic_year_id=? AND tenant_id=?").run(value.itemId,value.yearId,auth.session.tenantId);
      if(!removed.changes)throw new Error("Élément de structure introuvable ou encore utilisé.");
      db.prepare("INSERT INTO academic_year_audit(tenant_id,academic_year_id,actor_email,action,previous_status,new_status,details_json) VALUES(?,?,?,?,?,?,?)").run(auth.session.tenantId,value.yearId,auth.session.userId,"structure_deleted",year.status,year.status,JSON.stringify({itemId:value.itemId}));
      return Response.json({data:{ok:true}});
    }
    const parsed = academicYearSchema.safeParse(raw);
    if (!parsed.success)
      return jsonError(
        "Données de l’année scolaire invalides.",
        400,
        parsed.error.flatten(),
      );
    const id = createAcademicYear(
      auth.session.tenantId,
      auth.session.userId,
      parsed.data,
    );
    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Opération impossible.";
    return jsonError(message, message.includes("UNIQUE") ? 409 : 400);
  }
}
