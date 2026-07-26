import type {
  LedgerSelectionType,
  LedgerSport,
  LedgerSportKnown,
} from "@/types/ledger";
import { isLedgerSportKnown } from "@/types/ledger";

export type LedgerSelectionOption = {
  selectionType: LedgerSelectionType;
  /** select value / 기본 표시 라벨 */
  label: string;
};

const TWO_WAY: LedgerSelectionOption[] = [
  { selectionType: "home", label: "홈승" },
  { selectionType: "away", label: "원정승" },
  { selectionType: "other", label: "기타" },
];

const THREE_WAY: LedgerSelectionOption[] = [
  { selectionType: "home", label: "홈승" },
  { selectionType: "draw", label: "무" },
  { selectionType: "away", label: "원정승" },
  { selectionType: "other", label: "기타" },
];

const OTHER_ONLY: LedgerSelectionOption[] = [
  { selectionType: "other", label: "기타" },
];

/** 종목별 기본 선택 옵션 (MVP) */
export function selectionOptionsForSport(
  sport: LedgerSport,
): LedgerSelectionOption[] {
  const known: LedgerSportKnown = isLedgerSportKnown(sport)
    ? sport
    : "other";

  switch (known) {
    case "football":
      return THREE_WAY;
    case "other":
      return OTHER_ONLY;
    case "baseball":
    case "basketball":
    case "volleyball":
    case "ice-hockey":
    default:
      return TWO_WAY;
  }
}

export function defaultSelectionForSport(sport: LedgerSport): {
  selectionType: LedgerSelectionType;
  selectionLabel: string;
} {
  const first = selectionOptionsForSport(sport)[0];
  return {
    selectionType: first.selectionType,
    selectionLabel: first.label,
  };
}

/** option key — selectionType + label (기타 구분용) */
export function selectionOptionValue(opt: LedgerSelectionOption): string {
  return `${opt.selectionType}:${opt.label}`;
}

export function parseSelectionOptionValue(value: string): {
  selectionType: LedgerSelectionType;
  selectionLabel: string;
} | null {
  const idx = value.indexOf(":");
  if (idx < 0) return null;
  const selectionType = value.slice(0, idx) as LedgerSelectionType;
  const selectionLabel = value.slice(idx + 1);
  if (
    selectionType !== "home" &&
    selectionType !== "draw" &&
    selectionType !== "away" &&
    selectionType !== "other"
  ) {
    return null;
  }
  if (!selectionLabel) return null;
  return { selectionType, selectionLabel };
}
