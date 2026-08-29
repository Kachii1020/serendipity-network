import type { PlaceEvidenceDataV2 } from "@serendipity/contracts/planner-v2";

import {
  createPlannerEvidenceHandler,
  type PlannerV2OperationResult,
} from "../../../../../../lib/planner-v2/handlers";
import {
  PLANNER_V2_PACK_VERSION,
  readPlaceEvidenceV2,
} from "../../../../../../lib/planner-v2/runtime";

export const dynamic = "force-dynamic";

export type PlannerEvidenceOperation = (
  placeId: string,
) =>
  | PlannerV2OperationResult<PlaceEvidenceDataV2>
  | Promise<PlannerV2OperationResult<PlaceEvidenceDataV2>>;

export const createPlannerEvidenceGet = (
  getEvidence: PlannerEvidenceOperation,
  packVersion = PLANNER_V2_PACK_VERSION,
) => createPlannerEvidenceHandler({ getEvidence, packVersion });

const getEvidence = createPlannerEvidenceGet(readPlaceEvidenceV2);

export async function GET(
  request: Request,
  context: { params: Promise<{ placeId: string }> },
): Promise<Response> {
  const { placeId } = await context.params;
  return getEvidence(request, placeId);
}
