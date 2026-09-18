import { DEFAULT_FORWARD_EVAL_REL } from "./constants";
import { loadCommittedScheduleIdentityIndex } from "./identity";
import {
  readCommittedEvalDocument,
  resolveEvalPath,
  unwrapEvalPayload,
} from "./load";
import { buildForwardReadModelFromPayload } from "./build";
import type {
  FootballForwardEvidenceReadModel,
  LoadForwardReadModelInput,
} from "./types";

export {
  FORWARD_READ_MODEL_SCHEMA_VERSION,
  EXPECTED_EVAL_SCHEMA_VERSION,
  OFFICIAL_FORWARD_MODEL,
  OFFICIAL_FORWARD_MODEL_HASH,
  DEFAULT_FORWARD_EVAL_REL,
  ODDS_ROLE_OBSERVATION_ONLY,
} from "./constants";
export {
  ForwardReadModelError,
  FORWARD_READ_MODEL_ERROR,
} from "./errors";
export type {
  FootballForwardEvidenceReadModel,
  ForwardGradedEvent,
  ForwardHypothesisObservation,
  ForwardIdentityStatus,
  LoadForwardReadModelInput,
  ResolvedFixtureIdentity,
} from "./types";
export { loadCommittedScheduleIdentityIndex } from "./identity";

/**
 * Server-only Official Forward evidence read model.
 * Primary source is the committed cumulative evaluation.
 * Does not read MODEL_FORWARD cache, call providers, or fall back to R1/V3.
 */
export function loadFootballForwardEvidenceReadModel(
  input: LoadForwardReadModelInput = {},
): FootballForwardEvidenceReadModel {
  const rootDir = input.rootDir ?? process.cwd();
  const evalRel = input.evalRel ?? DEFAULT_FORWARD_EVAL_REL;
  const generatedFrom = evalRel.replace(/\\/g, "/");
  const document =
    input.document !== undefined
      ? input.document
      : readCommittedEvalDocument(resolveEvalPath(rootDir, evalRel));
  const payload = unwrapEvalPayload(document);
  const identityIndex =
    input.identityIndex ?? loadCommittedScheduleIdentityIndex(rootDir);
  return buildForwardReadModelFromPayload({
    payload,
    generatedFrom,
    identityIndex,
  });
}
