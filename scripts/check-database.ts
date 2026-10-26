import { db } from "../lib/db";
import { storePosting, getProfile } from "../lib/service";
import assert from "node:assert/strict";
const marker = `scout-integration-${Date.now()}`;
try {
  const source = await db.source.create({
    data: {
      provider: "manual",
      board: marker,
      company: marker,
      enabled: false,
    },
  });
  const post = {
    externalId: "test-1",
    title: "Integration test intern",
    company: marker,
    url: `https://example.com/${marker}`,
    description: "An integration test posting; never used as live job data.",
    location: null,
    workplace: null,
    employment: null,
    compensation: null,
    postedAt: null,
    deadline: null,
    raw: { test: true },
  };
  const p = await getProfile();
  const first = await storePosting(post, source.id, p);
  await db.job.update({
    where: { id: first.id },
    data: { saved: true, notes: "Retain this note" },
  });
  await db.override.create({
    data: {
      jobId: first.id,
      classification: "Verified Eligible",
      reason: "Temporary integration review",
    },
  });
  const second = await storePosting(
    {
      ...post,
      description: "Updated posting text for persistence validation.",
    },
    source.id,
    p,
  );
  assert.equal(second.id, first.id);
  assert.equal(
    await db.override.count({ where: { jobId: first.id, active: true } }),
    0,
  );
  assert.equal(second.saved, true);
  assert.equal(second.notes, "Retain this note");
  assert.equal(await db.jobSource.count({ where: { sourceId: source.id } }), 1);
  console.log(
    "PASS database round trip, idempotency, and saved-state preservation",
  );
} finally {
  await db.job.deleteMany({ where: { company: { key: marker } } });
  await db.source.deleteMany({ where: { board: marker } });
  await db.company.deleteMany({ where: { key: marker } });
  await db.$disconnect();
}
