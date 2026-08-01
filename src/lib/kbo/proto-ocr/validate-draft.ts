/**
 * Validate admin-edited Proto OCR draft rows (no file writes).
 */
import { validateProto } from "../t45-personnel/validate-personnel-input";
import { loadKboScheduleGames } from "./schedule-load";
import type {
  KboProtoOcrDraftRow,
  ProtoOcrValidateResponse,
} from "./types";
import { computeProtoOcrConfidence } from "./confidence";

export async function validateProtoOcrDraft(options: {
  dateKst: string;
  rows: KboProtoOcrDraftRow[];
  now?: Date;
  cwd?: string;
  lockedGameIds?: Set<string>;
  historicalReadOnly?: boolean;
}): Promise<ProtoOcrValidateResponse> {
  const now = options.now ?? new Date();
  const cwd = options.cwd ?? process.cwd();
  const globalErrors: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateKst)) {
    return {
      ok: false,
      dateKst: options.dateKst,
      rows: [],
      globalErrors: ["INVALID_DATE_KST"],
      mutationPerformed: false,
      errorCode: "INVALID_DATE_KST",
    };
  }

  if (options.dateKst === "2026-07-31" || options.historicalReadOnly) {
    globalErrors.push("HISTORICAL_READ_ONLY");
  }

  const schedule = await loadKboScheduleGames(options.dateKst, cwd);
  const byId = new Map(schedule.map((g) => [g.gameId, g]));

  const rows = options.rows.map((row) => {
    const next: KboProtoOcrDraftRow = {
      ...row,
      errors: [...row.errors],
      warnings: [...row.warnings],
    };
    if (!row.gameId) {
      next.errors.push("GAME_NOT_FOUND");
      return next;
    }
    const g = byId.get(row.gameId);
    if (!g) {
      next.errors.push("GAME_NOT_FOUND");
      next.mappingStatus = "GAME_NOT_IN_SCHEDULE";
      return next;
    }
    if (options.lockedGameIds?.has(row.gameId)) {
      next.errors.push("ALREADY_LOCKED");
    }
    const startMs = Date.parse(g.scheduledStartTime);
    if (Number.isFinite(startMs) && now.getTime() >= startMs) {
      next.errors.push("AFTER_CUTOFF");
    }

    // Direction vs schedule
    if (
      row.resolvedHomeTeam &&
      row.resolvedAwayTeam &&
      (row.resolvedHomeTeam !== g.home || row.resolvedAwayTeam !== g.away)
    ) {
      // allow if canonical alias equal via names already set from schedule
      if (g.home !== row.resolvedHomeTeam || g.away !== row.resolvedAwayTeam) {
        next.warnings.push("TEAM_LABEL_CHECK");
      }
    }

    const proto =
      row.homePrice != null && row.awayPrice != null
        ? {
            homePrice: row.homePrice,
            awayPrice: row.awayPrice,
            format: "DECIMAL" as const,
            marketType: "MONEYLINE_2WAY" as const,
          }
        : null;
    const pv = validateProto(proto, g.home, g.away);
    if (!pv.ok) {
      next.errors.push(...pv.errors);
    }

    next.confidence = computeProtoOcrConfidence({
      textRecognitionConfidence: row.confidence.textRecognitionConfidence,
      teamResolved: Boolean(row.resolvedAwayTeam && row.resolvedHomeTeam),
      pricesResolved: row.homePrice != null && row.awayPrice != null && pv.ok,
      scheduleMatched: Boolean(g),
      ambiguous: row.mappingStatus === "AMBIGUOUS",
      directionMismatch: row.mappingStatus === "DIRECTION_MISMATCH",
      invalidPrice: pv.errors.includes("INVALID_PRICE"),
      parserWarnings: row.warnings,
      mappingStatus: row.mappingStatus,
    });

    next.errors = [...new Set(next.errors)];
    return next;
  });

  const ok =
    globalErrors.length === 0 &&
    rows.every(
      (r) =>
        r.adminDecision === "REJECTED" ||
        (r.errors.length === 0 &&
          r.gameId &&
          r.homePrice != null &&
          r.awayPrice != null),
    );

  return {
    ok,
    dateKst: options.dateKst,
    rows,
    globalErrors,
    mutationPerformed: false,
    errorCode: globalErrors[0],
  };
}
