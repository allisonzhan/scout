import { NextRequest, NextResponse } from "next/server";
import { passwordMatches, sameOrigin, token } from "@/lib/auth";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const key = "single-user",
    current = attempts.get(key);
  if (current && current.until > Date.now() && current.count >= 10)
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (
    !data ||
    typeof data.password !== "string" ||
    !passwordMatches(data.password)
  ) {
    const a =
      current && current.until > Date.now()
        ? current
        : { count: 0, until: Date.now() + 900000 };
    a.count++;
    attempts.set(key, a);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  if ((process.env.SESSION_SECRET || "").length < 32)
    return NextResponse.json(
      { error: "Configure SESSION_SECRET with at least 32 characters." },
      { status: 503 },
    );
  attempts.delete(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("scout_session", token(), {
    httpOnly: true,
    sameSite: "strict",
    secure:
      new URL(process.env.APP_ORIGIN || req.nextUrl.origin).protocol ===
      "https:",
    maxAge: 43200,
    path: "/",
  });
  return res;
}
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("scout_session");
  return res;
}
