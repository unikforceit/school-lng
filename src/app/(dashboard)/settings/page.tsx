import SecuritySettings from "@/components/SecuritySettings";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SecurityOverview from "@/components/SecurityOverview";
export default async function SettingsPage(){const session=await getSession();if(!session)redirect("/sign-in");return session.role==="admin"?<SecuritySettings/>:<SecurityOverview role={session.role}/>;}
