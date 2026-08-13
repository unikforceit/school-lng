import RoleDashboard from "@/components/RoleDashboard";
import RoleProgressWidget from "@/components/RoleProgressWidget";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function StudentPage() { const session = await getSession(); if (!session) redirect("/sign-in"); if (session.role !== "student") redirect(`/${session.role}`); return <><RoleDashboard role="student" name={session.name} /><RoleProgressWidget title="My subject progression" /></>; }
