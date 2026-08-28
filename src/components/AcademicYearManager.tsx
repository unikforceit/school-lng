"use client";
import { useEffect, useMemo, useState } from "react";

type Term = {
  id: number;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  compositionStart: string;
  compositionEnd: string;
  reportPublicationDate: string;
  status: "open" | "closed";
  reportsPublished: number;
};
type Year = {
  id: number;
  name: string;
  code: string;
  status: "draft" | "scheduled" | "active" | "closed" | "archived";
  startDate: string;
  endDate: string;
  periodSystem: string;
  terms: Term[];
  structure: Array<{
    id: number;
    itemType: string;
    code: string;
    name: string;
  }>;
  audit: Array<{
    id: number;
    actor: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
    createdAt: string;
  }>;
};
const initial = {
  name: "2026–2027",
  code: "2026-2027",
  startDate: "2026-09-15",
  endDate: "2027-06-30",
  enrollmentStart: "2026-07-01",
  enrollmentEnd: "2026-09-30",
  periodSystem: "terms",
  schoolOpeningDate: "2026-09-15",
  holidays: [],
  closures: [],
  exams: [
    { name: "CEE", date: "2027-06-10" },
    { name: "BEPC", date: "2027-06-15" },
    { name: "Baccalauréat", date: "2027-06-20" },
  ],
  maximum: 20,
  passMark: 10,
  roundingRule: "0.01",
  rankingRule: "dense",
  minimumAverage: 10,
  terms: [
    {
      name: "1er trimestre",
      code: "T1",
      startDate: "2026-09-15",
      endDate: "2026-12-18",
      compositionStart: "2026-12-07",
      compositionEnd: "2026-12-12",
      reportPublicationDate: "2026-12-18",
    },
    {
      name: "2e trimestre",
      code: "T2",
      startDate: "2027-01-04",
      endDate: "2027-03-26",
      compositionStart: "2027-03-15",
      compositionEnd: "2027-03-20",
      reportPublicationDate: "2027-03-26",
    },
    {
      name: "3e trimestre",
      code: "T3",
      startDate: "2027-04-05",
      endDate: "2027-06-30",
      compositionStart: "2027-06-14",
      compositionEnd: "2027-06-19",
      reportPublicationDate: "2027-06-30",
    },
  ],
};

export default function AcademicYearManager() {
  const [years, setYears] = useState<Year[]>([]),
    [form, setForm] = useState(initial),
    [selected, setSelected] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(true);
  const [structureDraft, setStructureDraft] = useState({
    itemType: "class",
    code: "",
    name: "",
  });
  const current = useMemo(
    () => years.find((year) => year.id === selected) || years[0],
    [years, selected],
  );
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/academic-years", {
          cache: "no-store",
        }),
        payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setYears(payload.data);
      setSelected((value) => value ?? payload.data[0]?.id ?? null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chargement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const saved = localStorage.getItem("school-ing-academic-year-draft");
    if (saved)
      try {
        setForm(JSON.parse(saved));
      } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void load();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "school-ing-academic-year-draft",
      JSON.stringify(form),
    );
  }, [form]);
  async function request(body: unknown) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/academic-years", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setNotice("Modification enregistrée et journalisée.");
      await load();
      return payload.data;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Opération impossible.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const result = await request(form);
    if (result) {
      localStorage.removeItem("school-ing-academic-year-draft");
      setForm(initial);
    }
  }
  async function transition(
    action: "schedule" | "activate" | "close" | "reopen" | "archive",
  ) {
    if (!current) return;
    let reason = "";
    if (action === "reopen") {
      reason =
        window.prompt(
          "Justification obligatoire de la réouverture (10 caractères minimum)",
        ) || "";
      if (reason.length < 10) return;
    }
    if (
      !window.confirm(`Confirmer l’action « ${action} » pour ${current.name} ?`)
    )
      return;
    await request({
      operation: "transition",
      yearId: current.id,
      action,
      reason,
    });
  }
  async function rollover() {
    if (!current) return;
    const targets = years.filter(
      (year) => year.id !== current.id && year.status === "draft",
    );
    if (!targets.length) {
      setError("Créez d’abord l’année de destination en brouillon.");
      return;
    }
    const preview = await request({
      operation: "rollover-preview",
      yearId: current.id,
    });
    if (!preview) return;
    const target = targets[0];
    if (
      window.confirm(
        `${preview.students} élèves à prévisualiser. Copier la structure vers ${target.name} ? Les notes, présences, factures et paiements seront exclus.`,
      )
    )
      await request({
        operation: "rollover",
        yearId: current.id,
        targetYearId: target.id,
      });
  }
  async function generateReports() {
    if (!current) return;
    const correctionReason =
      window.prompt(
        "Motif de correction (laissez vide pour la première version)",
      ) || "";
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/academic-years/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "generate",
          yearId: current.id,
          correctionReason,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Génération impossible.");
      setNotice(
        `${payload.data.created} bulletin(s) calculé(s) dans une nouvelle version immuable.`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Génération impossible.");
    } finally {
      setSaving(false);
    }
  }
  const field =
    "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100";
  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-r from-[#102039] to-[#214b6c] p-5 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.2em] text-amber-400">
          Paramètres · Années scolaires
        </p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">
          Pilotage académique School‑InG
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
          Configurez le calendrier guinéen, les périodes, la structure
          pédagogique et un cycle de clôture auditable.
        </p>
      </header>
      {!online && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
        >
          Vous êtes hors ligne. Votre brouillon reste enregistré sur cet
          appareil et pourra être envoyé au retour de la connexion.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          {error}{" "}
          <button className="ms-2 underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
        <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Années configurées</h2>
              <p className="text-sm text-slate-500">
                Une seule année peut être active par école.
              </p>
            </div>
            <select
              aria-label="Choisir une année"
              value={current?.id || ""}
              onChange={(event) => setSelected(Number(event.target.value))}
              className="min-h-11 rounded-xl border px-3"
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name} · {year.status}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Chargement…
            </p>
          ) : current ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">{current.name}</h3>
                    <p className="text-sm text-slate-500">
                      {current.startDate} → {current.endDate} · Guinea ·
                      Africa/Conakry · GNF
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-900">
                    {current.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {current.status === "draft" && (
                    <button
                      disabled={saving}
                      onClick={() => void transition("schedule")}
                      className="min-h-11 rounded-lg border px-3 text-sm font-bold"
                    >
                      Planifier
                    </button>
                  )}
                  {["draft", "scheduled"].includes(current.status) && (
                    <button
                      disabled={saving}
                      onClick={() => void transition("activate")}
                      className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white"
                    >
                      Activer
                    </button>
                  )}
                  {current.status === "active" && (
                    <button
                      disabled={saving}
                      onClick={() => void transition("close")}
                      className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-bold text-white"
                    >
                      Clôturer
                    </button>
                  )}
                  {current.status === "closed" && (
                    <>
                      <button
                        disabled={saving}
                        onClick={() => void transition("reopen")}
                        className="min-h-11 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-700"
                      >
                        Réouvrir avec motif
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => void transition("archive")}
                        className="min-h-11 rounded-lg border px-3 text-sm font-bold"
                      >
                        Archiver
                      </button>
                    </>
                  )}
                  <button
                    disabled={saving}
                    onClick={() => void rollover()}
                    className="min-h-11 rounded-lg border border-amber-400 px-3 text-sm font-bold text-amber-900"
                  >
                    Assistant de reconduction
                  </button>
                  {!(["closed", "archived"] as string[]).includes(
                    current.status,
                  ) && (
                    <button
                      disabled={saving}
                      onClick={() => void generateReports()}
                      className="min-h-11 rounded-lg bg-[#102039] px-3 text-sm font-bold text-white"
                    >
                      Générer les bulletins
                    </button>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-black">Périodes et publication</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {current.terms.map((term) => (
                    <article key={term.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <b>{term.name}</b>
                        <span className="text-xs uppercase text-slate-500">
                          {term.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {term.startDate} → {term.endDate}
                      </p>
                      <label className="mt-3 flex min-h-10 items-center gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(term.reportsPublished)}
                          disabled={
                            saving ||
                            ["closed", "archived"].includes(current.status)
                          }
                          onChange={(event) =>
                            void request({
                              operation: "term",
                              yearId: current.id,
                              termId: term.id,
                              status: term.status,
                              reportsPublished: event.target.checked,
                            })
                          }
                        />{" "}
                        Bulletins publiés
                      </label>
                      <button
                        disabled={
                          saving ||
                          ["closed", "archived"].includes(current.status)
                        }
                        onClick={() =>
                          void request({
                            operation: "term",
                            yearId: current.id,
                            termId: term.id,
                            status: term.status === "open" ? "closed" : "open",
                            reportsPublished: Boolean(term.reportsPublished),
                          })
                        }
                        className="mt-2 min-h-10 w-full rounded-lg border text-xs font-bold"
                      >
                        {term.status === "open"
                          ? "Fermer la période"
                          : "Rouvrir la période"}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-black">Structure guinéenne configurable</h3>
                {!(["closed", "archived"] as string[]).includes(
                  current.status,
                ) && (
                  <form
                    className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const added = await request({
                        operation: "structure-add",
                        yearId: current.id,
                        ...structureDraft,
                      });
                      if (added)
                        setStructureDraft({
                          itemType: "class",
                          code: "",
                          name: "",
                        });
                    }}
                  >
                    <select
                      aria-label="Type d’élément"
                      value={structureDraft.itemType}
                      onChange={(event) =>
                        setStructureDraft({
                          ...structureDraft,
                          itemType: event.target.value,
                        })
                      }
                      className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                    >
                      {[
                        ["cycle", "Cycle"],
                        ["level", "Niveau"],
                        ["stream", "Filière"],
                        ["section", "Section"],
                        ["class", "Classe"],
                        ["subject", "Matière"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      aria-label="Code"
                      placeholder="Code"
                      value={structureDraft.code}
                      onChange={(event) =>
                        setStructureDraft({
                          ...structureDraft,
                          code: event.target.value,
                        })
                      }
                      className="min-h-11 rounded-lg border px-3 text-sm"
                    />
                    <input
                      required
                      aria-label="Nom"
                      placeholder="Nom"
                      value={structureDraft.name}
                      onChange={(event) =>
                        setStructureDraft({
                          ...structureDraft,
                          name: event.target.value,
                        })
                      }
                      className="min-h-11 rounded-lg border px-3 text-sm"
                    />
                    <button
                      disabled={saving}
                      className="min-h-11 rounded-lg bg-[#102039] px-4 text-sm font-bold text-white"
                    >
                      Ajouter
                    </button>
                  </form>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.structure.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full border bg-white px-3 py-1.5 text-xs"
                    >
                      <b className="text-amber-800">{item.itemType}</b> ·{" "}
                      {item.name}
                      {!(["closed", "archived"] as string[]).includes(
                        current.status,
                      ) && (
                        <button
                          type="button"
                          aria-label={`Supprimer ${item.name}`}
                          onClick={() =>
                            window.confirm(`Supprimer ${item.name} ?`) &&
                            void request({
                              operation: "structure-delete",
                              yearId: current.id,
                              itemId: item.id,
                            })
                          }
                          className="ms-2 font-black text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-black">Historique d’audit</h3>
                <ol className="mt-3 space-y-2">
                  {current.audit.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg bg-slate-50 p-3 text-xs"
                    >
                      <b>{item.action}</b> · {item.previousStatus || "—"} →{" "}
                      {item.newStatus || "—"}
                      <span className="block text-slate-500">
                        {item.actor} ·{" "}
                        {new Date(
                          item.createdAt.replace(" ", "T") + "Z",
                        ).toLocaleString("fr-FR")}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              Aucune année scolaire. Créez la première à droite.
            </p>
          )}
        </section>
        <form
          onSubmit={create}
          className="h-fit rounded-2xl border bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="text-xl font-black">Créer une année</h2>
          <p className="mt-1 text-sm text-slate-500">
            Brouillon sauvegardé automatiquement.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm font-bold">
              Nom
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Début
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Fin
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Début inscriptions
              <input
                required
                type="date"
                value={form.enrollmentStart}
                onChange={(e) =>
                  setForm({ ...form, enrollmentStart: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Fin inscriptions
              <input
                required
                type="date"
                value={form.enrollmentEnd}
                onChange={(e) =>
                  setForm({ ...form, enrollmentEnd: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Ouverture de l’école
              <input
                required
                type="date"
                value={form.schoolOpeningDate}
                onChange={(e) =>
                  setForm({ ...form, schoolOpeningDate: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Organisation
              <select
                value={form.periodSystem}
                onChange={(e) =>
                  setForm({ ...form, periodSystem: e.target.value })
                }
                className={field}
              >
                <option value="terms">3 trimestres</option>
                <option value="semesters">2 semestres</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Note maximale
              <input
                type="number"
                value={form.maximum}
                onChange={(e) =>
                  setForm({ ...form, maximum: Number(e.target.value) })
                }
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Moyenne de passage
              <input
                type="number"
                value={form.minimumAverage}
                onChange={(e) =>
                  setForm({ ...form, minimumAverage: Number(e.target.value) })
                }
                className={field}
              />
            </label>
          </div>
          <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            Valeurs fixes : Guinée · Africa/Conakry · français · GNF. Le modèle
            inclut CEE, BEPC, Baccalauréat et trois trimestres modifiables via
            l’API.
          </div>
          <button
            disabled={saving || !online}
            className="mt-5 min-h-12 w-full rounded-xl bg-[#d89500] px-4 font-black text-slate-950 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Créer en brouillon"}
          </button>
        </form>
      </div>
    </div>
  );
}
