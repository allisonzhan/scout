import assert from "node:assert/strict";
const base = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const res = await fetch(`${base}/api/scout`);
assert.equal(res.status, 200);
const initial = await res.json();
const bad = await fetch(`${base}/api/scout`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://evil.example",
  },
  body: JSON.stringify({ action: "profile", data: {} }),
});
assert.equal(bad.status, 403);
const first = initial.jobs.find(
  (j: { sources: { source: { provider: string } }[] }) =>
    j.sources.some((s) => s.source.provider === "ashby"),
);
assert.ok(first, "Run discovery before this integration check");
const imported = await fetch(`${base}/api/scout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ action: "import", data: { url: first.url } }),
});
assert.equal(imported.status, 200, await imported.text());
const after = await (await fetch(`${base}/api/scout`)).json();
assert.equal(after.jobs.length, initial.jobs.length);
assert.equal(
  after.jobs.find((j: { id: string }) => j.id === first.id).saved,
  first.saved,
);
console.log("PASS HTTP origin protection and real ATS import deduplication");
