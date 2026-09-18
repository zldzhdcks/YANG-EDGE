/**
 * API-Football derived lineup/injury legal-state sync — fixture / mock only.
 * Zero live Provider calls. No Public UI / Engine / research logic change.
 *
 *   npm run test:api-football-derived-lineup-injury-legal-state-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_FOOTBALL_ATTRIBUTION,
  API_FOOTBALL_AVAILABILITY_INTERNAL_INPUT,
  API_FOOTBALL_CACHE,
  API_FOOTBALL_COMMERCIAL_USE,
  API_FOOTBALL_COMPETITION_THIRD_PARTY_RIGHTS,
  API_FOOTBALL_CUSTOMER_DATA_FEED,
  API_FOOTBALL_DERIVED_ANALYSIS_GENERATION,
  API_FOOTBALL_DERIVED_ANALYSIS_PUBLIC_DISPLAY,
  API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS,
  API_FOOTBALL_DERIVED_STORAGE,
  API_FOOTBALL_INJURY_INTERNAL_INPUT,
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_LEGAL_STATE,
  API_FOOTBALL_LINEUP_INTERNAL_INPUT,
  API_FOOTBALL_PLAYER_DATA_ANALYSIS,
  API_FOOTBALL_PREDICTION_INPUT,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
  API_FOOTBALL_RAW_API_REDISTRIBUTION,
  API_FOOTBALL_RAW_INJURY_PUBLICATION,
  API_FOOTBALL_RAW_LINEUP_PUBLICATION,
  API_FOOTBALL_RAW_PLAYER_AVAILABILITY_PUBLICATION,
  API_FOOTBALL_RAW_RESALE,
  API_FOOTBALL_RAW_STORAGE,
  API_FOOTBALL_SCOPE_STATUSES,
  assertApiFootballLegalStateMatchesEvidence,
  LEGAL_BLOCK,
  LEGAL_CONDITIONAL,
  LEGAL_PASS,
  LEGAL_REVIEW_REQUIRED,
  loadApiFootballDerivedLineupInjuryLegalEvidence,
  NOT_REQUIRED_BY_PROVIDER,
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

function assertNoSecrets(text: string, label: string) {
  const lower = text.toLowerCase();
  for (const marker of SECRET_MARKERS) {
    assert.equal(lower.includes(marker.toLowerCase()), false, `${label}:${marker}`);
  }
}

test("1 LINEUP_INTERNAL_INPUT = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_LINEUP_INTERNAL_INPUT, LEGAL_PASS);
  assert.equal(API_FOOTBALL_PLAYER_DATA_ANALYSIS.lineupInternalInput, LEGAL_PASS);
});

test("2 INJURY_INTERNAL_INPUT = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_INJURY_INTERNAL_INPUT, LEGAL_PASS);
  assert.equal(API_FOOTBALL_PLAYER_DATA_ANALYSIS.injuryInternalInput, LEGAL_PASS);
});

test("3 AVAILABILITY_INTERNAL_INPUT = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_AVAILABILITY_INTERNAL_INPUT, LEGAL_PASS);
  assert.equal(
    API_FOOTBALL_PLAYER_DATA_ANALYSIS.availabilityInternalInput,
    LEGAL_PASS,
  );
});

test("4 DERIVED_ANALYSIS_GENERATION = LEGAL_PASS", () => {
  assert.equal(API_FOOTBALL_DERIVED_ANALYSIS_GENERATION, LEGAL_PASS);
  assert.equal(
    API_FOOTBALL_PLAYER_DATA_ANALYSIS.derivedAnalysisGeneration,
    LEGAL_PASS,
  );
});

test("5 DERIVED_ANALYSIS_PUBLIC_DISPLAY = LEGAL_CONDITIONAL", () => {
  assert.equal(API_FOOTBALL_DERIVED_ANALYSIS_PUBLIC_DISPLAY, LEGAL_CONDITIONAL);
  assert.equal(
    API_FOOTBALL_PLAYER_DATA_ANALYSIS.derivedAnalysisPublicDisplay,
    LEGAL_CONDITIONAL,
  );
});

test("6 RAW_LINEUP_PUBLICATION = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_RAW_LINEUP_PUBLICATION, LEGAL_REVIEW_REQUIRED);
});

test("7 RAW_INJURY_PUBLICATION = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_RAW_INJURY_PUBLICATION, LEGAL_REVIEW_REQUIRED);
});

test("8 RAW_PLAYER_AVAILABILITY_PUBLICATION = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(
    API_FOOTBALL_RAW_PLAYER_AVAILABILITY_PUBLICATION,
    LEGAL_REVIEW_REQUIRED,
  );
});

test("9 COMPETITION_THIRD_PARTY_RIGHTS = LEGAL_REVIEW_REQUIRED", () => {
  assert.equal(API_FOOTBALL_COMPETITION_THIRD_PARTY_RIGHTS, LEGAL_REVIEW_REQUIRED);
  assert.equal(
    API_FOOTBALL_PLAYER_DATA_ANALYSIS.competitionThirdPartyRights,
    LEGAL_REVIEW_REQUIRED,
  );
});

test("10 existing API-Football legal statuses unchanged", () => {
  assert.equal(API_FOOTBALL_LAUNCHD, LEGAL_PASS);
  assert.equal(API_FOOTBALL_RAW_STORAGE, LEGAL_CONDITIONAL);
  assert.equal(API_FOOTBALL_CACHE, LEGAL_CONDITIONAL);
  assert.equal(API_FOOTBALL_DERIVED_STORAGE, LEGAL_PASS);
  assert.equal(API_FOOTBALL_PREDICTION_INPUT, LEGAL_PASS);
  assert.equal(API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY, LEGAL_CONDITIONAL);
  assert.equal(API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS, LEGAL_CONDITIONAL);
  assert.equal(API_FOOTBALL_RAW_RESALE, LEGAL_BLOCK);
  assert.equal(API_FOOTBALL_RAW_API_REDISTRIBUTION, LEGAL_BLOCK);
  assert.equal(API_FOOTBALL_CUSTOMER_DATA_FEED, LEGAL_BLOCK);
  assert.equal(API_FOOTBALL_COMMERCIAL_USE, LEGAL_REVIEW_REQUIRED);
  assert.equal(API_FOOTBALL_ATTRIBUTION, NOT_REQUIRED_BY_PROVIDER);
  assert.equal(
    API_FOOTBALL_SCOPE_STATUSES.API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS,
    LEGAL_CONDITIONAL,
  );
  assert.equal(
    API_FOOTBALL_SCOPE_STATUSES.API_FOOTBALL_LINEUP_INTERNAL_INPUT,
    LEGAL_PASS,
  );
  assert.equal(
    API_FOOTBALL_LEGAL_STATE.playerDataAnalysis.rawLineupPublication,
    LEGAL_REVIEW_REQUIRED,
  );
});

test("11 no secret in evidence artifact", () => {
  const evidencePath = join(
    process.cwd(),
    API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL,
  );
  const text = readFileSync(evidencePath, "utf8");
  assertNoSecrets(text, "derived-evidence");
  const derived = loadApiFootballDerivedLineupInjuryLegalEvidence();
  assert.equal(derived.decisionDate, "2026-09-19");
  assert.equal(derived.provider, "API-SPORTS / API-Football");
  assertApiFootballLegalStateMatchesEvidence();
});

test("12 no Provider call", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    fetchCalls += 1;
    throw new Error("NETWORK_FORBIDDEN");
  }) as typeof fetch;
  try {
    loadApiFootballDerivedLineupInjuryLegalEvidence();
    assertApiFootballLegalStateMatchesEvidence();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});

test("13 no Public UI change", () => {
  const diff = execSync("git diff --name-only HEAD", {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  const paths = diff
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const p of paths) {
    assert.equal(
      p.startsWith("src/app/") ||
        p.startsWith("src/components/") ||
        p.includes("/ui/"),
      false,
      `unexpected UI path: ${p}`,
    );
  }
});

test("14 no Engine/research change", () => {
  const diff = execSync("git diff --name-only HEAD", {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  const paths = diff
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const p of paths) {
    const allowedResearchScope =
      p.includes("daily-scope-lock") ||
      p.includes("research-target-scope") ||
      p.includes("research-daily-scope-lock");
    const engineOrResearch =
      p.includes("/engine/") ||
      (p.includes("research") &&
        !p.includes("provider-legal-state") &&
        !allowedResearchScope) ||
      (p.includes("prediction") && !p.includes("provider-legal-state"));
    assert.equal(engineOrResearch, false, `unexpected engine/research path: ${p}`);
  }
});
