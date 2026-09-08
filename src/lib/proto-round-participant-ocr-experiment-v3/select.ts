import {
  CANDIDATE_SIMPLICITY_RANK_V3,
  type CandidatePilotScoreV3,
  type ParticipantOcrV3CandidateName,
} from "./types";
import { ParticipantOcrExperimentV3Error } from "./identity";

export function selectBestParticipantOcrCandidateV3(
  scores: CandidatePilotScoreV3[],
): ParticipantOcrV3CandidateName {
  if (scores.length === 0) {
    throw new ParticipantOcrExperimentV3Error("NO_EXPERIMENT_CANDIDATES");
  }
  let best = scores[0]!;
  for (let i = 1; i < scores.length; i++) {
    const cur = scores[i]!;
    if (cur.participantPairExactEvidencePresent !== best.participantPairExactEvidencePresent) {
      if (cur.participantPairExactEvidencePresent > best.participantPairExactEvidencePresent) {
        best = cur;
      }
      continue;
    }
    if (cur.participantExactSlotCount !== best.participantExactSlotCount) {
      if (cur.participantExactSlotCount > best.participantExactSlotCount) best = cur;
      continue;
    }
    if (cur.numericCellsAllExactEvidencePresent !== best.numericCellsAllExactEvidencePresent) {
      if (cur.numericCellsAllExactEvidencePresent > best.numericCellsAllExactEvidencePresent) {
        best = cur;
      }
      continue;
    }
    if (
      CANDIDATE_SIMPLICITY_RANK_V3[cur.candidate] <
      CANDIDATE_SIMPLICITY_RANK_V3[best.candidate]
    ) {
      best = cur;
    }
  }
  return best.candidate;
}

export function participantOcrV3Level(
  pairExact: number,
): 0 | 1 | 2 | 3 {
  if (pairExact >= 5) return 3;
  if (pairExact >= 3) return 2;
  if (pairExact >= 1) return 1;
  return 0;
}
