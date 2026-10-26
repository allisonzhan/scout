# Architecture and schema

## Request path

Browser -> authenticated Next.js route handlers -> validated service -> Prisma -> PostgreSQL.
Discovery -> fixed public ATS endpoint -> validated normalization -> canonical URL/source-ID upsert -> deterministic eligibility -> explained score -> dashboard.

`lib/domain.ts` contains shared input contracts and URL validation. `lib/sources.ts` owns provider-specific parsing and bounded HTTP. `lib/evaluate.ts` is a pure, testable rules engine. `lib/service.ts` coordinates transactions, discovery runs, persistence and reevaluation. `lib/auth.ts` handles local development access and signed sessions. `app/api` exposes same-origin single-user operations. `app/scout.tsx` implements the workspace; `app/use-dialog-focus.ts` manages keyboard focus and modal dismissal.

## Tables

| Model     | Purpose and invariants                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Profile   | One owner row; Zod-validated JSON including preferences, confirmed facts and score weights.                                           |
| Company   | Normalized name key, display name and job relationship. Distinct organizations sharing a name may require future identity refinement. |
| Source    | Provider/board pair is unique; enabled state, last successful verification and last error.                                            |
| Job       | Canonical URL unique; normalized nullable facts, source description, evaluation, saved flag and notes.                                |
| JobSource | Unique source/external-ID; original JSON, original link, source availability and verification timestamp.                              |
| Override  | Append-only reviewed classification and explanation; preserves automated evaluation.                                                  |
| Run       | Status, start/finish and per-source results.                                                                                          |
| Audit     | Profile changes and classification overrides.                                                                                         |

The migration under `prisma/migrations` is the source of truth. JSON fields preserve flexibility for the single-user MVP; richer experience/project and evaluation-history models are deferred. Single-user saved state intentionally resides on Job.

## Correctness

- Upserts are transactional. Repeated imports update posting content while preserving saved state, notes and overrides.
- Canonical URLs strip known tracking parameters while retaining identity parameters. Provider/external IDs preserve identity if a URL changes. No fuzzy auto-merging of distinct job requisitions.
- A source is marked absent only after successful validation of its complete board response. A job is closed only if all its stored sources are inactive. Failed requests never close existing jobs.
- Discovery run creation uses a PostgreSQL advisory transaction lock. A stale running marker expires after 15 minutes. Runs currently execute in the HTTP request; do not deploy on a platform whose request timeout is shorter than the required run duration. Durable queued workers are Phase 4.
- Unknown mandatory requirements stay visible. Confirmed conflicts force score zero; no technical match can override them automatically.
- User reviews are explicit records. The UI uses the latest reviewed classification while preserving the engine score/reasons. Overrides are automatically invalidated when profile facts or relevant posting fields change, and their historical records are retained.

## Security

Only fixed, allowlisted ATS endpoint templates are fetched. Redirects are rejected, board identifiers are constrained, responses are bounded, and requests time out. Arbitrary manual URLs are stored as HTTPS links, never fetched by the server. Descriptions render as escaped text, not HTML. External text cannot invoke tools or alter profile facts.

All API data requires a signed session in production. Authentication is fail-closed when the password is absent in production. Sessions expire after 12 hours and are HTTP-only, same-site strict, and secure over HTTPS. Mutations enforce APP_ORIGIN. Login attempts are capped in-process; a production reverse proxy should also rate-limit login and requests. Passwords and session secrets remain server-side environment values. For a multi-instance deployment use shared rate limiting and an identity provider. Do not expose the development server publicly.
