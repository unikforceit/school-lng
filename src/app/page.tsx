import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
const features = [
  {
    icon: "/home.png",
    title: "Pilotage en temps réel",
    text: "Tableaux de bord par rôle, notifications et données synchronisées.",
  },
  {
    icon: "/student.png",
    title: "Parcours de l’élève",
    text: "Inscriptions annuelles, présences, résultats, promotion et bulletins versionnés.",
  },
  {
    icon: "/setting.png",
    title: "Conçu pour la Guinée",
    text: "Cycles nationaux, CEE, BEPC, Baccalauréat, français, GNF et Africa/Conakry.",
  },
];
export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-white text-[#102039]">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="School-InG · GNG GROUP"
              width={48}
              height={48}
              priority
              className="h-11 w-11 object-contain sm:hidden"
            />
            <Image
              src="/design/school-ing-logo.png"
              alt=""
              width={190}
              height={64}
              priority
              className="hidden h-14 w-auto object-contain sm:block"
            />
          </Link>
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-7 text-sm font-bold md:flex"
          >
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#guinee">Guinée</a>
            <Link href="/developers">API</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Link
              href="/sign-in"
              className="min-h-11 rounded-xl bg-[#efa900] px-4 py-3 text-sm font-black text-[#102039]"
            >
              Connexion
            </Link>
          </div>
        </div>
      </header>
      <section className="overflow-hidden bg-[#fbfaf6]">
        <div className="mx-auto grid min-h-[650px] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1fr_.92fr]">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[.2em] text-[#c88700]">
              La gestion scolaire, simplement
            </p>
            <h1 className="max-w-2xl text-5xl font-black leading-[.98] tracking-[-.045em] sm:text-6xl">
              Chaque école.
              <br />
              <span className="text-[#d89500]">Une année maîtrisée.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-600">
              School-InG relie administration, enseignants, élèves et parents
              dans un espace sécurisé, français par défaut et adapté au système
              éducatif guinéen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-in"
                className="min-h-12 rounded-xl bg-[#102039] px-6 py-3.5 text-sm font-black text-white"
              >
                Découvrir la plateforme
              </Link>
              <a
                href="#fonctionnalites"
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-black"
              >
                Voir les fonctions
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[500px]">
            <Image
              src="/design/hero-study.webp"
              alt="Élèves apprenant ensemble"
              width={760}
              height={920}
              priority
              className="h-[520px] w-full rounded-[2rem] object-cover"
            />
            <div className="absolute -bottom-5 end-3 rounded-2xl bg-white px-5 py-4 shadow-xl sm:-end-5">
              <p className="text-xs font-bold text-slate-500">Année scolaire</p>
              <p className="text-xl font-black">2026–2027 · Guinée</p>
            </div>
          </div>
        </div>
      </section>
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[.18em] text-[#c88700]">
            Pratique au quotidien
          </p>
          <h2 className="mt-3 text-4xl font-black">
            Tout ce qui compte, accessible sans détour.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_15px_50px_rgba(15,23,42,.06)]"
            >
              <Image src={item.icon} alt="" width={28} height={28} />
              <h3 className="mt-5 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section id="guinee" className="bg-[#102039] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-black uppercase tracking-[.18em] text-amber-400">
              School-InG · GNG GROUP
            </p>
            <h2 className="mt-3 text-4xl font-black">
              Une base commune, une configuration propre à chaque école.
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              Préscolaire, primaire, collège et lycée restent configurables. Les
              années clôturées deviennent historiques et protégées ; les
              reconductions copient la structure sans copier notes, présences,
              factures ou paiements.
            </p>
          </div>
          <Image
            src="/design/library-study.jpg"
            alt="Élèves étudiant dans une bibliothèque"
            width={720}
            height={480}
            className="h-80 w-full rounded-2xl object-cover"
          />
        </div>
      </section>
      <footer className="bg-[#fbfaf6] py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center">
          <div>
            <Image
              src="/design/school-ing-logo.png"
              alt="School-InG · GNG GROUP"
              width={180}
              height={60}
              className="h-14 w-auto object-contain"
            />
            <p className="mt-2 text-sm text-slate-500">
              Gestion scolaire sécurisée et adaptée à la Guinée.
            </p>
          </div>
          <div className="flex gap-5 text-sm font-bold">
            <Link href="/developers">Documentation API</Link>
            <Link href="/sign-in">Connexion</Link>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t px-5 pt-6 text-xs text-slate-400">
          © 2026 School-InG · GNG GROUP. Tous droits réservés.
        </p>
      </footer>
    </main>
  );
}
