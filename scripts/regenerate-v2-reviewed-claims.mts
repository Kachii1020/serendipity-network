import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createReviewedPackClaimsV2,
  validatePlaceDataPackV2,
} from "../packages/contracts/src/planner-v2.ts";

import rawPack from "../apps/hub/data/shibuya.places.v2.json";

const validation = validatePlaceDataPackV2(rawPack);
if (!validation.ok) {
  throw new Error(
    `Cannot review an invalid pack: ${validation.issues.join("; ")}`,
  );
}

const snapshot = createReviewedPackClaimsV2(validation.value);
const outputPath = resolve("apps/hub/data/shibuya-v2.reviewed-claims.json");
await writeFile(
  outputPath,
  `${JSON.stringify({ [validation.value.packVersion]: snapshot }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Regenerated reviewed claims for ${validation.value.packVersion}.\n`,
);
