import {
  CANDIDATE_SIMPLICITY_RANK,
  type CandidatePilotScoreV1,
  type OcrRecoveryCandidateName,
} from "./types";
import { OcrRecoveryExperimentError } from "./identity";

function tieBreakSum(score: CandidatePilotScoreV1): number {
  return (
    score.participantLeftExactEvidencePresent +
    score.participantRightExactEvidencePresent +
    score.numericCellsAllExactEvidencePresent
  );
}

export function selectBestOcrRecoveryCandidate(
  scores: CandidatePilotScoreV1[],
): OcrRecoveryCandidateName {
  if (scores.length === 0) {
    throw new OcrRecoveryExperimentError("NO_EXPERIMENT_CANDIDATES");
  }
  let best = scores[0]!;
  for (let i = 1; i < scores.length; i++) {
    const cur = scores[i]!;
    if (cur.allPrimaryEvidencePresent > best.allPrimaryEvidencePresent) {
      best = cur;
      continue;
    }
    if (cur.allPrimaryEvidencePresent < best.allPrimaryEvidencePresent) {
      continue;
    }
    const curSum = tieBreakSum(cur);
    const bestSum = tieBreakSum(best);
    if (curSum > bestSum) {
      best = cur;
      continue;
    }
    if (curSum < bestSum) continue;
    if (CANDIDATE_SIMPLICITY_RANK[cur.candidate] < CANDIDATE_SIMPLICITY_RANK[best.candidate]) {
      best = cur;
    }
  }
  return best.candidate;
}
