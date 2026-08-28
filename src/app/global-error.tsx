"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="fr"><body><main id="main-content" className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl" role="alert"><h1 className="text-2xl font-black text-slate-900">School-InG doit être rechargé</h1><p className="mt-3 text-slate-600">Une erreur temporaire est survenue. Vos données scolaires enregistrées n’ont pas été supprimées.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-amber-500 px-5 font-bold text-slate-950">Recharger l’application</button></section></main></body></html>;
}
