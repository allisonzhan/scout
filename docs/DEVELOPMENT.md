# Development and deployment

## Environment

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`). Set DATABASE_URL to a PostgreSQL connection. For local development, `npm run dev` binds 127.0.0.1:3000. APP_ORIGIN must exactly match the browser origin, including scheme/port.

SCOUT_PASSWORD is required for production. SESSION_SECRET must contain at least 32 random characters; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it only in your environment or secret manager. Set APP_ORIGIN to your HTTPS deployment origin. Never place these values in NEXT_PUBLIC variables.

## Database

Run `npm run db:generate` after installing dependencies. Apply existing migrations with `npm run db:migrate`. When changing schema during development, run `npx prisma migrate dev --name descriptive_change` and commit the migration. Back up the database before applying migrations to production. The named Docker volume persists beyond container restarts; do not delete it if you need your records.

## Production

Use a long-running Node host with PostgreSQL connectivity. Install with `npm ci`, generate/apply migrations, then `npm run build` and `npm start`. The supplied start script binds localhost; put a same-host HTTPS reverse proxy in front. Configure forwarding and APP_ORIGIN consistently. A containerized host may require an explicit bind-address change, but never expose a dev server as production. This repository is not deployed to a public host by default.

Use a production database with unique credentials, TLS, backups and restricted access. Configure a strong workspace password, random session secret, HTTPS and proxy rate limits. Verify unauthenticated GET /api/scout returns 401. A blank production password intentionally prevents access.

Discovery runs in the request today. A serverless timeout can interrupt a run, leaving partial source updates and a stale run marker. Use a persistent Node server until durable workers are implemented. One active discovery run is allowed; stale markers expire after 15 minutes on the next discovery request. Partial run results are persisted after each source.

## Checks

`npm test` runs pure eligibility, normalization and URL-security cases. `npm run typecheck` checks strict TypeScript; `npm run build` validates the production bundle. `scripts/check-database.ts` checks real transaction/upsert behavior with isolated disposable records; `scripts/check-sources.ts` checks the three public feeds without writing data. Run both with `npx tsx --env-file=.env <script>`.

Browser acceptance: save profile -> add each source -> run discovery -> view source outcomes -> filter candidates -> inspect evidence -> save a role -> reload -> confirm saved state -> add notes -> verify bad-origin writes are rejected. Test missing source, invalid board, absent profile, unknown eligibility and empty filtered views.

## Next phases

1. Broaden structured profile and requirement extraction, preserving deterministic gates and evidence.
2. Application packages, resume handling, deadlines and full recruiting tracker.
3. Company research, public contacts, Gmail OAuth and exact-draft approval.
4. Durable scheduled jobs, email classification and follow-up suggestions.
5. Authenticated MCP tools reusing the services.
6. Browser extension for reviewed autofill.

No email sending, application submission or external-account mutation may bypass exact-action user approval.

## Windows development note
Prisma's native engine DLL can be locked by a running dev server. Stop `npm run dev` before `npm run build` or `npm run db:generate`, then restart it after the command succeeds. A synced OneDrive checkout can also cause excessive filesystem-watch activity; if startup or hot reload becomes slow, a normal local checkout outside the synced directory is preferable. The application does not change OneDrive settings.

For a running localhost development instance with an Ashby job already imported, `npx tsx --env-file=.env scripts/check-http.ts` verifies cross-origin write rejection and idempotent real URL reimport. It updates that existing posting from its source without creating test applicant data.
