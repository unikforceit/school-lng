import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolScope } from "@/lib/gamification";
import StudentCsvToolbar from "@/components/StudentCsvToolbar";

export default async function StudentDirectoryLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.role !== "admin" && session.role !== "teacher") redirect(`/${session.role}`);
  const classes=session.role==="teacher"?schoolScope(session).classes:[];
  const classFilter=session.role==="teacher"?(classes.length?` AND class_name IN (${classes.map(()=>"?").join(",")})`:" AND 1=0"):"";
  const rows=db.prepare(`SELECT student_id studentId,name,email,phone,grade,class_name className,address,gender,blood_type bloodType,photo_url photoUrl FROM students WHERE tenant_id=?${classFilter} ORDER BY name LIMIT 500`).all(session.tenantId,...classes) as Array<Record<string,unknown>>;
  return <div className="space-y-4"><StudentCsvToolbar rows={rows} canImport={session.role==="admin"}/>{children}</div>;
}
