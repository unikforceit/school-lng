"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationCenter from "@/components/NotificationCenter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

export default function Navbar({ userId, role, onMenuOpen, menuOpen = false }: { userId: string; role: string; tenantId: string; onMenuOpen?: () => void; menuOpen?: boolean }) {
  const platform=role==="superadmin";
  const {t}=useLanguage();
  useEffect(() => {
    const refresh = () => { void fetch("/api/auth/refresh", { method: "POST" }).then(response=>{if(response.status===401)window.location.assign(platform?"/superadmin/sign-in":"/sign-in")}).catch(() => undefined); };
    refresh();const interval = window.setInterval(refresh, 15 * 60 * 1000);return () => window.clearInterval(interval);
  }, [platform]);
  return <header className="sticky top-0 z-40 flex min-h-[76px] items-center justify-between gap-2 border-b border-[#f0eee8] bg-white/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-6 lg:px-8">
    {onMenuOpen&&<button id="dashboard-menu-button" type="button" onClick={onMenuOpen} aria-label={t("openMenu")} aria-controls="mobile-navigation" aria-expanded={menuOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-700 hover:border-amber-300 hover:bg-amber-50 lg:hidden">☰</button>}
    <div className="min-w-0 flex-1"><GlobalSearch/></div>
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5"><LanguageSwitcher compact/><NotificationCenter/>{!platform&&<><Link href="/list/announcements" aria-label={t("announcements")} className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white transition hover:border-amber-200 hover:bg-[#fff9eb] sm:flex"><Image src="/announcement.png" alt="" width={18} height={18}/></Link><Link href="/list/messages" aria-label={t("messages")} className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white transition hover:border-amber-200 hover:bg-[#fff9eb] sm:flex"><Image src="/message.png" alt="" width={18} height={18}/></Link></>}
      <Link href={platform?"/superadmin":"/profile"} className="ms-1 flex min-h-12 items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-[#faf9f5] sm:px-2"><Image src="/avatar.png" alt="" width={39} height={39} className="h-[39px] w-[39px] rounded-full object-cover ring-2 ring-[#fff2c8]"/><span className="hidden min-w-0 sm:block"><strong className="block max-w-36 truncate text-sm font-bold text-[#102039]">{userId}</strong><span className="block text-xs capitalize text-slate-500">{role}</span></span><span aria-hidden="true" className="hidden text-lg text-[#102039] sm:inline">⌄</span><span className="sr-only">{t("openProfile")}</span></Link>
    </div>
  </header>;
}
