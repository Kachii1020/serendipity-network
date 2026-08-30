import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(repositoryRoot, "apps/hub/data/planner-v3");
const packs = JSON.parse(
  readFileSync(resolve(dataDirectory, "area-packs.v3.json"), "utf8"),
);

if (!Array.isArray(packs)) {
  throw new Error("v3 area pack catalog must be an array");
}

for (const pack of packs) {
  if (
    pack === null ||
    typeof pack !== "object" ||
    typeof pack.area !== "string" ||
    typeof pack.packVersion !== "string"
  ) {
    throw new Error("v3 area pack catalog contains an invalid pack pointer");
  }

  const ledger = {
    [pack.packVersion]: {
      schemaVersion: "3",
      packVersion: pack.packVersion,
      area: pack.area,
      pack,
    },
  };
  writeFileSync(
    resolve(dataDirectory, `${pack.area}.reviewed-claims.v3.json`),
    `${JSON.stringify(ledger, null, 2)}\n`,
    "utf8",
  );
}

console.log(`Regenerated ${packs.length} independent v3 reviewed snapshots.`);
