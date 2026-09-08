import {
  CANDIDATE_SIMPLICITY_RANK_V2,
  type CandidatePilotScoreV2,
  type OcrRecoveryV2CandidateName,
} from "./types";
import { OcrRecoveryExperimentV2Error } from "./identity";

function totalExactEvidence(score: CandidatePilotScoreV2): number {
  return (
    score.participantLeftExactEvidencePresent +
    score.participantRightExactEvidencePresent +
    score.numericCellExactEvidenceCount
  );
}

export function selectBestOcrRecoveryCandidateV2(
  scores: CandidatePilotScoreV2[],
): OcrRecoveryV2CandidateName {
  const eligible = scores.filter((s) => s.status === "OK");
  if (eligible.length === 0) {
    throw new OcrRecoveryExperimentV2Error("NO_EXPERIMENT_CANDIDATES");
  }
  let best = eligible[0]!;
  for (let i = 1; i < eligible.length; i++) {
    const cur = eligible[i]!;
    if (cur.allPrimaryEvidencePresent !== best.allPrimaryEvidencePresent) {
      if (cur.allPrimaryEvidencePresent > best.allPrimaryEvidencePresent) best = cur;
      continue;
    }
    if (cur.participantPairExactEvidencePresent !== best.participantPairExactEvidencePresent) {
      if (cur.participantPairExactEvidencePresent > best.participantPairExactEvidencePresent) {
        best = cur;
      }
      continue;
    }
    if (cur.numericCellsAllExactEvidencePresent !== best.numericCellsAllExactEvidencePresent) {
      if (cur.numericCellsAllExactEvidencePresent > best.numericCellsAllExactEvidencePresent) {
        best = cur;
      }
      continue;
    }
    const curTotal = totalExactEvidence(cur);
    const bestTotal = totalExactEvidence(best);
    if (curTotal !== bestTotal) {
      if (curTotal > bestTotal) best = cur;
      continue;
    }
    if (
      CANDIDATE_SIMPLICITY_RANK_V2[cur.candidate] <
      CANDIDATE_SIMPLICITY_RANK_V2[best.candidate]
    ) {
      best = cur;
    }
  }
  return best.candidate;
}

export function ocrRecoveryV2Level(best: CandidatePilotScoreV2): 0 | 1 | 2 | 3 {
  if (best.allPrimaryEvidencePresent >= 1) return 3;
  if (best.participantPairExactEvidencePresent >= 1) return 2;
  if (
    best.numericCellExactEvidenceCount > 0 ||
    best.numericCellsAllExactEvidencePresent > 0
  ) {
    return 1;
  }
  return 0;
}
