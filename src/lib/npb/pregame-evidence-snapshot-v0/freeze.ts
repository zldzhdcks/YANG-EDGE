/**
 * Freeze NPB pregame evidence — seal-once, no engine picks.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadNpbScheduleGames } from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import { asFiniteMs } from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import { loadNpbStarterConfirmation } from "@/lib/npb/manual-starter-intake-v0";
import { npbStarterConfirmationRel } from "@/lib/npb/manual-starter-intake-v0/paths";
import { loadNpbMarketOddsConfirmation } from "@/lib/npb/manual-market-odds-v0";
import { npbMarketOddsConfirmationRel } from "@/lib/npb/manual-market-odds-v0/paths";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import type {
  NpbEvidenceGameV0,
  NpbEvidenceSnapshotStatus,
  NpbPregameEvidenceFreezeResult,
  NpbPregameEvidenceSnapshotV0,
} from "./types";
import {
  NPB_PREDICTION_SNAPSHOT_SCHEMA,
  NPB_PREGAME_EVIDENCE_SNAPSHOT_KIND,
} from "./types";

export function npbPredictionSnapshotRel(dateKst: string): string {
  return `data/predictions/npb/${dateKst}.json`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function emptyStarterSide(): NpbEvidenceGameV0["starter"]["away"] {
  return {
    displayName: null,
    originalName: null,
    normalizedName: null,
    sourceType: null,
    verifiedAt: null,
    verificationStatus: null,
  };
}

export async function loadNpbPregameEvidenceSnapshot(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbPregameEvidenceSnapshotV0 | null> {
  const cwd = input.cwd ?? process.cwd();
  try {
    const raw = JSON.parse(
      await readFile(
        path.join(cwd, npbPredictionSnapshotRel(input.dateKst)),
        "utf8",
      ),
    ) as unknown;
    const doc = asRecord(raw);
    if (!doc) return null;
    if (asString(doc.schemaVersion) !== NPB_PREDICTION_SNAPSHOT_SCHEMA) {
      return null;
    }
    return raw as NpbPregameEvidenceSnapshotV0;
  } catch {
    return null;
  }
}

/**
 * Build + seal evidence snapshot. Never overwrites an existing file.
 * Never invents picks / model probability / lineup.
 */
export async function freezeNpbPregameEvidenceSnapshot(input: {
  dateKst: string;
  cwd?: string;
  /** Override clock for tests (ISO). Default now. */
  asOf?: string;
}): Promise<NpbPregameEvidenceFreezeResult> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const pathRel = npbPredictionSnapshotRel(dateKst);
  const abs = path.join(cwd, pathRel);

  const existing = await loadNpbPregameEvidenceSnapshot({ dateKst, cwd });
  if (existing) {
    return {
      wrote: false,
      pathRel,
      document: existing,
      errors: [],
      snapshotStatus: "ALREADY_FROZEN",
    };
  }

  const schedule = await loadNpbScheduleGames({ dateKst, cwd });
  const starterDoc = await loadNpbStarterConfirmation({ dateKst, cwd });
  const oddsDoc = await loadNpbMarketOddsConfirmation({ dateKst, cwd });

  // Schedule is required. Starter/Odds confirmation may be absent —
  // freeze with null/missing sides (do not invent values; do not block forever).
  if (!schedule.exists || schedule.games.length === 0) {
    return {
      wrote: false,
      pathRel,
      document: null,
      errors: ["SCHEDULE_MISSING"],
      snapshotStatus: "MISSING_INPUTS",
    };
  }

  const snapshotCreatedAt = input.asOf ?? new Date().toISOString();
  const runId = snapshotCreatedAt.replace(/[:.]/g, "-");
  const starterById = new Map(
    (starterDoc?.games ?? []).map((g) => [g.internalGameId, g] as const),
  );
  const oddsById = new Map(
    (oddsDoc?.games ?? []).map((g) => [g.internalGameId, g] as const),
  );

  const matched = schedule.games.filter((g) => g.joinStatus === "MATCHED");
  const games: NpbEvidenceGameV0[] = [];

  for (const sched of matched) {
    const st = starterById.get(sched.internalGameId);
    const od = oddsById.get(sched.internalGameId);
    const firstPitchAt = sched.firstPitchAt;
    const asOfMs = asFiniteMs(snapshotCreatedAt);
    const pitchMs = asFiniteMs(firstPitchAt);
    let generatedBeforeGame: boolean | null = null;
    if (asOfMs != null && pitchMs != null) {
      generatedBeforeGame = asOfMs < pitchMs;
    }

    const warnings = [
      "NPB_ENGINE_NOT_AVAILABLE",
      "LINEUP_NOT_RELEASED",
    ];
    const passReasons = [
      "NPB_ENGINE_NOT_AVAILABLE",
      "LINEUP_NOT_RELEASED",
      "PREGAME_EVIDENCE_ONLY",
    ];
    const blockReasons: string[] = [];

    let status: NpbEvidenceGameV0["status"] = "NO_ENGINE_AVAILABLE";
    let officialStatus: "PASS" | "BLOCKED" = "PASS";

    if (generatedBeforeGame === false) {
      status = "BLOCKED_AFTER_START";
      officialStatus = "BLOCKED";
      blockReasons.push("BLOCKED_AFTER_START");
      warnings.push("BLOCKED_AFTER_START");
    }

    const awayStarter = st?.awayStarter
      ? {
          displayName: st.awayStarter.displayName,
          originalName: st.awayStarter.originalName,
          normalizedName: st.awayStarter.normalizedName,
          sourceType: "MANUAL_VERIFIED" as const,
          verifiedAt: st.verifiedAt,
          verificationStatus: "CONFIRMED" as const,
        }
      : emptyStarterSide();
    const homeStarter = st?.homeStarter
      ? {
          displayName: st.homeStarter.displayName,
          originalName: st.homeStarter.originalName,
          normalizedName: st.homeStarter.normalizedName,
          sourceType: "MANUAL_VERIFIED" as const,
          verifiedAt: st.verifiedAt,
          verificationStatus: "CONFIRMED" as const,
        }
      : emptyStarterSide();

    games.push({
      gameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      firstPitchAt,
      matchup: `${sched.awayTeam} @ ${sched.homeTeam}`,
      starter: {
        away: awayStarter,
        home: homeStarter,
        sourceType:
          awayStarter.sourceType && homeStarter.sourceType
            ? "MANUAL_VERIFIED"
            : null,
        verifiedAt: st?.verifiedAt ?? null,
      },
      market: {
        awayOdds: od?.awayOdds ?? null,
        homeOdds: od?.homeOdds ?? null,
        sourceType:
          od?.awayOdds != null && od?.homeOdds != null
            ? "MANUAL_VERIFIED"
            : null,
        verifiedAt: od?.verifiedAt ?? null,
        awayImpliedProbability: od?.awayImpliedProbability ?? null,
        homeImpliedProbability: od?.homeImpliedProbability ?? null,
      },
      lineup: { status: "NOT_RELEASED" },
      prediction: {
        officialPick: null,
        researchPick: null,
        modelProbability: null,
        confidence: null,
      },
      status,
      officialStatus,
      officialPick: null,
      researchPick: null,
      modelProbability: null,
      confidence: null,
      marketProbability: null,
      warnings,
      passReasons,
      blockReasons,
      generatedBeforeGame,
      snapshotCreatedAt,
    });
  }

  games.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const beforeCount = games.filter((g) => g.generatedBeforeGame === true).length;
  const blockedCount = games.filter(
    (g) => g.status === "BLOCKED_AFTER_START",
  ).length;

  // All games after start → refuse write (사후 Snapshot 금지)
  if (games.length > 0 && blockedCount === games.length) {
    return {
      wrote: false,
      pathRel,
      document: null,
      errors: ["BLOCKED_AFTER_START_ALL_GAMES"],
      snapshotStatus: "BLOCKED_AFTER_START",
    };
  }

  let snapshotStatus: NpbEvidenceSnapshotStatus =
    "PRE_GAME_SNAPSHOT_VERIFIED";
  if (blockedCount > 0) {
    snapshotStatus = "PARTIAL_BLOCKED_AFTER_START";
  }
  if (beforeCount === games.length && blockedCount === 0) {
    snapshotStatus = "PRE_GAME_SNAPSHOT_VERIFIED";
  }

  const starterConfirmed = games.filter(
    (g) =>
      g.starter.away.originalName &&
      g.starter.home.originalName &&
      g.starter.sourceType === "MANUAL_VERIFIED",
  ).length;
  const marketVerified = games.filter(
    (g) =>
      g.market.awayOdds != null &&
      g.market.homeOdds != null &&
      g.market.sourceType === "MANUAL_VERIFIED",
  ).length;

  const bodyWithoutHash = {
    schemaVersion: NPB_PREDICTION_SNAPSHOT_SCHEMA,
    snapshotKind: NPB_PREGAME_EVIDENCE_SNAPSHOT_KIND,
    sport: "baseball" as const,
    league: "NPB" as const,
    date: dateKst,
    dateKst,
    runId,
    snapshotCreatedAt,
    predictedAt: snapshotCreatedAt,
    enginePolicy: "NO_ENGINE_AVAILABLE" as const,
    evidenceNote:
      "PREGAME EVIDENCE SNAPSHOT — not a model prediction. No official/research picks. Market odds are MANUAL_VERIFIED inputs, not Model Probability.",
    snapshotStatus,
    generatedBeforeGameCount: beforeCount,
    blockedAfterStartCount: blockedCount,
    summary: {
      total: games.length,
      scheduleReady: games.length,
      starterConfirmed,
      marketVerified,
      lineupReleased: 0,
      PASS: games.filter((g) => g.officialStatus === "PASS").length,
      NO_ENGINE_AVAILABLE: games.filter(
        (g) => g.status === "NO_ENGINE_AVAILABLE",
      ).length,
      BLOCKED: blockedCount,
    },
    games,
    inputs: {
      schedulePath: `data/research/npb/${dateKst}-schedule-v1.json`,
      starterPath: npbStarterConfirmationRel(dateKst),
      marketOddsPath: npbMarketOddsConfirmationRel(dateKst),
    },
  };

  const predictionHashSha256 = sha256(
    JSON.stringify({
      dateKst,
      snapshotKind: NPB_PREGAME_EVIDENCE_SNAPSHOT_KIND,
      snapshotCreatedAt,
      games: games.map((g) => ({
        gameId: g.gameId,
        firstPitchAt: g.firstPitchAt,
        starter: g.starter,
        market: {
          awayOdds: g.market.awayOdds,
          homeOdds: g.market.homeOdds,
          sourceType: g.market.sourceType,
          verifiedAt: g.market.verifiedAt,
        },
        lineup: g.lineup,
        status: g.status,
        generatedBeforeGame: g.generatedBeforeGame,
      })),
    }),
  );

  const document: NpbPregameEvidenceSnapshotV0 = {
    ...bodyWithoutHash,
    predictionHashSha256,
  };

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return {
    wrote: true,
    pathRel,
    document,
    errors: [],
    snapshotStatus,
  };
}

export async function loadNpbPregameEvidenceView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  frozen: boolean;
  snapshotStatus: string;
  hashShort: string | null;
  snapshotCreatedAt: string | null;
  beforeFirstPitch: string;
  lines: string[];
  nextAction: string;
}> {
  const doc = await loadNpbPregameEvidenceSnapshot(input);
  if (!doc) {
    return {
      dateKst: input.dateKst,
      frozen: false,
      snapshotStatus: "NOT_FROZEN",
      hashShort: null,
      snapshotCreatedAt: null,
      beforeFirstPitch: "—",
      lines: [
        "Schedule —",
        "Starter —",
        "Market —",
        "⚠ Lineup Not Released",
        "⚪ Prediction Engine Not Available",
        "Snapshot: NOT FROZEN",
      ],
      nextAction: "FREEZE_PREGAME_EVIDENCE",
    };
  }

  const s = doc.summary;
  const before = `${doc.generatedBeforeGameCount}/${s.total}`;
  const starterSlots = s.starterConfirmed * 2;
  const starterTotal = s.total * 2;
  return {
    dateKst: input.dateKst,
    frozen: true,
    snapshotStatus: doc.snapshotStatus,
    hashShort: doc.predictionHashSha256
      ? `${doc.predictionHashSha256.slice(0, 8)}…`
      : null,
    snapshotCreatedAt: doc.snapshotCreatedAt,
    beforeFirstPitch: before,
    lines: [
      `✓ Schedule ${s.scheduleReady}/${s.total}`,
      `✓ Starter ${starterSlots}/${starterTotal}`,
      `✓ Market ${s.marketVerified}/${s.total}`,
      "⚠ Lineup Not Released",
      "⚪ Prediction Engine Not Available",
      "Snapshot: FROZEN BEFORE GAME",
    ],
    nextAction: "WAIT_FOR_LINEUP",
  };
}
