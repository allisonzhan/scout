# Claude Code continuation handoff

Updated 2026-10-26. This is the approved Phase 1 Scout discovery MVP. Continue from the existing implementation; do not scaffold over it.

## User intent and repository
The user requested a working product from the Scout v2 PRD, a live side-panel preview, commits under their name, and a push to the repo. They explicitly approved implementing Phase 1 first. Later phases remain future work. They also requested this handoff for Claude Code in case of usage cutoff.

Workspace: C:\Users\allis\OneDrive\Documents\ChatGPT\scout
Remote: https://github.com/allisonzhan/scout.git
Branch: codex/scout-mvp
Git identity: Allison <allison07lunch@gmail.com>
Delivery commits: 879caf1 (backend) and e7298aa (UI, documentation and reliability). Both were pushed to origin/codex/scout-mvp. Use git log for this handoff-finalization commit and git status for current state.
Original complete PRD: C:\Users\allis\.codex\attachments\2e580c38-2913-4fc4-be8b-2f8adc72d2a6\Pasted text.txt
Approved plan: IMPLEMENTATION_PLAN.md. Read README.md and docs/ before continuing.

## Implemented
- Next.js 16.4.3 / React / strict TypeScript / Tailwind responsive workspace.
- Overview, internship-focused discovery, search/status/remote filters, paged cards, source configuration, profile/preferences, job evidence/detail drawer, saved opportunities, persistent notes and audited eligibility reviews.
- Greenhouse, Lever and Ashby public employer-board discovery and ATS URL import. Manual text import for other HTTPS posting URLs; arbitrary pages are not fetched.
- Prisma 6.19.3 and PostgreSQL 17 with migrations, transactional upserts, URL and external-ID deduplication, source provenance, closure refresh, source errors, discovery history and advisory run lock.
- Deterministic eligibility before scoring: seniority, experience, graduation cutoff/range, completed degree, enrollment, schedule, location mode, expiry and explicitly supplied authorization. Unknowns remain visible. Automatic evaluation does not certify free-form postings; Verified Eligible requires a reasoned human review.
- Profile changes reevaluate jobs. Changed profile/posting facts invalidate active reviews while retaining historical review records.
- Production password/HMAC session authentication; localhost-only development bypass. Same-origin writes, input validation, bounded fixed-host fetching, escaped descriptions, auth tests.
- README, architecture/schema, integration and development/deployment guides. No credentials committed.

## Local environment and data
Node 24.19.0 and npm 11.17.0. Docker container scout-postgres uses PostgreSQL 17, volume scout_pgdata and localhost port 5433. Ignored .env contains local DATABASE_URL and SESSION_SECRET. SCOUT_PASSWORD is blank for localhost development; production deliberately fails closed without a password. Do not commit .env or database dumps.

Start existing database: docker start scout-postgres. Start app: npm run dev. Preview: http://127.0.0.1:3000. Existing container shares the volume named in compose.yaml; do not run a second database on the same port.

Live feeds configured in local database: Anthropic/Greenhouse (anthropic), Palantir/Lever (palantir), Notion/Ashby (notion). Last full discovery stored 516 relevant postings (286 + 199 + 31), with no source errors. These are actual fetched records, not fixtures. Profile personal facts remain blank/unknown for the user to confirm. Temporary browser test shortlist entry and note were removed.

## Verification
- 35 unit/security regression tests passed.
- TypeScript and final production build passed after all code changes, including the transaction timeout refinement.
- Live adapters independently returned 682 Greenhouse, 309 Lever and 141 Ashby total jobs at test time; discovery retains relevant titles.
- Database integration passed: persistence, idempotent imports, saved-state preservation, stale-review invalidation.
- HTTP integration passed: cross-origin writes rejected and reimporting an existing Ashby URL does not duplicate jobs.
- Browser passed source creation for all providers, discovery, filtering, job details/evidence, saved-state reload and note persistence.
- Profile reevaluation over all 516 jobs succeeded via HTTP after maxWait was raised to 15 seconds and transaction timeout to 60 seconds.
- Desktop layout visually inspected. At a 390px mobile viewport, document width was 375px: no horizontal overflow. Browser viewport override reset.
- npm audit reported zero vulnerabilities after overriding deepmerge-ts to ^8.0.0.

## Commands
npm ci
npm run db:generate
npm run db:migrate
npm run dev
npm test
npm run typecheck
npm run build
npm run check:db
npm run check:sources
npx tsx --env-file=.env scripts/check-http.ts

On Windows, stop the dev server before generating Prisma or building; the native DLL can be locked. OneDrive file activity caused slow compilation/watch churn during this session. No system sync settings were changed. A normal local checkout can avoid this environment issue.

## Known scope and next work
This release does not implement the full PRD. There is no LLM provider/inference yet, no automated company research, no resume/application packages, no Gmail/outreach, no recurring worker, no MCP server, and no extension. UI uses custom accessible controls rather than shadcn. Profile experience/projects are separate confirmed text fields rather than normalized tables. Additional profile fields and richer structured eligibility extraction remain follow-on work. Read README known boundaries.

Next priorities: expand structured profile and evidence extraction with an optional validated AI provider; add Phase 2 resume/application packages and full recruiting tracker; then Phase 3 research/outreach with exact-action approval. Preserve deterministic gates and source evidence. Do not fabricate qualifications, contacts, postings or research. No external communications or submissions without explicit approval of the exact action.

Discovery currently runs inside an HTTP request with bounded retries and partial-result persistence. Use a persistent Node deployment; durable workers must precede dependable unattended scheduling. Add shared login rate limiting and stronger identity management before multi-user or multi-instance use. Snapshot fetches all jobs; client cards are paged, but server pagination will be useful for larger datasets.

## Delivery state
Phase 1 code and documentation have been committed and pushed. Final production build succeeded. The localhost preview was restarted successfully and is available at http://127.0.0.1:3000. This final handoff update is committed separately. No public deployment or PR was requested. Continue with the next approved phase rather than redoing Phase 1.
