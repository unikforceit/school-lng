"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: number; category: string; title: string; message: string; link: string; createdAt: string; isRead: number };

export default function NotificationCenter() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notifications unavailable");
      const payload = await response.json();
      const nextItems = (payload.data?.notifications || []) as Item[];
      setItems(nextItems);
      setUnread(payload.data?.unread || 0);
      return nextItems[0]?.id || 0;
    } catch {
      setConnected(false);
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let source: EventSource | undefined;
    let cancelled = false;
    void load().then((latest) => {
      if (cancelled) return;
      source = new EventSource(`/api/notifications/stream?after=${latest}`);
      source.addEventListener("notification", () => {
        setConnected(true);
        void load();
        router.refresh();
        window.dispatchEvent(new CustomEvent("sime:realtime"));
      });
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
    });
    return () => { cancelled = true; source?.close(); };
  }, [load, router]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", escape); };
  }, []);

  async function read(id?: number) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    }).catch(() => null);
    if (response?.ok) await load();
  }

  const syncLabel = !online ? "Offline — updates will resume when connected" : connected ? "Live updates connected" : "Reconnecting to live updates";

  return <div className="relative" ref={root}>
    <p className="sr-only" role="status" aria-live="polite">{syncLabel}</p>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifications, ${unread} unread. ${syncLabel}`} aria-expanded={open} aria-controls="notification-panel" title={syncLabel} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:border-amber-300 hover:bg-[#fff9eb]">
      <span aria-hidden="true" className="text-lg">🔔</span>
      <span aria-hidden="true" className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${!online ? "bg-slate-400" : connected ? "bg-emerald-500" : "bg-amber-400"}`} />
      {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-black leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>

    {open && <section id="notification-panel" aria-label="Notification center" className="fixed inset-x-3 top-[72px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div><h2 className="font-extrabold">Notification center</h2><p className="text-xs text-slate-600">{syncLabel}</p></div>
        {unread > 0 && <button type="button" onClick={() => void read()} className="min-h-10 rounded-lg px-2 text-xs font-bold text-[#8b6000] hover:bg-amber-50">Mark all read</button>}
      </header>
      <div className="max-h-[min(560px,70vh)] overflow-y-auto" aria-busy={loading}>
        {items.map((item) => {
          const content = <><div className="flex items-start justify-between gap-3"><strong className="text-sm">{item.title}</strong>{!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c88700]" aria-label="Unread" />}</div><p className="mt-1 text-xs leading-5 text-slate-700">{item.message}</p><time className="mt-2 block text-[11px] text-slate-500">{new Date(item.createdAt.replace(" ", "T") + "Z").toLocaleString()}</time></>;
          const className = `block min-h-[76px] w-full border-b px-4 py-3 text-left hover:bg-[#fffaf0] ${item.isRead ? "bg-white" : "bg-amber-50/60"}`;
          return item.link ? <Link key={item.id} href={item.link} onClick={() => { setOpen(false); void read(item.id); }} className={className}>{content}</Link> : <button type="button" key={item.id} onClick={() => void read(item.id)} className={className}>{content}</button>;
        })}
        {!items.length && <p role="status" className="px-5 py-12 text-center text-sm text-slate-500">{loading ? "Loading notifications…" : "You’re all caught up."}</p>}
      </div>
    </section>}
  </div>;
}
