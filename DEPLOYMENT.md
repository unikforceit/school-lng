# SIME deployment guide

## Choose the right target

| Target | Works with the current SQLite build? | Best use |
| --- | --- | --- |
| Railway + volume | Yes | Easiest shareable demo |
| Render + persistent disk | Yes, paid disk and one instance | Simple alternative to Railway |
| Fly.io + volume | Yes, one Machine | Docker-based deployment near users |
| Docker VPS / DigitalOcean Droplet | Yes | Maximum control and predictable storage |
| cPanel Node.js hosting | Sometimes | Existing compatible hosting account |
| Vercel or Netlify | Auth/demo preview only | Supabase Auth works; persistent data still needs PostgreSQL migration |

The current realtime channel uses Server-Sent Events and a shared SQLite database. Keep one long-running application instance. For horizontal scaling or serverless hosting, migrate notifications and application data to PostgreSQL and use Supabase Realtime or another shared event service.

## Best option for a shareable demo: Railway + persistent volume

The application currently stores all data in SQLite at `./data/sime.db`. A host must therefore keep one long-running application instance and persist `/app/data` across deployments.

1. Push the project to a private GitHub repository.
2. In Railway, create a project from that repository. Railway will detect the included `Dockerfile`.
3. Attach a volume to the service with mount path `/app/data`.
4. Add these variables:

   ```text
   DATABASE_PATH=/app/data/sime.db
   AUTH_SECRET=<at least 32 random characters>
   ID_CARD_SECRET=<a different random secret>
   NEXT_PUBLIC_APP_URL=https://<your-domain>
   ADMIN_EMAIL=<your admin email>
   ADMIN_PASSWORD=<strong unique password>
   SUPERADMIN_EMAIL=<your platform email>
   SUPERADMIN_PASSWORD=<strong unique password>
   TEACHER_PASSWORD=<strong demo password>
   STUDENT_PASSWORD=<strong demo password>
   PARENT_PASSWORD=<strong demo password>
   SAMPLE_ADMIN_PASSWORD=<strong demo password>
   OPENROUTER_API_KEY=<optional>
   OPENROUTER_MODEL=openai/gpt-4o-mini
   ```

5. Generate a Railway domain, set it as `NEXT_PUBLIC_APP_URL`, and redeploy.
6. Set the health-check path to `/api/health`.
7. Enable volume backups. Keep this service at one replica while it uses SQLite.

Generate secrets locally with `openssl rand -base64 48`.

`ID_CARD_SECRET` is optional because every build generates a private server-only signing key. Set a stable value in the host's secret manager when printed QR cards must remain verifiable after a later deployment.

## Vercel + Supabase: best long-term architecture

Supabase Auth is connected and all demo roles can sign in on Vercel. The application uses `/tmp/sime.db` there so pages can render, but Vercel Functions do not provide shared persistent local storage: edits can disappear after a cold start. Treat it only as a synthetic-data preview until `src/lib/db.ts` and its synchronous SQL consumers are migrated from `better-sqlite3` to PostgreSQL.

Recommended migration:

1. Use the connected Supabase project and the committed PostgreSQL migrations.
2. Replace `better-sqlite3` with a PostgreSQL client or ORM supporting pooled serverless connections.
3. Convert synchronous database calls to asynchronous calls and use Supabase's transaction pooler for Vercel.
4. Import the existing SQLite data into PostgreSQL.
5. Run `npm run verify:all` against a disposable staging database.
6. Deploy the Next.js app to Vercel and configure `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, all server secrets above, and the production `NEXT_PUBLIC_APP_URL`.

Supabase is the database platform in this setup; Vercel hosts the Next.js application.

The same database migration is required for Netlify. Do not rely on either platform's function filesystem for `sime.db`. After migration, deploy the Next.js app, set the pooled `DATABASE_URL`, and replace the local SSE poller with Supabase Realtime for durable multi-instance updates.

## Render + persistent disk

1. Create a Docker Web Service from the Git repository.
2. Attach a paid persistent disk at `/app/data`.
3. Set `DATABASE_PATH=/app/data/sime.db`, `PORT=10000`, and the production variables listed in the Railway section.
4. Use `/api/health` as the health-check path.
5. Keep one instance. Render disks cannot be shared across instances and disk-backed deploys have brief downtime.
6. Retain Render's disk snapshots and also schedule a SQLite-aware backup.

## Fly.io + volume

1. Install `flyctl`, sign in, then run `fly launch --no-deploy` in the project.
2. Create a volume in the selected region: `fly volumes create sime_data --size 1`.
3. Add a `fly.toml` mount with source `sime_data` and destination `/app/data`.
4. Set `DATABASE_PATH=/app/data/sime.db` and secrets with `fly secrets set`.
5. Deploy with `fly deploy`, keep one Machine, and verify `/api/health`.
6. Configure volume snapshots or Litestream replication; Fly volumes are local to one Machine and are not automatically replicated.

## cPanel

cPanel is suitable only if the hosting plan explicitly supports Node.js 22, native npm modules, SSH/Terminal access, writable persistent application storage, environment variables, and a continuously running Passenger application. Many shared cPanel plans do not meet all of these requirements.

If supported:

1. Clone the repository using cPanel Git Version Control.
2. Configure Node.js 22 in Application Manager.
3. Run `npm ci` and `npm run build` through SSH.
4. Store the variables above in the application environment and set `DATABASE_PATH` to an absolute writable path outside `public_html`.
5. Start the Next.js production server through Passenger, point the domain to it, and verify `/api/health`.
6. Back up the SQLite database and its WAL files while the application is stopped, or use a SQLite-aware backup process.

For this project, a Docker-capable VPS is usually simpler than shared cPanel hosting.

## Docker VPS alternative

On a small Ubuntu VPS with Docker and Docker Compose:

```bash
git clone <your-private-repository-url> sime
cd sime
cp .env.example .env.local
# edit .env.local with production values
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:6969/api/health
```

Put Caddy, Nginx, or Cloudflare Tunnel in front of port 6969 for HTTPS. Back up the `sime-data` Docker volume regularly.

This is also the recommended DigitalOcean route: create a Droplet, install Docker, follow the commands above, point a domain at the Droplet, and terminate HTTPS with Caddy or Nginx. Restrict the firewall to SSH, HTTP, and HTTPS; do not expose port 6969 publicly.

## Temporary link from your own computer

For a short demo only, run the verified local server and expose `http://127.0.0.1:6969` through Cloudflare Tunnel or another authenticated tunnel. Your computer must stay awake, the app stops when your process stops, and you should use synthetic data only. A hosted Railway/Render service is safer for unattended sharing.

## Production checklist

- Run `npm run verify:all` before every release.
- Never commit `.env.local`, database files, API keys, or real student information.
- Replace every seeded/demo password before sharing publicly.
- Keep `AUTH_SECRET` stable; changing it logs everyone out and prevents decryption of saved tenant OpenRouter keys.
- Use HTTPS and enable secure cookies in the school security settings.
- Keep one application replica while using SQLite.
- Configure automated database/volume backups and test restoration.
- Use synthetic demo records only when showing friends.
- Before serving real schools, migrate to PostgreSQL and add password reset, MFA, managed account provisioning, monitoring, and a privacy/legal review.
