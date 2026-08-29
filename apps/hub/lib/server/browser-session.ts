import "server-only";

import { randomUUID } from "node:crypto";

const COOKIE_NAME = "serendipity-session";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BrowserSession = {
  id: string;
  isNew: boolean;
};

export const readBrowserSession = (request: Request): BrowserSession => {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  return value && UUID_PATTERN.test(value)
    ? { id: value, isNew: false }
    : { id: randomUUID(), isNew: true };
};

export const browserSessionCookie = (
  session: BrowserSession,
  secure = process.env.NODE_ENV === "production",
): string | undefined =>
  session.isNew
    ? `${COOKIE_NAME}=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=14400${secure ? "; Secure" : ""}`
    : undefined;
