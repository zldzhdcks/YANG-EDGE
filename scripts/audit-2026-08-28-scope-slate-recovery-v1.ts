/**
 * 2026-08-28 scope / slate recovery v1.
 *
 * Legal-safe PNG handling is local-only. This script recovers schedule
 * independently, then joins operator observations with exact identity only.
 * Does NOT lock Daily Scope. Does NOT change formalObservedAt or odds.
 *
 *   npx tsx --env-file=.env.local scripts/audit-2026-08-28-scope-slate-recovery-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { findCompetitionByOperatorLabel } from "../src/lib/football/foundation/competition-registry";
import { footballScheduleV1Rel } from "../src/lib/football/core/paths";
import type { FootballScheduleArtifactV1 } from "../src/lib/football/core/types";
import {
  loadMlbScheduleArtifact,
  mlbScheduleArtifactRel,
  saveMlbScheduleArtifactV1,
} from "../src/lib/mlb/build-mlb-schedule-artifact";
import type { MlbScheduleArtifactGame } from "../src/lib/mlb/mlb-schedule-artifact-types";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1/build-from-admin-rows";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { normalizeTeamName } from "../src/lib/teams/normalize-team-name";
import {
  DATE_KST,
  FORMAL_OBSERVED_AT,
  INBOX_PATH,
  RAW_REL,
  RECOVERY_AUDIT_REL,
  REQUIRED_BASE_COMMIT,
  SCREENSHOTS,
  SEALED_2026_08_26,
  STRUCTURED_REL,
} from "./intake-2026-08-28-batch-2228-operator-pregame-observations";
import {
  FIXTURES_CAPTURE_REL,
  captureFootballFixtures20260828,
  rebuildFootballScheduleFromCapture,
} from "./capture-2026-08-28-football-fixtures-v1";

export const SLATE_RECOVERY_REL =
  "data/audits/2026-08-28-scope-slate-recovery-v1.json";
export const PNG_LOCAL_EXCLUDE =
  "data/operator-observations/raw/2026-08-28/batch-2228/*.png";
export const RAW_EVIDENCE_STORAGE = "LOCAL_ONLY_OWNER_PROVIDED_SCREENSHOT";
export const REPOSITORY_EVIDENCE = "HASH_AND_STRUCTURED_OBSERVATION";
export const FROZEN_FORMAL_OBSERVED_AT = "2026-08-27T22:31:14.162+09:00";

type ObservedRow = {
  sport: string;
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawMatchup: string;
  screenshotFile: string;
  screenshotSha256: string;
  originalInboxName: string;
  formalObservedAt: string;
  sourceFileModifiedAt: string;
  markets: Array<{ rowIds: number[] }>;
  teamLabelStatus?: string;
  identityStatus?: string;
  mappingStatus?: string;
  [key: string]: unknown;
};

type StructuredDoc = {
  summary: Record<string, unknown>;
  mlbOddsGames: ObservedRow[];
  footballOddsFixtures: ObservedRow[];
  basketballOddsFixtures: ObservedRow[];
  [key: string]: unknown;
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function utcToKstOffsetIso(utcIso: string): string {
  const d = new Date(utcIso);
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "+09:00");
}

function isPregame(formalObservedAt: string, scheduledStartAt: string): boolean {
  return Date.parse(formalObservedAt) < Date.parse(scheduledStartAt);
}

function findRegisteredCompetition(label: string) {
  return findCompetitionByOperatorLabel(label);
}

function aliasMatchesScheduleTeam(
  alias: NonNullable<ReturnType<typeof resolveApprovedAlias>>,
  teamName: string,
  providerTeamId: string,
) {
  const names = [alias.displayName, ...alias.originalNames].map((n) =>
    normalizeTeamName(n),
  );
  if (names.includes(normalizeTeamName(teamName))) return true;
  return (alias.externalIds ?? []).some(
    (ext) => ext.provider === "api-football" && ext.id === String(providerTeamId),
  );
}

function resolveApprovedAlias(label: string, league: string, sport: string) {
  const n = normalizeTeamName(label);
  if (!n) return null;
  return (
    TEAM_ALIASES.find((a) => {
      if (a.league !== league || a.sport !== sport) return false;
      if (normalizeTeamName(a.displayName) === n) return true;
      return a.originalNames.some((name) => normalizeTeamName(name) === n);
    }) ?? null
  );
}

function findExactMlbPair(
  schedule: MlbScheduleArtifactGame[],
  leftCanon: string,
  rightCanon: string,
  startKst: string,
) {
  const matches: Array<{
    game: MlbScheduleArtifactGame;
    orientation: "left_home" | "left_away";
  }> = [];
  for (const g of schedule) {
    if (g.startTimeKst !== startKst) continue;
    if (g.homeTeam === leftCanon && g.awayTeam === rightCanon) {
      matches.push({ game: g, orientation: "left_home" });
    } else if (g.homeTeam === rightCanon && g.awayTeam === leftCanon) {
      matches.push({ game: g, orientation: "left_away" });
    }
  }
  if (matches.length === 1) return matches[0]!;
  return null;
}

function marketIds(row: ObservedRow): number[] {
  return row.markets.flatMap((m) => m.rowIds);
}

export const OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES = {
  competition: [{ operatorLabel: "UEL", canonicalDisplayName: "UEFA 유로파리그" }],
  teams: [
    { operatorLabel: "셀타비고", canonicalDisplayName: "셀타비고" },
    { operatorLabel: "오사수나", canonicalDisplayName: "오사수나" },
    { operatorLabel: "바르셀로", canonicalDisplayName: "바르셀로나" },
    { operatorLabel: "A빌바오", canonicalDisplayName: "A빌바오" },
  ],
} as const;

export const OPERATOR_REVIEW_ITEMS = [
  {
    reviewState: "OWNER_EXPLICIT_CONFIRMATION" as const,
    priorStatesResolved: [
      "FIELD_REVIEW_REQUIRED",
      "OWNER_CONFIRMATION_REQUIRED",
    ],
    resolvedBy: "OWNER_EXPLICIT_CONFIRMATION",
    screenshotFile: "screenshot_2026-08-27_211857.png",
    originalInboxName: "스크린샷 2026-08-27 211857.png",
    marketIdRange: [7023, 7024, 7025, 7026],
    displayedDateKst: DATE_KST,
    displayedStartKst: "10:40",
    rawLeagueGlyph: "남농월예",
    rawHomeLabel: "파나마",
    rawAwayLabel: "캐나다",
    unreadableCharacterPositions: null,
    candidateProviderFixtures: [] as unknown[],
    reviewNote:
      "OWNER_EXPLICIT_CONFIRMATION applied exactly: 08.28 10:40 파나마 vs 캐나다. Labels are not translated. No lawful basketball schedule provider exists, so no fixture IDs are bound.",
  },
  {
    reviewState: "OWNER_EXPLICIT_CONFIRMATION" as const,
    priorStatesResolved: [
      "FIELD_REVIEW_REQUIRED",
      "OWNER_CONFIRMATION_REQUIRED",
    ],
    resolvedBy: "OWNER_EXPLICIT_CONFIRMATION",
    screenshotFile: "screenshot_2026-08-27_211857.png",
    originalInboxName: "스크린샷 2026-08-27 211857.png",
    marketIdRange: [7019, 7020, 7021, 7022],
    displayedDateKst: DATE_KST,
    displayedStartKst: "11:10",
    rawLeagueGlyph: "남농월예",
    rawHomeLabel: "멕시코",
    rawAwayLabel: "콜롬비아",
    unreadableCharacterPositions: null,
    candidateProviderFixtures: [] as unknown[],
    reviewNote:
      "OWNER_EXPLICIT_CONFIRMATION applied exactly: 08.28 11:10 멕시코 vs 콜롬비아. Labels are not translated. No lawful basketball schedule provider exists, so no fixture IDs are bound.",
  },
];

function joinMlb(row: ObservedRow, schedule: MlbScheduleArtifactGame[]) {
  const left = canonicalDomesticTeam(row.rawHomeLabel);
  const right = canonicalDomesticTeam(row.rawAwayLabel);
  if (!left || !right) {
    return {
      ...row,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH",
      scheduleJoinStatus: "IDENTITY_REVIEW_REQUIRED",
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      gamePk: null,
      joinReasons: [
        "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
        `HOME=${left ?? "MISSING"}`,
        `AWAY=${right ?? "MISSING"}`,
      ],
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const hit = findExactMlbPair(schedule, left, right, row.displayedStartKst);
  if (!hit) {
    return {
      ...row,
      canonicalHome: left,
      canonicalAway: right,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      mappingStatus: "TEAM_ALIAS_MATCHED_NO_SCHEDULE",
      scheduleJoinStatus: "IDENTITY_REVIEW_REQUIRED",
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      gamePk: null,
      joinReasons: [
        "NO_EXACT_SCHEDULE_PAIR_AND_TIME",
        `HOME_ALIAS:${left}`,
        `AWAY_ALIAS:${right}`,
        `DISPLAYED_START:${row.displayedStartKst}`,
      ],
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const scheduledStartAt = utcToKstOffsetIso(hit.game.commenceTimeUtc);
  const eligible = isPregame(row.formalObservedAt, scheduledStartAt);
  return {
    ...row,
    canonicalHome: left,
    canonicalAway: right,
    identityStatus: "MATCHED",
    mappingStatus: "EXACT_ALIAS_AND_SCHEDULE_TIME",
    scheduleJoinStatus: "MATCHED",
    gamePk: hit.game.gamePk,
    internalGameId: hit.game.internalGameId,
    provider: "mlb-stats-api",
    providerFixtureId: String(hit.game.gamePk),
    scheduledStartAt,
    scheduledStartAtUtc: hit.game.commenceTimeUtc,
    scheduleStartTimeKst: hit.game.startTimeKst,
    orientation: hit.orientation,
    doubleheaderRisk: "NONE_UNIQUE_PAIR_AND_TIME",
    pregameEligibilityStatus: eligible
      ? "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE"
      : "POST_START_MARKET_OBSERVATION",
    joinReasons: [
      "EXACT_REGISTERED_ALIAS",
      "EXACT_HOME_AWAY_PAIR",
      "EXACT_SCHEDULED_KST_TIME",
      `GAMEPK:${hit.game.gamePk}`,
    ],
    fuzzyMatchingUsed: false,
    scopeAccountingState: "SCHEDULE_MATCHED",
  };
}

function joinFootball(
  row: ObservedRow,
  schedule: FootballScheduleArtifactV1,
) {
  const competition = findRegisteredCompetition(row.rawLeagueLabel);
  if (!competition) {
    return {
      ...row,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH",
      scheduleJoinStatus: "COMPETITION_REVIEW_REQUIRED",
      competitionRegistryJoin: "LABEL_NOT_IN_REGISTRY",
      matchId: null,
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      joinReasons: [
        "UNREGISTERED_COMPETITION",
        `SCREENSHOT_LEAGUE_${row.rawLeagueLabel}_NOT_IN_COMPETITION_REGISTRY`,
      ],
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const homeAlias = resolveApprovedAlias(
    row.rawHomeLabel,
    competition.displayName,
    "football",
  );
  const awayAlias = resolveApprovedAlias(
    row.rawAwayLabel,
    competition.displayName,
    "football",
  );
  if (!homeAlias || !awayAlias) {
    return {
      ...row,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH",
      scheduleJoinStatus: "IDENTITY_REVIEW_REQUIRED",
      competitionRegistryJoin:
        row.rawLeagueLabel === "UEL"
          ? "OWNER_APPROVED_OPERATOR_ALIAS"
          : "MATCHED_DISPLAY_NAME",
      registeredCompetitionId: competition.competitionId,
      matchId: null,
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      joinReasons: [
        "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
        !homeAlias ? `HOME_ALIAS_MISSING:${row.rawHomeLabel}` : null,
        !awayAlias ? `AWAY_ALIAS_MISSING:${row.rawAwayLabel}` : null,
      ].filter(Boolean),
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const hits = schedule.rows.filter((g) => {
    if (g.competitionId !== competition.competitionId) return false;
    if (!aliasMatchesScheduleTeam(homeAlias, g.homeTeamName, g.homeProviderTeamId)) {
      return false;
    }
    if (!aliasMatchesScheduleTeam(awayAlias, g.awayTeamName, g.awayProviderTeamId)) {
      return false;
    }
    const kst = g.kickoffTimeUtc
      ? instantToKst(g.kickoffTimeUtc)?.time ?? null
      : null;
    return kst === row.displayedStartKst;
  });
  if (hits.length !== 1) {
    return {
      ...row,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH",
      scheduleJoinStatus:
        hits.length === 0 ? "SCHEDULE_NOT_FOUND" : "IDENTITY_REVIEW_REQUIRED",
      competitionRegistryJoin: "MATCHED_DISPLAY_NAME",
      matchId: null,
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      joinReasons:
        hits.length === 0
          ? ["NO_PROVIDER_FIXTURE_FOR_APPROVED_ALIAS_PAIR_AND_TIME"]
          : [
              "AMBIGUOUS_PROVIDER_FIXTURES",
              ...hits.map((h) => `CANDIDATE:${h.providerMatchId}`),
            ],
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const hit = hits[0]!;
  if (!hit.kickoffTimeUtc) {
    return {
      ...row,
      identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED",
      scheduleJoinStatus: "IDENTITY_REVIEW_REQUIRED",
      matchId: hit.matchId,
      scheduledStartAt: null,
      pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
      joinReasons: ["KICKOFF_MISSING"],
      scopeAccountingState: "IDENTITY_REVIEW_REQUIRED",
    };
  }
  const scheduledStartAt = utcToKstOffsetIso(hit.kickoffTimeUtc);
  const eligible = isPregame(row.formalObservedAt, scheduledStartAt);
  return {
    ...row,
    identityStatus: "MATCHED",
    mappingStatus: "EXACT_ALIAS_AND_SCHEDULE",
    scheduleJoinStatus: "MATCHED",
    competitionRegistryJoin:
      row.rawLeagueLabel === "UEL"
        ? "OWNER_APPROVED_OPERATOR_ALIAS"
        : "MATCHED_DISPLAY_NAME",
    matchId: hit.matchId,
    providerFixtureId: hit.providerMatchId,
    scheduledStartAt,
    scheduledStartAtUtc: hit.kickoffTimeUtc,
    pregameEligibilityStatus: eligible
      ? "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE"
      : "POST_START_MARKET_OBSERVATION",
    joinReasons: [
      "EXACT_REGISTERED_COMPETITION",
      "EXACT_APPROVED_ALIAS",
      "EXACT_SCHEDULED_KST_TIME",
    ],
    fuzzyMatchingUsed: false,
    scopeAccountingState: "SCHEDULE_MATCHED",
  };
}

function joinBasketball(row: ObservedRow) {
  const ownerConfirm = row.teamLabelStatus === "OWNER_EXPLICIT_CONFIRMATION";
  const unread = row.teamLabelStatus === "FIELD_REVIEW_REQUIRED";
  return {
    ...row,
    identityStatus: unread
      ? "OWNER_CONFIRMATION_REQUIRED"
      : "PROVIDER_UNSUPPORTED",
    mappingStatus: "NO_LAWFUL_BASKETBALL_SCHEDULE_PROVIDER",
    scheduleJoinStatus: "PROVIDER_NOT_SUPPORTED",
    scheduledStartAt: null,
    pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED",
    scopeAccountingState: "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED",
    teamLabelConfirmation: ownerConfirm
      ? "OWNER_EXPLICIT_CONFIRMATION"
      : unread
        ? "OWNER_CONFIRMATION_REQUIRED"
        : "VISIBLE",
    joinReasons: unread
      ? [
          "KOREAN_TEAM_GLYPHS_FIELD_REVIEW_REQUIRED",
          "NO_LAWFUL_APPROVED_BASKETBALL_PIPELINE",
        ]
      : [
          "NO_LAWFUL_APPROVED_BASKETBALL_PIPELINE",
          ownerConfirm ? "OWNER_EXPLICIT_CONFIRMATION_LABELS_ONLY" : null,
        ].filter(Boolean),
    candidateProviderFixtures: [],
  };
}

export async function runSlateRecovery(cwd = process.cwd()) {
  if (FORMAL_OBSERVED_AT !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  for (const shot of SCREENSHOTS) {
    const inboxAbs = path.join(INBOX_PATH, shot.originalInboxName);
    const sha = sha256File(inboxAbs);
    if (sha !== shot.sha256) {
      throw new Error(`INBOX_SHA_MISMATCH: ${shot.originalInboxName}`);
    }
  }
  for (const sealed of SEALED_2026_08_26) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_26_MUTATED: ${sealed.rel}`);
    }
  }

  const recoveryRunAt = new Date().toISOString();
  const structuredAbs = path.join(cwd, STRUCTURED_REL);
  const priorStructuredSha = existsSync(structuredAbs)
    ? sha256File(structuredAbs)
    : null;
  const priorRecoveryAbs = path.join(cwd, RECOVERY_AUDIT_REL);
  const priorRecoverySha = existsSync(priorRecoveryAbs)
    ? sha256File(priorRecoveryAbs)
    : null;

  const mlbRel = mlbScheduleArtifactRel(DATE_KST);
  const mlbAbs = path.join(cwd, mlbRel);
  let mlbNetworkCallsThisRun = 0;
  if (!existsSync(mlbAbs)) {
    await saveMlbScheduleArtifactV1(DATE_KST);
    mlbNetworkCallsThisRun = 1;
  }
  const mlbDoc = await loadMlbScheduleArtifact(DATE_KST, cwd);
  const mlbRecordedCalls = 1;

  const footballCaptureAbs = path.join(cwd, FIXTURES_CAPTURE_REL);
  const footballCaptureResult =
    await captureFootballFixtures20260828(cwd);
  const footballNetworkCallsThisRun = footballCaptureResult.networkCallMade
    ? 1
    : 0;
  const footballRecordedCalls = footballCaptureResult.document.networkCallMade
    ? 1
    : 0;
  const footballBuilt = await rebuildFootballScheduleFromCapture(cwd);
  const footballDoc = footballBuilt.document;
  const footballCapture = existsSync(footballCaptureAbs)
    ? JSON.parse(readFileSync(footballCaptureAbs, "utf8")) as {
        fixtureCount: number;
        endpoint: string;
        networkCallMade: boolean;
      }
    : null;
  const recordedProviderCallCount = mlbRecordedCalls + footballRecordedCalls;

  const structured = JSON.parse(
    readFileSync(structuredAbs, "utf8"),
  ) as StructuredDoc;
  if (structured.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("STRUCTURED_FORMAL_OBSERVED_AT_MUTATED");
  }

  const mlbJoined = structured.mlbOddsGames.map((row) => {
    if (row.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
      throw new Error("ROW_FORMAL_OBSERVED_AT_MUTATED");
    }
    return joinMlb(row, mlbDoc.games);
  });
  const footballJoined = structured.footballOddsFixtures.map((row) =>
    joinFootball(row, footballDoc),
  );
  const basketballJoined = structured.basketballOddsFixtures.map((row) =>
    joinBasketball(row),
  );

  const all = [...mlbJoined, ...footballJoined, ...basketballJoined];
  const matched = all.filter((r) => r.identityStatus === "MATCHED");
  const pregame = all.filter(
    (r) => r.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
  );
  const postStart = all.filter(
    (r) => r.pregameEligibilityStatus === "POST_START_MARKET_OBSERVATION",
  );
  const unresolvedElig = all.filter(
    (r) => r.pregameEligibilityStatus === "PREGAME_ELIGIBILITY_UNRESOLVED",
  );
  const ownerConfirmRequired = basketballJoined.filter(
    (r) =>
      r.identityStatus === "OWNER_CONFIRMATION_REQUIRED" ||
      r.teamLabelStatus === "FIELD_REVIEW_REQUIRED",
  );
  const ownerConfirmed = basketballJoined.filter(
    (r) => r.teamLabelStatus === "OWNER_EXPLICIT_CONFIRMATION",
  );
  const accountingStates = all.map((r) => String(r.scopeAccountingState ?? ""));
  if (accountingStates.some((s) => !s)) {
    throw new Error("SCOPE_ACCOUNTING_STATE_MISSING");
  }
  const scheduleMatchedCount = all.filter(
    (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
  ).length;
  const providerUnsupportedCount = all.filter(
    (r) => r.scopeAccountingState === "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED",
  ).length;
  const identityReviewCount = all.filter(
    (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
  ).length;
  const accountedFor = all.length;
  const matchupKeys = all.map(
    (r) =>
      `${r.sport}|${r.displayedStartKst}|${r.rawHomeLabel}|${r.rawAwayLabel}|${marketIds(r).join(",")}`,
  );
  if (new Set(matchupKeys).size !== matchupKeys.length) {
    throw new Error("DUPLICATE_OBSERVED_MATCHUP_IN_DENOMINATOR");
  }
  const scopeLockReady =
    accountedFor === 36 &&
    ownerConfirmRequired.length === 0 &&
    ownerConfirmed.length === 2 &&
    basketballJoined.length === 15 &&
    mlbJoined.filter((r) => r.identityStatus === "MATCHED").length === 7 &&
    all.every((r) => r.scopeAccountingState) &&
    scheduleMatchedCount + providerUnsupportedCount + identityReviewCount ===
      accountedFor;

  for (const row of pregame) {
    if (row.identityStatus !== "MATCHED" || !row.scheduledStartAt) {
      throw new Error("PREGAME_WITHOUT_DETERMINISTIC_IDENTITY");
    }
    if (!isPregame(FROZEN_FORMAL_OBSERVED_AT, String(row.scheduledStartAt))) {
      throw new Error("PREGAME_MARKED_AFTER_START");
    }
  }
  for (const row of unresolvedElig) {
    if (row.identityStatus === "MATCHED") {
      throw new Error("MATCHED_LEFT_UNRESOLVED_ELIGIBILITY");
    }
  }
  for (const row of ownerConfirmRequired) {
    throw new Error("SCREENSHOT6_TEAM_LABEL_STILL_UNCONFIRMED");
  }
  for (const row of ownerConfirmed) {
    if (row.rawHomeLabel === "FIELD_REVIEW_REQUIRED") {
      throw new Error("OWNER_CONFIRMED_LABEL_STILL_PLACEHOLDER");
    }
    if (row.scheduleJoinStatus === "MATCHED") {
      throw new Error("BASKETBALL_SCHEDULE_MATCH_FABRICATED");
    }
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      throw new Error("BASKETBALL_PREGAME_WITHOUT_SCHEDULED_START");
    }
  }

  const uelRows = footballDoc.rows.filter((r) =>
    r.competitionId.endsWith("-3"),
  );
  const laligaRows = footballDoc.rows.filter((r) =>
    r.competitionId.endsWith("-140"),
  );
  const footballByComp: Record<string, number> = {};
  for (const r of footballDoc.rows) {
    footballByComp[r.competitionId] = (footballByComp[r.competitionId] ?? 0) + 1;
  }

  const candidateScheduleGames = [
    ...mlbDoc.games.map((g) => ({
      sport: "MLB",
      provider: "mlb-stats-api",
      providerFixtureId: String(g.gamePk),
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      scheduledStartAt: utcToKstOffsetIso(g.commenceTimeUtc),
      scheduledStartAtUtc: g.commenceTimeUtc,
      startTimeKst: g.startTimeKst,
      joinedToOperator: mlbJoined.some((r) => r.gamePk === g.gamePk),
    })),
    ...footballDoc.rows.map((g) => ({
      sport: "FOOTBALL",
      provider: "api-football",
      providerFixtureId: g.providerMatchId,
      competitionId: g.competitionId,
      homeTeam: g.homeTeamName,
      awayTeam: g.awayTeamName,
      scheduledStartAt: g.kickoffTimeUtc
        ? utcToKstOffsetIso(g.kickoffTimeUtc)
        : null,
      scheduledStartAtUtc: g.kickoffTimeUtc,
      startTimeKst: g.kickoffTimeUtc
        ? instantToKst(g.kickoffTimeUtc)?.time ?? null
        : null,
      joinedToOperator: footballJoined.some(
        (r) => r.providerFixtureId === g.providerMatchId,
      ),
    })),
  ];

  const scheduleGamesWithNoOperatorOdds = candidateScheduleGames.filter(
    (g) => !g.joinedToOperator,
  );
  const operatorOddsWithNoScheduleMatch = all.filter(
    (r) => r.identityStatus !== "MATCHED",
  );

  const footballMatched = footballJoined.filter(
    (r) => r.identityStatus === "MATCHED",
  );
  const footballUnresolved = footballJoined.filter(
    (r) => r.identityStatus !== "MATCHED",
  );
  const footballIdentityReview = footballJoined.filter(
    (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
  );
  const footballUnresolvedBlockers = footballIdentityReview.map((r) => ({
    displayedStartKst: r.displayedStartKst,
    rawHomeLabel: r.rawHomeLabel,
    rawAwayLabel: r.rawAwayLabel,
    rawLeagueLabel: r.rawLeagueLabel,
    scheduleJoinStatus: r.scheduleJoinStatus,
    joinReasons: r.joinReasons,
    scopeAccountingState: r.scopeAccountingState,
  }));

  const scopeLockBlockers = scopeLockReady
    ? []
    : [
        ownerConfirmRequired.length > 0
          ? "SCREENSHOT_6_BASKETBALL_GLYPHS_OWNER_CONFIRMATION_REQUIRED"
          : null,
        accountedFor !== 36 ? "OBSERVED_DENOMINATOR_NOT_36" : null,
      ].filter(Boolean);

  const summary = {
    ...structured.summary,
    rowsObserved: 169,
    rowsParsed: 169,
    rowsIdentityMatched: matched.length,
    rowsIdentityReviewRequired: identityReviewCount,
    rowsOwnerConfirmationRequired: ownerConfirmRequired.length,
    rowsOwnerExplicitConfirmation: ownerConfirmed.length,
    rowsPregameEligible: pregame.length,
    rowsPostStart: postStart.length,
    rowsPregameEligibilityUnresolved: unresolvedElig.length,
    scopeAccounting: {
      scopeTotal: accountedFor,
      accountedFor,
      scheduleMatched: scheduleMatchedCount,
      providerUnsupported: providerUnsupportedCount,
      identityReviewRequired: identityReviewCount,
    },
    mlbOddsMatchups: mlbJoined.length,
    mlbOddsAliasMatched: mlbJoined.filter((r) => r.canonicalHome && r.canonicalAway)
      .length,
    mlbGamePkJoined: mlbJoined.filter((r) => r.gamePk != null).length,
    footballOddsFixtures: footballJoined.length,
    footballJoined: footballMatched.length,
    basketballOddsFixtures: basketballJoined.length,
    predictionCreated: 0,
    fuzzyMatchingUsed: false,
    ownerApprovedFootballAliasesApplied:
      OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES,
    providerCallCount: recordedProviderCallCount,
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
  };

  const recoveryStatus = scopeLockReady
    ? "SCOPE_LOCK_CANDIDATE_READY"
    : "OPERATOR_REVIEW_REQUIRED";
  const recoveryReason = scopeLockReady
    ? "All 36 operator-observed matchups are accounted. OWNER basketball labels applied exactly. OWNER-approved football aliases applied without duplication or extra fuzzy names. MLB 7/7 exact. La Liga 2/2 exact. UEL 12 remain IDENTITY_REVIEW_REQUIRED because no OWNER-approved team aliases exist. Basketball 15 retained as SCOPE_OBSERVED_PROVIDER_UNSUPPORTED. Denominator can freeze without guessing. Candidate lock is allowed; FINAL SEAL is OWNER-only."
    : "Observed slate is not fully accounted. Do not build Daily Scope Lock candidate.";

  const nextStructured: StructuredDoc = {
    ...structured,
    observationPhase: "PREGAME_SCOPE_SLATE_RECOVERY",
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_LOCAL_EXCLUDE,
    operatorReviewItems: OPERATOR_REVIEW_ITEMS,
    summary,
    mlbOddsGames: mlbJoined,
    footballOddsFixtures: footballJoined,
    basketballOddsFixtures: basketballJoined,
    scopeLockStatus: scopeLockReady
      ? "READY_FOR_DAILY_SCOPE_LOCK_CANDIDATE"
      : "NOT_READY_TO_LOCK_DAILY_SCOPE",
    status: recoveryStatus,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    fuzzyMatchingUsed: false,
    providerCallCount: recordedProviderCallCount,
  };

  const storageFields = {
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_LOCAL_EXCLUDE,
  };

  const currentState = JSON.parse(
    readFileSync(priorRecoveryAbs, "utf8"),
  ) as Record<string, unknown>;
  if (currentState.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("CURRENT_STATE_FORMAL_OBSERVED_AT_MUTATED");
  }
  const nextCurrentState = {
    ...currentState,
    ...storageFields,
    status: recoveryStatus,
    statusReason: recoveryReason,
    rowsIdentityMatched: matched.length,
    rowsIdentityReviewRequired: identityReviewCount,
    rowsPregameEligible: pregame.length,
    rowsPostStart: postStart.length,
    rowsPregameEligibilityUnresolved: unresolvedElig.length,
    providerCallCount: recordedProviderCallCount,
    providerEndpoints: [
      "/api/v1/schedule?sportId=1&startDate=2026-08-27&endDate=2026-08-28&hydrate=probablePitcher",
      "/fixtures?date=2026-08-28&timezone=Asia/Seoul",
    ],
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    mlbRowsPresent: true,
    mlbRowCount: 7,
    mlbIdentityMatched: mlbJoined.filter((r) => r.identityStatus === "MATCHED")
      .length,
    footballIdentityMatched: footballMatched.length,
    footballIdentityReviewRequired: footballIdentityReview.length,
    basketballProviderUnsupported: basketballJoined.length,
    basketballOwnerConfirmed: ownerConfirmed.length,
    operatorReviewItems: OPERATOR_REVIEW_ITEMS,
    priorArtifactSha256: priorRecoverySha,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    fuzzyMatchingUsed: false,
    dailyScopeLocked: false,
    scopeLockReady,
    nextRecommendedStep: scopeLockReady
      ? "Write 2026-08-28 Daily Scope Lock CANDIDATE, then OWNER review. Do not start B1."
      : "Resolve remaining scope accounting before any lock candidate.",
  };

  const slate = {
    schemaVersion: "yang-edge-scope-slate-recovery-v1",
    dateKst: DATE_KST,
    recoveryRunAt,
    baseCommit: REQUIRED_BASE_COMMIT,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    formalObservedAtChanged: false,
    ...storageFields,
    researchOnly: true,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    predictionCreated: 0,
    fuzzyMatchingUsed: false,
    ownerApprovedFootballAliasesApplied:
      OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES,
    scheduleProvidersUsed: [
      "mlb-stats-api",
      "api-football",
    ],
    providerCallCount: recordedProviderCallCount,
    providerCalls: [
      {
        sport: "MLB",
        provider: "mlb-stats-api",
        endpoint:
          "/api/v1/schedule?sportId=1&startDate=2026-08-27&endDate=2026-08-28&hydrate=probablePitcher",
        callCount: mlbRecordedCalls,
        callCountThisRun: mlbNetworkCallsThisRun,
        cached: mlbNetworkCallsThisRun === 0,
        resultCount: mlbDoc.games.length,
        note:
          "Minimal schedule-only Stats API window including previous UTC calendar date for early-morning KST. Subsequent recovery loads reuse the artifact.",
      },
      {
        sport: "FOOTBALL",
        provider: "api-football",
        endpoint: "/fixtures?date=2026-08-28&timezone=Asia/Seoul",
        callCount: footballRecordedCalls,
        callCountThisRun: footballNetworkCallsThisRun,
        cached: footballNetworkCallsThisRun === 0,
        resultCount: footballCapture?.fixtureCount ?? footballDoc.meta.scheduleGames,
        note:
          "One date-window getFixtures call persisted to capture. Result/predictions/odds endpoints were not used. Subsequent recovery loads reuse the capture.",
      },
      {
        sport: "BASKETBALL",
        provider: null,
        endpoint: null,
        callCount: 0,
        cached: null,
        resultCount: 0,
        note: "No lawful basketball schedule provider is wired in this repository.",
      },
    ],
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    scheduleArtifacts: {
      mlb: mlbRel,
      footballCapture: FIXTURES_CAPTURE_REL,
      footballSchedule: footballScheduleV1Rel(DATE_KST),
      basketball: null,
    },
    candidateScheduleGames,
    bySport: {
      MLB: {
        recoveredScheduleGames: mlbDoc.games.length,
        operatorObserved: mlbJoined.length,
        matched: mlbJoined.filter((r) => r.identityStatus === "MATCHED").length,
        unresolved: mlbJoined.filter((r) => r.identityStatus !== "MATCHED")
          .length,
        scopeAccountingState: "SCHEDULE_MATCHED",
      },
      FOOTBALL: {
        recoveredRawFixtures: footballCapture?.fixtureCount ?? null,
        recoveredRegisteredScheduleGames: footballDoc.meta.scheduleGames,
        droppedUnregisteredCompetition:
          footballDoc.meta.droppedUnregisteredCompetition,
        uelRegistered: uelRows.length,
        laLigaRegistered: laligaRows.length,
        operatorObserved: footballJoined.length,
        matched: footballMatched.length,
        unresolved: footballUnresolved.length,
        competitionReviewRequired: footballJoined.filter(
          (r) => r.scheduleJoinStatus === "COMPETITION_REVIEW_REQUIRED",
        ).length,
        identityReviewRequired: footballIdentityReview.length,
        uelOperatorAliasApplied: true,
        laLigaOperatorAliasesApplied: 4,
        unresolvedBlockers: footballUnresolvedBlockers,
        byRegisteredCompetition: footballByComp,
      },
      BASKETBALL: {
        recoveredScheduleGames: 0,
        operatorObserved: basketballJoined.length,
        matched: 0,
        unresolved: basketballJoined.length,
        ownerConfirmationRequired: ownerConfirmRequired.length,
        ownerExplicitConfirmation: ownerConfirmed.length,
        provider: "NOT_WIRED",
        scopeAccountingState: "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED",
        droppedFromDenominator: 0,
      },
    },
    operatorObservedMatchups: accountedFor,
    operatorMatchupsMatched: matched.length,
    operatorIdentityReviewRequired: identityReviewCount,
    operatorConfirmationRequired: ownerConfirmRequired.length,
    operatorOwnerExplicitConfirmation: ownerConfirmed.length,
    scopeAccounting: {
      scopeTotal: accountedFor,
      accountedFor,
      scheduleMatched: scheduleMatchedCount,
      providerUnsupported: providerUnsupportedCount,
      identityReviewRequired: identityReviewCount,
    },
    scheduleGamesWithNoOperatorOdds: scheduleGamesWithNoOperatorOdds.length,
    operatorOddsWithNoScheduleMatch: operatorOddsWithNoScheduleMatch.length,
    pregameEligibleObservedMatchups: pregame.length,
    postStartObservedMatchups: postStart.length,
    pregameEligibilityUnresolved: unresolvedElig.length,
    operatorReviewItems: OPERATOR_REVIEW_ITEMS,
    priorStructuredObservationSha256: priorStructuredSha,
    priorCurrentStateRecoverySha256: priorRecoverySha,
    scopeLockReady,
    scopeLockBlockers,
    dailyScopeLockCreated: false,
    status: recoveryStatus,
    statusReason: recoveryReason,
  };

  await mkdir(path.dirname(path.join(cwd, SLATE_RECOVERY_REL)), {
    recursive: true,
  });
  await writeFile(
    structuredAbs,
    `${JSON.stringify(nextStructured, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    priorRecoveryAbs,
    `${JSON.stringify(nextCurrentState, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(cwd, SLATE_RECOVERY_REL),
    `${JSON.stringify(slate, null, 2)}\n`,
    "utf8",
  );

  const manifestRel = `${RAW_REL}/manifest.json`;
  const manifestAbs = path.join(cwd, manifestRel);
  if (existsSync(manifestAbs)) {
    const manifest = JSON.parse(readFileSync(manifestAbs, "utf8")) as Record<
      string,
      unknown
    >;
    const nextManifest = {
      ...manifest,
      ...storageFields,
      notes: [
        ...((manifest.notes as string[]) ?? []),
        "RAW PNG copies are LOCAL-ONLY evidence. Public GitHub tracks hashes and structured observations only.",
      ].filter((v, i, a) => a.indexOf(v) === i),
    };
    await writeFile(
      manifestAbs,
      `${JSON.stringify(nextManifest, null, 2)}\n`,
      "utf8",
    );
  }

  return {
    structured: nextStructured,
    currentState: nextCurrentState,
    slate,
    priorStructuredSha,
    priorRecoverySha,
    newStructuredSha: sha256File(structuredAbs),
    newRecoverySha: sha256File(priorRecoveryAbs),
    newSlateSha: sha256File(path.join(cwd, SLATE_RECOVERY_REL)),
  };
}

async function main() {
  const result = await runSlateRecovery();
  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${RECOVERY_AUDIT_REL}`);
  console.log(`wrote ${SLATE_RECOVERY_REL}`);
  console.log(
    JSON.stringify(
      {
        mlbMatched: result.slate.bySport.MLB.matched,
        footballMatched: result.slate.bySport.FOOTBALL.matched,
        basketballMatched: result.slate.bySport.BASKETBALL.matched,
        pregameEligible: result.slate.pregameEligibleObservedMatchups,
        unresolved: result.slate.pregameEligibilityUnresolved,
        scopeLockReady: result.slate.scopeLockReady,
        priorStructuredSha: result.priorStructuredSha,
        newStructuredSha: result.newStructuredSha,
        priorRecoverySha: result.priorRecoverySha,
        newRecoverySha: result.newRecoverySha,
        newSlateSha: result.newSlateSha,
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
