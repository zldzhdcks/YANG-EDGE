/**
 * 2026-08-29 B1 schedule / identity reconciliation — OWNER-reviewed seal.
 *
 * Consumer-only. Reads sealed Daily Scope Lock + stored schedule artifacts.
 * No new aliases. No fuzzy matching. No Result / Prediction / Engine.
 *
 *   npx tsx scripts/audit-2026-08-29-schedule-identity-reconciliation-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  SOURCE_OBS_REL,
  sha256File,
} from "./lock-2026-08-29-daily-scope-v1";

export const B1_REL =
  "data/audits/2026-08-29-schedule-identity-reconciliation-v1.json";
export const SEALED_B1_HASH =
  "c6baf2466302b2f57d3864fb1c048944cbc74611bbc5a4016d01e3648a7aaf1f";
export const SEALED_LOCK_HASH =
  "c6a898ad16dbde921bc5ace9c086d5e3ccd9c5907d00c2d420ed088638e64e53";
export const FROZEN_DECISION_AT = "2026-08-28T13:32:03.190Z";

export type B1Status =
  | "MATCHED"
  | "IDENTITY_REVIEW_REQUIRED"
  | "COMPETITION_REVIEW_REQUIRED"
  | "PROVIDER_NOT_SUPPORTED";

type ObservedRow = {
  sport: string;
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawMatchup: string;
  scopeMembership?: string;
  scopeAccountingState?: string;
  identityStatus?: string;
  scheduleJoinStatus?: string;
  mappingStatus?: string;
  canonicalHome?: string | null;
  canonicalAway?: string | null;
  gamePk?: number | null;
  internalGameId?: string | null;
  providerFixtureId?: string | number | null;
  matchId?: string | null;
  scheduledStartAt?: string | null;
  scheduledStartAtUtc?: string | null;
  pregameEligibilityStatus?: string;
  joinReasons?: string[];
  markets: Array<{ rowIds: number[] }>;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function marketIds(row: ObservedRow): number[] {
  return row.markets.flatMap((m) => m.rowIds);
}

function operatorGameId(row: ObservedRow): string {
  return [
    row.sport,
    row.displayedDateKst,
    row.displayedStartKst,
    row.rawHomeLabel,
    row.rawAwayLabel,
  ].join("|");
}

function b1StatusFromOfficialRow(row: ObservedRow): {
  status: B1Status;
  reasons: string[];
} {
  if (row.sport === "MLB") {
    if (
      row.identityStatus === "MATCHED" &&
      row.scopeAccountingState === "SCHEDULE_MATCHED" &&
      row.gamePk != null
    ) {
      return {
        status: "MATCHED",
        reasons: row.joinReasons ?? [
          "EXACT_REGISTERED_ALIAS",
          "EXACT_HOME_AWAY_PAIR",
          "EXACT_SCHEDULED_KST_TIME",
        ],
      };
    }
    return {
      status: "IDENTITY_REVIEW_REQUIRED",
      reasons: row.joinReasons ?? ["MLB_SCHEDULE_NOT_EXACT"],
    };
  }
  if (row.sport === "FOOTBALL") {
    if (row.scopeAccountingState === "COMPETITION_REVIEW_REQUIRED") {
      return {
        status: "COMPETITION_REVIEW_REQUIRED",
        reasons: row.joinReasons ?? ["UNREGISTERED_COMPETITION"],
      };
    }
    if (row.scopeAccountingState === "SCHEDULE_MATCHED") {
      return {
        status: "MATCHED",
        reasons: row.joinReasons ?? ["EXACT_APPROVED_ALIAS"],
      };
    }
    return {
      status: "IDENTITY_REVIEW_REQUIRED",
      reasons: row.joinReasons ?? ["OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS"],
    };
  }
  if (row.sport === "BASKETBALL") {
    return {
      status: "PROVIDER_NOT_SUPPORTED",
      reasons: row.joinReasons ?? ["NO_LAWFUL_APPROVED_BASKETBALL_PIPELINE"],
    };
  }
  throw new Error(`UNEXPECTED_SPORT:${row.sport}`);
}

export async function runB1(cwd = process.cwd()) {
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    lockStatus: string;
    scopeLockStatus: string;
    dateKst: string;
    scopeTotal: number;
    officialDenominator: number;
    accountedFor: number;
    sourceOperatorObservationHash: string;
    formalObservedAt: string;
    excludedCrossDateRows?: Array<Record<string, unknown>>;
    resultCalls?: number;
    predictionCalls?: number;
  };
  if (lock.lockStatus !== "LOCKED" || lock.scopeLockStatus !== "COMPLETE") {
    throw new Error("SCOPE_NOT_SEALED");
  }
  if (lock.dateKst !== DATE_KST) throw new Error("LOCK_DATE_MISMATCH");
  if (lock.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  if (sha256File(obsAbs) !== lock.sourceOperatorObservationHash) {
    throw new Error("STRUCTURED_OBSERVATION_HASH_MISMATCH");
  }
  if (lock.scopeTotal !== lock.officialDenominator || lock.scopeTotal !== lock.accountedFor) {
    throw new Error("SEALED_SCOPE_ACCOUNTING_INCONSISTENT");
  }

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    mlbOddsGames: ObservedRow[];
    footballOddsFixtures: ObservedRow[];
    basketballOddsFixtures: ObservedRow[];
  };
  const all = [
    ...obs.mlbOddsGames,
    ...obs.footballOddsFixtures,
    ...obs.basketballOddsFixtures,
  ];
  const official = all.filter((r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE");
  const excluded = all.filter((r) => r.scopeMembership === "EXCLUDED_NON_TARGET_DATE");
  if (official.length !== lock.scopeTotal) {
    throw new Error(`B1_OFFICIAL_COUNT_MISMATCH:${official.length}!=${lock.scopeTotal}`);
  }
  if (official.length + excluded.length !== all.length) {
    throw new Error("SCOPE_MEMBERSHIP_GAP");
  }

  const games = official.map((row) => {
    const mapped = b1StatusFromOfficialRow(row);
    return {
      operatorGameId: operatorGameId(row),
      sport: row.sport,
      league: row.rawLeagueLabel,
      displayedDateKst: row.displayedDateKst,
      displayedStartKst: row.displayedStartKst,
      rawHome: row.rawHomeLabel,
      rawAway: row.rawAwayLabel,
      rawMatchup: row.rawMatchup,
      marketIds: marketIds(row),
      scopeMembership: row.scopeMembership,
      status: mapped.status,
      reasons: mapped.reasons,
      canonicalHome: row.canonicalHome ?? null,
      canonicalAway: row.canonicalAway ?? null,
      provider: row.sport === "MLB" ? "mlb-stats-api" : row.sport === "FOOTBALL" ? "api-football" : null,
      providerFixtureId:
        row.providerFixtureId ??
        (row.gamePk != null ? String(row.gamePk) : row.matchId ?? null),
      gamePk: row.gamePk ?? null,
      internalGameId: row.internalGameId ?? null,
      scheduledStartAt: row.scheduledStartAt ?? null,
      scheduledStartAtUtc: row.scheduledStartAtUtc ?? null,
      pregameEligibilityStatus: row.pregameEligibilityStatus ?? null,
      fuzzyMatchingUsed: false,
      newAliasInvented: false,
    };
  });

  const statuses = games.map((g) => g.status);
  if (statuses.some((s) => !s)) throw new Error("B1_STATUS_MISSING");
  if (games.length !== official.length) throw new Error("B1_GAME_COUNT_MISMATCH");

  const count = (s: B1Status) => games.filter((g) => g.status === s).length;
  const totals = {
    officialScopeTotal: official.length,
    MATCHED: count("MATCHED"),
    IDENTITY_REVIEW_REQUIRED: count("IDENTITY_REVIEW_REQUIRED"),
    COMPETITION_REVIEW_REQUIRED: count("COMPETITION_REVIEW_REQUIRED"),
    PROVIDER_NOT_SUPPORTED: count("PROVIDER_NOT_SUPPORTED"),
  };
  if (
    totals.MATCHED +
      totals.IDENTITY_REVIEW_REQUIRED +
      totals.COMPETITION_REVIEW_REQUIRED +
      totals.PROVIDER_NOT_SUPPORTED !==
    totals.officialScopeTotal
  ) {
    throw new Error("B1_ACCOUNTING_INCOMPLETE");
  }

  const bySport = {
    MLB: {
      official: games.filter((g) => g.sport === "MLB").length,
      MATCHED: games.filter((g) => g.sport === "MLB" && g.status === "MATCHED").length,
      IDENTITY_REVIEW_REQUIRED: games.filter(
        (g) => g.sport === "MLB" && g.status === "IDENTITY_REVIEW_REQUIRED",
      ).length,
    },
    FOOTBALL: {
      official: games.filter((g) => g.sport === "FOOTBALL").length,
      MATCHED: games.filter((g) => g.sport === "FOOTBALL" && g.status === "MATCHED").length,
      IDENTITY_REVIEW_REQUIRED: games.filter(
        (g) => g.sport === "FOOTBALL" && g.status === "IDENTITY_REVIEW_REQUIRED",
      ).length,
      COMPETITION_REVIEW_REQUIRED: games.filter(
        (g) => g.sport === "FOOTBALL" && g.status === "COMPETITION_REVIEW_REQUIRED",
      ).length,
    },
    BASKETBALL: {
      official: games.filter((g) => g.sport === "BASKETBALL").length,
      PROVIDER_NOT_SUPPORTED: games.filter(
        (g) => g.sport === "BASKETBALL" && g.status === "PROVIDER_NOT_SUPPORTED",
      ).length,
      dropped: 0,
    },
  };

  const document = {
    schemaVersion: "yang-edge-schedule-identity-reconciliation-v1",
    dateKst: DATE_KST,
    stage: "B1",
    candidateStatus: "OWNER_REVIEW_CANDIDATE",
    sealedLockRel: LOCK_REL,
    sealedLockSha256: sha256File(lockAbs),
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    sourceOperatorObservationHash: lock.sourceOperatorObservationHash,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    researchOnly: true,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    fuzzyMatchingUsed: false,
    newAliasesInvented: 0,
    resultCalls: 0,
    predictionCalls: 0,
    engineModified: false,
    weightsModified: false,
    totals,
    bySport,
    excludedCrossDateCount: excluded.length,
    excludedCrossDateRows: excluded.map((r) => ({
      displayedDateKst: r.displayedDateKst,
      displayedStartKst: r.displayedStartKst,
      rawMatchup: r.rawMatchup,
      marketIds: marketIds(r),
      scopeMembership: r.scopeMembership,
      b1Official: false,
      note: "Preserved operator evidence. Not a 2026-08-29 official Scope game. Not assigned a B1 official state.",
    })),
    games,
    note: "B1 candidate. Exact alias / competition / home-away / kickoff / provider ID only. No fuzzy matching. No Result. Do not commit until OWNER review.",
  };

  const abs = path.join(cwd, B1_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  return { document, rel: B1_REL, sha256: sha256Text(body) };
}

async function main() {
  const result = await runB1();
  console.log(`wrote ${result.rel}`);
  console.log(
    JSON.stringify(
      {
        ...result.document.totals,
        sha256: result.sha256,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
