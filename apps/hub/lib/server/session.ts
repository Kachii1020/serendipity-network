import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export const createBrowserSessionId = (): string => randomUUID();

export const assertBrowserSessionOwnership = (
  expectedSessionId: string,
  presentedSessionId: string,
): boolean => {
  const digest = (value: string): Buffer =>
    createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expectedSessionId), digest(presentedSessionId));
};
