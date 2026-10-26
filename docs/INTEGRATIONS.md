# Integrations

These are public read-only employer board integrations. No applicant submission endpoints are called.

| Provider   | Official contract                                          | Scout endpoint                                                                   |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Greenhouse | https://docs.greenhouse.io/job-board                       | `https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`           |
| Lever      | https://github.com/lever/postings-api                      | `https://api.lever.co/v0/postings/{board}?mode=json&limit=100&skip={offset}`     |
| Ashby      | https://developers.ashbyhq.com/docs/public-job-posting-api | `https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true` |

Greenhouse imports content and location. Updated-at is not misrepresented as a posting date. Lever combines the main description and qualification lists, handles pages of 100 and preserves structured workplace and compensation. Ashby accepts explicit nulls, skips unlisted roles and retains published dates when supplied. All missing fields stay null. API data is validated; an invalid response fails the source rather than being mistaken for an empty board.

Supported import URLs: `boards.greenhouse.io/{board}/jobs/{id}`, `job-boards.greenhouse.io/{board}/jobs/{id}`, `jobs.lever.co/{board}/{id}`, `jobs.ashbyhq.com/{board}/{id}`. Lever EU endpoints and custom employer application domains are not yet supported automatically; use manual text import. Imported boards start paused unless already configured.

Retry policy: up to three attempts, 500ms then 1000ms backoff, 20-second request timeout, 12MB response limit. Lever pagination is bounded at 5,000 postings; hitting the bound aborts refresh instead of incorrectly closing records. Future work should distinguish retryable statuses more finely and respect Retry-After.

Discovery retains student and engineering/research-related titles from each board; this is a candidate prefilter, not an eligibility decision. Counts reflect the actual data available, never guaranteed internship volume. Source outages and HTTP failures are shown in Sources and run activity.

LinkedIn, Indeed, Handshake, university portals, YC discovery and search providers are not integrated. Manual text import preserves the original URL and labels provenance as user-supplied. No restricted scraping, CAPTCHA bypass or guessed contacts.
