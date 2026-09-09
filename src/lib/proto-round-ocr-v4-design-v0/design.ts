import type {
  OcrV4CandidateDefinitionV0,
  OcrV4CandidateNameV0,
  OcrV4SuccessLevelV0,
} from "./types";
import {
  CANDIDATE_SIMPLICITY_RANK_V4,
  OCR_V4_CANDIDATES,
  WINNER_RULE_ORDER_V4,
} from "./types";
import { OcrV4DesignV0Error } from "./error";

export const OCR_V4_CANDIDATE_DEFINITIONS: OcrV4CandidateDefinitionV0[] = [
  {
    name: "LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO",
    cropRule:
      "visualRow [topY,bottomY] split at floor(imageWidth/2); LEFT_TEXT_BAND x=[0,mid); RIGHT_TEXT_BAND x=[mid,imageWidth); no Human participant coordinates",
    scale: "4",
    interpolation: "Linear",
    preprocessing: "none",
    language: "ko",
    evidenceUnionRule: "independent union of LEFT_TEXT_BAND and RIGHT_TEXT_BAND extracts",
  },
  {
    name: "MULTI_SCALE_ROW_CROP_3X_5X_LINEAR_KO",
    cropRule: "full visual row native box x=0,y=topY,width=imageWidth,height=bottomY-topY",
    scale: "3 and 5",
    interpolation: "Linear",
    preprocessing: "none",
    language: "ko",
    evidenceUnionRule: "independent union of scale-3 extract and scale-5 extract",
  },
  {
    name: "ROW_NEAREST_NEIGHBOR_UPSCALE_4X_KO",
    cropRule: "full visual row native box",
    scale: "4",
    interpolation: "NearestNeighbor",
    preprocessing: "none",
    language: "ko",
    evidenceUnionRule: "single crop extract",
  },
  {
    name: "TEXT_REGION_LEFT_RIGHT_BY_CENTER_X_UPSCALE_5X_LINEAR_KO",
    cropRule:
      "exclusive TEXT_BEARING_RAW region boxes expanded 0.8 horizontal / 1.0 vertical; partition by fragment-union centerX vs imageWidth/2",
    scale: "5",
    interpolation: "Linear",
    preprocessing: "none",
    language: "ko",
    evidenceUnionRule:
      "independent union of left-of-midpoint region crops and right-of-midpoint region crops",
  },
  {
    name: "ROW_PLUS_LEFT_RIGHT_BANDS_EVIDENCE_UNION",
    cropRule:
      "frozen v3 visual-row crop plus LEFT_TEXT_BAND and RIGHT_TEXT_BAND half-row crops; machine geometry only",
    scale: "row=3; left/right bands=4",
    interpolation: "Linear",
    preprocessing: "none",
    language: "ko",
    evidenceUnionRule: "independent union of row crop and left/right half-row extracts",
  },
  {
    name: "CONTRAST_NORMALIZE_ROW_UPSCALE_4X_LINEAR_KO",
    cropRule: "full visual row native box",
    scale: "4",
    interpolation: "Linear",
    preprocessing:
      "grayscale then deterministic min-max contrast stretch on crop pixels before OCR; no network; no external API",
    language: "ko",
    evidenceUnionRule: "single preprocessed crop extract",
  },
];

export const VALIDATION_2_OPEN_REQUIRES = [
  "v4 candidate definitions frozen",
  "winner rule frozen",
  "development experiment completed once",
  "winning v4 implementation frozen in Git",
] as const;

export const AFTER_VALIDATION_2_OPENED = "NO_MORE_V4_RULE_CHANGES" as const;

export const TEAM_NAME_DICTIONARY_FORBIDDEN = true as const;
export const THREE_DIGIT_DECIMAL_GUESS_FORBIDDEN = true as const;

export function frozenOcrV4CandidateDefinitions(): OcrV4CandidateDefinitionV0[] {
  if (OCR_V4_CANDIDATE_DEFINITIONS.length > 6) {
    throw new OcrV4DesignV0Error("TOO_MANY_V4_CANDIDATES");
  }
  if (OCR_V4_CANDIDATE_DEFINITIONS.length !== OCR_V4_CANDIDATES.length) {
    throw new OcrV4DesignV0Error("V4_CANDIDATE_COUNT_MISMATCH");
  }
  return OCR_V4_CANDIDATE_DEFINITIONS.map((c) => ({ ...c }));
}

export type OcrV4CandidateScoreV0 = {
  candidate: OcrV4CandidateNameV0;
  participantPairExactEvidencePresent: number;
  participantExactSlotCount: number;
  numericRawAllExactRowCount: number;
  numericRawExactCellCount: number;
};

export function selectOcrV4Winner(scores: OcrV4CandidateScoreV0[]): OcrV4CandidateNameV0 {
  if (scores.length === 0) {
    throw new OcrV4DesignV0Error("NO_V4_CANDIDATES");
  }
  let best = scores[0]!;
  for (let i = 1; i < scores.length; i++) {
    const cur = scores[i]!;
    if (
      cur.participantPairExactEvidencePresent !== best.participantPairExactEvidencePresent
    ) {
      if (cur.participantPairExactEvidencePresent > best.participantPairExactEvidencePresent) {
        best = cur;
      }
      continue;
    }
    if (cur.participantExactSlotCount !== best.participantExactSlotCount) {
      if (cur.participantExactSlotCount > best.participantExactSlotCount) best = cur;
      continue;
    }
    if (cur.numericRawAllExactRowCount !== best.numericRawAllExactRowCount) {
      if (cur.numericRawAllExactRowCount > best.numericRawAllExactRowCount) best = cur;
      continue;
    }
    if (cur.numericRawExactCellCount !== best.numericRawExactCellCount) {
      if (cur.numericRawExactCellCount > best.numericRawExactCellCount) best = cur;
      continue;
    }
    if (CANDIDATE_SIMPLICITY_RANK_V4[cur.candidate] < CANDIDATE_SIMPLICITY_RANK_V4[best.candidate]) {
      best = cur;
    }
  }
  return best.candidate;
}

export function ocrV4SuccessLevel(input: {
  baselinePair: number;
  candidatePair: number;
  baselineNumericRawAllExactRows: number;
  candidateNumericRawAllExactRows: number;
  candidatePairExact: number;
}): OcrV4SuccessLevelV0 {
  const pairUp = input.candidatePair > input.baselinePair;
  const numericAllUp =
    input.candidateNumericRawAllExactRows > input.baselineNumericRawAllExactRows;
  if (input.candidatePairExact >= 5 && input.candidateNumericRawAllExactRows >= 3) {
    return "V4_LEVEL_3";
  }
  if (pairUp && numericAllUp) return "V4_LEVEL_2";
  if (pairUp) return "V4_LEVEL_1";
  return "V4_LEVEL_0";
}

export { WINNER_RULE_ORDER_V4 };
