import { redirect } from "next/navigation";
import InterventionDashboard from "@/components/InterventionDashboard";
import { getSession } from "@/lib/auth";
export default async function Page(){const session=await getSession();if(!session)redirect("/sign-in");if(session.role!=="admin"&&session.role!=="teacher")redirect(`/${session.role}`);return <InterventionDashboard/>}
