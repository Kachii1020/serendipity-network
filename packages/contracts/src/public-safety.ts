const sensitiveKey =
  /^(?:holdtoken|idempotencykey|servicerolekey|rawprompt|databaseurl|tokenhash|secret|password|sql|stack)$/i;

export const assertPublicPayloadSafe = (
  value: unknown,
): { ok: true } | { ok: false; path: string } => {
  const visit = (candidate: unknown, path: string): string | null => {
    if (Array.isArray(candidate)) {
      for (const [index, item] of candidate.entries()) {
        const unsafePath = visit(item, `${path}/${index}`);
        if (unsafePath) return unsafePath;
      }
      return null;
    }
    if (candidate === null || typeof candidate !== "object") return null;
    for (const [key, child] of Object.entries(candidate)) {
      const childPath = `${path}/${key}`;
      if (sensitiveKey.test(key)) return childPath;
      const unsafePath = visit(child, childPath);
      if (unsafePath) return unsafePath;
    }
    return null;
  };
  const path = visit(value, "");
  return path ? { ok: false, path } : { ok: true };
};

export const enforceResultSize = (
  value: unknown,
):
  { ok: true; bytes: number } | { ok: false; bytes: number; limit: number } => {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return bytes <= 65_536
    ? { ok: true, bytes }
    : { ok: false, bytes, limit: 65_536 };
};
