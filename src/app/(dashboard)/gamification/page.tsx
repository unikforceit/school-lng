import GamificationDashboard from "@/components/GamificationDashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Page(){const session=await getSession();if(!session)redirect("/sign-in");if(session.role==="superadmin")redirect("/superadmin");return <GamificationDashboard/>}
