"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/auth";
import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";

type Props = {
  children: React.ReactNode;
  userId: string;
  role: Role;
  tenantId: string;
  apiVisible?: boolean;
};

function Brand({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const {t}=useLanguage();
  return <Link href={role === "superadmin" ? "/superadmin" : `/${role}`} onClick={onNavigate} className="mb-2 flex h-[72px] items-center justify-start gap-3 px-2">
    <Image src="/design/school-ing-logo.png" alt={role === "superadmin" ? "School-InG platform" : "School-InG · GNG GROUP"} width={150} height={50} className="h-11 w-auto object-contain" priority />
    <span className="sr-only">{t("dashboardHome")}</span>
  </Link>;
}

export default function DashboardShell({ children, userId, role, tenantId, apiVisible = false }: Props) {
  const pathname = usePathname();
  const {t}=useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current !== pathname) setMenuOpen(false);
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        const focusable = drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", keyboard);
      document.getElementById("dashboard-menu-button")?.focus();
    };
  }, [menuOpen]);

  return <div className="flex min-h-screen bg-[#f8f7f3] text-[#102039]">
    <aside className="dashboard-sidebar fixed inset-y-0 start-0 z-40 hidden w-60 overflow-y-auto border-e border-[#efede7] bg-white px-4 py-3 lg:block">
      <Brand role={role} />
      <Menu role={role} apiVisible={apiVisible} />
    </aside>

    {menuOpen && <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
      <button type="button" aria-label={t("closeNavigation")} className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
      <aside ref={drawer} id="mobile-navigation" role="dialog" aria-modal="true" aria-label={t("mainNavigation")} className="mobile-navigation-drawer relative h-full w-[min(21rem,88vw)] overflow-y-auto border-e border-slate-200 bg-white px-4 py-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <Brand role={role} onNavigate={() => setMenuOpen(false)} />
          <button ref={closeButton} type="button" onClick={() => setMenuOpen(false)} aria-label={t("closeMenu")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-2xl text-slate-600 hover:bg-slate-50">×</button>
        </div>
        <Menu role={role} apiVisible={apiVisible} expanded />
      </aside>
    </div>}

    <div className="dashboard-content flex min-h-screen min-w-0 flex-1 flex-col lg:ms-60">
      <Navbar userId={userId} role={role} tenantId={tenantId} onMenuOpen={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-3 pb-8 pt-5 sm:px-6 lg:px-8 lg:pt-7">{children}</main>
    </div>
  </div>;
}
