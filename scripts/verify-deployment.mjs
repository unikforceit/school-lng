import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
let checks = 0;
const check = (value, label) => { checks++; if (!value) failures.push(label); };
const read = (file) => readFileSync(join(root, file), "utf8");

const pkg = JSON.parse(read("package.json"));
const config = read("next.config.mjs");
const dockerfile = read("Dockerfile");
const compose = read("docker-compose.yml");
const rootLayout = read("src/app/layout.tsx");
const languageProvider = read("src/components/LanguageProvider.tsx");
const css = read("src/app/globals.css");
const shell = read("src/components/DashboardShell.tsx");
const notifications = read("src/components/NotificationCenter.tsx");
const stream = read("src/app/api/notifications/stream/route.ts");
const guide = read("DEPLOYMENT.md");
const idCard = read("src/components/IdCard.tsx");
const i18n = read("src/lib/i18n.ts");
const profileApi = read("src/app/api/profile/route.ts");
const supabaseAuth = read("src/lib/supabase-auth.ts");
const auth = read("src/lib/auth.ts");
const schoolSignIn = read("src/app/sign-in/page.tsx");
const platformSignIn = read("src/components/PlatformSignInForm.tsx");
const cardSecretBuild = read("scripts/prepare-card-secret.mjs");

check(pkg.engines?.node === ">=22 <23", "Node.js production runtime is pinned to the supported major");
check(config.includes('output: "standalone"'), "Next.js standalone output is enabled");
check(existsSync(join(root, ".next/standalone/server.js")), "standalone production server artifact exists");
check(dockerfile.includes("USER node") && dockerfile.includes(".next/standalone") && dockerfile.includes('CMD ["node", "server.js"]'), "container is standalone and non-root");
check(compose.includes("/api/health") && compose.includes("sime-data:/app/data"), "container health check and persistent data volume are configured");
check(rootLayout.includes('href="#main-content"') && rootLayout.includes('cookies()') && rootLayout.includes('initialLanguage={language}') && rootLayout.includes('dir={direction}'), "server-rendered locale, text direction, and skip navigation are present");
check(languageProvider.includes("initialLanguage") && languageProvider.includes('window.addEventListener("storage"') && languageProvider.includes("sime_language="), "language choice remains consistent across SSR, navigation, and browser tabs");
check(css.includes(":focus-visible") && css.includes("prefers-reduced-motion") && css.includes("forced-colors"), "focus, reduced-motion, and high-contrast support are present");
check(shell.includes('aria-modal="true"') && shell.includes('event.key === "Escape"') && shell.includes('event.key === "Tab"'), "mobile navigation is a keyboard-safe dialog");
check(notifications.includes('role="status"') && notifications.includes('navigator.onLine') && notifications.includes("router.refresh()"), "notification center exposes live/offline sync state and refreshes pages");
check(stream.includes("last-event-id") && stream.includes('X-Accel-Buffering'), "realtime stream supports reconnect resumption and proxy-safe delivery");
check(guide.includes("Railway") && guide.includes("Vercel + Supabase") && guide.includes("Render + persistent disk") && guide.includes("Fly.io + volume") && guide.includes("cPanel") && guide.includes("Docker VPS"), "deployment guide covers supported hosting paths");
check(i18n.includes('code: "ar"') && i18n.includes('code: "fr"') && i18n.includes('direction: "rtl"'), "multilingual catalog includes Arabic, French, and RTL metadata");
check(!i18n.includes('code: "bn"') && !i18n.includes('Bengali') && !i18n.includes('বাংলা'), "removed Bengali locale cannot be selected or persisted");
check(idCard.includes('print("selected")') && idCard.includes('print("all")') && css.includes("85.6mm") && css.includes("53.98mm"), "ID cards support selected and authorized bulk printing at ISO card size");
check(profileApi.includes(".strict()") && profileApi.includes("hasValidOrigin") && profileApi.includes("updateUserMetadata"), "profile editing validates an allowlist and enforces same-origin writes");
check(supabaseAuth.includes("user.user_metadata") && supabaseAuth.includes("metadata.role") && !supabaseAuth.includes("profile.role"), "editable user metadata is separated from app-controlled authorization metadata");
check(auth.includes('cache(resolveSession)') && auth.includes("userFromAccessToken(token)"), "Supabase session validation is safely deduplicated within each server render");
check(!schoolSignIn.includes("demoAccounts") && !schoolSignIn.includes("ChangeMe123!") && !schoolSignIn.includes('useState("demo-school")'), "school login form does not expose or prefill demo credentials");
check(!platformSignIn.includes("SuperAdmin123!") && platformSignIn.includes('useState("")'), "platform login form does not expose or prefill credentials");
check(pkg.scripts?.prebuild?.includes("prepare:card-secret") && cardSecretBuild.includes("randomBytes(32)") && read(".gitignore").includes("id-card-secret.ts"), "Vercel builds generate an uncommitted cryptographic ID-card signing key");

if (failures.length) {
  console.error(`FAILED ${failures.length}/${checks}\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`PASS ${checks} deployment, container, realtime-resilience, and accessibility readiness checks.`);
