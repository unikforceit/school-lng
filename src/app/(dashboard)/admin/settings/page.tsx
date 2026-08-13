import SecuritySettings from "@/components/SecuritySettings";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AiAdminSettings from "@/components/AiAdminSettings";

export default async function AdminSecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.role !== "admin") redirect("/settings");
  return <div className="space-y-5"><SecuritySettings /><AiAdminSettings /></div>;
}
