import { z } from "zod";
import { db } from "@/lib/db";

export const academicYearSchema = z
  .object({
    name: z.string().trim().min(3).max(40),
    code: z.string().trim().min(3).max(20),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    enrollmentStart: z.iso.date(),
    enrollmentEnd: z.iso.date(),
    periodSystem: z.enum(["terms", "semesters"]).default("terms"),
    schoolOpeningDate: z.iso.date(),
    holidays: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          date: z.iso.date(),
        }),
      )
      .max(30)
      .default([]),
    closures: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          date: z.iso.date(),
        }),
      )
      .max(30)
      .default([]),
    exams: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          date: z.iso.date(),
        }),
      )
      .max(20)
      .default([]),
    maximum: z.number().min(1).max(100).default(20),
    passMark: z.number().min(0).max(100).default(10),
    roundingRule: z.enum(["0.01", "0.1", "1"]).default("0.01"),
    rankingRule: z.enum(["dense", "competition"]).default("dense"),
    minimumAverage: z.number().min(0).max(100).default(10),
    terms: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(40),
          code: z.string().trim().min(1).max(12),
          startDate: z.iso.date(),
          endDate: z.iso.date(),
          compositionStart: z.iso.date(),
          compositionEnd: z.iso.date(),
          reportPublicationDate: z.iso.date(),
        }),
      )
      .min(2)
      .max(6),
  })
  .superRefine((value, ctx) => {
    if (value.startDate >= value.endDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fin doit suivre le début.",
      });
    if (value.enrollmentStart > value.enrollmentEnd)
      ctx.addIssue({
        code: "custom",
        path: ["enrollmentEnd"],
        message: "Période d'inscription invalide.",
      });
    if (value.passMark > value.maximum)
      ctx.addIssue({
        code: "custom",
        path: ["passMark"],
        message: "Le seuil ne peut pas dépasser le maximum.",
      });
    for (const [index, term] of value.terms.entries())
      if (
        term.startDate < value.startDate ||
        term.endDate > value.endDate ||
        term.startDate > term.endDate
      )
        ctx.addIssue({
          code: "custom",
          path: ["terms", index],
          message: "La période doit rester dans l'année scolaire.",
        });
  });

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type AcademicYearStatus =
  "draft" | "scheduled" | "active" | "closed" | "archived";

export function createAcademicYear(
  tenantId: string,
  actor: string,
  input: AcademicYearInput,
) {
  return db.transaction(() => {
    const created = db
      .prepare(
        `INSERT INTO academic_years(tenant_id,name,code,start_date,end_date,enrollment_start,enrollment_end,period_system,school_opening_date,holidays_json,closures_json,exams_json,grading_json,rounding_rule,ranking_rule,promotion_json,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        tenantId,
        input.name,
        input.code,
        input.startDate,
        input.endDate,
        input.enrollmentStart,
        input.enrollmentEnd,
        input.periodSystem,
        input.schoolOpeningDate,
        JSON.stringify(input.holidays),
        JSON.stringify(input.closures),
        JSON.stringify(input.exams),
        JSON.stringify({ maximum: input.maximum, passMark: input.passMark }),
        input.roundingRule,
        input.rankingRule,
        JSON.stringify({ minimumAverage: input.minimumAverage }),
        actor,
      );
    const id = Number(created.lastInsertRowid);
    const addTerm = db.prepare(
      `INSERT INTO academic_terms(academic_year_id,tenant_id,name,code,position,start_date,end_date,composition_start,composition_end,report_publication_date) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    );
    input.terms.forEach((term, index) =>
      addTerm.run(
        id,
        tenantId,
        term.name,
        term.code,
        index + 1,
        term.startDate,
        term.endDate,
        term.compositionStart,
        term.compositionEnd,
        term.reportPublicationDate,
      ),
    );
    seedGuineaStructure(tenantId, id);
    audit(tenantId, id, actor, "created", "", "draft", "", {
      periods: input.terms.length,
    });
    return id;
  })();
}

function seedGuineaStructure(tenantId: string, yearId: number) {
  const add = db.prepare(
    "INSERT OR IGNORE INTO academic_structure_items(tenant_id,academic_year_id,item_type,code,name,parent_id,sort_order) VALUES(?,?,?,?,?,?,?)",
  );
  const cycles = [
    {
      code: "PRESCO",
      name: "Préscolaire",
      levels: ["Petite section", "Moyenne section", "Grande section"],
    },
    {
      code: "PRIM",
      name: "Primaire",
      levels: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
    },
    { code: "COLL", name: "Collège", levels: ["7e", "8e", "9e", "10e"] },
    { code: "LYC", name: "Lycée", levels: ["11e", "12e / Terminale"] },
  ];
  cycles.forEach((cycle, cycleIndex) => {
    const cycleId = Number(
      add.run(
        tenantId,
        yearId,
        "cycle",
        cycle.code,
        cycle.name,
        null,
        cycleIndex,
      ).lastInsertRowid ||
        (
          db
            .prepare(
              "SELECT id FROM academic_structure_items WHERE academic_year_id=? AND item_type='cycle' AND code=?",
            )
            .get(yearId, cycle.code) as { id: number }
        ).id,
    );
    cycle.levels.forEach((name, index) =>
      add.run(
        tenantId,
        yearId,
        "level",
        name.replace(/\W/g, "-").toUpperCase(),
        name,
        cycleId,
        index,
      ),
    );
  });
  [
    ["MAT", "Mathématiques"],
    ["FR", "Français"],
    ["SC", "Sciences"],
    ["HG", "Histoire-Géographie"],
    ["ECM", "Éducation civique et morale"],
  ].forEach(([code, name], index) =>
    add.run(tenantId, yearId, "subject", code, name, null, index),
  );
}

function audit(
  tenantId: string,
  yearId: number,
  actor: string,
  action: string,
  previous: string,
  next: string,
  reason: string,
  details: Record<string, unknown> = {},
) {
  db.prepare(
    "INSERT INTO academic_year_audit(tenant_id,academic_year_id,actor_email,action,previous_status,new_status,reason,details_json) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    tenantId,
    yearId,
    actor,
    action,
    previous,
    next,
    reason,
    JSON.stringify(details),
  );
}

export function transitionAcademicYear(
  tenantId: string,
  yearId: number,
  actor: string,
  action: "schedule" | "activate" | "close" | "reopen" | "archive",
  reason = "",
) {
  return db.transaction(() => {
    const year = db
      .prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?")
      .get(yearId, tenantId) as { status: AcademicYearStatus } | undefined;
    if (!year) throw new Error("Année scolaire introuvable.");
    const allowed: Record<typeof action, AcademicYearStatus[]> = {
      schedule: ["draft"],
      activate: ["draft", "scheduled"],
      close: ["active"],
      reopen: ["closed"],
      archive: ["closed"],
    };
    if (!allowed[action].includes(year.status))
      throw new Error("Transition non autorisée depuis cet état.");
    if (action === "close") {
      const pending = db
        .prepare(
          "SELECT COUNT(*) count FROM academic_terms WHERE academic_year_id=? AND (status!='closed' OR reports_published=0)",
        )
        .get(yearId) as { count: number };
      if (pending.count)
        throw new Error(
          "Fermez toutes les périodes et publiez leurs bulletins avant la clôture.",
        );
    }
    if (action === "reopen") {
      if (reason.trim().length < 10)
        throw new Error("Une justification détaillée est obligatoire.");
      const permission = db
        .prepare(
          "SELECT can_reopen canReopen FROM academic_year_permissions WHERE tenant_id=? AND user_email=?",
        )
        .get(tenantId, actor) as { canReopen: number } | undefined;
      if (!permission?.canReopen)
        throw new Error("Autorisation spéciale de réouverture requise.");
    }
    const next: AcademicYearStatus =
      action === "schedule"
        ? "scheduled"
        : action === "activate"
          ? "active"
          : action === "close"
            ? "closed"
            : action === "reopen"
              ? "active"
              : "archived";
    db.prepare(
      "UPDATE academic_years SET status=?,closed_at=CASE WHEN ?='closed' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?",
    ).run(next, next, yearId, tenantId);
    audit(tenantId, yearId, actor, action, year.status, next, reason);
    return next;
  })();
}

export function setTermState(
  tenantId: string,
  yearId: number,
  termId: number,
  actor: string,
  status: "open" | "closed",
  reportsPublished: boolean,
) {
  return db.transaction(() => {
    const year = db
      .prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?")
      .get(yearId, tenantId) as { status: AcademicYearStatus } | undefined;
    if (!year) throw new Error("Année scolaire introuvable.");
    if (["closed", "archived"].includes(year.status))
      throw new Error("Cette année est verrouillée.");
    const result = db
      .prepare(
        "UPDATE academic_terms SET status=?,reports_published=? WHERE id=? AND academic_year_id=? AND tenant_id=?",
      )
      .run(status, reportsPublished ? 1 : 0, termId, yearId, tenantId);
    if (!result.changes) throw new Error("Période introuvable.");
    audit(
      tenantId,
      yearId,
      actor,
      "term_updated",
      year.status,
      year.status,
      "",
      { termId, status, reportsPublished },
    );
  })();
}

export function rolloverPreview(tenantId: string, yearId: number) {
  const structures = db
    .prepare(
      "SELECT item_type itemType,COUNT(*) count FROM academic_structure_items WHERE tenant_id=? AND academic_year_id=? GROUP BY item_type",
    )
    .all(tenantId, yearId) as Array<{ itemType: string; count: number }>;
  const students = (
    db
      .prepare("SELECT COUNT(*) count FROM students WHERE tenant_id=?")
      .get(tenantId) as { count: number }
  ).count;
  return {
    copies: structures,
    students,
    excluded: ["notes", "présences", "factures", "paiements"],
    historyProtected: true,
  };
}

export function rolloverAcademicYear(
  tenantId: string,
  sourceId: number,
  targetId: number,
  actor: string,
) {
  return db.transaction(() => {
    const target = db
      .prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?")
      .get(targetId, tenantId) as { status: string } | undefined;
    if (!target || target.status !== "draft")
      throw new Error("La destination doit être une année en brouillon.");
    const source = db
      .prepare(
        "SELECT grading_json grading,coefficients_json coefficients,promotion_json promotion,report_template_json reportTemplate,fee_template_json feeTemplate FROM academic_years WHERE id=? AND tenant_id=?",
      )
      .get(sourceId, tenantId) as Record<string, string> | undefined;
    if (!source) throw new Error("Année source introuvable.");
    db.prepare(
      "DELETE FROM academic_structure_items WHERE academic_year_id=? AND tenant_id=?",
    ).run(targetId, tenantId);
    const rows = db
      .prepare(
        "SELECT item_type itemType,code,name,settings_json settings,sort_order sortOrder FROM academic_structure_items WHERE academic_year_id=? AND tenant_id=? ORDER BY CASE item_type WHEN 'cycle' THEN 1 WHEN 'level' THEN 2 ELSE 3 END,sort_order",
      )
      .all(sourceId, tenantId) as Array<{
      itemType: string;
      code: string;
      name: string;
      settings: string;
      sortOrder: number;
    }>;
    const add = db.prepare(
      "INSERT INTO academic_structure_items(tenant_id,academic_year_id,item_type,code,name,settings_json,sort_order) VALUES(?,?,?,?,?,?,?)",
    );
    rows.forEach((row) =>
      add.run(
        tenantId,
        targetId,
        row.itemType,
        row.code,
        row.name,
        row.settings,
        row.sortOrder,
      ),
    );
    db.prepare(
      "UPDATE academic_years SET grading_json=?,coefficients_json=?,promotion_json=?,report_template_json=?,fee_template_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      source.grading,
      source.coefficients,
      source.promotion,
      source.reportTemplate,
      source.feeTemplate,
      targetId,
    );
    audit(tenantId, targetId, actor, "rollover", "draft", "draft", "", {
      sourceId,
      copiedStructures: rows.length,
      excluded: ["results", "attendance", "invoices", "payments"],
    });
    return { copiedStructures: rows.length };
  })();
}

export function academicYearLocked(
  tenantId: string,
  yearId: number | null | undefined,
) {
  if (!yearId) return false;
  const row = db
    .prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?")
    .get(yearId, tenantId) as { status: string } | undefined;
  return row?.status === "closed" || row?.status === "archived";
}

export function activeAcademicYearId(tenantId: string) {
  return (
    (
      db
        .prepare(
          "SELECT id FROM academic_years WHERE tenant_id=? AND status='active'",
        )
        .get(tenantId) as { id: number } | undefined
    )?.id ?? null
  );
}

function rounded(value: number, rule: string) {
  const factor = rule === "1" ? 1 : rule === "0.1" ? 10 : 100;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
export function generateReportCards(
  tenantId: string,
  yearId: number,
  actor: string,
  correctionReason = "",
) {
  return db.transaction(() => {
    const year = db
      .prepare(
        "SELECT status,rounding_rule roundingRule,ranking_rule rankingRule,promotion_json promotion FROM academic_years WHERE id=? AND tenant_id=?",
      )
      .get(yearId, tenantId) as
      | {
          status: string;
          roundingRule: string;
          rankingRule: string;
          promotion: string;
        }
      | undefined;
    if (!year) throw new Error("Année scolaire introuvable.");
    if (["closed", "archived"].includes(year.status))
      throw new Error("Les bulletins de cette année sont verrouillés.");
    const rows = db
      .prepare(
        "SELECT title,payload FROM resources WHERE tenant_id=? AND academic_year_id=? AND resource_type='results'",
      )
      .all(tenantId, yearId) as Array<{ title: string; payload: string }>;
    const byStudent = new Map<
      string,
      Array<{
        subject: string;
        score: number;
        coefficient: number;
        term: string;
      }>
    >();
    for (const row of rows) {
      const p = JSON.parse(row.payload) as Record<string, unknown>,
        student = String(p.student || row.title),
        score = Number(p.score),
        coefficient = Math.max(0.01, Number(p.coefficient) || 1);
      if (!Number.isFinite(score)) continue;
      const list = byStudent.get(student) || [];
      list.push({
        subject: String(p.subject || "Matière"),
        score,
        coefficient,
        term: String(p.term || ""),
      });
      byStudent.set(student, list);
    }
    const summaries = [...byStudent]
      .map(([student, marks]) => {
        const total = marks.reduce(
            (sum, mark) => sum + mark.score * mark.coefficient,
            0,
          ),
          coefficients = marks.reduce((sum, mark) => sum + mark.coefficient, 0);
        return {
          student,
          marks,
          average: rounded(total / coefficients, year.roundingRule),
          rank: 0,
        };
      })
      .sort(
        (a, b) =>
          b.average - a.average || a.student.localeCompare(b.student, "fr"),
      );
    let previous: number | undefined,
      rank = 0;
    for (let index = 0; index < summaries.length; index++) {
      const row = summaries[index];
      if (previous === undefined || row.average !== previous)
        rank = year.rankingRule === "competition" ? index + 1 : rank + 1;
      row.rank = rank;
      previous = row.average;
    }
    const minimum =
        Number(
          (JSON.parse(year.promotion) as { minimumAverage?: number })
            .minimumAverage,
        ) || 10,
      insert = db.prepare(
        "INSERT INTO report_card_versions(tenant_id,academic_year_id,student_id,version,snapshot_json,correction_reason,created_by) VALUES(?,?,?,COALESCE((SELECT MAX(version)+1 FROM report_card_versions WHERE academic_year_id=? AND student_id=?),1),?,?,?)",
      );
    let created = 0;
    for (const summary of summaries) {
      const student = db
        .prepare("SELECT id FROM students WHERE tenant_id=? AND name=?")
        .get(tenantId, summary.student) as { id: number } | undefined;
      if (!student) continue;
      const existing = (
        db
          .prepare(
            "SELECT COUNT(*) count FROM report_card_versions WHERE academic_year_id=? AND student_id=?",
          )
          .get(yearId, student.id) as { count: number }
      ).count;
      if (existing && correctionReason.trim().length < 5)
        throw new Error(
          "Un motif de correction est requis pour créer une nouvelle version.",
        );
      insert.run(
        tenantId,
        yearId,
        student.id,
        yearId,
        student.id,
        JSON.stringify({
          ...summary,
          decision: summary.average >= minimum ? "promoted" : "repeated",
          generatedAt: new Date().toISOString(),
        }),
        correctionReason,
        actor,
      );
      created++;
    }
    audit(
      tenantId,
      yearId,
      actor,
      "report_versions_generated",
      year.status,
      year.status,
      correctionReason,
      { created },
    );
    return { created, summaries };
  })();
}

export function publishReportVersion(
  tenantId: string,
  yearId: number,
  reportId: number,
  actor: string,
) {
  return db.transaction(() => {
    const year = db
      .prepare("SELECT status FROM academic_years WHERE id=? AND tenant_id=?")
      .get(yearId, tenantId) as { status: string } | undefined;
    if (!year || ["closed", "archived"].includes(year.status))
      throw new Error("Année scolaire introuvable ou verrouillée.");
    const result = db
      .prepare(
        "UPDATE report_card_versions SET status='published',published_at=CURRENT_TIMESTAMP WHERE id=? AND academic_year_id=? AND tenant_id=? AND status='draft'",
      )
      .run(reportId, yearId, tenantId);
    if (!result.changes)
      throw new Error("Version de bulletin introuvable ou déjà publiée.");
    audit(
      tenantId,
      yearId,
      actor,
      "report_version_published",
      year.status,
      year.status,
      "",
      { reportId },
    );
  })();
}
