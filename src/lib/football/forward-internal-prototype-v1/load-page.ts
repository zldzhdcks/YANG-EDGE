import {
  ForwardReadModelError,
  loadFootballForwardEvidenceReadModel,
  type FootballForwardEvidenceReadModel,
} from "../forward-read-model-v1";

export type OfficialForwardInternalPageData =
  | { status: "ok"; model: FootballForwardEvidenceReadModel }
  | { status: "error"; code: string };

/**
 * Internal page loader. Fail closed to an error code.
 * Does not fall back to R1/V3/mock cards.
 */
export function loadOfficialForwardInternalPage(): OfficialForwardInternalPageData {
  try {
    return { status: "ok", model: loadFootballForwardEvidenceReadModel() };
  } catch (err) {
    if (err instanceof ForwardReadModelError) {
      return { status: "error", code: err.code };
    }
    return { status: "error", code: "FORWARD_EVAL_UNAVAILABLE" };
  }
}
