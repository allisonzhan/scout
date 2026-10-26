# Scout implementation plan

Status: Approved Phase 1 implemented. See README.md for delivered scope and CLAUDE_HANDOFF.md for verification and continuation context.

## Repository and delivery

- Repository: https://github.com/allisonzhan/scout.git
- Empty checkout; current branch master has no commits.
- Existing Git author: Allison <allison07lunch@gmail.com>. Preserve this identity.
- Implement on codex/scout-mvp, commit coherent milestones, test, and push the branch to origin. Do not commit secrets or personal applicant data.
- Show this plan in the side panel now; show the localhost application there during implementation.

## First deliverable: Phase 1 working discovery product

Build an end-to-end single-user app that persists the applicant profile, discovers real postings from Greenhouse, Lever, and Ashby, imports supported posting URLs, deduplicates, evaluates eligibility before ranking, and supports filtering, saving, and viewing source evidence. Include dashboard counts and priorities derived from stored records, job details, saved opportunities, source configuration, and profile/preferences settings.

The remaining PRD phases follow after this release: application packages and tracker; company research and approved outreach with Gmail; scheduled automation; MCP; browser extension. These are separate milestones, not features to represent as complete in the initial release.

## Architecture

- Next.js App Router, strict TypeScript, Tailwind and accessible shadcn/ui components.
- Server-side services for discovery, normalization, deduplication, eligibility, scoring, and saved opportunities; route handlers validate input with Zod.
- PostgreSQL with Prisma migrations; persistence is real, not browser-only demo storage.
- Single-user authenticated application; server-only credentials, session protection and validated mutations. Bind local development to localhost. Document production authentication and deployment configuration.
- Provider abstraction for optional AI interpretation with structured, validated output. Deterministic eligibility gates remain authoritative. Missing AI credentials must not prevent structured discovery and conservative rule-based evaluation.
- Persist discovery runs and individual source outcomes, with bounded requests, timeouts, retry/backoff and failure visibility. Add durable recurring workers in Phase 4.

## Initial schema

- UserProfile: education, explicitly supplied authorization, skills, availability, preferences, configurable scoring weights.
- Experience and Project: user-confirmed facts, dates, technologies and outcomes; separate professional employment from student projects.
- Company: canonical identity, name and website.
- DiscoverySource: provider, employer board identifier, enabled state and refresh information.
- JobPosting: normalized fields, canonical application URL, description, nullable unknown requirements, deadlines and availability.
- JobSource: provider/external ID, original URL, retrieved timestamp and original source evidence; unique provider/external ID for idempotency.
- OpportunityEvaluation: profile/rules version, eligibility, score components, reasons, evidence, unknowns and evaluation timestamp.
- EligibilityOverride: user explanation and audit history; preserve original engine classification.
- SavedOpportunity: user/job relationship, notes and saved/archive state.
- DiscoveryRun and AuditLog: per-source results, counts, errors, timestamps and important mutations.
  Use foreign keys, uniqueness constraints and transactions. Similarity suggests possible duplicates; merge only when identity evidence is strong enough to avoid combining distinct roles.

## Integrations and limitations

Greenhouse, Lever and Ashby adapters use publicly available employer board endpoints. Confirm current official API contracts and permitted access during implementation. These endpoints require employer board identifiers; they are not universal job-search APIs. Start with configurable boards and explicit discovery runs.

Supported ATS URLs resolve through these adapters. Other career-page URLs support user-supplied posting text and source links when authorized structured extraction is unavailable. Never imply arbitrary websites can always be imported automatically. Fetching must reject private/local network destinations and unsafe redirects, and limit response sizes/time.

Fields not supplied by sources remain unknown. Availability refreshes distinguish confirmed closure from a temporary network/provider failure. LinkedIn, Handshake, search providers and YC directory access need separate supported integrations; do not scrape restricted services.

## Eligibility and scoring

1. Normalize requirements with source excerpts and confidence; preserve ambiguity.
2. Confirmed mandatory conflicts yield Ineligible: seniority/experience, required completed degree, graduation range, schedule, location, timing or explicitly supplied work authorization.
3. Missing essential facts yield Potentially Eligible; contradictory requirements yield Manual Review Required.
4. Verified Eligible requires affirmative supporting evidence for applicable mandatory requirements, not merely an absence of detected conflicts.
5. Exclude confirmed ineligible roles from primary recommendations. Manual-review roles receive a separate review view. Show unknowns and evidence on every evaluation.
6. Score remaining opportunities using PRD weights: eligibility 30, technical alignment 25, learning 20, schedule 15, compensation 5, company interest 5. Explain components and avoid treating unknowns as verified positives.
7. Reevaluate when profile/preferences or postings change. A full-time semester role cannot be assumed compatible; projects cannot count as years of professional experience.

## Implementation milestones and checks

1. Scaffold app, development configuration, database, authentication and documentation; verify production build and migration.
2. Implement profile and source configuration; validate persistence and input handling.
3. Implement three ATS adapters, supported URL import, deduplication and run reporting; test captured API fixtures and live retrieval where reachable.
4. Implement evidence-backed eligibility and transparent scoring; regression-test senior roles, missing requirements, explicit exceptions, conflicting requirements, graduation restrictions, authorization unknowns, expired roles and semester scheduling.
5. Build responsive dashboard, discovery filters, detail/review views and saved opportunities. Check loading, empty, partial-failure and error states. No fabricated dashboard metrics or unlabeled example jobs.
6. Run integration and browser checks through profile -> discover -> evaluate -> filter -> save -> reload. Verify private URL rejection and primary-queue eligibility exclusions.
7. Document setup, architecture, schema, integrations, environment variables, testing and deployment. Commit milestones under configured identity and push tested branch; report actual verification and remaining limitations.

## Decisions/defaults

- Approve Phase 1 as the initial implementation scope, consistent with the PRD roadmap.
- Use the configured Git identity above unless corrected.
- Use local PostgreSQL through Docker if access can be enabled; otherwise a user-provided PostgreSQL connection is needed. Docker exists but its API returned permission denied in this session; no database has been started.
- Use PRD education and experience as onboarding suggestions for user verification; do not assume citizenship, authorization, personal contact details or exact employment dates.
- Keep AI optional for Phase 1; provider credentials and Gmail OAuth are not required for the first discovery workflow.

