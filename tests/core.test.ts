import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../lib/evaluate";
import {
  defaultProfile,
  Posting,
  profileSchema,
  canonicalUrl,
} from "../lib/domain";
import { normalize, parseJobUrl } from "../lib/sources";
const p = {
  ...defaultProfile,
  enrolled: true,
  graduationYear: 2028,
  professionalYears: 0.5,
  skills: ["TypeScript", "Python"],
  remoteOnly: true,
};
const job = (description = "", extra: Partial<Posting> = {}): Posting => ({
  externalId: "1",
  title: "Software Engineering Intern",
  company: "Example",
  url: "https://example.com/jobs/1",
  description,
  location: null,
  workplace: null,
  employment: null,
  compensation: null,
  postedAt: null,
  deadline: null,
  raw: {},
  ...extra,
});
test("missing requirements never certify eligibility", () => {
  const e = evaluate(job(), p);
  assert.equal(e.classification, "Potentially Eligible");
  assert.ok(e.unknowns.length);
});
test("senior technical match is excluded", () => {
  const e = evaluate(
    job("Python TypeScript", { title: "Senior Software Engineer" }),
    p,
  );
  assert.equal(e.classification, "Ineligible");
  assert.equal(e.score, 0);
});
test("professional experience exceeds profile", () => {
  assert.equal(
    evaluate(job("Requires 3 years of professional engineering experience."), p)
      .classification,
    "Ineligible",
  );
});
test("equivalent experience is reviewed, not assumed", () => {
  assert.equal(
    evaluate(
      job(
        "Requires 3 years of professional experience or equivalent experience.",
      ),
      p,
    ).classification,
    "Manual Review Required",
  );
});
test("full-time semester work is ineligible", () => {
  assert.equal(
    evaluate(job("Full-time internship."), p).classification,
    "Ineligible",
  );
});
test("summer allows full-time with suitable hours", () => {
  assert.notEqual(
    evaluate(job("Summer full-time internship, 40 hours per week."), {
      ...p,
      period: "summer",
      maxHours: 40,
    }).classification,
    "Ineligible",
  );
});
test("unknown work authorization remains unknown", () => {
  const e = evaluate(
    job("Must be authorized to work in the United States."),
    p,
  );
  assert.equal(e.classification, "Potentially Eligible");
  assert.ok(e.unknowns.some((x) => x.includes("authorization")));
});
test("explicit authorization conflict excludes", () => {
  assert.equal(
    evaluate(job("Must be authorized to work in the United States."), {
      ...p,
      authorized: false,
    }).classification,
    "Ineligible",
  );
});
test("graduation ranges are enforced", () => {
  assert.equal(
    evaluate(job("Graduating 2026–2027."), p).classification,
    "Ineligible",
  );
});
test("expired posting excluded", () => {
  assert.equal(
    evaluate(job("", { deadline: "2020-01-01" }), p).classification,
    "Ineligible",
  );
});
test("hybrid role cannot satisfy remote-only", () => {
  assert.equal(
    evaluate(job("", { workplace: "Hybrid" }), p).classification,
    "Ineligible",
  );
});
test("conflicting schedules need review", () => {
  assert.equal(
    evaluate(job("Full-time or part-time internship."), p).classification,
    "Manual Review Required",
  );
});
test("weekly hours upper bound used", () => {
  assert.equal(
    evaluate(job("15–30 hours per week."), p).classification,
    "Ineligible",
  );
});
test("score bounded and component-based", () => {
  const e = evaluate(
    job("Python, TypeScript, mentorship. 15 hours per week."),
    p,
  );
  assert.equal(
    e.score,
    Object.values(e.components).reduce((a, b) => a + b, 0),
  );
  assert.ok(e.score <= 100);
});
test("invalid weights rejected", () => {
  assert.throws(() =>
    profileSchema.parse({ ...p, weights: { ...p.weights, technical: 100 } }),
  );
});
test("canonical URLs remove tracking, retain posting identity", () => {
  assert.equal(
    canonicalUrl("https://example.com/jobs/1/?utm_source=a#top"),
    "https://example.com/jobs/1",
  );
});
test("supported ATS URLs parsed", () => {
  assert.deepEqual(parseJobUrl("https://jobs.lever.co/acme/abc-123"), {
    provider: "lever",
    board: "acme",
    externalId: "abc-123",
  });
  assert.equal(
    parseJobUrl("https://job-boards.greenhouse.io/acme/jobs/123").externalId,
    "123",
  );
  assert.equal(
    parseJobUrl("https://jobs.ashbyhq.com/acme/abc-123/application").externalId,
    "abc-123",
  );
});
test("reject private URLs, credentials, and deceptive hosts", () => {
  for (const u of [
    "http://localhost/jobs/1",
    "https://127.0.0.1/job",
    "https://jobs.lever.co.evil.com/acme/a",
    "https://user:pass@jobs.lever.co/acme/a",
    "https://[::1]/job",
  ])
    assert.throws(() => parseJobUrl(u));
});
test("Greenhouse normalizes HTML without inventing metadata", () => {
  const [j] = normalize(
    "greenhouse",
    {
      jobs: [
        {
          id: 1,
          title: "Intern",
          absolute_url: "https://example.com/1",
          content: "&lt;p&gt;Python &amp; AI&lt;/p&gt;",
        },
      ],
    },
    "Example",
  );
  assert.equal(j.description, "Python & AI");
  assert.equal(j.employment, null);
  assert.equal(j.postedAt, null);
});
test("Lever includes qualification lists", () => {
  const [j] = normalize(
    "lever",
    [
      {
        id: "a",
        text: "Intern",
        hostedUrl: "https://example.com/a",
        lists: [{ text: "Requirements", content: "<li>Python</li>" }],
      },
    ],
    "Example",
  );
  assert.match(j.description, /Requirements: Python/);
});
test("Ashby respects unlisted status and missing workplace", () => {
  const result = normalize(
    "ashby",
    {
      jobs: [
        {
          title: "Hidden",
          jobUrl: "https://example.com/a",
          descriptionPlain: "a",
          isListed: false,
        },
        {
          title: "Intern",
          jobUrl: "https://example.com/b",
          descriptionPlain: "b",
        },
      ],
    },
    "Example",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].workplace, null);
});
test("malformed provider response fails rather than empties board", () => {
  assert.throws(() => normalize("greenhouse", { jobs: "bad" }, "Example"));
});
test("Ashby nullable optional fields remain unknown", () => {
  const [j] = normalize(
    "ashby",
    {
      jobs: [
        {
          title: "Intern",
          jobUrl: "https://example.com/a",
          descriptionPlain: "role",
          workplaceType: null,
          isRemote: null,
          compensation: { compensationTierSummary: null },
        },
      ],
    },
    "Example",
  );
  assert.equal(j.workplace, null);
  assert.equal(j.compensation, null);
});
test("generic required years of experience gate eligibility", () => {
  assert.equal(
    evaluate(job("Requires 3+ years of experience building software."), p)
      .classification,
    "Ineligible",
  );
});
test("preferred experience is not mandatory", () => {
  assert.notEqual(
    evaluate(job("Preferred: 3 years of professional experience."), p)
      .classification,
    "Ineligible",
  );
});
test("enrollment does not imply absence of a completed degree", () => {
  assert.notEqual(
    evaluate(job("Must have a bachelor degree."), {
      ...p,
      completedDegree: true,
    }).classification,
    "Ineligible",
  );
});
test("confirmed incomplete degree conflicts with completed degree requirement", () => {
  assert.equal(
    evaluate(job("Must have a bachelor degree."), {
      ...p,
      completedDegree: false,
    }).classification,
    "Ineligible",
  );
});
test("mandatory experience is not softened by nearby preferred skills", () => {
  assert.equal(
    evaluate(
      job("Requires 3 years of professional experience. Python preferred."),
      p,
    ).classification,
    "Ineligible",
  );
});
test("machine learning alone is not mentorship evidence", () => {
  assert.equal(
    evaluate(job("Machine learning and Python."), p).components.learning,
    0,
  );
});
