/**
 * 2026-08-30 B1 schedule / football identity reconciliation — FINAL SEAL.
 *
 * OWNER result: APPROVED_WITH_UNRESOLVED_IDENTITIES.
 * The 13 unresolved football rows remain IDENTITY_REVIEW_REQUIRED.
 *
 * Consumer-only. Reads sealed Daily Scope Lock + stored pregame artifacts.
 * Does NOT modify Team Alias Registry, Competition Registry, Stage A
 * artifacts, or sealed 2026-08-29 artifacts.
 * No fuzzy matching. No Result / Prediction / Engine.
 *
 *   npx tsx scripts/audit-2026-08-30-schedule-identity-reconciliation-v1.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { findCompetitionByOperatorLabel } from "../src/lib/football/foundation/competition-registry";
import type { FootballCompetition } from "../src/lib/football/foundation/types";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { normalizeTeamName } from "../src/lib/teams/normalize-team-name";
import type { TeamAliasEntry } from "../src/lib/teams/types";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  SOURCE_OBS_REL,
  sha256File,
} from "./lock-2026-08-30-daily-scope-v1";
import {
  SEALED_2026_08_29,
} from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import { FIXTURES_CAPTURE_REL } from "./capture-2026-08-30-football-fixtures-v1";

export const B1_REL =
  "data/audits/2026-08-30-schedule-identity-reconciliation-v1.json";
export const B1_BASE_COMMIT =
  "39636b2caf61da6316b3eb5827feb735962bd254";
export const B1_STATUS = "COMPLETE_WITH_IDENTITY_REVIEW_REMAINING";
export const B1_OWNER_REVIEW_STATUS = "APPROVED";
export const B1_OWNER_REVIEW_RESULT = "APPROVED_WITH_UNRESOLVED_IDENTITIES";
export const FROZEN_GENERATED_AT = "2026-08-29T13:00:36.324Z";
export const FROZEN_OWNER_SEALED_AT = "2026-08-29T13:05:00.000Z";
export const CANDIDATE_B1_SHA256 =
  "b70ddd62c3c39faddaff8ce29e3f5f9987af41d3e3b3153a655cb949bcfc50b9";
export const SEALED_B1_SHA256 =
  "98c25b0cf626285c21ba6601f7fcd3479c086f9b166404c43d866678a4b514eb";
export const NEXT_RECOMMENDED_STEP =
  "B2 pregame input coverage on matched 2026-08-30 identities.";
export const REQUIRED_UNRESOLVED = [
  ["세리에A", "01:30", "피오렌티", "프로시노"],
  ["세리에A", "01:30", "AC몬차", "우디네세"],
  ["세리에A", "01:30", "사수올로", "토리노"],
  ["프리그1", "03:45", "AJ오세르", "앙제SCO"],
  ["프리그1", "03:45", "브레스트", "툴루즈"],
  ["프리그1", "03:45", "로리앙", "트루아AC"],
  ["프리그1", "03:45", "리옹", "르아브르"],
  ["MLS", "08:30", "애틀유나", "샬럿FC"],
  ["MLS", "08:30", "인터마이", "CF몽레알"],
  ["MLS", "09:30", "휴스다이", "새너어스"],
  ["MLS", "09:30", "미네유나", "올랜시티"],
  ["MLS", "09:30", "내슈빌SC", "FC신시내"],
  ["MLS", "11:30", "샌디에FC", "LA갤럭시"],
] as const;
export const TEAM_ALIAS_REGISTRY_REL = "src/lib/teams/team-aliases.ts";
export const COMPETITION_REGISTRY_REL =
  "src/lib/football/foundation/competition-registry.ts";

export const SEALED_STAGE_A = [
  {
    rel: LOCK_REL,
    sha256:
      "71fe9d14a1b7a16d6e09e591a74013752617de59255eac2b2bb7bb3fde80d539",
  },
  {
    rel: SOURCE_OBS_REL,
    sha256:
      "2f4a67e94d75d59b280b429da0ae5c79db393dc374216220e8b32d1a012db46d",
  },
  {
    rel: "data/audits/2026-08-30-scope-slate-recovery-v1.json",
    sha256:
      "a62a117d034bb49aaeabe84cb43c9564b143e261e5dd0e27a9c8610fc274eb1f",
  },
  {
    rel: "data/audits/2026-08-30-pregame-current-state-recovery-v1.json",
    sha256:
      "d56036fbafe8c6e58d24464cd2e47845bbf7140fab1ef8c39963b73168fa87a0",
  },
  {
    rel: "data/research/mlb/2026-08-30-schedule-v1.json",
    sha256:
      "a1cd72867724603c39aa0ef8e91a31ecb7e4ba089d34e26e6508e8c0c5932e2d",
  },
  {
    rel: FIXTURES_CAPTURE_REL,
    sha256:
      "6c11136f36c62b36639132678c18082a4d8abb227101243db3f0811bd4e2351e",
  },
  {
    rel: "data/research/football/2026-08-30-schedule-v1.json",
    sha256:
      "c93ca29c4eff8d12b5dab7c7061ca207e01a9b01b4d9af7bda21960c6903e7dc",
  },
] as const;

export const SEALED_REGISTRY = [
  {
    rel: TEAM_ALIAS_REGISTRY_REL,
    sha256:
      "1f0882e8e9ae93110c0b48104ad68d9129aa04fb2e60d8903020b2c83e15e8e9",
  },
  {
    rel: COMPETITION_REGISTRY_REL,
    sha256:
      "c5afd5048bf34c1da61a172238701f0360f50f12e2342dd60210b805519b4174",
  },
] as const;

export type FootballIdentityStatus =
  | "MATCHED_SEALED_ALIAS"
  | "MATCHED_UNIQUE_COMPETITION_KICKOFF_SLOT"
  | "MATCHED_PREVIOUS_DETERMINISTIC_EVIDENCE"
  | "IDENTITY_REVIEW_REQUIRED"
  | "COMPETITION_REVIEW_REQUIRED";

export type FootballIdentityMethod =
  | "SEALED_ALIAS_EXACT"
  | "UNIQUE_COMPETITION_KICKOFF_SLOT"
  | "PREVIOUS_DETERMINISTIC_PROVIDER_ID_EVIDENCE"
  | null;

type ObservedRow = {
  sport: string;
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawMatchup?: string;
  scopeMembership?: string;
  scopeAccountingState?: string;
  identityStatus?: string;
  gamePk?: number | null;
  providerFixtureId?: string | number | null;
  scheduledStartAt?: string | null;
  markets: Array<{ rowIds: number[] }>;
};

type CaptureFixture = {
  fixture: { id: number; date: string; timezone?: string };
  league: { id: number; name: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

function assertUnchanged(
  cwd: string,
  items: ReadonlyArray<{ rel: string; sha256: string }>,
  label: string,
) {
  for (const sealed of items) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) {
      throw new Error(`${label}_MUTATED: ${sealed.rel}`);
    }
  }
}

function kstPartsFromFixtureDate(
  date: string,
): { date: string; time: string } | null {
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) &&
    (date.includes("+09:00") || date.includes("Asia/Seoul"))
  ) {
    return {
      date: date.slice(0, 10),
      time: date.slice(11, 16),
    };
  }
  return instantToKst(date);
}

function resolveApprovedAlias(
  label: string,
  league: string,
): TeamAliasEntry | null {
  const n = normalizeTeamName(label);
  if (!n) return null;
  return (
    TEAM_ALIASES.find((a) => {
      if (a.league !== league || a.sport !== "football") return false;
      if (normalizeTeamName(a.displayName) === n) return true;
      return a.originalNames.some((name) => normalizeTeamName(name) === n);
    }) ?? null
  );
}

function providerTeamIdFromAlias(alias: TeamAliasEntry | null): string | null {
  if (!alias) return null;
  return alias.externalIds?.find((e) => e.provider === "api-football")?.id ?? null;
}

function fixturesAtCompetitionKickoff(
  fixtures: CaptureFixture[],
  competition: FootballCompetition,
  dateKst: string,
  kickoffKst: string,
): CaptureFixture[] {
  return fixtures.filter((f) => {
    if (String(f.league.id) !== String(competition.providerCompetitionId)) {
      return false;
    }
    const parts = kstPartsFromFixtureDate(f.fixture.date);
    return parts?.date === dateKst && parts.time === kickoffKst;
  });
}

function attach(
  row: ObservedRow,
  competition: FootballCompetition,
  hit: CaptureFixture,
  candidateCount: number,
  method: Exclude<FootballIdentityMethod, null>,
  status: FootballIdentityStatus,
  reason: string,
) {
  const parts = kstPartsFromFixtureDate(hit.fixture.date);
  return {
    rawLeagueLabel: row.rawLeagueLabel,
    canonicalCompetition: competition.displayName,
    providerCompetitionId: competition.providerCompetitionId,
    displayedDateKst: row.displayedDateKst,
    displayedKickoffKst: row.displayedStartKst,
    rawHome: row.rawHomeLabel,
    rawAway: row.rawAwayLabel,
    providerFixtureId: String(hit.fixture.id),
    providerKickoffKst: parts?.time ?? null,
    providerHomeTeamId: String(hit.teams.home.id),
    providerHomeTeamName: hit.teams.home.name,
    providerAwayTeamId: String(hit.teams.away.id),
    providerAwayTeamName: hit.teams.away.name,
    identityMethod: method,
    candidateCountWithinCompetitionKickoff: candidateCount,
    identityStatus: status,
    identityReason: reason,
    pregameEvidenceOnly: true,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
    marketDataUsedForIdentity: false,
  };
}

function unresolved(
  row: ObservedRow,
  competition: FootballCompetition | null,
  candidateCount: number,
  reason: string,
  status: FootballIdentityStatus = "IDENTITY_REVIEW_REQUIRED",
) {
  return {
    rawLeagueLabel: row.rawLeagueLabel,
    canonicalCompetition: competition?.displayName ?? null,
    providerCompetitionId: competition?.providerCompetitionId ?? null,
    displayedDateKst: row.displayedDateKst,
    displayedKickoffKst: row.displayedStartKst,
    rawHome: row.rawHomeLabel,
    rawAway: row.rawAwayLabel,
    providerFixtureId: null,
    providerKickoffKst: null,
    providerHomeTeamId: null,
    providerHomeTeamName: null,
    providerAwayTeamId: null,
    providerAwayTeamName: null,
    identityMethod: null,
    candidateCountWithinCompetitionKickoff: candidateCount,
    identityStatus: status,
    identityReason: reason,
    pregameEvidenceOnly: true,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
    marketDataUsedForIdentity: false,
  };
}

function operatorKey(row: ObservedRow): string {
  return [
    row.sport,
    row.displayedDateKst,
    row.displayedStartKst,
    row.rawHomeLabel,
    row.rawAwayLabel,
  ].join("|");
}

export async function runB1(cwd = process.cwd()) {
  assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A");
  assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29");
  assertUnchanged(cwd, SEALED_REGISTRY, "SEALED_FOOTBALL_REGISTRY");

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
    observedScope: { FOOTBALL: number; MLB: number };
    identityReviewCount: number;
    supportedScheduleMatchedCount: number;
    bySportReconciliation: {
      FOOTBALL: { scheduleMatched: number; identityReviewRequired: number };
      MLB: { scheduleMatched: number };
    };
    predictionCreated?: number;
    predictionCalls?: number;
    resultCalls?: number;
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
  if (lock.scopeTotal !== 44 || lock.officialDenominator !== 44) {
    throw new Error("SEALED_SCOPE_DENOMINATOR_CHANGED");
  }

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    mlbOddsGames: ObservedRow[];
    footballOddsFixtures: ObservedRow[];
    basketballOddsFixtures: ObservedRow[];
    predictionCreated?: number;
    predictionInput?: boolean;
    engineInput?: boolean;
  };
  const officialMlb = obs.mlbOddsGames.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const officialFootball = obs.footballOddsFixtures.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const excludedFootball = obs.footballOddsFixtures.filter(
    (r) => r.scopeMembership === "EXCLUDED_NON_TARGET_DATE",
  );
  if (officialMlb.length !== 15) throw new Error("MLB_OFFICIAL_COUNT_MISMATCH");
  if (officialFootball.length !== 29) {
    throw new Error("FOOTBALL_OFFICIAL_COUNT_MISMATCH");
  }
  if (obs.basketballOddsFixtures.length !== 0) {
    throw new Error("UNEXPECTED_BASKETBALL_ROWS");
  }
  if (officialMlb.some((r) => r.scopeAccountingState !== "SCHEDULE_MATCHED")) {
    throw new Error("MLB_STAGE_A_MATCH_DEFECT");
  }
  const footballMatchedBefore = officialFootball.filter(
    (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
  ).length;
  if (footballMatchedBefore !== 2) {
    throw new Error("FOOTBALL_STAGE_A_MATCHED_CHANGED");
  }
  if (excludedFootball.length !== 20) {
    throw new Error("CROSS_DATE_EXCLUSION_CHANGED");
  }
  if (excludedFootball.some((r) => r.displayedDateKst === DATE_KST)) {
    throw new Error("CROSS_DATE_ROW_HAS_TARGET_DATE");
  }

  const capture = JSON.parse(
    readFileSync(path.join(cwd, FIXTURES_CAPTURE_REL), "utf8"),
  ) as { fixtures: CaptureFixture[]; researchOnly?: boolean };
  if (!Array.isArray(capture.fixtures) || capture.fixtures.length < 1) {
    throw new Error("FOOTBALL_CAPTURE_EMPTY");
  }

  const footballOperatorSlotCount = new Map<string, number>();
  for (const row of officialFootball) {
    const competition = findCompetitionByOperatorLabel(row.rawLeagueLabel);
    const slotKey = `${competition?.providerCompetitionId ?? "NONE"}|${row.displayedStartKst}`;
    footballOperatorSlotCount.set(
      slotKey,
      (footballOperatorSlotCount.get(slotKey) ?? 0) + 1,
    );
  }

  const claimedFixtures = new Map<string, string>();
  const rows = officialFootball.map((row) => {
    if (row.displayedDateKst !== DATE_KST) {
      return unresolved(
        row,
        null,
        0,
        "OFFICIAL_ROW_NOT_TARGET_DATE",
      );
    }
    const competition = findCompetitionByOperatorLabel(row.rawLeagueLabel);
    if (!competition) {
      return unresolved(
        row,
        null,
        0,
        "UNREGISTERED_COMPETITION",
        "COMPETITION_REVIEW_REQUIRED",
      );
    }
    const candidates = fixturesAtCompetitionKickoff(
      capture.fixtures,
      competition,
      DATE_KST,
      row.displayedStartKst,
    );
    const candidateCount = candidates.length;
    const homeAlias = resolveApprovedAlias(
      row.rawHomeLabel,
      competition.displayName,
    );
    const awayAlias = resolveApprovedAlias(
      row.rawAwayLabel,
      competition.displayName,
    );
    const homeId = providerTeamIdFromAlias(homeAlias);
    const awayId = providerTeamIdFromAlias(awayAlias);

    if (homeId && awayId) {
      const aliasHits = candidates.filter(
        (f) =>
          String(f.teams.home.id) === homeId &&
          String(f.teams.away.id) === awayId,
      );
      if (aliasHits.length === 1) {
        return attach(
          row,
          competition,
          aliasHits[0]!,
          candidateCount,
          "SEALED_ALIAS_EXACT",
          "MATCHED_SEALED_ALIAS",
          "BOTH_OPERATOR_LABELS_RESOLVE_TO_EXACT_PROVIDER_TEAM_IDS_IN_CANONICAL_COMPETITION",
        );
      }
    }

    const operatorSlotKey = `${competition.providerCompetitionId}|${row.displayedStartKst}`;
    const operatorSlotCount = footballOperatorSlotCount.get(operatorSlotKey) ?? 0;
    if (
      candidateCount === 1 &&
      operatorSlotCount === 1 &&
      row.displayedDateKst === DATE_KST
    ) {
      return attach(
        row,
        competition,
        candidates[0]!,
        candidateCount,
        "UNIQUE_COMPETITION_KICKOFF_SLOT",
        "MATCHED_UNIQUE_COMPETITION_KICKOFF_SLOT",
        `UNIQUE_PROVIDER_FIXTURE_IN_COMPETITION_${competition.providerCompetitionId}_AT_${row.displayedStartKst}`,
      );
    }

    if (homeId || awayId) {
      const priorHits = candidates.filter((f) => {
        if (homeId && String(f.teams.home.id) !== homeId) return false;
        if (awayId && String(f.teams.away.id) !== awayId) return false;
        return true;
      });
      if (priorHits.length === 1) {
        const which = [
          homeId ? `HOME_ID:${homeId}` : null,
          awayId ? `AWAY_ID:${awayId}` : null,
        ]
          .filter(Boolean)
          .join("+");
        return attach(
          row,
          competition,
          priorHits[0]!,
          candidateCount,
          "PREVIOUS_DETERMINISTIC_PROVIDER_ID_EVIDENCE",
          "MATCHED_PREVIOUS_DETERMINISTIC_EVIDENCE",
          `SEALED_ALIAS_PROVIDER_ID_UNIQUELY_SELECTS_FIXTURE_IN_COMPETITION_KICKOFF_SET:${which}`,
        );
      }
    }

    const reasonParts = [
      candidateCount === 0
        ? "NO_PROVIDER_FIXTURE_IN_CANONICAL_COMPETITION_AT_KICKOFF"
        : `AMBIGUOUS_COMPETITION_KICKOFF_SLOT:CANDIDATES=${candidateCount}`,
      !homeAlias ? `HOME_ALIAS_MISSING:${row.rawHomeLabel}` : null,
      !awayAlias ? `AWAY_ALIAS_MISSING:${row.rawAwayLabel}` : null,
      "NO_FUZZY_NAME_AUTO_APPROVAL",
    ].filter(Boolean);
    return unresolved(row, competition, candidateCount, reasonParts.join("|"));
  });

  for (const row of rows) {
    if (!row.providerFixtureId) continue;
    if (
      row.identityStatus === "IDENTITY_REVIEW_REQUIRED" ||
      row.identityStatus === "COMPETITION_REVIEW_REQUIRED"
    ) {
      continue;
    }
    const prior = claimedFixtures.get(row.providerFixtureId);
    const key = `${row.rawHome}|${row.rawAway}|${row.displayedKickoffKst}`;
    if (prior && prior !== key) {
      throw new Error(
        `DUPLICATE_FIXTURE_CLAIM:${row.providerFixtureId}:${prior}:${key}`,
      );
    }
    claimedFixtures.set(row.providerFixtureId, key);
  }

  const footballKeys = officialFootball.map(operatorKey);
  if (new Set(footballKeys).size !== footballKeys.length) {
    throw new Error("DUPLICATE_FOOTBALL_OPERATOR_ROW");
  }
  if (rows.length !== 29) throw new Error("FOOTBALL_B1_ROW_COUNT");

  const footballMatchedAfter = rows.filter((r) =>
    r.identityStatus.startsWith("MATCHED_"),
  ).length;
  const footballIdentityReviewRemaining = rows.filter(
    (r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED",
  ).length;
  const competitionReviewRequired = rows.filter(
    (r) => r.identityStatus === "COMPETITION_REVIEW_REQUIRED",
  ).length;
  const methodBreakdown = {
    sealedAlias: rows.filter((r) => r.identityMethod === "SEALED_ALIAS_EXACT")
      .length,
    uniqueCompetitionKickoffSlot: rows.filter(
      (r) => r.identityMethod === "UNIQUE_COMPETITION_KICKOFF_SLOT",
    ).length,
    previousDeterministicEvidence: rows.filter(
      (r) => r.identityMethod === "PREVIOUS_DETERMINISTIC_PROVIDER_ID_EVIDENCE",
    ).length,
  };
  if (footballMatchedAfter + footballIdentityReviewRemaining !== 29) {
    throw new Error("FOOTBALL_ACCOUNTING_GAP");
  }
  if (competitionReviewRequired !== 0) {
    throw new Error("UNEXPECTED_COMPETITION_REVIEW");
  }
  if (15 + footballMatchedAfter + footballIdentityReviewRemaining !== 44) {
    throw new Error("SCOPE_ACCOUNTING_GAP");
  }
  if (footballMatchedAfter !== 16) {
    throw new Error("FOOTBALL_MATCHED_AFTER_NOT_16");
  }
  if (footballIdentityReviewRemaining !== 13) {
    throw new Error("FOOTBALL_UNRESOLVED_NOT_13");
  }
  if (methodBreakdown.sealedAlias !== 2) {
    throw new Error("SEALED_ALIAS_COUNT");
  }
  if (methodBreakdown.uniqueCompetitionKickoffSlot !== 10) {
    throw new Error("UNIQUE_KICKOFF_COUNT");
  }
  if (methodBreakdown.previousDeterministicEvidence !== 4) {
    throw new Error("PREVIOUS_EVIDENCE_COUNT");
  }
  const unresolvedKeys = rows
    .filter((r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED")
    .map(
      (r) =>
        `${r.rawLeagueLabel}|${r.displayedKickoffKst}|${r.rawHome}|${r.rawAway}`,
    )
    .sort();
  const requiredUnresolvedKeys = REQUIRED_UNRESOLVED.map((r) => r.join("|")).slice().sort();
  if (JSON.stringify(unresolvedKeys) !== JSON.stringify(requiredUnresolvedKeys)) {
    throw new Error("UNRESOLVED_SET_CHANGED");
  }
  const espanyol = rows.find((r) => r.rawAway === "에스피뇰");
  if (!espanyol || espanyol.rawAway !== "에스피뇰") {
    throw new Error("ESPANYOL_RAW_LABEL_MUTATED");
  }

  const futureAliasCandidates: Array<{
    rawLabel: string;
    side: "home" | "away";
    providerTeamName: string;
    providerTeamId: string;
    competition: string;
    providerCompetitionId: string;
    fixtureId: string;
    evidenceMethod: Exclude<FootballIdentityMethod, null>;
    alreadyGloballyRegistered: false;
  }> = [];
  const seenCandidate = new Set<string>();
  for (const row of rows) {
    if (!row.identityMethod || !row.providerFixtureId || !row.canonicalCompetition) {
      continue;
    }
    const competition = findCompetitionByOperatorLabel(row.rawLeagueLabel);
    if (!competition) continue;
    const sides: Array<{
      raw: string;
      side: "home" | "away";
      name: string;
      id: string;
    }> = [
      {
        raw: row.rawHome,
        side: "home",
        name: row.providerHomeTeamName!,
        id: row.providerHomeTeamId!,
      },
      {
        raw: row.rawAway,
        side: "away",
        name: row.providerAwayTeamName!,
        id: row.providerAwayTeamId!,
      },
    ];
    for (const side of sides) {
      if (resolveApprovedAlias(side.raw, competition.displayName)) continue;
      const key = `${side.raw}|${competition.displayName}|${side.id}`;
      if (seenCandidate.has(key)) continue;
      seenCandidate.add(key);
      futureAliasCandidates.push({
        rawLabel: side.raw,
        side: side.side,
        providerTeamName: side.name,
        providerTeamId: side.id,
        competition: competition.displayName,
        providerCompetitionId: competition.providerCompetitionId,
        fixtureId: row.providerFixtureId,
        evidenceMethod: row.identityMethod,
        alreadyGloballyRegistered: false,
      });
    }
  }

  const mlbPreserved = officialMlb.map((row) => ({
    sport: "MLB" as const,
    rawLeagueLabel: row.rawLeagueLabel,
    displayedDateKst: row.displayedDateKst,
    displayedKickoffKst: row.displayedStartKst,
    rawHome: row.rawHomeLabel,
    rawAway: row.rawAwayLabel,
    providerFixtureId: row.providerFixtureId ?? String(row.gamePk ?? ""),
    gamePk: row.gamePk ?? null,
    identityStatus: "MATCHED" as const,
    identityMethod: "PRESERVED_STAGE_A_SCHEDULE_MATCHED" as const,
    identityReason: "STAGE_A_MLB_EXACT_ALIAS_AND_SCHEDULE_TIME_NOT_REOPENED",
    pregameEvidenceOnly: true,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
  }));

  const document = {
    schemaVersion: "yang-edge-schedule-identity-reconciliation-v1",
    dateKst: DATE_KST,
    stage: "B1",
    status: B1_STATUS,
    candidateStatus: B1_STATUS,
    ownerReviewStatus: B1_OWNER_REVIEW_STATUS,
    ownerReviewResult: B1_OWNER_REVIEW_RESULT,
    generatedAt: FROZEN_GENERATED_AT,
    ownerSealedAt: FROZEN_OWNER_SEALED_AT,
    candidateSha256: CANDIDATE_B1_SHA256,
    baseCommit: B1_BASE_COMMIT,
    sourceScopeLock: LOCK_REL,
    sourceScopeLockSha256: sha256File(lockAbs),
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    formalObservedAtChanged: false,
    researchOnly: true,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
    marketDataUsedForIdentity: false,
    newAliasesInvented: 0,
    globalTeamAliasRegistryModified: false,
    competitionRegistryModified: false,
    predictionCreated: 0,
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    engineModified: false,
    weightsModified: false,
    summary: {
      officialScopeTotal: 44,
      accountedFor: 44,
      MLB: 15,
      mlbMatched: 15,
      Football: 29,
      footballMatchedBefore: 2,
      footballMatchedAfter,
      footballMatched: footballMatchedAfter,
      footballNewlyResolved: footballMatchedAfter - footballMatchedBefore,
      footballIdentityReviewRemaining,
      competitionReviewRequired,
      providerUnsupported: 0,
      methodBreakdown,
    },
    rows,
    mlbPreserved,
    futureAliasCandidates,
    unresolvedFootball: rows
      .filter((r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED")
      .map((r) => ({
        rawLeagueLabel: r.rawLeagueLabel,
        displayedKickoffKst: r.displayedKickoffKst,
        rawHome: r.rawHome,
        rawAway: r.rawAway,
        candidateCountWithinCompetitionKickoff:
          r.candidateCountWithinCompetitionKickoff,
        identityReason: r.identityReason,
      })),
    excludedCrossDateCount: 20,
    excludedCrossDateNote:
      "Twenty 08.29 leftover football matchups remain in structured operator observations with scopeMembership=EXCLUDED_NON_TARGET_DATE. Not B1 official rows. Sealed 2026-08-29 was not reopened.",
    historicalFirewall: {
      stageAArtifactsUnchanged: true,
      sealed20260829Unchanged: true,
      stageA: SEALED_STAGE_A,
      sealed20260829: SEALED_2026_08_29,
      registriesUnchanged: SEALED_REGISTRY,
    },
    nextRecommendedStep: NEXT_RECOMMENDED_STEP,
  };

  const abs = path.join(cwd, B1_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  const text = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, text, "utf8");
  assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A_AFTER_WRITE");
  assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29_AFTER_WRITE");
  assertUnchanged(cwd, SEALED_REGISTRY, "SEALED_FOOTBALL_REGISTRY_AFTER_WRITE");

  return {
    document,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
  };
}

async function main() {
  const result = await runB1();
  console.log(`wrote ${B1_REL}`);
  console.log(
    JSON.stringify(
      {
        sha256: result.sha256,
        footballMatchedAfter: result.document.summary.footballMatchedAfter,
        footballNewlyResolved: result.document.summary.footballNewlyResolved,
        footballIdentityReviewRemaining:
          result.document.summary.footballIdentityReviewRemaining,
        futureAliasCandidates: result.document.futureAliasCandidates.length,
        methodBreakdown: result.document.summary.methodBreakdown,
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
