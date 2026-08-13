# school-lng — SIME multi-tenant school management

SIME is a full-stack Next.js application with reusable React interfaces, tenant-isolated persistence, signed authentication, and a guarded OpenRouter-powered school copilot.

## Functional modules

- Admin, teacher, student, and parent dashboards
- Platform super-admin dashboard for isolated school instances
- Students, teachers, parents, subjects, classes, and lessons
- Exams, assignments, results, and attendance
- Events, messages, and announcements
- Profile, settings, and SAGE AI workspace
- Standard-size printable ID cards with signed QR verification
- Overall/class gamification leaderboards and configurable scoring rules
- Tenant-scoped student gender analytics on the admin dashboard
- Search plus create, update, and delete workflows backed by the current SQLite application adapter
- Tenant-scoped generic resource APIs for reusable school deployments

## Security model

- HTTP-only, signed, rolling session cookie
- Tenant ID carried in the signed session, never trusted from CRUD request input
- Shared role matrix enforced in navigation, server pages, APIs, and mutations
- Personal ID cards are self-only; administrators can generate cards for all tenant identities
- Signed, expiring ID-card QR tokens are revalidated against active database records
- Zod validation, SQL parameters, database constraints, request limits, and AI timeouts
- Server-only OpenRouter key and metadata-only AI audit records
- Clickjacking, MIME-sniffing, referrer, browser-permission, and cross-origin headers
- Production fails closed when credentials or `AUTH_SECRET` are absent

## Local run — port 6969

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:6969/sign-in](http://localhost:6969/sign-in). Local school login:

- School ID: `demo-school`
- Email: `admin@sime.local`
- Password: `ChangeMe123!`

Additional MVP roles use school ID `demo-school`:

- Teacher: `teacher@sime.local` / `Teacher123!`
- Student: `student@sime.local` / `Student123!`
- Parent: `parent@sime.local` / `Parent123!`

Platform administration has its own login at [http://localhost:6969/superadmin/sign-in](http://localhost:6969/superadmin/sign-in):

- Super admin: `superadmin@sime.local` / `SuperAdmin123!`

The platform console includes school provisioning, tenant details, license lifecycle and capacity controls, cross-school user status, an audit trail, and platform-wide operational settings. Disabled or unlicensed tenants have their sessions revoked immediately.

A second seeded instance is available for multi-school visualization:

- School ID: `sample-academy`
- Administrator: `principal@sample.local` / `SampleAdmin123!`

The database and demo tenant are created automatically. To enable SAGE, put an OpenRouter key in `.env.local`.

## Supabase deployment status

Supabase project `skxizqwipqthvukzgcll` now contains the secured SIME PostgreSQL schema in [`supabase/migrations`](./supabase/migrations). All 23 public tables have RLS enabled with server-only policies, and six change tables are registered with Supabase Realtime. No secret keys, local password hashes, or private SQLite records are committed to this repository.

The running Next.js application still uses its SQLite adapter. A Vercel deployment can build from this repository, but persistent production writes must wait until the application database adapter is converted to Supabase/PostgreSQL. Do not present a Vercel preview using ephemeral SQLite as a persistent production deployment.

## Production run

Generate strong, unique secrets and do not use the demo credentials:

```bash
npm ci
npm run check
npm start
```

`npm start` serves port 6969. Health check: `GET /api/health`.

Docker is supported:

```bash
docker compose up --build
```

Persist `/app/data` as a volume and terminate TLS at the reverse proxy. SQLite is suitable for one application instance and many school tenants. For horizontally concurrent application replicas, replace the storage adapter with managed PostgreSQL and use Redis-backed distributed rate limiting; a shared SQLite file is not safe as a multi-host production database.

## Configuration

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | HMAC session secret; required in production |
| `ID_CARD_SECRET` | Optional separate HMAC secret for ID-card QR tokens; falls back to `AUTH_SECRET` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Initial administrator credentials |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Initial platform administrator credentials |
| `DATABASE_PATH` | SQLite database location |
| `OPENROUTER_API_KEY` | Optional server-side AI credential |
| `OPENROUTER_MODEL` | OpenRouter model identifier |
| `NEXT_PUBLIC_APP_URL` | Public application origin |

## Verification

```bash
npm run verify:all
```

This runs the production build plus integration suites for all roles, search, AI, assignments, role-scoped feedback, platform isolation, developer API controls, and every settings workflow. See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway, Vercel + Supabase, cPanel, and Docker VPS deployment plans.

Before processing real student information, add managed user provisioning/password hashing, password reset and MFA, immutable security audit storage, encrypted backups, a PostgreSQL adapter for horizontal scaling, distributed rate limiting, observability, and a privacy review against applicable education and data-protection regulations.
