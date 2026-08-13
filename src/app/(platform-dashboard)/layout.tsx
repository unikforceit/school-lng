import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getSession } from "@/lib/auth";

export default async function PlatformLayout({children}:{children:React.ReactNode}){
  const session=await getSession();
  if(!session)redirect("/superadmin/sign-in");
  if(session.role!=="superadmin"||session.tenantId!=="platform")redirect(`/${session.role}`);
  return <DashboardShell userId={session.name} role={session.role} tenantId={session.tenantId}>{children}</DashboardShell>;
}
