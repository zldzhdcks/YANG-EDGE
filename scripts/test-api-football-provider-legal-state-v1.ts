/**
 * API-Football provider legal-state registry — fixture / mock only.
 * Zero live Provider calls.
 *
 *   npm run test:api-football-provider-legal-state-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MLB_STATS_LEGAL_STATUS,
  ODDS_LEGAL_STATUS,
} from "../src/lib/provider-automation-policy";
import {
  API_FOOTBALL_AI_ML_INPUT,
  API_FOOTBALL_ATTRIBUTION,
  API_FOOTBALL_BRANDED_IMAGE,
  API_FOOTBALL_CACHE,
  API_FOOTBALL_COMMERCIAL_USE,
  API_FOOTBALL_CUSTOMER_DATA_FEED,
  API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS,
  API_FOOTBALL_DERIVED_STORAGE,
  API_FOOTBALL_HISTORICAL_RETENTION,
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_LAUNCHD_ENABLED,
  API_FOOTBALL_LEAGUE_LOGO,
  API_FOOTBALL_LEAGUE_NAME_DISPLAY,
  API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_LEGAL_EVIDENCE_DATE,
  API_FOOTBALL_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_LEGAL_STATE,
  API_FOOTBALL_PLAYER_PHOTO,
  API_FOOTBALL_PREDICTION_INPUT,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
  API_FOOTBALL_RAW_API_REDISTRIBUTION,
  API_FOOTBALL_RAW_RESALE,
  API_FOOTBALL_RAW_STORAGE,
  API_FOOTBALL_TEAM_LOGO,
  API_FOOTBALL_TEAM_NAME_DISPLAY,
  assertApiFootballLegalStateMatchesEvidence,
  canEnableNewPublicCompetition,
  evaluateCompetitionPublicExpansion,
  LEGAL_BLOCK,
  LEGAL_CONDITIONAL,
  LEGAL_PASS,
  LEGAL_REVIEW_REQUIRED,
  loadApiFootballDerivedLineupInjuryLegalEvidence,
  loadApiFootballLegalEvidence,
  NOT_REQUIRED_BY_PROVIDER,
  PUBLIC_EXPANSION_ALLOWED_DEFAULT,
  UNREVIEWED,
} from "../src/lib/provider-legal-state";

const SECRET_MARKERS = [
  "x-apisports-key",
  "API_FOOTBALL_KEY",
  "ODDS_API_KEY",
  "sk_live",
  "BEGIN PRIVATE",
  "support session",
  "account identifier",
];

function legalStateSource(): string {
  const dir = join(process.cwd(), "src/lib/provider-legal-state");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function assertNoSecrets(text: string, label: string) {
  const lower = text.toLowerCase();
  for (const marker of SECRET_MARKERS) {
    assert.equal(lower.includes(marker.toLowerCase()), false, `${label}:${marker}`);
  }
}

test("1 LAUNCHD = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_LAUNCHD, LEGAL_PASS);
  assert.equal(API_FOOTBALL_LEGAL_STATE.automation.legalHoldRemoved, true);
  assert.equal(API_FOOTBALL_LAUNCHD_ENABLED, false);
  assert.equal(API_FOOTBALL_LEGAL_STATE.automation.launchdEnabled, false);
});

test("2 RAW_STORAGE = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_RAW_STORAGE, LEGAL_CONDITIONAL);
});

test("3 CACHE = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_CACHE, LEGAL_CONDITIONAL);
});

test("4 HISTORICAL_RETENTION = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_HISTORICAL_RETENTION, LEGAL_CONDITIONAL);
});

test("5 DERIVED_STORAGE = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_DERIVED_STORAGE, LEGAL_PASS);
});

test("6 PREDICTION_INPUT = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_PREDICTION_INPUT, LEGAL_PASS);
});

test("7 AI_ML_INPUT = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_AI_ML_INPUT, LEGAL_PASS);
});

test("8 PUBLIC_FIXTURE_DISPLAY = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY, LEGAL_CONDITIONAL);
});

test("9 TEAM_NAME_DISPLAY = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_TEAM_NAME_DISPLAY, LEGAL_CONDITIONAL);
});

test("10 LEAGUE_NAME_DISPLAY = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_LEAGUE_NAME_DISPLAY, LEGAL_CONDITIONAL);
});

test("11 DERIVED_PUBLIC_ANALYSIS = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS, LEGAL_CONDITIONAL);
});

test("12 RAW_RESALE = LEGAL_BLOCK", () => {
  assert.equal(API_FOOTBALL_RAW_RESALE, LEGAL_BLOCK);
});

test("13 RAW_API_REDISTRIBUTION = LEGAL_BLOCK", () => {
  assert.equal(API_FOOTBALL_RAW_API_REDISTRIBUTION, LEGAL_BLOCK);
});

test("14 CUSTOMER_DATA_FEED = LEGAL_BLOCK", () => {
  assert.equal(API_FOOTBALL_CUSTOMER_DATA_FEED, LEGAL_BLOCK);
});

test("15 TEAM_LOGO = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_TEAM_LOGO, LEGAL_REVIEW_REQUIRED);
});

test("16 LEAGUE_LOGO = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_LEAGUE_LOGO, LEGAL_REVIEW_REQUIRED);
});

test("17 PLAYER_PHOTO = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_PLAYER_PHOTO, LEGAL_REVIEW_REQUIRED);
});

test("18 BRANDED_IMAGE = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_BRANDED_IMAGE, LEGAL_REVIEW_REQUIRED);
});

test("19 COMMERCIAL_USE = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_COMMERCIAL_USE, LEGAL_REVIEW_REQUIRED);
});

test("20 ATTRIBUTION = NOT_REQUIRED_BY_PROVIDER", () => {
  assert.equal(API_FOOTBALL_ATTRIBUTION, NOT_REQUIRED_BY_PROVIDER);
  assert.notEqual(API_FOOTBALL_ATTRIBUTION, LEGAL_PASS);
});

test("21 unreviewed competition cannot be newly public-enabled", () => {
  assert.equal(PUBLIC_EXPANSION_ALLOWED_DEFAULT, false);
  const unreviewed = evaluateCompetitionPublicExpansion({
    providerCompetitionId: "9999",
  });
  assert.equal(unreviewed.reviewStatus, UNREVIEWED);
  assert.equal(unreviewed.publicExpansionAllowed, false);
  assert.equal(
    canEnableNewPublicCompetition({ providerCompetitionId: "39" }),
    false,
  );
  assert.equal(
    canEnableNewPublicCompetition({
      providerCompetitionId: "39",
      reviewStatus: LEGAL_REVIEW_REQUIRED,
    }),
    false,
  );
  assert.equal(
    canEnableNewPublicCompetition({
      providerCompetitionId: "39",
      reviewStatus: LEGAL_BLOCK,
    }),
    false,
  );
  assert.equal(
    canEnableNewPublicCompetition({
      providerCompetitionId: "39",
      reviewStatus: "APPROVED",
    }),
    false,
  );
});

test("22 legal state contains no secrets", () => {
  assertNoSecrets(legalStateSource(), "module");
  assertNoSecrets(
    readFileSync(join(process.cwd(), API_FOOTBALL_LEGAL_EVIDENCE_REL), "utf8"),
    "evidence",
  );
  assertNoSecrets(
    readFileSync(
      join(process.cwd(), API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL),
      "utf8",
    ),
    "derived-evidence",
  );
  assertNoSecrets(JSON.stringify(API_FOOTBALL_LEGAL_STATE), "runtime");
});

test("23 compliance evidence date = 2026-09-19", () => {
  const evidence = loadApiFootballLegalEvidence();
  assert.equal(evidence.evidenceDate, "2026-09-19");
  assert.equal(API_FOOTBALL_LEGAL_EVIDENCE_DATE, "2026-09-19");
  assert.equal(evidence.termsLastUpdated, "2025-05-21");
  assertApiFootballLegalStateMatchesEvidence();
});

test("24 existing MLB/Odds legal conclusions are unchanged", () => {
  assert.equal(MLB_STATS_LEGAL_STATUS, "LEGAL_REVIEW_REQUIRED");
  assert.equal(ODDS_LEGAL_STATUS, "LEGAL_CONDITIONAL");
});

test("25 PROVIDER_CALLS=0", () => {
  const source = legalStateSource();
  for (const forbidden of [
    'from "../api-football-provider"',
    'from "@/lib/football/api-football-provider"',
    "get-football-provider",
    "the-odds-api",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    fetchCalls += 1;
    throw new Error("NETWORK_FORBIDDEN");
  }) as typeof fetch;
  try {
    loadApiFootballLegalEvidence();
    loadApiFootballDerivedLineupInjuryLegalEvidence();
    assertApiFootballLegalStateMatchesEvidence();
    evaluateCompetitionPublicExpansion({ providerCompetitionId: "140" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});
