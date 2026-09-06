import type {
  AnnotationStatusV0,
  DiscoveryAnnotationDocumentV0,
  DiscoveryAnnotationRecordV0,
} from "./types";

export const QUICK_MODE_PRIMARY_FIELDS = [
  "screenRowIdentifierRaw",
  "participantLeftRaw",
  "participantRightRaw",
  "numericCellsRaw",
] as const;

export const PILOT_OPTIONAL_FIELDS = [
  "screenDateRaw",
  "screenTimeRaw",
  "leagueDisplayRaw",
  "marketMarkerRaw",
  "statusTextRaw",
  "otherVisibleTextRaw",
  "annotatorNotes",
] as const;

export const QUICK_MODE_ADVANCED_FIELDS = PILOT_OPTIONAL_FIELDS;

export const PILOT_SAMPLE_SIZE = 10 as const;
export const PILOT_SOURCE = "FIRST_10_FROZEN_DISCOVERY_ROWS" as const;
export const OPTIONAL_SECTION_LABEL = "필요할 때만" as const;
export const ASSISTED_REVIEW_MODE_ACTIVE = false as const;
export const GROUND_TRUTH_FROM_OCR = false as const;
export const OCR_VISIBLE_DURING_TRUTH_ENTRY = false as const;

export const QUICK_UI_LABELS = {
  screenRowIdentifierRaw: "경기번호",
  screenDateRaw: "날짜",
  screenTimeRaw: "시간",
  leagueDisplayRaw: "리그",
  participantLeftRaw: "왼쪽 팀/참가자",
  participantRightRaw: "오른쪽 팀/참가자",
  numericCellsRaw: "숫자칸",
  statusTextRaw: "상태",
  marketMarkerRaw: "시장표시",
  otherVisibleTextRaw: "기타 보이는 글자",
  annotatorNotes: "메모",
} as const;

export type QuickTruthDraftV0 = {
  uncertain: boolean;
  unreadable: boolean;
  screenRowIdentifierRaw: string | null;
  screenDateRaw: string | null;
  screenTimeRaw: string | null;
  leagueDisplayRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  marketMarkerRaw: string | null;
  numericCellsRaw: string[];
  statusTextRaw: string | null;
  otherVisibleTextRaw: string[];
  annotatorNotes: string | null;
};

export const CONFIRM_AND_NEXT_LABEL = "확인하고 다음" as const;
export const TYPING_ALONE_MARKS_COMPLETE = false as const;
export const AUTOSAVE_PROMOTES_ANNOTATION_STATUS = false as const;
export const NAVIGATION_ALONE_MARKS_COMPLETE = false as const;
export const EXPLICIT_HUMAN_REVIEW_REQUIRED_FOR_COMPLETE = true as const;
export const PLAIN_ENTER_WHILE_TYPING_CONFIRMS = false as const;

export function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.trim() === "" ? null : text;
}

/**
 * Split compact operator input on spaces/commas.
 * Does not parse or convert numeric values.
 */
export function parseNumericCellsRaw(value: string): string[] {
  return String(value ?? "")
    .split(/[,\s]+/)
    .filter((token) => token.length > 0);
}

export function formatNumericCellsRaw(cells: string[]): string {
  return cells.join(" ");
}

export function hasEnteredHumanTruth(
  draft: Pick<
    QuickTruthDraftV0,
    | "screenRowIdentifierRaw"
    | "screenDateRaw"
    | "screenTimeRaw"
    | "leagueDisplayRaw"
    | "participantLeftRaw"
    | "participantRightRaw"
    | "marketMarkerRaw"
    | "numericCellsRaw"
    | "statusTextRaw"
    | "otherVisibleTextRaw"
    | "annotatorNotes"
  >,
): boolean {
  const strings = [
    draft.screenRowIdentifierRaw,
    draft.screenDateRaw,
    draft.screenTimeRaw,
    draft.leagueDisplayRaw,
    draft.participantLeftRaw,
    draft.participantRightRaw,
    draft.marketMarkerRaw,
    draft.statusTextRaw,
    draft.annotatorNotes,
  ];
  if (strings.some((value) => value != null && String(value).trim() !== "")) {
    return true;
  }
  if (draft.numericCellsRaw.length > 0) return true;
  if (draft.otherVisibleTextRaw.length > 0) return true;
  return false;
}

export function exclusiveReviewOverrides(input: {
  uncertain: boolean;
  unreadable: boolean;
  lastToggled?: "uncertain" | "unreadable";
}): { uncertain: boolean; unreadable: boolean } {
  if (input.lastToggled === "unreadable" && input.unreadable) {
    return { uncertain: false, unreadable: true };
  }
  if (input.lastToggled === "uncertain" && input.uncertain) {
    return { uncertain: true, unreadable: false };
  }
  if (input.unreadable) return { uncertain: false, unreadable: true };
  if (input.uncertain) return { uncertain: true, unreadable: false };
  return { uncertain: false, unreadable: false };
}

export function persistDraftAnnotationStatus(
  currentStatus: AnnotationStatusV0,
): AnnotationStatusV0 {
  return currentStatus;
}

export function confirmReviewAnnotationStatus(draft: Pick<
  QuickTruthDraftV0,
  "uncertain" | "unreadable"
>): AnnotationStatusV0 {
  const exclusive = exclusiveReviewOverrides(draft);
  if (exclusive.unreadable) return "UNREADABLE";
  if (exclusive.uncertain) return "UNCERTAIN";
  return "COMPLETE";
}

export function deriveQuickAnnotationStatus(
  draft: QuickTruthDraftV0,
  opts?: { confirm?: boolean; currentStatus?: AnnotationStatusV0 },
): AnnotationStatusV0 {
  if (opts?.confirm) return confirmReviewAnnotationStatus(draft);
  return persistDraftAnnotationStatus(opts?.currentStatus ?? "UNANNOTATED");
}

export function overridesFromStatus(status: AnnotationStatusV0): {
  uncertain: boolean;
  unreadable: boolean;
} {
  return {
    uncertain: status === "UNCERTAIN",
    unreadable: status === "UNREADABLE",
  };
}

export function applyQuickDraftToRecord(
  record: DiscoveryAnnotationRecordV0,
  draft: QuickTruthDraftV0,
  opts?: { confirm?: boolean },
): DiscoveryAnnotationRecordV0 {
  return {
    ...record,
    annotationStatus: deriveQuickAnnotationStatus(draft, {
      confirm: opts?.confirm === true,
      currentStatus: record.annotationStatus,
    }),
    screenRowIdentifierRaw: draft.screenRowIdentifierRaw,
    screenDateRaw: draft.screenDateRaw,
    screenTimeRaw: draft.screenTimeRaw,
    leagueDisplayRaw: draft.leagueDisplayRaw,
    participantLeftRaw: draft.participantLeftRaw,
    participantRightRaw: draft.participantRightRaw,
    marketMarkerRaw: draft.marketMarkerRaw,
    numericCellsRaw: [...draft.numericCellsRaw],
    statusTextRaw: draft.statusTextRaw,
    otherVisibleTextRaw: [...draft.otherVisibleTextRaw],
    annotatorNotes: draft.annotatorNotes,
  };
}

export function countAnnotatedRecords(
  records: Array<{ annotationStatus: AnnotationStatusV0 }>,
): number {
  return records.filter((record) => record.annotationStatus !== "UNANNOTATED").length;
}

/**
 * Blind pilot subset = first N frozen Discovery rows in frozen order.
 * Selection is positional only.
 */
export function pilotDiscoverySlice<T>(records: readonly T[]): T[] {
  return records.slice(0, PILOT_SAMPLE_SIZE);
}

export function buildDiscoveryExportV0(
  doc: Pick<DiscoveryAnnotationDocumentV0, "schemaVersion" | "protoRoundKey">,
  records: DiscoveryAnnotationRecordV0[],
) {
  return {
    schemaVersion: doc.schemaVersion,
    protoRoundKey: doc.protoRoundKey,
    records: records.map((record) => ({
      sourceImageSha256: record.sourceImageSha256,
      sourceFileName: record.sourceFileName,
      visualRowIndex: record.visualRowIndex,
      annotationStatus: record.annotationStatus,
      screenRowIdentifierRaw: record.screenRowIdentifierRaw,
      screenDateRaw: record.screenDateRaw,
      screenTimeRaw: record.screenTimeRaw,
      leagueDisplayRaw: record.leagueDisplayRaw,
      participantLeftRaw: record.participantLeftRaw,
      participantRightRaw: record.participantRightRaw,
      marketMarkerRaw: record.marketMarkerRaw,
      numericCellsRaw: record.numericCellsRaw,
      statusTextRaw: record.statusTextRaw,
      otherVisibleTextRaw: record.otherVisibleTextRaw,
      annotatorNotes: record.annotatorNotes,
    })),
  };
}
