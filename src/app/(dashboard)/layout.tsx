import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import FloatingSage from "@/components/FloatingSage";
import DashboardShell from "@/components/DashboardShell";
import { getAiSettings, roleAllowed } from "@/lib/ai-settings";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.role === "superadmin") redirect("/superadmin");
  const ai = getAiSettings(session.tenantId);
  const apiAccess=session.role==="admin"?db.prepare("SELECT school_visible visible FROM developer_api_settings WHERE tenant_id=?").get(session.tenantId) as {visible:number}|undefined:undefined;
  return <DashboardShell userId={session.name} role={session.role} tenantId={session.tenantId} apiVisible={Boolean(apiAccess?.visible)}>{children}{ai.floatingEnabled && roleAllowed(ai,session.role) && <FloatingSage name={session.name} role={session.role} />}</DashboardShell>;
}
