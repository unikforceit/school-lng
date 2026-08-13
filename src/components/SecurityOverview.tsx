import type { Role } from "@/lib/auth";

export default function SecurityOverview({ role }: { role: Role }) {
  return <div className="space-y-5">
    <header className="rounded-xl bg-[#0c2237] p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#efa900]">Account protection</p>
      <h1 className="mt-2 text-2xl font-bold">Security center</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Your session, permissions, and school data are protected with tenant isolation and role-based editing.</p>
    </header>
    <section className="grid gap-4 md:grid-cols-3">
      {[['Session','Your signed session remains active for up to seven days.'],['Permissions',`You are signed in as ${role}. Navigation, page routes, APIs, and editing rights are limited to this role.`],['Privacy','Your ID card is private to your account. Only administrators can select and print another person’s card.']].map(([title,copy])=><article key={title} className="rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p></article>)}
    </section>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Security policy changes, API credentials, login-attempt logs, and tenant-wide controls are restricted to administrators.</p>
  </div>;
}
