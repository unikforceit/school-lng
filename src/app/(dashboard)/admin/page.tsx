import AdminDashboard from "@/components/AdminDashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function AdminPage() { const session = await getSession(); if (!session) redirect("/sign-in"); if(session.role!=="admin")redirect(`/${session.role}`); return <AdminDashboard />; }
