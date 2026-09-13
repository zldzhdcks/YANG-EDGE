import { findCompetitionByOperatorLabel } from "../football/foundation/competition-registry";
import { parseScreenshotFilenameTimestamp } from "../proto-round-extraction-design-v0";
import {
  type JoinStatusV1,
  ROUND_IDENTITY_UNCERTAIN,
  type StructuredOddsRowV1,
} from "../domestic-odds-promotion-v1/types";
import {
  boardRowBands,
  cellCropBox,
  headerCropBox,
  inferColumnBands,
  tokensInBox,
  type GeometryLineV2,
} from "./columns";
import { parseDateTimeFromPasses } from "./dates";
import { verifyOddsFromPasses } from "./odds-verify";
import { recoverTeamPair } from "./teams";
import type {
  ColumnNameV2,
  OddsFieldV2,
  OcrPassEvidenceV2,
  PixelBoxV2,
} from "./types";

const KNOWN_LEAGUES = new Set(["KBO", "NPB", "MLB"]);

export type PlannedCellV2 = {
  board: string;
  column: ColumnNameV2;
  crop: PixelBoxV2;
  baselineText: string;
};

export type PlannedImageCropsV2 = {
  sourceFile: string;
  imageWidth: number;
  imageHeight: number;
  header: PixelBoxV2 | null;
  cells: PlannedCellV2[];
  columnBands: ReturnType<typeof inferColumnBands>;
};

export function planImageCrops(input: {
  sourceFile: string;
  lines: GeometryLineV2[];
  imageWidth: number;
  imageHeight: number;
}): PlannedImageCropsV2 {
  const bands = inferColumnBands(input.lines, input.imageWidth);
  const rows = boardRowBands(input.lines, input.imageHeight);
  const header = headerCropBox({
    firstBoardY: rows[0]?.y0 ?? 0,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
  });
  const cells: PlannedCellV2[] = [];
  for (const row of rows) {
    for (const column of ["DATE", "TEAM", "ODDS"] as const) {
      const crop = cellCropBox({
        x0: bands[column].x0,
        x1: bands[column].x1,
        y0: row.y0,
        y1: row.y1,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
      });
      if (!crop) continue;
      const baselineText = tokensInBox(input.lines, crop)
        .map((t) => t.text.trim())
        .filter(Boolean)
        .join(" ");
      cells.push({ board: row.board, column, crop, baselineText });
    }
  }
  return {
    sourceFile: input.sourceFile,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    header,
    cells,
    columnBands: bands,
  };
}

function pickCompetition(text: string): string | null {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (KNOWN_LEAGUES.has(token)) return token;
    if (findCompetitionByOperatorLabel(token)) return token;
  }
  return null;
}

export type AssembledBoardRowV2 = StructuredOddsRowV1 & {
  oddsFields: OddsFieldV2[];
  homeStatus: string;
  awayStatus: string;
  clockAmbiguous: boolean;
  sourceRoundClaim: 108;
  roundVerified: false;
};

export function assembleBoardRow(input: {
  operatingDateKst: string;
  sourceFile: string;
  sourceSha256: string;
  fileMtimeUtc: string | null;
  operatorObservedAtUtc: string;
  board: string;
  datePasses: OcrPassEvidenceV2[];
  teamPasses: OcrPassEvidenceV2[];
  oddsPasses: OcrPassEvidenceV2[];
}): AssembledBoardRowV2 {
  const filenameTs = parseScreenshotFilenameTimestamp(input.sourceFile);
  const date = parseDateTimeFromPasses(input.datePasses, input.operatingDateKst);
  const teams = recoverTeamPair(input.teamPasses);
  const odds = verifyOddsFromPasses(input.oddsPasses);
  const competitionRawLabel =
    pickCompetition(input.teamPasses.map((p) => p.rawText).join(" ")) ??
    pickCompetition(input.datePasses.map((p) => p.rawText).join(" "));
  const verifiedOdds =
    odds.verificationStatus === "ODDS_VERIFIED" && odds.normalizedCandidate != null
      ? [odds.normalizedCandidate]
      : null;
  const extractionStatus =
    odds.verificationStatus === "ODDS_UNREADABLE" && input.board === "1405"
      ? "SOURCE_UNREADABLE"
      : odds.verificationStatus === "ODDS_UNREADABLE"
        ? "INSUFFICIENT_EVIDENCE"
        : verifiedOdds
          ? "PARSED"
        : "INSUFFICIENT_EVIDENCE";
  const rejectionReason = [
    "VERIFIED_CAPTURE_TIME_ABSENT",
    "VERIFIED_PROVIDER_TIME_ABSENT",
    "ROUND_IDENTITY_UNCERTAIN",
    "PREDICTION_INPUT_NOT_PROMOTED",
  ];
  if (extractionStatus !== "PARSED") {
    rejectionReason.unshift(`EXTRACTION_${extractionStatus}`);
  }
  if (teams.home.status === "TEAM_TEXT_PARTIAL" || teams.away.status === "TEAM_TEXT_PARTIAL") {
    rejectionReason.push("TEAM_TEXT_PARTIAL");
  }
  if (date.clockAmbiguous) rejectionReason.push("DISPLAYED_CLOCK_OCR_AMBIGUOUS");
  if (odds.verificationStatus !== "ODDS_VERIFIED") {
    rejectionReason.push(odds.verificationStatus);
  }

  let joinStatus: JoinStatusV1 = "IDENTITY_REVIEW_REQUIRED";
  if (extractionStatus === "SOURCE_UNREADABLE") joinStatus = "SOURCE_UNREADABLE";

  return {
    operatingDateKst: input.operatingDateKst,
    claimedRound: 108,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
    sourceType: "MANUAL_SCREENSHOT",
    sourceFile: input.sourceFile,
    sourceSha256: input.sourceSha256,
    boardGameNumber: input.board,
    competitionRawLabel,
    homeRawName: teams.home.rawText,
    awayRawName: teams.away.rawText,
    marketRaw: null,
    rawOddsText: odds.rawText,
    parsedOddsValues: verifiedOdds,
    extractionStatus,
    extractionConfidence: verifiedOdds ? "HIGH" : "LOW",
    targetDateKst: date.targetDateKst,
    displayedStartKst: date.displayedStartKst,
    screenVisibleStatusLabel: null,
    fileMtimeUtc: input.fileMtimeUtc,
    filenameTimestampCandidateKst: filenameTs.filenameTimestampCandidateKst,
    filenameTimestampCandidateUtc: filenameTs.filenameTimestampCandidateUtc,
    operatorObservedAtUtc: input.operatorObservedAtUtc,
    verifiedCaptureTime: null,
    verifiedProviderTime: null,
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    canonicalFixtureId: null,
    joinStatus,
    predictionInputAllowed: false,
    rejectionReason,
    oddsFields: [odds],
    homeStatus: teams.home.status,
    awayStatus: teams.away.status,
    clockAmbiguous: date.clockAmbiguous,
    sourceRoundClaim: 108,
    roundVerified: false,
  };
}

export function headerHasRoundEvidence(texts: string[]): boolean {
  return texts.some((t) => /회차/.test(t) || /108/.test(t));
}
