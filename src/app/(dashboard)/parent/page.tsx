import RoleDashboard from "@/components/RoleDashboard";
import RoleProgressWidget from "@/components/RoleProgressWidget";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function ParentPage() { const session = await getSession(); if (!session) redirect("/sign-in"); if (session.role !== "parent") redirect(`/${session.role}`); return <><RoleDashboard role="parent" name={session.name} /><RoleProgressWidget title="My child’s progress" /></>; }
