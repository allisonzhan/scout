import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { authenticated, sameOrigin, token } from "../lib/auth";
test("production requires a session and rejects expired/tampered cookies", () => {
  const env = { ...process.env };
  try {
    process.env.SCOUT_PASSWORD = "test-only-password";
    process.env.SESSION_SECRET = "test-only-secret-at-least-32-characters";
    assert.equal(
      authenticated(new NextRequest("https://scout.example/api/scout")),
      false,
    );
    const session = token();
    assert.equal(
      authenticated(
        new NextRequest("https://scout.example/api/scout", {
          headers: { cookie: `scout_session=${session}` },
        }),
      ),
      true,
    );
    assert.equal(
      authenticated(
        new NextRequest("https://scout.example/api/scout", {
          headers: { cookie: `scout_session=${session}tampered` },
        }),
      ),
      false,
    );
    assert.equal(
      authenticated(
        new NextRequest("https://scout.example/api/scout", {
          headers: { cookie: "scout_session=1.bad" },
        }),
      ),
      false,
    );
    process.env.SESSION_SECRET = "short";
    assert.equal(
      authenticated(
        new NextRequest("https://scout.example/api/scout", {
          headers: { cookie: `scout_session=${session}` },
        }),
      ),
      false,
    );
  } finally {
    process.env = env;
  }
});
test("mutations require exact configured origin", () => {
  const prev = process.env.APP_ORIGIN;
  try {
    process.env.APP_ORIGIN = "https://scout.example";
    assert.equal(
      sameOrigin(
        new NextRequest("https://scout.example/api/scout", {
          headers: { origin: "https://evil.example" },
        }),
      ),
      false,
    );
    assert.equal(
      sameOrigin(
        new NextRequest("https://scout.example/api/scout", {
          headers: { origin: "https://scout.example" },
        }),
      ),
      true,
    );
  } finally {
    if (prev === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = prev;
  }
});
test("production with no password fails closed, even on localhost", () => {
  const env = { ...process.env };
  try {
    process.env = { ...env, NODE_ENV: "production", SCOUT_PASSWORD: "" };
    assert.equal(
      authenticated(new NextRequest("http://127.0.0.1:3000/api/scout")),
      false,
    );
  } finally {
    process.env = env;
  }
});
