import { getSession } from "@/lib/auth";
export default async function ProfilePage() {
  const session = await getSession();
  return <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Account</p><h1 className="mt-2 text-2xl font-semibold">Profile</h1><dl className="mt-6 grid max-w-xl gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Email</dt><dd className="mt-1 break-all font-medium">{session?.userId}</dd></div><div><dt className="text-xs text-slate-400">Role</dt><dd className="mt-1 font-medium capitalize">{session?.role}</dd></div><div><dt className="text-xs text-slate-400">School tenant</dt><dd className="mt-1 font-medium">{session?.tenantId}</dd></div><div><dt className="text-xs text-slate-400">Session expires</dt><dd className="mt-1 font-medium">{session ? new Date(session.exp).toLocaleString() : "—"}</dd></div></dl></div>;
}
