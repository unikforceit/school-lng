import RoleDashboard from "@/components/RoleDashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function TeacherPage() { const session = await getSession(); if (!session) redirect("/sign-in"); if (session.role !== "teacher") redirect(`/${session.role}`); return <RoleDashboard role="teacher" name={session.name} />; }
