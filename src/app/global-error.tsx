"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main id="main-content" className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl" role="alert"><h1 className="text-2xl font-black text-slate-900">SIME needs to reload</h1><p className="mt-3 text-slate-600">A temporary application error occurred. Your stored school data was not removed.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-amber-500 px-5 font-bold text-slate-950">Reload application</button></section></main></body></html>;
}
