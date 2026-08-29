/**
 * One-shot 2026-08-30/batch-2118 operator screenshot intake.
 *
 *   npx tsx scripts/intake-2026-08-30-batch-2118-operator-pregame-observations.ts
 *
 * Stage A observation writer. Does NOT lock Daily Scope.
 * Does NOT write Prediction / operator-input / Result / Grade.
 * Does NOT call providers. Does NOT fuzzy-match identity.
 * formalObservedAt is the frozen intake clock, never file mtime.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1/build-from-admin-rows";

export const BATCH_ID = "2026-08-30/batch-2118";
export const DATE_KST = "2026-08-30";
export const RECEIVED_DATE_KST = "2026-08-30";
export const SLATE_DATE_KST = "2026-08-30";
export const INTAKE_STARTED_AT = "2026-08-29T21:19:31.776+09:00";
export const INTAKE_STARTED_AT_KST = "2026-08-29T21:19:31.776+09:00";
export const INTAKE_STARTED_AT_UTC = "2026-08-29T12:19:31.776Z";
export const FORMAL_OBSERVED_AT = INTAKE_STARTED_AT;
export const CAPTURE_TIME_SOURCE = "INTAKE_STARTED_AT_FROZEN_NOT_FILE_MTIME";
export const TIMING_CLASS = "PREGAME_ELIGIBILITY_UNRESOLVED";
export const SCOPE_STATUS = "NOT_READY_TO_LOCK_DAILY_SCOPE";
export const STATUS = "OPERATOR_REVIEW_REQUIRED";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-30/batch-2118";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-30/batch-2118-next-pregame-v0.json";
export const TRANSCRIPTION_REL =
  "data/operator-observations/structured/2026-08-30/batch-2118-manual-transcription-source-v0.json";
export const RECOVERY_AUDIT_REL =
  "data/audits/2026-08-30-pregame-current-state-recovery-v1.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const INBOX_PATH =
  "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-30";
export const REQUIRED_BASE_COMMIT =
  "84cc91a2fcb8ab1485e1ac359b64b4398d034b6a";
export const RAW_EVIDENCE_STORAGE = "LOCAL_ONLY_OWNER_PROVIDED_SCREENSHOT";
export const REPOSITORY_EVIDENCE = "HASH_AND_STRUCTURED_OBSERVATION";
export const PNG_GIT_EXCLUDE =
  "data/operator-observations/raw/2026-08-30/batch-2118/*.png";

export const FORBIDDEN_WRITE_PREFIXES = [
  "data/predictions/",
  "data/operator-input/",
  "리포트/",
] as const;

export const SEALED_2026_08_29 = [
  {
    rel: "data/audits/2026-08-29-daily-scope-lock-v1.json",
    sha256:
      "c6a898ad16dbde921bc5ace9c086d5e3ccd9c5907d00c2d420ed088638e64e53",
  },
  {
    rel: "data/audits/2026-08-29-scope-slate-recovery-v1.json",
    sha256:
      "5bc05300d2234590c804f5c13043517dad2ca0cd8bf9a17f939bf7a97785b24b",
  },
  {
    rel: "data/audits/2026-08-29-pregame-current-state-recovery-v1.json",
    sha256:
      "8602de81e52a8e85199b8a64e33f02bf70c4c6a74b33793fd47ff4cf986a0cc6",
  },
  {
    rel: "data/operator-observations/structured/2026-08-29/batch-2130-next-pregame-v0.json",
    sha256:
      "d652b158494ab7824402e90c000c966691512a32ae3d3a7efae17adc935a52d7",
  },
  {
    rel: "data/operator-observations/raw/2026-08-29/batch-2130/manifest.json",
    sha256:
      "769956e333f28ba2a0d3e6cbc562e983019c84f73cf2ad23eb7cba51fe54434c",
  },
  {
    rel: "data/operator-observations/raw/2026-08-29/batch-2130/README.txt",
    sha256:
      "f892f1656ed8c3c8f01e2ea7da357d9d39471bba63576fa569a3da9e00720c8e",
  },
] as const;

export const SCREENSHOTS = [
  {
    file: "screenshot_2026-08-29_211359.png",
    originalInboxName: "스크린샷 2026-08-29 211359.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "ccf7d7b07159a0a61836e16e849b26c76b1a718357ba9f20b513d556becba347",
    bytes: 184498,
    sourceFileCreatedAt: "2026-08-29T21:13:59.3954644+09:00",
    sourceFileModifiedAt: "2026-08-29T21:13:59.4508188+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:13:59+09:00",
    displayedSourceTimestamp: null,
    sequence: 1,
  },
  {
    file: "screenshot_2026-08-29_211405.png",
    originalInboxName: "스크린샷 2026-08-29 211405.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "4937b9da5276a97c579adb3c455ea6709760ac79d20c1cc6fd9c4d1623f5916c",
    bytes: 175882,
    sourceFileCreatedAt: "2026-08-29T21:14:05.4709396+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:05.5311772+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:05+09:00",
    displayedSourceTimestamp: null,
    sequence: 2,
  },
  {
    file: "screenshot_2026-08-29_211411.png",
    originalInboxName: "스크린샷 2026-08-29 211411.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "a5f4d54411c70ea9ea6449d27a9e78585ed690ae091ece7667252ecb003a8716",
    bytes: 175269,
    sourceFileCreatedAt: "2026-08-29T21:14:11.7647880+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:11.8163505+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:11+09:00",
    displayedSourceTimestamp: null,
    sequence: 3,
  },
  {
    file: "screenshot_2026-08-29_211417.png",
    originalInboxName: "스크린샷 2026-08-29 211417.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "e5f278275793d30f2ba4e3c62a95a3bb6caab804512a5d59100c96831713812c",
    bytes: 185541,
    sourceFileCreatedAt: "2026-08-29T21:14:17.9638031+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:18.0176414+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:17+09:00",
    displayedSourceTimestamp: null,
    sequence: 4,
  },
  {
    file: "screenshot_2026-08-29_211424.png",
    originalInboxName: "스크린샷 2026-08-29 211424.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "c4634d4cd423b0366b6620482af7020c58566252170d487d1b6149ba2aec04d3",
    bytes: 177639,
    sourceFileCreatedAt: "2026-08-29T21:14:24.1549992+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:24.2088924+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:24+09:00",
    displayedSourceTimestamp: null,
    sequence: 5,
  },
  {
    file: "screenshot_2026-08-29_211431.png",
    originalInboxName: "스크린샷 2026-08-29 211431.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "782b3b788d19b5f4169f748ae299f735d5b7eb02e9412db8569dd1eddced15a9",
    bytes: 182728,
    sourceFileCreatedAt: "2026-08-29T21:14:31.3030511+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:31.3582140+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:31+09:00",
    displayedSourceTimestamp: null,
    sequence: 6,
  },
  {
    file: "screenshot_2026-08-29_211436.png",
    originalInboxName: "스크린샷 2026-08-29 211436.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "6587333bd2f36dc0baac792c7d24f6dc5a7fe63a691c8580a2c1d0899615f1eb",
    bytes: 168768,
    sourceFileCreatedAt: "2026-08-29T21:14:37.0243330+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:37.0789739+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:36+09:00",
    displayedSourceTimestamp: null,
    sequence: 7,
  },
  {
    file: "screenshot_2026-08-29_211451.png",
    originalInboxName: "스크린샷 2026-08-29 211451.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "be1bb6d2fd71d7476ba59ed136cd3a1dca233f617ba6b9e0bafeab543b4a092e",
    bytes: 181216,
    sourceFileCreatedAt: "2026-08-29T21:14:51.5744543+09:00",
    sourceFileModifiedAt: "2026-08-29T21:14:51.6287398+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:14:51+09:00",
    displayedSourceTimestamp: null,
    sequence: 8,
  },
  {
    file: "screenshot_2026-08-29_211528.png",
    originalInboxName: "스크린샷 2026-08-29 211528.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "a5ed4fe81692c00806fd02c1b683efa3fdc7db9cd6790ab6b56e1e750d204c3f",
    bytes: 181012,
    sourceFileCreatedAt: "2026-08-29T21:15:28.2099811+09:00",
    sourceFileModifiedAt: "2026-08-29T21:15:28.2655286+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:15:28+09:00",
    displayedSourceTimestamp: null,
    sequence: 9,
  },
  {
    file: "screenshot_2026-08-29_211535.png",
    originalInboxName: "스크린샷 2026-08-29 211535.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "bac69e01d8db9f20d70b174219f5f3b0495d926239ecfab1b0b198619360b0a9",
    bytes: 140870,
    sourceFileCreatedAt: "2026-08-29T21:15:35.6340766+09:00",
    sourceFileModifiedAt: "2026-08-29T21:15:35.6858316+09:00",
    sourceFileNameTimestamp: "2026-08-29T21:15:35+09:00",
    displayedSourceTimestamp: null,
    sequence: 10,
  },
] as const;

type MarketType =
  | "MONEYLINE_2WAY"
  | "DOMESTIC_THREE_WAY_SPECIAL"
  | "RUN_LINE"
  | "TOTALS"
  | "SUM"
  | "FIRST_HALF_OR_EARLY_SPECIAL"
  | "ONE_X_TWO"
  | "FOOTBALL_HANDICAP_3WAY"
  | "UNKNOWN";

type SourceMarket = {
  rawMarketLabel: string;
  marketType: MarketType;
  line: number | null;
  homePrice: number | null;
  drawPrice: number | null;
  awayPrice: number | null;
  screenshotFile: string;
  rowIds: number[];
};

type SourceFootball = {
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  screenshot: string;
  overlapScreenshots: string[];
  reviewNotes: string[];
  markets: SourceMarket[];
};

type SourceMlb = {
  displayedDateKst: string;
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  screenshot: string;
  overlapScreenshots: string[];
  markets: SourceMarket[];
};

type SourceDoc = {
  football: SourceFootball[];
  mlb: SourceMlb[];
  basketball: unknown[];
  volleyball: unknown[];
  marketIdGapsNotInvented: number[][];
};

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function screenshotMeta(file: string) {
  const shot = SCREENSHOTS.find((s) => s.file === file);
  if (!shot) throw new Error(`UNKNOWN_SCREENSHOT: ${file}`);
  return shot;
}

function loadSource(cwd = process.cwd()): SourceDoc {
  return JSON.parse(
    readFileSync(path.join(cwd, TRANSCRIPTION_REL), "utf8"),
  ) as SourceDoc;
}

function provenance(file: string) {
  const shot = screenshotMeta(file);
  return {
    screenshotFile: shot.file,
    screenshotSha256: shot.sha256,
    screenshotRel: `${RAW_REL}/${shot.file}`,
    sourceScreenshotSha: shot.sha256,
    originalInboxName: shot.originalInboxName,
    sourceFileCreatedAt: shot.sourceFileCreatedAt,
    sourceFileModifiedAt: shot.sourceFileModifiedAt,
    sourceFileNameTimestamp: shot.sourceFileNameTimestamp,
    displayedSourceTimestamp: shot.displayedSourceTimestamp,
    formalObservedAt: FORMAL_OBSERVED_AT,
    intakeStartedAt: INTAKE_STARTED_AT,
    operatorObservedAt: FORMAL_OBSERVED_AT,
    receivedAtKst: INTAKE_STARTED_AT_KST,
  };
}

function decorateMarkets(markets: SourceMarket[]) {
  return markets.map((m) => {
    const shot = screenshotMeta(m.screenshotFile);
    return {
      ...m,
      rawValueStatus: "VISIBLE" as const,
      sourceScreenshotSha: shot.sha256,
      originalInboxName: shot.originalInboxName,
      formalObservedAt: FORMAL_OBSERVED_AT,
      sourceFileModifiedAt: shot.sourceFileModifiedAt,
      marketBenchmarkOnly: true as const,
      predictionInput: false as const,
      engineInput: false as const,
      observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION" as const,
    };
  });
}

function commonRowFlags() {
  return {
    sourceType: "MANUAL_OPERATOR_OBSERVATION" as const,
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION" as const,
    marketBenchmarkOnly: true as const,
    predictionInput: false as const,
    engineInput: false as const,
    formalObservedAt: FORMAL_OBSERVED_AT,
    scheduledStartAt: null,
    pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED" as const,
    timingClass: TIMING_CLASS,
    fuzzyMatchingUsed: false as const,
    pick: null,
    yangPick: null,
    recommendation: null,
  };
}

function decorateFootball(g: SourceFootball) {
  const inTarget = g.displayedDateKst === SLATE_DATE_KST;
  return {
    ...commonRowFlags(),
    ...provenance(g.screenshot),
    sport: "FOOTBALL" as const,
    rawLeagueLabel: g.rawLeagueLabel,
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHome: g.rawHome,
    rawAway: g.rawAway,
    rawHomeLabel: g.rawHome,
    rawAwayLabel: g.rawAway,
    rawMatchup: `${g.rawHome} : ${g.rawAway}`,
    rawHomeSecondaryVisible: null as string | null,
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    competitionRegistryJoin: "NOT_ATTEMPTED" as const,
    leagueLabelStatus: "VISIBLE" as const,
    reviewNotes: g.reviewNotes,
    scopeMembership: inTarget
      ? ("IN_TARGET_DATE_SCOPE" as const)
      : ("EXCLUDED_NON_TARGET_DATE" as const),
    matchId: null,
    overlapScreenshots: g.overlapScreenshots,
    markets: decorateMarkets(g.markets),
  };
}

function decorateMlb(g: SourceMlb) {
  const left = canonicalDomesticTeam(g.rawHome);
  const right = canonicalDomesticTeam(g.rawAway);
  const aliasMatched = Boolean(left && right);
  return {
    ...commonRowFlags(),
    ...provenance(g.screenshot),
    sport: "MLB" as const,
    rawLeagueLabel: "MLB",
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHomeLabel: g.rawHome,
    rawAwayLabel: g.rawAway,
    rawMatchup: `${g.rawHome} : ${g.rawAway}`,
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: aliasMatched
      ? ("TEAM_ALIAS_MATCHED_NO_SCHEDULE" as const)
      : ("NO_SCHEDULE_JOIN_THIS_BATCH" as const),
    canonicalHome: left,
    canonicalAway: right,
    gamePk: null,
    internalGameId: null,
    doubleheaderRisk: "UNKNOWN_NO_SCHEDULE" as const,
    overlapScreenshots: g.overlapScreenshots,
    scopeMembership: "IN_TARGET_DATE_SCOPE" as const,
    markets: decorateMarkets(g.markets),
  };
}

function countMarkets(
  games: { markets: { rowIds: number[] }[] }[],
): number {
  return games.reduce(
    (n, g) => n + g.markets.reduce((m, x) => m + x.rowIds.length, 0),
    0,
  );
}

function footballByLeague(rows: { rawLeagueLabel: string }[]) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.rawLeagueLabel] = (out[row.rawLeagueLabel] ?? 0) + 1;
  }
  return out;
}

export async function runIntake(cwd = process.cwd()) {
  const source = loadSource(cwd);
  for (const shot of SCREENSHOTS) {
    const copiedAbs = path.join(cwd, RAW_REL, shot.file);
    if (!existsSync(copiedAbs)) {
      throw new Error(`COPIED_SCREENSHOT_MISSING: ${shot.file}`);
    }
    const copiedSha = sha256File(copiedAbs);
    if (copiedSha !== shot.sha256) {
      throw new Error(`COPIED_SHA_MISMATCH: ${shot.file}`);
    }
    const inboxAbs = path.join(INBOX_PATH, shot.originalInboxName);
    if (!existsSync(inboxAbs)) {
      throw new Error(`INBOX_SCREENSHOT_MISSING: ${shot.originalInboxName}`);
    }
    const inboxSha = sha256File(inboxAbs);
    if (inboxSha !== shot.sha256) {
      throw new Error(`INBOX_SHA_MISMATCH: ${shot.originalInboxName}`);
    }
    if (inboxSha !== copiedSha) {
      throw new Error(`COPY_NOT_BYTE_IDENTICAL: ${shot.file}`);
    }
    const inboxBytes = readFileSync(inboxAbs).byteLength;
    if (inboxBytes !== shot.bytes) {
      throw new Error(`INBOX_BYTE_MISMATCH: ${shot.originalInboxName}`);
    }
  }

  for (const sealed of SEALED_2026_08_29) {
    const abs = path.join(cwd, sealed.rel);
    if (!existsSync(abs)) {
      throw new Error(`SEALED_2026_08_29_MISSING: ${sealed.rel}`);
    }
    const sha = sha256File(abs);
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_29_MUTATED: ${sealed.rel}`);
    }
  }

  const footballRows = source.football.map(decorateFootball);
  const mlbRows = source.mlb.map(decorateMlb);
  const basketballRows: never[] = [];
  const rowsObserved = countMarkets([...source.football, ...source.mlb]);
  const allRows = [...footballRows, ...mlbRows];
  const official = allRows.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const excluded = allRows.filter(
    (r) => r.scopeMembership === "EXCLUDED_NON_TARGET_DATE",
  );
  const mlbAliasMatched = mlbRows.filter(
    (r) => r.mappingStatus === "TEAM_ALIAS_MATCHED_NO_SCHEDULE",
  ).length;
  const overlapCount = allRows.filter(
    (r) => r.overlapScreenshots.length > 1,
  ).length;

  const summary = {
    screenshots: SCREENSHOTS.length,
    oddsScreenshots: 10,
    lineupScreenshots: 0,
    rowsObserved,
    rowsParsed: rowsObserved,
    matchupCount: allRows.length,
    observedBatchCount: allRows.length,
    officialTargetDateScopeCount: official.length,
    excludedCrossDateCount: excluded.length,
    rowsIdentityMatched: 0,
    rowsIdentityReviewRequired: allRows.length,
    rowsPregameEligible: 0,
    rowsPostStart: 0,
    rowsPregameEligibilityUnresolved: allRows.length,
    unreadableGameRows: 0,
    offDateDisplayedMatchups: excluded.length,
    reviewRequiredSections: 3,
    mlbOddsMatchups: mlbRows.length,
    mlbOddsAliasMatched: mlbAliasMatched,
    mlbOddsAliasFailed: mlbRows.length - mlbAliasMatched,
    mlbGamePkJoined: 0,
    basketballOddsFixtures: 0,
    footballOddsFixtures: footballRows.length,
    footballJoined: 0,
    volleyballOddsFixtures: 0,
    npbOddsGames: 0,
    kboOddsGames: 0,
    expectedLineups: 0,
    confirmedLineups: 0,
    overlapGamesDeduped: overlapCount,
    shaDuplicates: 0,
    rawMutation: 0,
    predictionInputTrue: 0,
    predictionCreated: 0,
    fuzzyMatchingUsed: false,
    inventedOddsFields: 0,
    inventedTeamIdentities: 0,
    providerCallCount: 0,
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    marketIdGapsNotInvented: source.marketIdGapsNotInvented.flat(),
  };

  const document = {
    schemaVersion: "yang-edge-next-pregame-observation-v0",
    batchId: BATCH_ID,
    dateKst: DATE_KST,
    receivedDateKst: RECEIVED_DATE_KST,
    slateDateKst: SLATE_DATE_KST,
    intendedOperatingDateKst: SLATE_DATE_KST,
    dateClassification: "DATE_DISPLAYED_NOT_SCOPE_LOCKED",
    dateClassificationReason:
      "Inbox folder is 2026-08-30. Screenshot filenames are 2026-08-29 21:13-21:15 KST. On-screen betting dates include 08.29(토) leftover football and 08.30(일) target-date football/MLB. Official target-date Scope is 2026-08-30 from displayed 08.30(일). 08.29(토) rows are preserved with scopeMembership=EXCLUDED_NON_TARGET_DATE and are not used to reopen sealed 2026-08-29 artifacts. formalObservedAt is the frozen intake clock, not file mtime and not filename time.",
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    observedAt: INTAKE_STARTED_AT_UTC,
    operatorObservedAt: FORMAL_OBSERVED_AT,
    captureTime: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    predictionAlreadyFrozen: false,
    officialPredictionHash: null,
    officialPredictionRel: null,
    observationPhase: "PREGAME_CURRENT_STATE_RECOVERY",
    timingClass: TIMING_CLASS,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: null,
    scopeLockStatus: SCOPE_STATUS,
    status: STATUS,
    fuzzyMatchingUsed: false,
    providerCallCount: 0,
    predictionCreated: 0,
    expectedConfirmedSeparation:
      "No lineup screenshots in this batch. EXPECTED and CONFIRMED arrays remain empty.",
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_GIT_EXCLUDE,
    note: "2026-08-30 Stage A intake. Inbox screenshots copied byte-identical. RAW PNG copies are LOCAL-ONLY and must not be committed to public GitHub. No schedule/result/prediction/odds-provider calls in the intake writer. MLB aliases recorded where exact; fixture/gamePk join is the slate-recovery writer. Displayed kickoff is not treated as scheduledStartAt until schedule join. Market IDs 7538-7541 and 7686-7689 were not on any screenshot and were not invented. 20 08.29 leftover football matchups remain in structured observations with scopeMembership=EXCLUDED_NON_TARGET_DATE and are excluded from the 2026-08-30 official Daily Scope denominator.",
    summary,
    screenshots: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      sourceFileCreatedAt: s.sourceFileCreatedAt,
      sourceFileModifiedAt: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      intakeStartedAt: INTAKE_STARTED_AT,
      operatorObservedAt: FORMAL_OBSERVED_AT,
      receivedAtKst: INTAKE_STARTED_AT_KST,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      engineInput: false,
      marketBenchmarkOnly: true,
      source: "MANUAL_SCREENSHOT",
      sequence: s.sequence,
      rel: `${RAW_REL}/${s.file}`,
    })),
    overlapDedup: {
      method: "EVENT_IDENTITY_DISPLAYED_DATE_START_LEAGUE_HOME_AWAY",
      duplicateGameIdentitiesRemoved: overlapCount,
      overlappingGames: allRows
        .filter((r) => r.overlapScreenshots.length > 1)
        .map((r) => ({
          displayedDateKst: r.displayedDateKst,
          matchup: r.rawMatchup,
          screenshots: r.overlapScreenshots,
        })),
    },
    reviewRequired: [
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "OFF_DATE_08_29_FOOTBALL_LEFTOVER",
        note: "Screenshots 1-3 display leftover 08.29(토) football matchups. Preserved in operator observations with scopeMembership=EXCLUDED_NON_TARGET_DATE. Not 2026-08-30 official Scope games. Not used to reopen sealed 2026-08-29 artifacts.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "MARKET_ID_GAPS_NOT_INVENTED",
        marketIds: source.marketIdGapsNotInvented.flat(),
        note: "IDs 7538-7541 jump from 7537 to 7542 (08.29 에레디비 to 08.30 라리가). IDs 7686-7689 jump from 7685 to 7690 (MLS 애틀유나 to DC유나이). No rows were invented.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "FOOTBALL_RAW_GLYPH_에스피뇰",
        note: "라리가 away label stored as 에스피뇰 exactly as displayed. Not silently unified to registered alias 에스파뇰.",
      },
    ],
    basketballOddsFixtures: basketballRows,
    footballOddsFixtures: footballRows,
    mlbOddsGames: mlbRows,
    volleyballOddsFixtures: [],
    npbOddsGames: [],
    kboOddsGames: [],
    expectedLineups: [],
    confirmedLineups: [],
    footballByLeague: footballByLeague(footballRows),
    footballByLeagueOfficialTargetDate: footballByLeague(
      footballRows.filter((r) => r.displayedDateKst === SLATE_DATE_KST),
    ),
    nextOperatingDay: {
      readyToLockDailyScope: false,
      scheduleJoinRequired: true,
      mlbSchedulePresent: false,
      footballSchedulePresent: false,
      basketballSchedulePresent: false,
      predictionPresent: false,
      mandatoryPercentComputed: false,
    },
  };

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    receivedAtKst: INTAKE_STARTED_AT_KST,
    captureTime: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    predictionAlreadyFrozen: false,
    predictionHash: null,
    observationPhase: "PREGAME_CURRENT_STATE_RECOVERY",
    timingClass: TIMING_CLASS,
    officialPredictionRel: null,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: null,
    slateDateKst: SLATE_DATE_KST,
    receivedDateKst: RECEIVED_DATE_KST,
    inboxPath: INBOX_PATH,
    screenshotCount: SCREENSHOTS.length,
    notes: [
      "Raw screenshots copied byte-identical from INBOX. SHA-256 verified on copy. Inbox originals were not moved, renamed, deleted, overwritten, compressed, or edited.",
      "formalObservedAt = frozen intakeStartedAt. Filesystem mtime and filename 21:13-21:15 timestamps are provenance only.",
      "Inbox folder 2026-08-30 is drop location. Official displayed target date is 08.30(일). 08.29(토) leftover football is retained with EXCLUDED_NON_TARGET_DATE.",
      "No Prediction / Engine / Weights / Result / schedule-provider work in this intake writer.",
    ],
    files: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      sourceFileCreatedAt: s.sourceFileCreatedAt,
      sourceFileModifiedAt: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      intakeStartedAt: INTAKE_STARTED_AT,
      operatorObservedAt: FORMAL_OBSERVED_AT,
      receivedAtKst: INTAKE_STARTED_AT_KST,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      engineInput: false,
      marketBenchmarkOnly: true,
      duplicateSource: false,
      copiedAs: `${RAW_REL}/${s.file}`,
      copiedBytes: s.bytes,
      copiedSha256: s.sha256,
      copyIntegrity: "PASS",
    })),
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_GIT_EXCLUDE,
  };

  const readme = `YANG EDGE — 2026-08-30 Stage A Pregame Raw Batch
batchId: ${BATCH_ID}
Inbox: ${INBOX_PATH}\\
intakeStartedAt / formalObservedAt: ${INTAKE_STARTED_AT}
captureTimeSource: ${CAPTURE_TIME_SOURCE}
slateDateKst: ${SLATE_DATE_KST}
observationPhase: PREGAME_CURRENT_STATE_RECOVERY
predictionInput: false
engineInput: false
marketBenchmarkOnly: true
scopeLockStatus: ${SCOPE_STATUS}
status: ${STATUS}

Contents
- 10 domestic-odds screenshots (football / MLB)
- 0 lineup screenshots

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Odds provenance = MANUAL_OPERATOR_OBSERVATION / MANUAL_OPERATOR_MARKET_OBSERVATION.
3. researchOnly = true, engineAdmission = PROHIBITED, predictionInput = false, engineInput = false.
4. formalObservedAt is the frozen intake clock. Do not treat file mtime as observedAt.
5. Official target date is 2026-08-30 from displayed 08.30(일). 08.29 leftover football is EXCLUDED_NON_TARGET_DATE.
6. Do not alter sealed 2026-08-29 artifacts.
7. Do not call Odds/Starter/Lineup/Result/Grade/Review/Engine/Prediction providers in this intake writer.
8. RAW PNG copies are LOCAL-ONLY owner-provided evidence. Public Git tracks hashes + structured observations only.
`;

  const recoveryAudit = {
    schemaVersion: "yang-edge-pregame-current-state-recovery-v1",
    dateKst: DATE_KST,
    baseCommit: REQUIRED_BASE_COMMIT,
    batchId: BATCH_ID,
    status: STATUS,
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_GIT_EXCLUDE,
    statusReason:
      "Inbox inventory and byte-identical copies are complete. RAW PNG copies are local-only. Readable odds rows are preserved with provenance. Twenty 08.29 leftover football matchups are preserved with scopeMembership=EXCLUDED_NON_TARGET_DATE and are excluded from the 2026-08-30 official Daily Scope denominator. Fixture identity join is applied by slate recovery, not this intake writer. Daily Scope is not locked in this intake writer.",
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    inboxPath: INBOX_PATH,
    inboxFileCount: SCREENSHOTS.length,
    existing20260830ArtifactsBeforeWork: [],
    sourceFiles: SCREENSHOTS.map((s) => ({
      exactFilename: s.originalInboxName,
      copiedAs: s.file,
      extension: ".png",
      bytes: s.bytes,
      sha256: s.sha256,
      filesystemCreationTime: s.sourceFileCreatedAt,
      filesystemModifiedTime: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      filesystemTimestampAuthoritativeForObservedAt: false,
    })),
    matchupCount: summary.matchupCount,
    observedBatchCount: summary.observedBatchCount,
    officialTargetDateScopeCount: summary.officialTargetDateScopeCount,
    excludedCrossDateCount: summary.excludedCrossDateCount,
    rowsObserved: summary.rowsObserved,
    rowsParsed: summary.rowsParsed,
    rowsIdentityMatched: summary.rowsIdentityMatched,
    rowsIdentityReviewRequired: summary.rowsIdentityReviewRequired,
    rowsPregameEligible: summary.rowsPregameEligible,
    rowsPostStart: summary.rowsPostStart,
    rowsPregameEligibilityUnresolved: summary.rowsPregameEligibilityUnresolved,
    unreadableOrReviewRequiredMatchups: 0,
    sportBreakdown: {
      FOOTBALL: footballRows.length,
      BASKETBALL: 0,
      MLB: mlbRows.length,
    },
    leagueBreakdownSafelyKnown: {
      ...footballByLeague(footballRows),
      MLB: mlbRows.length,
    },
    mlbRowsPresent: true,
    mlbRowCount: mlbRows.length,
    structuredObservationPath: STRUCTURED_REL,
    recoveryAuditPath: RECOVERY_AUDIT_REL,
    rawManifestPath: MANIFEST_REL,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    fuzzyMatchingUsed: false,
    inventedOddsFieldsCount: 0,
    inventedTeamIdentitiesCount: 0,
    providerCallCount: 0,
    providerEndpoints: [],
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    predictionCreatedCount: 0,
    engineModified: false,
    weightsModified: false,
    originalInboxFilesUntouched: true,
    sealed20260829FilesUntouched: true,
    retroactive20260829WorkCreatedOrModified: false,
    dailyScopeLocked: false,
    nextRecommendedStep: "2026-08-30 SCOPE / SLATE RECOVERY",
    doNotStartNextStepInThisMission: false,
    wrote: [MANIFEST_REL, README_REL, STRUCTURED_REL, RECOVERY_AUDIT_REL],
    frozenArtifactsOpened: false,
    summary,
  };

  await mkdir(path.dirname(path.join(cwd, STRUCTURED_REL)), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, RECOVERY_AUDIT_REL)), {
    recursive: true,
  });
  await writeFile(
    path.join(cwd, MANIFEST_REL),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(cwd, README_REL), readme, "utf8");
  await writeFile(
    path.join(cwd, STRUCTURED_REL),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(cwd, RECOVERY_AUDIT_REL),
    `${JSON.stringify(recoveryAudit, null, 2)}\n`,
    "utf8",
  );

  return { document, manifest, recoveryAudit };
}

async function main() {
  const result = await runIntake();
  console.log(`wrote ${MANIFEST_REL}`);
  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${RECOVERY_AUDIT_REL}`);
  console.log(
    `status=${result.document.status} football=${result.document.summary.footballOddsFixtures} mlb=${result.document.summary.mlbOddsMatchups} matchups=${result.document.summary.matchupCount} official=${result.document.summary.officialTargetDateScopeCount} excluded=${result.document.summary.excludedCrossDateCount} rows=${result.document.summary.rowsObserved} predictionInput=false`,
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
