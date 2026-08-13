"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main id="main-content" className="grid min-h-[70vh] place-items-center px-6 py-16">
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="alert">
      <p className="text-sm font-bold uppercase tracking-widest text-amber-700">Something went wrong</p>
      <h1 className="mt-3 text-2xl font-black text-slate-900">This page could not finish loading</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Your saved data is unchanged. Check your connection, then try loading the page again.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-amber-500 px-5 font-bold text-slate-950 hover:bg-amber-400">Try again</button>
        <button type="button" onClick={() => window.location.assign("/")} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold text-slate-700 hover:bg-slate-50">Return home</button>
      </div>
      {error.digest && <p className="mt-6 text-xs text-slate-500">Reference: {error.digest}</p>}
    </section>
  </main>;
}
