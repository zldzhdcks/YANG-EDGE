/**
 * LedgerTicketDraft 검산 계층.
 * 인식값을 추측·보정하지 않는다. 불일치 시 needs-review + issue 만 추가.
 */

import {
  combinePickOdds,
  expectedTicketReturn,
  isValidPickOdds,
} from "@/lib/ledger/calc";
import type {
  DraftValidationIssue,
  LedgerPickDraft,
  LedgerTicketDraft,
  RecognitionField,
} from "@/types/ledger-draft";

const CONFIDENCE_AUTO_CONFIRM_MIN = 0.8;
const COMBINED_ODDS_RELATIVE_TOLERANCE = 0.01;
const EXPECTED_RETURN_ABS_FLOOR = 10;
const EXPECTED_RETURN_RELATIVE = 0.001;

const SELECTION_TYPES: ReadonlySet<string> = new Set([
  "home",
  "draw",
  "away",
  "other",
]);

function cloneField<T>(field: RecognitionField<T>): RecognitionField<T> {
  return {
    value: field.value,
    confidence: field.confidence,
    sourceText: field.sourceText,
    status: field.status,
    issues: [...field.issues],
  };
}

function clonePick(pick: LedgerPickDraft): LedgerPickDraft {
  return {
    clientKey: pick.clientKey,
    gameId: cloneField(pick.gameId),
    sport: cloneField(pick.sport),
    league: cloneField(pick.league),
    homeTeam: cloneField(pick.homeTeam),
    awayTeam: cloneField(pick.awayTeam),
    startTime: cloneField(pick.startTime),
    selectionType: cloneField(pick.selectionType),
    selectionLabel: cloneField(pick.selectionLabel),
    odds: cloneField(pick.odds),
  };
}

function cloneDraft(draft: LedgerTicketDraft): LedgerTicketDraft {
  return {
    id: draft.id,
    imageHash: draft.imageHash,
    betDate: cloneField(draft.betDate),
    stake: cloneField(draft.stake),
    recognizedCombinedOdds: cloneField(draft.recognizedCombinedOdds),
    calculatedCombinedOdds: draft.calculatedCombinedOdds,
    expectedReturn: cloneField(draft.expectedReturn),
    calculatedExpectedReturn: draft.calculatedExpectedReturn,
    source: cloneField(draft.source),
    memo: cloneField(draft.memo),
    picks: draft.picks.map(clonePick),
    validationIssues: draft.validationIssues.map((i) => ({ ...i })),
    readyToSave: draft.readyToSave,
  };
}

/**
 * confidence 정규화.
 * - 범위 밖 → null + needs-review + INVALID_CONFIDENCE
 * - 값 있고 confidence < 0.8 → confirmed 금지 (needs-review)
 */
export function normalizeRecognitionField<T>(
  field: RecognitionField<T>,
): RecognitionField<T> {
  const next = cloneField(field);
  const issues = [...next.issues];

  if (next.value == null) {
    if (next.status === "confirmed") {
      next.status = "missing";
    } else if (next.status !== "needs-review") {
      next.status = "missing";
    }
  }

  if (next.confidence != null) {
    if (
      !Number.isFinite(next.confidence) ||
      next.confidence < 0 ||
      next.confidence > 1
    ) {
      next.confidence = null;
      if (next.value != null) {
        next.status = "needs-review";
      }
      if (!issues.includes("INVALID_CONFIDENCE")) {
        issues.push("INVALID_CONFIDENCE");
      }
    } else if (
      next.value != null &&
      next.confidence < CONFIDENCE_AUTO_CONFIRM_MIN &&
      next.status === "confirmed"
    ) {
      next.status = "needs-review";
    }
  }

  next.issues = issues;
  return next;
}

function addIssue(
  list: DraftValidationIssue[],
  issue: DraftValidationIssue,
): void {
  const exists = list.some(
    (i) =>
      i.code === issue.code &&
      i.path === issue.path &&
      i.message === issue.message,
  );
  if (!exists) list.push(issue);
}

function fieldBlocksSave(field: RecognitionField<unknown>): boolean {
  return field.status === "missing" || field.status === "needs-review";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function relativeDiff(a: number, b: number): number {
  const denom = Math.abs(b);
  if (denom === 0) return Math.abs(a) === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / denom;
}

/**
 * Draft 검산. 입력은 변경하지 않고 새 객체를 반환한다 (결정적).
 */
export function validateTicketDraft(
  input: LedgerTicketDraft,
): LedgerTicketDraft {
  const draft = cloneDraft(input);
  const issues: DraftValidationIssue[] = [];

  draft.betDate = normalizeRecognitionField(draft.betDate);
  draft.stake = normalizeRecognitionField(draft.stake);
  draft.recognizedCombinedOdds = normalizeRecognitionField(
    draft.recognizedCombinedOdds,
  );
  draft.expectedReturn = normalizeRecognitionField(draft.expectedReturn);
  draft.source = normalizeRecognitionField(draft.source);
  draft.memo = normalizeRecognitionField(draft.memo);
  draft.picks = draft.picks.map((p) => ({
    ...p,
    gameId: normalizeRecognitionField(p.gameId),
    sport: normalizeRecognitionField(p.sport),
    league: normalizeRecognitionField(p.league),
    homeTeam: normalizeRecognitionField(p.homeTeam),
    awayTeam: normalizeRecognitionField(p.awayTeam),
    startTime: normalizeRecognitionField(p.startTime),
    selectionType: normalizeRecognitionField(p.selectionType),
    selectionLabel: normalizeRecognitionField(p.selectionLabel),
    odds: normalizeRecognitionField(p.odds),
  }));

  if (draft.picks.length < 1) {
    addIssue(issues, {
      code: "NO_PICKS",
      message: "픽이 1개 이상 필요합니다.",
    });
  }

  if (draft.betDate.value == null || !isNonEmptyString(draft.betDate.value)) {
    draft.betDate.status = "missing";
    addIssue(issues, {
      code: "REQUIRED_MISSING",
      message: "베팅일이 없습니다.",
      path: "betDate",
    });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.betDate.value.trim())) {
    draft.betDate.status = "needs-review";
    if (!draft.betDate.issues.includes("INVALID_BET_DATE")) {
      draft.betDate.issues.push("INVALID_BET_DATE");
    }
    addIssue(issues, {
      code: "INVALID_BET_DATE",
      message: "베팅일 형식이 YYYY-MM-DD 가 아닙니다.",
      path: "betDate",
    });
  }

  const stake = draft.stake.value;
  if (stake == null || !Number.isFinite(stake)) {
    draft.stake.status = "missing";
    addIssue(issues, {
      code: "REQUIRED_MISSING",
      message: "베팅금이 없습니다.",
      path: "stake",
    });
  } else if (stake <= 0) {
    draft.stake.status = "needs-review";
    if (!draft.stake.issues.includes("INVALID_STAKE")) {
      draft.stake.issues.push("INVALID_STAKE");
    }
    addIssue(issues, {
      code: "INVALID_STAKE",
      message: "베팅금은 0보다 커야 합니다.",
      path: "stake",
    });
  }

  if (draft.source.value == null || !isNonEmptyString(draft.source.value)) {
    draft.source.status = "missing";
    addIssue(issues, {
      code: "REQUIRED_MISSING",
      message: "판단 출처가 없습니다.",
      path: "source",
    });
  } else if (
    draft.source.value !== "manual" &&
    draft.source.value !== "yang-edge"
  ) {
    draft.source.status = "needs-review";
    if (!draft.source.issues.includes("INVALID_SOURCE")) {
      draft.source.issues.push("INVALID_SOURCE");
    }
    addIssue(issues, {
      code: "INVALID_SOURCE",
      message: "판단 출처는 manual 또는 yang-edge 여야 합니다.",
      path: "source",
    });
  }

  if (draft.memo.value == null && draft.memo.status !== "needs-review") {
    draft.memo.status = "missing";
  }

  const validOddsForCalc: { odds: number }[] = [];

  for (const pick of draft.picks) {
    const pathPrefix = `picks.${pick.clientKey}`;

    if (!isNonEmptyString(pick.sport.value)) {
      pick.sport.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "종목이 없습니다.",
        path: `${pathPrefix}.sport`,
      });
    }

    if (!isNonEmptyString(pick.homeTeam.value)) {
      pick.homeTeam.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "홈팀이 없습니다.",
        path: `${pathPrefix}.homeTeam`,
      });
    }

    if (pick.awayTeam.value == null) {
      pick.awayTeam.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "원정팀이 없습니다.",
        path: `${pathPrefix}.awayTeam`,
      });
    }

    if (pick.selectionType.value == null) {
      pick.selectionType.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "선택 타입이 없습니다.",
        path: `${pathPrefix}.selectionType`,
      });
    } else if (!SELECTION_TYPES.has(pick.selectionType.value)) {
      pick.selectionType.status = "needs-review";
      if (!pick.selectionType.issues.includes("INVALID_SELECTION_TYPE")) {
        pick.selectionType.issues.push("INVALID_SELECTION_TYPE");
      }
      addIssue(issues, {
        code: "INVALID_SELECTION_TYPE",
        message: "selectionType 이 유효하지 않습니다.",
        path: `${pathPrefix}.selectionType`,
      });
    }

    if (!isNonEmptyString(pick.selectionLabel.value)) {
      pick.selectionLabel.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "선택 내용이 없습니다.",
        path: `${pathPrefix}.selectionLabel`,
      });
    }

    const odds = pick.odds.value;
    if (odds == null) {
      pick.odds.status = "missing";
      addIssue(issues, {
        code: "REQUIRED_MISSING",
        message: "배당이 없습니다.",
        path: `${pathPrefix}.odds`,
      });
    } else if (!Number.isFinite(odds) || odds < 1) {
      pick.odds.status = "needs-review";
      if (!pick.odds.issues.includes("INVALID_ODDS")) {
        pick.odds.issues.push("INVALID_ODDS");
      }
      addIssue(issues, {
        code: "INVALID_ODDS",
        message: "배당은 유한 숫자이며 1 이상이어야 합니다.",
        path: `${pathPrefix}.odds`,
      });
    } else if (isValidPickOdds(odds)) {
      validOddsForCalc.push({ odds });
    }
  }

  draft.calculatedCombinedOdds =
    validOddsForCalc.length > 0 ? combinePickOdds(validOddsForCalc) : null;

  if (
    stake != null &&
    Number.isFinite(stake) &&
    stake > 0 &&
    draft.calculatedCombinedOdds != null
  ) {
    draft.calculatedExpectedReturn = expectedTicketReturn(
      stake,
      draft.calculatedCombinedOdds,
    );
  } else {
    draft.calculatedExpectedReturn = null;
  }

  const recognizedOdds = draft.recognizedCombinedOdds.value;
  if (
    recognizedOdds != null &&
    Number.isFinite(recognizedOdds) &&
    draft.calculatedCombinedOdds != null
  ) {
    const rel = relativeDiff(recognizedOdds, draft.calculatedCombinedOdds);
    if (rel > COMBINED_ODDS_RELATIVE_TOLERANCE) {
      draft.recognizedCombinedOdds.status = "needs-review";
      if (
        !draft.recognizedCombinedOdds.issues.includes("COMBINED_ODDS_MISMATCH")
      ) {
        draft.recognizedCombinedOdds.issues.push("COMBINED_ODDS_MISMATCH");
      }
      addIssue(issues, {
        code: "COMBINED_ODDS_MISMATCH",
        message: `인식 조합배당(${recognizedOdds})과 계산값(${draft.calculatedCombinedOdds})의 상대 오차가 1%를 초과합니다.`,
        path: "recognizedCombinedOdds",
      });
    }
  }

  const recognizedReturn = draft.expectedReturn.value;
  if (
    recognizedReturn != null &&
    Number.isFinite(recognizedReturn) &&
    draft.calculatedExpectedReturn != null
  ) {
    const calc = draft.calculatedExpectedReturn;
    const tolerance = Math.max(
      EXPECTED_RETURN_ABS_FLOOR,
      Math.abs(calc) * EXPECTED_RETURN_RELATIVE,
    );
    if (Math.abs(recognizedReturn - calc) > tolerance) {
      draft.expectedReturn.status = "needs-review";
      if (!draft.expectedReturn.issues.includes("EXPECTED_RETURN_MISMATCH")) {
        draft.expectedReturn.issues.push("EXPECTED_RETURN_MISMATCH");
      }
      addIssue(issues, {
        code: "EXPECTED_RETURN_MISMATCH",
        message: `인식 예상환급(${recognizedReturn})과 계산값(${calc})의 차이가 허용(${tolerance})을 초과합니다.`,
        path: "expectedReturn",
      });
    }
  }

  for (const path of ["betDate", "stake", "source"] as const) {
    const field = draft[path];
    if (field.status === "needs-review") {
      addIssue(issues, {
        code: "NEEDS_REVIEW",
        message: `${path} 필드 검토가 필요합니다.`,
        path,
      });
    }
  }

  if (draft.recognizedCombinedOdds.status === "needs-review") {
    addIssue(issues, {
      code: "NEEDS_REVIEW",
      message: "조합배당 검토가 필요합니다.",
      path: "recognizedCombinedOdds",
    });
  }
  if (draft.expectedReturn.status === "needs-review") {
    addIssue(issues, {
      code: "NEEDS_REVIEW",
      message: "예상 환급액 검토가 필요합니다.",
      path: "expectedReturn",
    });
  }
  if (draft.memo.status === "needs-review") {
    addIssue(issues, {
      code: "NEEDS_REVIEW",
      message: "memo 필드 검토가 필요합니다.",
      path: "memo",
    });
  }

  for (const pick of draft.picks) {
    const requiredPick: Array<[RecognitionField<unknown>, string]> = [
      [pick.sport, "sport"],
      [pick.homeTeam, "homeTeam"],
      [pick.awayTeam, "awayTeam"],
      [pick.selectionType, "selectionType"],
      [pick.selectionLabel, "selectionLabel"],
      [pick.odds, "odds"],
    ];
    for (const [field, name] of requiredPick) {
      if (field.status === "needs-review") {
        addIssue(issues, {
          code: "NEEDS_REVIEW",
          message: `${name} 필드 검토가 필요합니다.`,
          path: `picks.${pick.clientKey}.${name}`,
        });
      }
    }
    if (pick.league.status === "needs-review") {
      addIssue(issues, {
        code: "NEEDS_REVIEW",
        message: "league 필드 검토가 필요합니다.",
        path: `picks.${pick.clientKey}.league`,
      });
    }
    if (pick.gameId.status === "needs-review") {
      addIssue(issues, {
        code: "NEEDS_REVIEW",
        message: "gameId 필드 검토가 필요합니다.",
        path: `picks.${pick.clientKey}.gameId`,
      });
    }
    if (pick.startTime.status === "needs-review") {
      addIssue(issues, {
        code: "NEEDS_REVIEW",
        message: "startTime 필드 검토가 필요합니다.",
        path: `picks.${pick.clientKey}.startTime`,
      });
    }
  }

  draft.validationIssues = issues;

  const anyNeedsReviewOrMissingRequired =
    fieldBlocksSave(draft.betDate) ||
    fieldBlocksSave(draft.stake) ||
    fieldBlocksSave(draft.source) ||
    draft.recognizedCombinedOdds.status === "needs-review" ||
    draft.expectedReturn.status === "needs-review" ||
    draft.memo.status === "needs-review" ||
    draft.picks.some(
      (p) =>
        fieldBlocksSave(p.sport) ||
        fieldBlocksSave(p.homeTeam) ||
        fieldBlocksSave(p.awayTeam) ||
        fieldBlocksSave(p.selectionType) ||
        fieldBlocksSave(p.selectionLabel) ||
        fieldBlocksSave(p.odds) ||
        p.league.status === "needs-review" ||
        p.gameId.status === "needs-review" ||
        p.startTime.status === "needs-review",
    );

  draft.readyToSave =
    draft.picks.length >= 1 &&
    issues.length === 0 &&
    !anyNeedsReviewOrMissingRequired &&
    draft.calculatedCombinedOdds != null &&
    draft.calculatedExpectedReturn != null;

  return draft;
}
