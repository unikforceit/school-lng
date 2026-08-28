import Link from "next/link";
import { apiDatasets } from "@/lib/developer-api";
const code =
  "overflow-x-auto rounded-xl bg-[#101a2d] p-4 font-mono text-xs leading-6 text-slate-100";
export default function DeveloperDocs() {
  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#142038]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="font-black">
            School-InG <span className="text-[#d49300]">Developers</span>
          </Link>
          <a
            href="/api/openapi"
            className="min-h-11 rounded-lg bg-[#e7a000] px-4 py-3 text-sm font-bold text-slate-950"
          >
            OpenAPI JSON
          </a>
        </div>
      </header>
      <article className="mx-auto max-w-5xl space-y-12 px-5 py-12">
        <section>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ca8a00]">
            API reference · v1
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Connect your systems to School-InG.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            The integration API provides tenant-isolated access to licensed
            school data for approved server-to-server integrations, reporting
            pipelines and mobile backends.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <b>Never put an API key in browser or mobile code.</b> Store it in a
            server-side secret manager; keys are shown only once.
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Authentication</h2>
          <p className="leading-7 text-slate-600">
            A platform super administrator enables access and issues a
            school-bound, revocable read or read/write key. Send it with{" "}
            <code>X-API-Key</code>.
          </p>
          <pre className={code}>
            <code>{`export SCHOOL_ING_API_KEY="school_ing_live_..."\nexport BASE_URL="${process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:6969"}/api/v1"\n\ncurl "$BASE_URL/data/students?limit=25" \\\n  -H "X-API-Key: $SCHOOL_ING_API_KEY"`}</code>
          </pre>
        </section>
        <section>
          <h2 className="text-2xl font-black">Available datasets</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {apiDatasets.map((item) => (
              <code
                key={item}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              >
                {item}
              </code>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="text-2xl font-black">Examples</h2>
          <div className="rounded-2xl border bg-white p-5">
            <b>GET /api/v1/data/attendance</b>
            <pre className={`${code} mt-4`}>
              <code>{`curl "$BASE_URL/data/attendance?q=10e-A" \\\n  -H "X-API-Key: $SCHOOL_ING_API_KEY"`}</code>
            </pre>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <b>POST /api/v1/data/students</b>
            <pre className={`${code} mt-4`}>
              <code>{`curl -X POST "$BASE_URL/data/students" \\\n  -H "X-API-Key: $SCHOOL_ING_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"studentId":"GIN-2026-2042","name":"Mamadou Camara","email":"mamadou@ecole.gn","grade":10,"className":"10e-A"}'`}</code>
            </pre>
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-black">Errors and limits</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Responses use JSON and ISO 8601 dates. List endpoints support
            pagination. Keys are scope-bound, rate-limited, expirable and
            disabled when the school license is suspended.
          </p>
        </section>
      </article>
    </main>
  );
}
