import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const providerBuilds = readdirSync(join(root, "apps/provider"))
  .filter((name) => name.startsWith(".next-"))
  .map((name) => join(root, "apps/provider", name, "static"));
const roots = [join(root, "apps/hub/.next/static"), ...providerBuilds].filter(
  existsSync,
);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".txt",
]);
const forbiddenNames = [
  "BUNDLE_ENCRYPTION_KEY",
  "DATABASE_URL",
  "DEMO_OPERATOR_SECRET",
  "HOLD_TOKEN_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "HUB_INTERSERVICE_SECRET",
  "PROVIDER_ACCESS_TOKEN_SECRET",
];
const forbiddenValues = [
  ...forbiddenNames.map((name) => process.env[name]),
  "local-only-hold-token-secret-32-bytes-minimum",
  "local-only-interservice-secret-32-bytes-minimum",
  "local-only-provider-access-secret-32-bytes-minimum",
].filter((value) => typeof value === "string" && value.length >= 16);

const files = [];
const visit = (path) => {
  for (const name of readdirSync(path)) {
    const target = join(path, name);
    if (statSync(target).isDirectory()) visit(target);
    else if (
      [...textExtensions].some((extension) => name.endsWith(extension))
    ) {
      files.push(target);
    }
  }
};
for (const path of roots) visit(path);

if (files.length === 0) {
  throw new Error("No built browser assets were found. Build the apps first.");
}

const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const name of forbiddenNames) {
    if (text.includes(name)) findings.push(`${file}: environment name ${name}`);
  }
  for (const value of forbiddenValues) {
    if (text.includes(value)) findings.push(`${file}: configured secret value`);
  }
}

if (findings.length > 0) {
  throw new Error(`Public asset secret scan failed:\n${findings.join("\n")}`);
}

console.log(
  `Public asset secret scan passed: ${files.length} files across ${roots.length} builds.`,
);
