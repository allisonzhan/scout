import { NextRequest, NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  discover,
  getProfile,
  saveProfile,
  snapshot,
  storePosting,
} from "@/lib/service";
import { canonicalUrl, classifications, sourceSchema } from "@/lib/domain";
import { fetchBoard, parseJobUrl } from "@/lib/sources";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  if (!authenticated(req))
    return NextResponse.json(
      { error: "Sign in to Scout", unauthorized: true },
      { status: 401 },
    );
  try {
    return NextResponse.json(await snapshot());
  } catch {
    return NextResponse.json(
      {
        error:
          "Database unavailable. Check DATABASE_URL and run database migrations.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!authenticated(req))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  try {
    if (Number(req.headers.get("content-length") || 0) > 150000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 150000) throw new Error("Request too large");
    const body = z
      .object({ action: z.string(), data: z.unknown() })
      .parse(JSON.parse(raw));
    switch (body.action) {
      case "profile":
        await saveProfile(body.data);
        break;
      case "source": {
        const s = sourceSchema.parse(body.data);
        await db.source.upsert({
          where: { provider_board: { provider: s.provider, board: s.board } },
          create: s,
          update: { company: s.company, enabled: true },
        });
        break;
      }
      case "toggleSource": {
        const d = z
          .object({ id: z.string(), enabled: z.boolean() })
          .parse(body.data);
        await db.source.update({
          where: { id: d.id },
          data: { enabled: d.enabled },
        });
        break;
      }
      case "discover":
        return NextResponse.json({ results: await discover() });
      case "save": {
        const d = z
          .object({ id: z.string(), saved: z.boolean() })
          .parse(body.data);
        await db.job.update({ where: { id: d.id }, data: { saved: d.saved } });
        break;
      }
      case "notes": {
        const d = z
          .object({ id: z.string(), notes: z.string().max(10000) })
          .parse(body.data);
        await db.job.update({ where: { id: d.id }, data: { notes: d.notes } });
        break;
      }
      case "override": {
        const d = z
          .object({
            id: z.string(),
            classification: z.enum(classifications),
            reason: z.string().trim().min(10).max(2000),
          })
          .parse(body.data);
        await db.$transaction([
          db.override.create({
            data: {
              jobId: d.id,
              classification: d.classification,
              reason: d.reason,
            },
          }),
          db.audit.create({
            data: {
              action: "eligibility.override",
              details: `${d.id}: ${d.classification}: ${d.reason}`,
            },
          }),
        ]);
        break;
      }
      case "import": {
        const d = z.object({ url: z.string().max(2000) }).parse(body.data),
          parsed = parseJobUrl(d.url);
        const s = await db.source.upsert({
          where: {
            provider_board: { provider: parsed.provider, board: parsed.board },
          },
          create: {
            provider: parsed.provider,
            board: parsed.board,
            company: parsed.board,
            enabled: false,
          },
          update: {},
        });
        const jobs = await fetchBoard({ ...parsed, company: s.company });
        const post = jobs.find((j) => j.externalId === parsed.externalId);
        if (!post)
          throw new Error("Posting is not currently listed on this board.");
        await storePosting(post, s.id, await getProfile());
        break;
      }
      case "manual": {
        const d = z
          .object({
            url: z.string().max(2000),
            title: z.string().min(3).max(200),
            company: z.string().min(1).max(120),
            description: z.string().min(50).max(100000),
          })
          .parse(body.data);
        const url = canonicalUrl(d.url);
        const s = await db.source.upsert({
          where: { provider_board: { provider: "manual", board: "user" } },
          create: {
            provider: "manual",
            board: "user",
            company: "Manual imports",
            enabled: false,
          },
          update: {},
        });
        await storePosting(
          {
            ...d,
            url,
            externalId: url,
            location: null,
            workplace: null,
            employment: null,
            compensation: null,
            postedAt: null,
            deadline: null,
            raw: { origin: "user-supplied", ...d },
          },
          s.id,
          await getProfile(),
        );
        break;
      }
      default:
        throw new Error("Unknown action");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : e instanceof Error
              ? e.message
              : "Action failed",
      },
      { status: 400 },
    );
  }
}
