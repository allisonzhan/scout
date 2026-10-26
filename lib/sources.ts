import { z } from "zod";
import he from "he";
const { decode } = he;
import { Posting, canonicalUrl, safeUrl, sourceSchema } from "./domain";
export function plain(value: string) {
  return decode(decode(value))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const gh = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      absolute_url: z.string(),
      content: z.string().nullish(),
      location: z.object({ name: z.string() }).nullish(),
      updated_at: z.string().nullish(),
    }),
  ),
});
const lever = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    descriptionPlain: z.string().nullish(),
    description: z.string().nullish(),
    lists: z
      .array(z.object({ text: z.string(), content: z.string() }))
      .nullish(),
    additionalPlain: z.string().nullish(),
    categories: z
      .object({
        location: z.string().nullish(),
        commitment: z.string().nullish(),
      })
      .nullish(),
    workplaceType: z.string().nullish(),
    salaryRange: z
      .object({
        min: z.number().nullish(),
        max: z.number().nullish(),
        currency: z.string().nullish(),
        interval: z.string().nullish(),
      })
      .nullish(),
    createdAt: z.number().nullish(),
  }),
);
const ashby = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      jobUrl: z.string(),
      descriptionPlain: z.string(),
      location: z.string().nullish(),
      workplaceType: z.string().nullish(),
      isRemote: z.boolean().nullish(),
      isListed: z.boolean().nullish(),
      employmentType: z.string().nullish(),
      publishedAt: z.string().nullish(),
      compensation: z
        .object({ compensationTierSummary: z.string().nullish() })
        .nullish(),
    }),
  ),
});
export type SourceInput = z.infer<typeof sourceSchema>;
export function normalize(
  provider: SourceInput["provider"],
  data: unknown,
  company: string,
): Posting[] {
  const base = {
    company,
    deadline: null,
    postedAt: null,
    compensation: null,
    workplace: null,
    employment: null,
    location: null,
  };
  if (provider === "greenhouse")
    return gh
      .parse(data)
      .jobs.map((j) => ({
        ...base,
        externalId: String(j.id),
        title: j.title,
        url: canonicalUrl(j.absolute_url),
        description: plain(j.content || ""),
        location: j.location?.name || null,
        workplace: /\bremote\b/i.test(j.location?.name || "") ? "Remote" : null,
        raw: j,
      }));
  if (provider === "lever")
    return lever
      .parse(data)
      .map((j) => ({
        ...base,
        externalId: j.id,
        title: j.text,
        url: canonicalUrl(j.hostedUrl),
        description: plain(
          [
            j.descriptionPlain || j.description,
            ...(j.lists || []).map((l) => `${l.text}: ${l.content}`),
            j.additionalPlain,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        location: j.categories?.location || null,
        workplace: j.workplaceType || null,
        employment: j.categories?.commitment || null,
        compensation: j.salaryRange
          ? `${j.salaryRange.currency || ""} ${j.salaryRange.min ?? "?"}–${j.salaryRange.max ?? "?"} / ${j.salaryRange.interval || "unknown period"}`
          : null,
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        raw: j,
      }));
  return ashby
    .parse(data)
    .jobs.filter((j) => j.isListed !== false)
    .map((j) => ({
      ...base,
      externalId: new URL(j.jobUrl).pathname.split("/").filter(Boolean).pop()!,
      title: j.title,
      url: canonicalUrl(j.jobUrl),
      description: plain(j.descriptionPlain),
      location: j.location || null,
      workplace: j.workplaceType || (j.isRemote ? "Remote" : null),
      employment: j.employmentType || null,
      compensation: j.compensation?.compensationTierSummary || null,
      postedAt: j.publishedAt || null,
      raw: j,
    }));
}
export function sourceEndpoint(s: SourceInput) {
  sourceSchema.parse(s);
  return s.provider === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${s.board}/jobs?content=true`
    : s.provider === "lever"
      ? `https://api.lever.co/v0/postings/${s.board}?mode=json&limit=100&skip=0`
      : `https://api.ashbyhq.com/posting-api/job-board/${s.board}?includeCompensation=true`;
}
async function getJson(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        redirect: "error",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500)
          throw new Error(`Provider temporarily unavailable (${res.status})`);
        throw new Error(
          `Provider returned HTTP ${res.status}; check the board identifier`,
        );
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Empty provider response");
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 12_000_000) {
          await reader.cancel();
          throw new Error("Provider response exceeds size limit");
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error("Provider request failed");
}
export async function fetchBoard(s: SourceInput): Promise<Posting[]> {
  const url = sourceEndpoint(s);
  if (s.provider !== "lever")
    return normalize(s.provider, await getJson(url), s.company);
  const all: Posting[] = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = normalize(
      "lever",
      await getJson(url.replace("skip=0", `skip=${skip}`)),
      s.company,
    );
    all.push(...page);
    if (page.length < 100) return all;
  }
  throw new Error(
    "Board exceeds pagination limit; refresh aborted to preserve availability",
  );
}
export function parseJobUrl(value: string): {
  provider: SourceInput["provider"];
  board: string;
  externalId: string;
} {
  const u = safeUrl(value),
    parts = u.pathname.split("/").filter(Boolean);
  let provider: SourceInput["provider"], board: string, id: string;
  if (
    ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(u.hostname) &&
    parts[1] === "jobs"
  ) {
    provider = "greenhouse";
    board = parts[0];
    id = parts[2];
  } else if (u.hostname === "jobs.lever.co") {
    provider = "lever";
    [board, id] = parts;
  } else if (u.hostname === "jobs.ashbyhq.com") {
    provider = "ashby";
    [board, id] = parts;
  } else
    throw new Error(
      "This URL is not a supported ATS posting. Use the manual text import.",
    );
  sourceSchema.parse({ provider, board, company: board });
  if (!id || !/^[a-zA-Z0-9-]+$/.test(id))
    throw new Error("Use the full posting URL, including the job ID");
  return { provider, board, externalId: id };
}
