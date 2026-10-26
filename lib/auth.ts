import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
function secret() {
  return process.env.SESSION_SECRET || "";
}
export function token() {
  const exp = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${exp}.${createHmac("sha256", secret()).update(exp).digest("hex")}`;
}
function equals(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authenticated(req: NextRequest) {
  const password = process.env.SCOUT_PASSWORD;
  if (!password)
    return (
      process.env.NODE_ENV !== "production" &&
      ["127.0.0.1", "localhost"].includes(req.nextUrl.hostname)
    );
  if (secret().length < 32) return false;
  const value = req.cookies.get("scout_session")?.value || "",
    [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return equals(sig, createHmac("sha256", secret()).update(exp).digest("hex"));
}
export function passwordMatches(value: string) {
  return (
    !!process.env.SCOUT_PASSWORD && equals(value, process.env.SCOUT_PASSWORD)
  );
}
export function sameOrigin(req: NextRequest) {
  return (
    req.headers.get("origin") === (process.env.APP_ORIGIN || req.nextUrl.origin)
  );
}
