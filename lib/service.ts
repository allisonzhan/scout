import { db } from "./db";
import {
  defaultProfile,
  profileSchema,
  Posting,
  Profile,
  Evaluation,
} from "./domain";
import { evaluate } from "./evaluate";
import { fetchBoard } from "./sources";
import { Prisma } from "@prisma/client";
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function getProfile() {
  const row = await db.profile.findUnique({ where: { id: "owner" } });
  return row ? profileSchema.parse(row.data) : defaultProfile;
}
export function asPosting(j: {
  id: string;
  title: string;
  url: string;
  description: string;
  location: string | null;
  workplace: string | null;
  employment: string | null;
  compensation: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  closed: boolean;
  company: { name: string };
}): Posting {
  return {
    ...j,
    externalId: j.id,
    company: j.company.name,
    postedAt: j.postedAt?.toISOString() || null,
    deadline: j.deadline?.toISOString() || null,
    raw: {},
  };
}
export async function storePosting(
  post: Posting,
  sourceId: string,
  p: Profile,
) {
  return db.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { key: post.company.toLowerCase().trim() },
      create: { key: post.company.toLowerCase().trim(), name: post.company },
      update: {},
    });
    const prior = await tx.jobSource.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: post.externalId } },
    });
    const data = {
      companyId: company.id,
      title: post.title,
      description: post.description,
      url: post.url,
      location: post.location,
      workplace: post.workplace,
      employment: post.employment,
      compensation: post.compensation,
      postedAt: post.postedAt ? new Date(post.postedAt) : null,
      deadline: post.deadline ? new Date(post.deadline) : null,
      closed: false,
      evaluation: json(evaluate(post, p)),
    };
    const previous = prior
      ? await tx.job.findUnique({ where: { id: prior.jobId } })
      : await tx.job.findUnique({ where: { url: post.url } });
    if (
      previous &&
      (
        [
          "title",
          "description",
          "location",
          "workplace",
          "employment",
          "compensation",
          "closed",
        ] as const
      ).some((key) => previous[key] !== data[key])
    )
      await tx.override.updateMany({
        where: { jobId: previous.id, active: true },
        data: { active: false },
      });
    const job = prior
      ? await tx.job.update({ where: { id: prior.jobId }, data })
      : await tx.job.upsert({
          where: { url: post.url },
          create: data,
          update: data,
        });
    await tx.jobSource.upsert({
      where: { sourceId_externalId: { sourceId, externalId: post.externalId } },
      create: {
        sourceId,
        externalId: post.externalId,
        jobId: job.id,
        url: post.url,
        raw: json(post.raw),
      },
      update: {
        raw: json(post.raw),
        url: post.url,
        active: true,
        verifiedAt: new Date(),
      },
    });
    return job;
  });
}
export async function saveProfile(input: unknown) {
  const profile = profileSchema.parse(input);
  await db.$transaction(
    async (tx) => {
      await tx.profile.upsert({
        where: { id: "owner" },
        create: { id: "owner", data: json(profile) },
        update: { data: json(profile) },
      });
      await tx.override.updateMany({
        where: { active: true },
        data: { active: false },
      });
      const jobs = await tx.job.findMany({ include: { company: true } });
      for (const j of jobs)
        await tx.job.update({
          where: { id: j.id },
          data: { evaluation: json(evaluate(asPosting(j), profile)) },
        });
      await tx.audit.create({
        data: {
          action: "profile.updated",
          details: "User-confirmed profile updated; opportunities reevaluated.",
        },
      });
    },
    { maxWait: 15000, timeout: 60000 },
  );
}
export async function discover() {
  // A transaction-scoped advisory lock makes run creation atomic across processes.
  const run = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(724910)`;
    await tx.run.updateMany({
      where: {
        status: "running",
        startedAt: { lt: new Date(Date.now() - 15 * 60_000) },
      },
      data: { status: "interrupted", finishedAt: new Date() },
    });
    if (await tx.run.findFirst({ where: { status: "running" } }))
      throw new Error("A discovery run is already active.");
    return tx.run.create({ data: {} });
  });
  const results: {
    company: string;
    provider: string;
    count: number;
    error?: string;
  }[] = [];
  try {
    const p = await getProfile();
    const sources = await db.source.findMany({
      where: {
        enabled: true,
        provider: { in: ["greenhouse", "lever", "ashby"] },
      },
    });
    for (const s of sources) {
      try {
        const posts = await fetchBoard({
          ...s,
          provider: s.provider as "greenhouse" | "lever" | "ashby",
        });
        // Retain relevant engineering/student roles, while using the complete board for closure checks.
        const relevant = posts.filter((j) =>
          /intern|engineer|developer|machine learning|data scien|research/i.test(
            j.title,
          ),
        );
        for (const post of relevant) await storePosting(post, s.id, p);
        await db.$transaction(
          async (tx) => {
            await tx.jobSource.updateMany({
              where: {
                sourceId: s.id,
                externalId: { notIn: posts.map((j) => j.externalId) },
              },
              data: { active: false, verifiedAt: new Date() },
            });
            const existing = await tx.job.findMany({
              where: { sources: { some: { sourceId: s.id } } },
              include: { company: true, sources: true },
            });
            for (const j of existing) {
              const closed = j.sources.every((x) => !x.active);
              if (closed !== j.closed)
                await tx.job.update({
                  where: { id: j.id },
                  data: {
                    closed,
                    evaluation: json(evaluate({ ...asPosting(j), closed }, p)),
                  },
                });
            }
            await tx.source.update({
              where: { id: s.id },
              data: { lastChecked: new Date(), lastError: null },
            });
          },
          { timeout: 30000 },
        );
        results.push({
          company: s.company,
          provider: s.provider,
          count: relevant.length,
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : "Source failed";
        results.push({
          company: s.company,
          provider: s.provider,
          count: 0,
          error,
        });
        await db.source.update({
          where: { id: s.id },
          data: { lastError: error },
        });
      }
      await db.run.update({
        where: { id: run.id },
        data: { results: json(results) },
      });
    }
    await db.run.update({
      where: { id: run.id },
      data: {
        status: results.some((r) => r.error)
          ? results.every((r) => r.error)
            ? "failed"
            : "partial"
          : "completed",
        finishedAt: new Date(),
        results: json(results),
      },
    });
    return results;
  } catch (e) {
    await db.run.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        results: json(results),
      },
    });
    throw e;
  }
}
export async function snapshot() {
  const [profile, jobs, sources, runs] = await Promise.all([
    getProfile(),
    db.job.findMany({
      include: {
        company: true,
        sources: {
          select: {
            url: true,
            verifiedAt: true,
            active: true,
            source: { select: { provider: true, company: true } },
          },
        },
        overrides: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.source.findMany({ orderBy: { company: "asc" } }),
    db.run.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);
  return {
    profile,
    jobs: jobs.map((j) => ({
      ...j,
      evaluation: j.evaluation as unknown as Evaluation,
    })),
    sources,
    runs,
  };
}
