const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function assertExactOrigin(label, value) {
  if (value.includes("*")) {
    throw new Error(`${label} must not contain a wildcard`);
  }

  const parsed = new URL(value);
  const isLocalHttp =
    parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`${label} must use HTTPS (localhost HTTP is allowed)`);
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${label} must be an exact origin without credentials or path`,
    );
  }

  return parsed;
}

const hub = process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";
const providers = (
  process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
  "http://localhost:3101,http://localhost:3102,http://localhost:3103"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

assertExactOrigin("NEXT_PUBLIC_HUB_ORIGIN", hub);
if (providers.length !== 3) {
  throw new Error("The product requires exactly three Provider origins");
}
providers.forEach((origin, index) => {
  assertExactOrigin(`NEXT_PUBLIC_PROVIDER_ORIGINS[${index}]`, origin);
});

const mode = process.env.WEBMCP_COMPOSITION_MODE ?? "direct";
if (mode !== "nested" && mode !== "direct") {
  throw new Error("WEBMCP_COMPOSITION_MODE must be nested or direct");
}

const encoding = process.env.WEBMCP_EXECUTION_ENCODING ?? "json-string";
if (encoding !== "json-string" && encoding !== "object") {
  throw new Error("WEBMCP_EXECUTION_ENCODING must be json-string or object");
}

console.log(
  JSON.stringify(
    {
      encoding,
      hub,
      mode,
      providers,
      valid: true,
    },
    null,
    2,
  ),
);
