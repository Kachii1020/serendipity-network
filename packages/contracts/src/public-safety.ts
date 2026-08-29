const sensitiveKeys = new Set([
  "accesskey",
  "accesstoken",
  "apikey",
  "authtoken",
  "authorization",
  "clientsecret",
  "cookie",
  "credential",
  "databaseurl",
  "holdtoken",
  "html",
  "idempotencykey",
  "password",
  "privatekey",
  "rawhtml",
  "rawprompt",
  "refreshtoken",
  "script",
  "secret",
  "sessiontoken",
  "servicerolekey",
  "sql",
  "stack",
  "tokenhash",
]);

const normalizedKey = (value: string): string =>
  value.replace(/[\s_-]/g, "").toLowerCase();

const isSensitiveKey = (value: string): boolean =>
  sensitiveKeys.has(normalizedKey(value));

export const assertPublicPayloadSafe = (
  value: unknown,
): { ok: true } | { ok: false; path: string } => {
  const ancestors = new WeakSet<object>();
  const visit = (candidate: unknown, path: string): string | null => {
    if (typeof candidate === "string" && /<\/?[A-Za-z][^>]*>/.test(candidate)) {
      return path || "/";
    }
    if (Array.isArray(candidate)) {
      if (ancestors.has(candidate)) return path || "/";
      ancestors.add(candidate);
      for (const [index, item] of candidate.entries()) {
        const unsafePath = visit(item, `${path}/${index}`);
        if (unsafePath) {
          ancestors.delete(candidate);
          return unsafePath;
        }
      }
      ancestors.delete(candidate);
      return null;
    }
    if (candidate === null || typeof candidate !== "object") return null;
    if (ancestors.has(candidate)) return path || "/";
    ancestors.add(candidate);
    for (const [key, child] of Object.entries(candidate)) {
      const childPath = `${path}/${key}`;
      if (isSensitiveKey(key)) {
        ancestors.delete(candidate);
        return childPath;
      }
      const unsafePath = visit(child, childPath);
      if (unsafePath) {
        ancestors.delete(candidate);
        return unsafePath;
      }
    }
    ancestors.delete(candidate);
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
