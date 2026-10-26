# Scout

A personal internship-discovery workspace built with Next.js, TypeScript, Prisma and PostgreSQL. Scout collects real public employer postings, preserves source evidence, checks eligibility before scoring, and keeps a persistent shortlist.

## What works in this release

- Greenhouse, Lever and Ashby employer boards, with pagination where needed, bounded fetches, retries and per-source errors.
- Supported ATS URL import and manual posting-text import for other public HTTPS links.
- Canonical URL/external-ID deduplication, original source payloads and availability refreshes.
- Conservative eligibility checks, evidence excerpts, unknown requirements and configurable fit scoring.
- Editable applicant profile; preference changes reevaluate existing jobs.
- Search, eligibility and remote filters, saved opportunities, notes and audited human-reviewed classifications.
- Real database-derived dashboard metrics and discovery history.
- Single-user password authentication for production; development bypass only on localhost.

**This is Phase 1, not the complete six-phase PRD.** There is no LLM inference, automated company research, application preparation/submission, email, scheduled worker, MCP server or extension yet. The UI does not advertise these as working features. Discovery uses employer board IDs, not a universal search across every employer. Automatic evaluation conservatively returns Potentially Eligible, Ineligible, or Manual Review Required; Verified Eligible requires recorded human review.

## Quick start

Requires Node.js 22+ (tested with 24), npm and Docker Desktop or an existing PostgreSQL database.

```sh
npm ci
# Copy .env.example to .env, then configure values.
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:3000. The Docker database binds only to localhost:5433. The example database credentials are for local development only. Never reuse them for an internet-accessible database. If a container named `scout-postgres` was started during initial development, use `docker start scout-postgres` instead of starting a second container on the same port; it uses the same named volume.

1. Confirm your profile and availability in **Profile & preferences**. Unknown facts can remain blank.
2. Add employer boards in **Sources**. Examples tested during development: Greenhouse `anthropic`, Lever `palantir`, Ashby `notion`. These are real feeds, not endorsements or guarantees of suitable internships.
3. Run discovery. Review unknowns and source excerpts before applying.
4. Save promising roles, keep notes, and visit the original employer application page.

Nothing sends messages or submits applications. Private profile data lives in your PostgreSQL database, never in the repository.

## Validation

```sh
npm test
npm run typecheck
npm run build
npx tsx --env-file=.env scripts/check-database.ts
npx tsx --env-file=.env scripts/check-sources.ts
```

The database check creates isolated test records and removes only those records afterward. The source check makes read-only network requests to public boards. Unit tests do not need network access or a database.

## Documentation

- [Architecture and schema](docs/ARCHITECTURE.md)
- [Integration contracts](docs/INTEGRATIONS.md)
- [Development and deployment](docs/DEVELOPMENT.md)
- [Approved implementation plan](IMPLEMENTATION_PLAN.md)
- [Continuation handoff](CLAUDE_HANDOFF.md)

## Known boundaries

Regex-based parsing is intentionally conservative and is not a complete natural-language interpretation of every requirement. Review geographic, education, authorization, scheduling and ambiguous experience requirements yourself. A human override is explicit and recorded; it never erases the engine evidence. Scores measure available evidence, not the probability of getting an offer. Refreshing a board confirms whether a posting remains listed, not whether the employer is still accepting applications internally. Provider failures preserve the last known data.

The initial profile keeps confirmed experience/projects as separate text fields; normalized experience/project tables, profile history, structured education/authorization jurisdictions, broader deduplication suggestions, advanced profile fields, and an optional AI interpreter are follow-on work. This release uses custom accessible components with Tailwind rather than adding a shadcn dependency for basic controls.
