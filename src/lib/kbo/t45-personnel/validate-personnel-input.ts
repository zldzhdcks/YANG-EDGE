/**
 * KBO T45 personnel input validators (per-game isolation).
 */
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type {
  CommercialUseStatus,
  GameValidationResult,
  KboT45GameInput,
  KboT45LineupBatterInput,
  KboT45PersonnelInputV1,
  KboT45ProtoInput,
  KboT45StarterInput,
  PersonnelCompleteness,
  PredictionUsability,
  PersonnelWorkflowStatus,
} from "./types";

export type ParseInputOutcome =
  | { ok: true; input: KboT45PersonnelInputV1 }
  | { ok: false; globalBlocker: string };

export function tempPlayerKey(team: string, name: string): string {
  const slug = `${team}-${name}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "");
  return `tmp-kbo-${slug}`;
}

export function parsePersonnelInputJson(raw: unknown): ParseInputOutcome {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, globalBlocker: "GLOBAL_BLOCKER: input root must be object" };
  }
  const doc = raw as Record<string, unknown>;
  if (doc.schemaVersion !== "kbo-t45-personnel-input-v1") {
    return {
      ok: false,
      globalBlocker: `GLOBAL_BLOCKER: schemaVersion must be kbo-t45-personnel-input-v1 (got ${String(doc.schemaVersion)})`,
    };
  }
  if (doc.league !== "KBO") {
    return { ok: false, globalBlocker: "GLOBAL_BLOCKER: league must be KBO" };
  }
  if (typeof doc.dateKst !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(doc.dateKst)) {
    return { ok: false, globalBlocker: "GLOBAL_BLOCKER: dateKst YYYY-MM-DD required" };
  }
  if (!Array.isArray(doc.games)) {
    return { ok: false, globalBlocker: "GLOBAL_BLOCKER: games must be an array" };
  }
  return { ok: true, input: doc as unknown as KboT45PersonnelInputV1 };
}

export function validateStarter(
  starter: KboT45StarterInput | null | undefined,
  team: string,
  side: "home" | "away",
): { ok: boolean; errors: string[]; warnings: string[]; resolvedId: string | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!starter || typeof starter !== "object") {
    return {
      ok: false,
      errors: [`STARTER_NOT_ENTERED_${side.toUpperCase()}`],
      warnings,
      resolvedId: null,
    };
  }
  if (!starter.playerName || !String(starter.playerName).trim()) {
    errors.push(`STARTER_NAME_MISSING_${side.toUpperCase()}`);
  }
  const hand = starter.throwingHand;
  if (hand != null && hand !== "L" && hand !== "R" && hand !== "S") {
    errors.push(`STARTER_THROWING_HAND_INVALID_${side.toUpperCase()}`);
  }
  let resolvedId: string | null = null;
  const pid = starter.playerId?.trim() || null;
  const tmp = starter.temporaryPlayerKey?.trim() || null;
  if (pid && !pid.startsWith("tmp-")) {
    resolvedId = pid;
  } else {
    resolvedId = tmp || (starter.playerName ? tempPlayerKey(team, starter.playerName) : null);
    warnings.push("PLAYER_ID_UNRESOLVED");
  }
  return { ok: errors.length === 0, errors, warnings, resolvedId };
}

export function validateLineup(
  lineup: KboT45LineupBatterInput[] | null | undefined,
  team: string,
  side: "home" | "away",
): {
  ok: boolean;
  partial: boolean;
  batterCount: number;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!lineup || !Array.isArray(lineup) || lineup.length === 0) {
    return {
      ok: false,
      partial: false,
      batterCount: 0,
      errors: [`LINEUP_NOT_ENTERED_${side.toUpperCase()}`],
      warnings,
    };
  }
  const batterCount = lineup.length;
  if (batterCount !== 9) {
    if (batterCount < 9) {
      errors.push(`LINEUP_PARTIAL_COUNT_${side.toUpperCase()}:${batterCount}`);
    } else {
      errors.push(`LINEUP_COUNT_INVALID_${side.toUpperCase()}:${batterCount}`);
    }
  }
  const slots = lineup.map((b) => b.slot);
  const slotSet = new Set(slots);
  if (slotSet.size !== slots.length) {
    errors.push(`DUPLICATE_BATTING_ORDER_${side.toUpperCase()}`);
  }
  for (const s of slots) {
    if (!Number.isInteger(s) || s < 1 || s > 9) {
      errors.push(`BATTING_ORDER_OUT_OF_RANGE_${side.toUpperCase()}:${s}`);
    }
  }
  if (batterCount === 9 && slotSet.size === 9) {
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9].join(",");
    const got = [...slots].sort((a, b) => a - b).join(",");
    if (got !== expected) {
      errors.push(`BATTING_ORDER_INCOMPLETE_${side.toUpperCase()}`);
    }
  }
  const nameKeys = lineup.map((b) => {
    const id = b.playerId?.trim() || b.temporaryPlayerKey?.trim() || b.playerName;
    return String(id).normalize("NFKC").toLowerCase();
  });
  if (new Set(nameKeys).size !== nameKeys.length) {
    errors.push(`DUPLICATE_PLAYER_${side.toUpperCase()}`);
  }
  for (const b of lineup) {
    if (!b.playerName?.trim()) {
      errors.push(`BATTER_NAME_MISSING_${side.toUpperCase()}_SLOT_${b.slot}`);
    }
    if (!b.position?.trim()) {
      errors.push(`POSITION_MISSING_${side.toUpperCase()}_SLOT_${b.slot}`);
    }
    if (!b.playerId?.trim() || String(b.playerId).startsWith("tmp-")) {
      warnings.push("PLAYER_ID_UNRESOLVED");
    }
  }
  const hardFail = errors.some(
    (e) =>
      e.startsWith("DUPLICATE_") ||
      e.startsWith("BATTING_ORDER_OUT_OF_RANGE") ||
      e.startsWith("POSITION_MISSING") ||
      e.startsWith("BATTER_NAME_MISSING") ||
      e.startsWith("LINEUP_COUNT_INVALID"),
  );
  const partial =
    batterCount > 0 &&
    batterCount < 9 &&
    !errors.some((e) => e.startsWith("DUPLICATE_"));
  const ok = errors.length === 0 && batterCount === 9;
  return {
    ok,
    partial: partial || (!ok && !hardFail && batterCount > 0 && batterCount < 9),
    batterCount,
    errors: hardFail || !ok ? errors : [],
    warnings: [...new Set(warnings)],
  };
}

export function validateProto(
  proto: KboT45ProtoInput | null | undefined,
  homeTeam: string,
  awayTeam: string,
): { ok: boolean; status: string; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!proto || typeof proto !== "object") {
    return {
      ok: false,
      status: "NOT_ENTERED",
      errors: ["DOMESTIC_PROTO_NOT_ENTERED"],
      warnings,
    };
  }
  const homeId = resolveKboTeamIdentity(homeTeam);
  const awayId = resolveKboTeamIdentity(awayTeam);
  if (homeId.mappingStatus !== "MATCHED" || !homeId.canonicalTeamId) {
    errors.push("TEAM_MAPPING_FAILED_HOME");
  }
  if (awayId.mappingStatus !== "MATCHED" || !awayId.canonicalTeamId) {
    errors.push("TEAM_MAPPING_FAILED_AWAY");
  }
  if (errors.some((e) => e.startsWith("TEAM_MAPPING"))) {
    return { ok: false, status: "TEAM_MAPPING_FAILED", errors, warnings };
  }
  const hp = proto.homePrice;
  const ap = proto.awayPrice;
  const bad = (n: unknown) =>
    typeof n !== "number" || !Number.isFinite(n) || Number.isNaN(n) || n <= 1;
  if (bad(hp) || bad(ap)) {
    return {
      ok: false,
      status: "INVALID_PRICE",
      errors: ["INVALID_PRICE"],
      warnings,
    };
  }
  if (proto.format && proto.format !== "DECIMAL") {
    errors.push("PROTO_FORMAT_MUST_BE_DECIMAL");
  }
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? "ADMIN_VERIFIED" : "PARTIAL",
    errors,
    warnings,
  };
}

export type CutoffContext = {
  nowMs: number;
  lockedPredictionExists?: boolean;
  statusAbstract?: string | null;
  actualStartTime?: string | null;
};

export function checkHardCutoff(
  game: KboT45GameInput,
  ctx: CutoffContext,
): { blocked: boolean; code: "AFTER_CUTOFF" | "ALREADY_LOCKED" | "BLOCKED_AFTER_START" | null } {
  if (ctx.lockedPredictionExists) {
    return { blocked: true, code: "ALREADY_LOCKED" };
  }
  const startMs = Date.parse(game.scheduledStartTime);
  const observedMs = Date.parse(game.observedAt);
  const blob = `${ctx.statusAbstract ?? ""}`.toUpperCase();
  if (/FINAL|\bFT\b|IN[_\s-]?PROGRESS|\bLIVE\b/.test(blob)) {
    return { blocked: true, code: "BLOCKED_AFTER_START" };
  }
  if (ctx.actualStartTime && Date.parse(ctx.actualStartTime) <= ctx.nowMs) {
    return { blocked: true, code: "BLOCKED_AFTER_START" };
  }
  if (Number.isFinite(startMs) && ctx.nowMs >= startMs) {
    return { blocked: true, code: "AFTER_CUTOFF" };
  }
  if (Number.isFinite(startMs) && Number.isFinite(observedMs) && observedMs >= startMs) {
    return { blocked: true, code: "AFTER_CUTOFF" };
  }
  return { blocked: false, code: null };
}

function completenessOf(input: {
  starterHome: boolean;
  starterAway: boolean;
  lineupHomeOk: boolean;
  lineupAwayOk: boolean;
  lineupPartial: boolean;
  protoOk: boolean;
}): PersonnelCompleteness {
  if (
    input.starterHome &&
    input.starterAway &&
    input.lineupHomeOk &&
    input.lineupAwayOk &&
    input.protoOk
  ) {
    return "COMPLETE";
  }
  if (
    input.lineupPartial ||
    input.starterHome ||
    input.starterAway ||
    input.lineupHomeOk ||
    input.lineupAwayOk ||
    input.protoOk
  ) {
    return "PARTIAL";
  }
  return "INSUFFICIENT";
}

function usabilityOf(
  completeness: PersonnelCompleteness,
  hasHardError: boolean,
): PredictionUsability {
  if (hasHardError) return "UNUSABLE";
  if (completeness === "COMPLETE") return "ELIGIBLE";
  if (completeness === "PARTIAL") return "WARNING_ONLY";
  return "UNUSABLE";
}

export function validateGame(
  game: KboT45GameInput,
  ctx: CutoffContext,
): GameValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!game.gameId?.trim()) {
    return {
      gameId: String(game.gameId ?? ""),
      status: "FAILED",
      completeness: "INSUFFICIENT",
      predictionUsability: "UNUSABLE",
      starterOk: false,
      lineupOk: false,
      lineupPartial: false,
      protoOk: false,
      batterCount: 0,
      errors: ["GAME_ID_MISSING"],
      warnings,
    };
  }

  const cutoff = checkHardCutoff(game, ctx);
  if (cutoff.blocked && cutoff.code) {
    return {
      gameId: game.gameId,
      status: cutoff.code,
      completeness: "INSUFFICIENT",
      predictionUsability: "UNUSABLE",
      starterOk: false,
      lineupOk: false,
      lineupPartial: false,
      protoOk: false,
      batterCount: 0,
      errors: [cutoff.code],
      warnings,
    };
  }

  const sh = validateStarter(game.home?.starter, game.homeTeam, "home");
  const sa = validateStarter(game.away?.starter, game.awayTeam, "away");
  const lh = validateLineup(game.home?.lineup, game.homeTeam, "home");
  const la = validateLineup(game.away?.lineup, game.awayTeam, "away");
  const proto = validateProto(game.domesticProto, game.homeTeam, game.awayTeam);

  errors.push(...sh.errors, ...sa.errors, ...lh.errors, ...la.errors, ...proto.errors);
  warnings.push(...sh.warnings, ...sa.warnings, ...lh.warnings, ...la.warnings, ...proto.warnings);

  const hardDup = errors.some(
    (e) => e.startsWith("DUPLICATE_") || e === "INVALID_PRICE" || e.startsWith("TEAM_MAPPING"),
  );
  const lineupPartial = (lh.partial || la.partial) && !hardDup;
  const completeness = completenessOf({
    starterHome: sh.ok,
    starterAway: sa.ok,
    lineupHomeOk: lh.ok,
    lineupAwayOk: la.ok,
    lineupPartial,
    protoOk: proto.ok,
  });
  const starterOk = sh.ok && sa.ok;
  const lineupOk = lh.ok && la.ok;
  const protoOk = proto.ok;

  let status: GameValidationResult["status"] = "DRAFT";
  if (hardDup) {
    status = "FAILED";
  } else if (completeness === "COMPLETE" && starterOk && lineupOk && protoOk) {
    status = "ADMIN_VERIFIED";
  } else if (completeness === "PARTIAL" || lineupPartial) {
    status = "DRAFT";
  } else if (!starterOk && !lineupOk && !protoOk) {
    status = "NOT_AVAILABLE";
  } else {
    status = "DRAFT";
  }

  const predictionUsability = usabilityOf(completeness, hardDup || status === "FAILED");

  return {
    gameId: game.gameId,
    status: status as PersonnelWorkflowStatus | "FAILED" | "AFTER_CUTOFF" | "ALREADY_LOCKED",
    completeness,
    predictionUsability,
    starterOk,
    lineupOk,
    lineupPartial,
    protoOk,
    batterCount: lh.batterCount + la.batterCount,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

export type T45InputProbe =
  | { status: "MISSING" }
  | { status: "INVALID"; reason: string }
  | { status: "READY"; dateKst: string; gameCount: number };

export function probePersonnelInputFile(
  rawText: string | null,
): T45InputProbe {
  if (rawText == null) return { status: "MISSING" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { status: "INVALID", reason: "JSON_PARSE_FAILED" };
  }
  const outcome = parsePersonnelInputJson(parsed);
  if (!outcome.ok) {
    return { status: "INVALID", reason: outcome.globalBlocker };
  }
  return {
    status: "READY",
    dateKst: outcome.input.dateKst,
    gameCount: outcome.input.games.length,
  };
}

export function defaultCommercialUse(
  status: CommercialUseStatus | undefined,
): CommercialUseStatus {
  return status ?? "INTERNAL_ONLY";
}
