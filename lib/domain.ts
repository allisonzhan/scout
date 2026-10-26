import { z } from "zod";
export const classifications = [
  "Verified Eligible",
  "Potentially Eligible",
  "Ineligible",
  "Manual Review Required",
] as const;
export const profileSchema = z.object({
  name: z.string().max(100).default(""),
  university: z.string().max(150).default(""),
  graduationYear: z.number().int().min(2020).max(2045).nullable().default(null),
  enrolled: z.boolean().nullable().default(null),
  completedDegree: z.boolean().nullable().default(null),
  professionalYears: z.number().min(0).max(50).nullable().default(null),
  skills: z.array(z.string().min(1).max(80)).max(50).default([]),
  roles: z.array(z.string().min(1).max(100)).max(20).default([]),
  period: z.enum(["semester", "summer"]).default("semester"),
  maxHours: z.number().int().min(1).max(80).default(20),
  remoteOnly: z.boolean().default(false),
  location: z.string().max(200).default(""),
  authorized: z.boolean().nullable().default(null),
  citizenship: z.string().max(80).default(""),
  experience: z.string().max(10000).default(""),
  projects: z.string().max(10000).default(""),
  weights: z
    .object({
      eligibility: z.number().min(0).max(100),
      technical: z.number().min(0).max(100),
      learning: z.number().min(0).max(100),
      schedule: z.number().min(0).max(100),
      compensation: z.number().min(0).max(100),
      interest: z.number().min(0).max(100),
    })
    .refine(
      (w) => Object.values(w).reduce((a, b) => a + b, 0) === 100,
      "Weights must sum to 100",
    )
    .default({
      eligibility: 30,
      technical: 25,
      learning: 20,
      schedule: 15,
      compensation: 5,
      interest: 5,
    }),
});
export type Profile = z.infer<typeof profileSchema>;
export const defaultProfile = profileSchema.parse({});
export type Posting = {
  externalId: string;
  title: string;
  company: string;
  url: string;
  description: string;
  location: string | null;
  workplace: string | null;
  employment: string | null;
  compensation: string | null;
  postedAt: string | null;
  deadline: string | null;
  closed?: boolean;
  raw: unknown;
};
export type Evaluation = {
  classification: (typeof classifications)[number];
  score: number;
  reasons: string[];
  unknowns: string[];
  evidence: { rule: string; quote: string }[];
  components: Record<string, number>;
  matchedSkills: string[];
  evaluatedAt: string;
  version: string;
};
export const sourceSchema = z.object({
  provider: z.enum(["greenhouse", "lever", "ashby"]),
  board: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  company: z.string().trim().min(1).max(120),
});
export function safeUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.hostname === "localhost" ||
    /^[\d.]+$/.test(u.hostname) ||
    u.hostname.includes(":") ||
    !u.hostname.includes(".") ||
    /\.(local|internal|test|localhost)$/.test(u.hostname)
  )
    throw new Error("Use a public HTTPS posting URL");
  return u;
}
export function canonicalUrl(value: string) {
  const u = safeUrl(value);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|gh_src|source|ref)/.test(key)) u.searchParams.delete(key);
  u.pathname = u.pathname.replace(/\/$/, "");
  return u.toString();
}
