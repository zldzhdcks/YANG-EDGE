/**
 * Save / load NPB manual moneyline odds confirmation.
 * Never overwrites Provider odds artifacts.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  asFiniteMs,
  loadNpbScheduleGames,
} from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  npbMarketOddsConfirmationAbs,
  npbMarketOddsConfirmationRel,
} from "./paths";
import {
  normalizeImpliedPair,
  parseDecimalOdds,
} from "./validate-odds";
import type {
  NpbMarketOddsConfirmationV0,
  NpbMarketOddsDraftGame,
  NpbMarketOddsGameV0,
  NpbOddsUiStatus,
} from "./types";
import { NPB_MARKET_ODDS_CONFIRMATION_SCHEMA } from "./types";

function cutoffFor(input: {
  verifiedAt: string;
  firstPitchAt: string | null;
}): {
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: NpbMarketOddsGameV0["cutoffLabel"];
} {
  const v = asFiniteMs(input.verifiedAt);
  const f = asFiniteMs(input.firstPitchAt);
  if (v == null || f == null) {
    return { isBeforeFirstPitch: null, cutoffLabel: "UNKNOWN" };
  }
  if (v < f) {
    return { isBeforeFirstPitch: true, cutoffLabel: "PRE_GAME_VERIFIED" };
  }
  return { isBeforeFirstPitch: false, cutoffLabel: "LATE_OPERATOR_INPUT" };
}

function uiStatusFor(game: {
  joinStatus: NpbMarketOddsGameV0["joinStatus"];
  awayOdds: number | null;
  homeOdds: number | null;
  cutoffLabel: NpbMarketOddsGameV0["cutoffLabel"];
}): NpbOddsUiStatus {
  if (game.joinStatus !== "MATCHED") return "JOIN_ERROR";
  if (game.cutoffLabel === "LATE_OPERATOR_INPUT") return "LATE";
  if (game.awayOdds != null && game.homeOdds != null) return "VERIFIED";
  return "MISSING";
}

function summarize(
  games: NpbMarketOddsGameV0[],
): NpbMarketOddsConfirmationV0["summary"] {
  let matchedGames = 0;
  let moneylineVerified = 0;
  let missing = 0;
  let lateGames = 0;
  let joinErrors = 0;
  let preGameVerifiedGames = 0;

  for (const g of games) {
    if (g.joinStatus === "MATCHED") matchedGames++;
    else joinErrors++;
    if (g.uiStatus === "LATE" || g.cutoffLabel === "LATE_OPERATOR_INPUT") {
      lateGames++;
    }
    if (g.awayOdds != null && g.homeOdds != null && g.joinStatus === "MATCHED") {
      moneylineVerified++;
      if (g.cutoffLabel === "PRE_GAME_VERIFIED") preGameVerifiedGames++;
    } else if (g.joinStatus === "MATCHED") {
      missing++;
    }
  }

  return {
    scheduleGames: games.length,
    matchedGames,
    moneylineVerified,
    missing,
    lateGames,
    joinErrors,
    preGameVerifiedGames,
  };
}

export async function loadNpbMarketOddsConfirmation(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbMarketOddsConfirmationV0 | null> {
  try {
    const raw = JSON.parse(
      await readFile(
        npbMarketOddsConfirmationAbs(input.dateKst, input.cwd),
        "utf8",
      ),
    ) as unknown;
    const doc = asRecord(raw);
    if (
      !doc ||
      asString(doc.schemaVersion) !== NPB_MARKET_ODDS_CONFIRMATION_SCHEMA
    ) {
      return null;
    }
    return raw as NpbMarketOddsConfirmationV0;
  } catch {
    return null;
  }
}

export async function saveNpbMarketOddsConfirmation(input: {
  dateKst: string;
  cwd?: string;
  sourceLabel?: string;
  verifiedAt?: string;
  drafts: NpbMarketOddsDraftGame[];
  allowLate?: boolean;
}): Promise<{
  ok: boolean;
  pathRel: string;
  document: NpbMarketOddsConfirmationV0 | null;
  errors: string[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  const pathRel = npbMarketOddsConfirmationRel(dateKst);
  const errors: string[] = [];

  const schedule = await loadNpbScheduleGames({ dateKst, cwd });
  if (!schedule.exists || schedule.games.length === 0) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: ["SCHEDULE_MISSING"],
    };
  }

  const matchedById = new Map(
    schedule.games
      .filter((g) => g.joinStatus === "MATCHED")
      .map((g) => [g.internalGameId, g] as const),
  );

  const games: NpbMarketOddsGameV0[] = [];

  for (const draft of input.drafts) {
    const awayRaw = draft.awayOdds;
    const homeRaw = draft.homeOdds;
    const awayEmpty =
      awayRaw == null || String(awayRaw).trim() === "";
    const homeEmpty =
      homeRaw == null || String(homeRaw).trim() === "";
    if (awayEmpty && homeEmpty) {
      continue;
    }

    const sched = matchedById.get(draft.internalGameId);
    if (!sched) {
      const ambiguous = schedule.games.find(
        (g) =>
          g.internalGameId === draft.internalGameId &&
          g.joinStatus === "AMBIGUOUS",
      );
      errors.push(
        ambiguous
          ? `AMBIGUOUS:${draft.internalGameId}`
          : `NOT_MATCHED:${draft.internalGameId}`,
      );
      continue;
    }

    const cutoff = cutoffFor({
      verifiedAt,
      firstPitchAt: sched.firstPitchAt,
    });
    if (cutoff.cutoffLabel === "LATE_OPERATOR_INPUT" && !input.allowLate) {
      errors.push(`LATE_OPERATOR_INPUT:${draft.internalGameId}`);
      continue;
    }

    const awayParse = parseDecimalOdds(draft.awayOdds);
    const homeParse = parseDecimalOdds(draft.homeOdds);
    if (!awayParse.ok) {
      errors.push(`${awayParse.error}:AWAY:${draft.internalGameId}`);
      continue;
    }
    if (!homeParse.ok) {
      errors.push(`${homeParse.error}:HOME:${draft.internalGameId}`);
      continue;
    }

    const awayOdds = awayParse.value!;
    const homeOdds = homeParse.value!;
    const implied = normalizeImpliedPair(awayOdds, homeOdds);

    const game: NpbMarketOddsGameV0 = {
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayTeamCanonicalId: sched.awayTeamCanonicalId,
      homeTeamCanonicalId: sched.homeTeamCanonicalId,
      awayOdds,
      homeOdds,
      awayImpliedProbability: implied.away,
      homeImpliedProbability: implied.home,
      verifiedAt,
      firstPitchAt: sched.firstPitchAt,
      isBeforeFirstPitch: cutoff.isBeforeFirstPitch,
      cutoffLabel: cutoff.cutoffLabel,
      joinStatus: "MATCHED",
      uiStatus: "MISSING",
    };
    game.uiStatus = uiStatusFor(game);
    games.push(game);
  }

  if (
    errors.some(
      (e) =>
        e.startsWith("NOT_MATCHED") ||
        e.startsWith("AMBIGUOUS") ||
        e.startsWith("LATE_OPERATOR_INPUT") ||
        e.includes("ODDS_"),
    )
  ) {
    return { ok: false, pathRel, document: null, errors };
  }
  if (errors.length > 0 && games.length === 0) {
    return { ok: false, pathRel, document: null, errors };
  }

  const savedIds = new Set(games.map((g) => g.internalGameId));
  for (const sched of matchedById.values()) {
    if (savedIds.has(sched.internalGameId)) continue;
    games.push({
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayTeamCanonicalId: sched.awayTeamCanonicalId,
      homeTeamCanonicalId: sched.homeTeamCanonicalId,
      awayOdds: null,
      homeOdds: null,
      awayImpliedProbability: null,
      homeImpliedProbability: null,
      verifiedAt: null,
      firstPitchAt: sched.firstPitchAt,
      isBeforeFirstPitch: null,
      cutoffLabel: null,
      joinStatus: "MATCHED",
      uiStatus: "MISSING",
    });
  }

  games.sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  const document: NpbMarketOddsConfirmationV0 = {
    schemaVersion: NPB_MARKET_ODDS_CONFIRMATION_SCHEMA,
    dateKst,
    league: "NPB",
    market: "MONEYLINE",
    sourceType: "MANUAL_VERIFIED",
    sourceLabel: input.sourceLabel ?? "수동 확인 · MANUAL VERIFIED",
    verifiedAt,
    enteredBy: "OPERATOR",
    games,
    summary: summarize(games),
  };

  const abs = npbMarketOddsConfirmationAbs(dateKst, cwd);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return { ok: true, pathRel, document, errors };
}

export async function loadNpbMarketOddsIntakeView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  scheduleExists: boolean;
  schedulePath: string | null;
  confirmationPath: string;
  sourceBanner: string;
  games: NpbMarketOddsGameV0[];
  summary: NpbMarketOddsConfirmationV0["summary"] | null;
  existing: NpbMarketOddsConfirmationV0 | null;
}> {
  const schedule = await loadNpbScheduleGames(input);
  const existing = await loadNpbMarketOddsConfirmation(input);
  const byId = new Map(
    (existing?.games ?? []).map((g) => [g.internalGameId, g] as const),
  );

  const games =
    schedule.games.length > 0
      ? schedule.games
          .filter((g) => g.joinStatus === "MATCHED")
          .map((g) => {
            const prev = byId.get(g.internalGameId);
            if (prev) return prev;
            return {
              internalGameId: g.internalGameId,
              awayTeam: g.awayTeam,
              homeTeam: g.homeTeam,
              awayTeamCanonicalId: g.awayTeamCanonicalId,
              homeTeamCanonicalId: g.homeTeamCanonicalId,
              awayOdds: null,
              homeOdds: null,
              awayImpliedProbability: null,
              homeImpliedProbability: null,
              verifiedAt: null,
              firstPitchAt: g.firstPitchAt,
              isBeforeFirstPitch: null,
              cutoffLabel: null,
              joinStatus: "MATCHED" as const,
              uiStatus: "MISSING" as const,
            };
          })
      : existing?.games ?? [];

  return {
    dateKst: input.dateKst,
    scheduleExists: schedule.exists,
    schedulePath: schedule.exists ? schedule.pathRel : null,
    confirmationPath: npbMarketOddsConfirmationRel(input.dateKst),
    sourceBanner: "수동 확인 · MANUAL VERIFIED",
    games,
    summary: existing?.summary ?? null,
    existing,
  };
}
