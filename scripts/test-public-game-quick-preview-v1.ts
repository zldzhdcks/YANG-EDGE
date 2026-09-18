/**
 * Public Game Quick Preview Minimal V1.
 * Presentation/read-model only. No provider / engine / prediction writes.
 *
 *   npm run test:public-game-quick-preview-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildAnalysisPath,
  sanitizeAnalysisPresentationIdentity,
} from "../src/lib/datetime/games-date";
import { applyListIdentityFallback } from "../src/lib/public-analysis/apply-list-identity";
import { publicCopyForCState } from "../src/lib/public-analysis/c-state-display";
import { finalizePublicAnalysisView } from "../src/lib/public-analysis/finalize-public-view";
import { loadPublicGameAnalysis } from "../src/lib/public-analysis/load-public-game-analysis";
import {
  isOfficialDailyCPrediction,
  projectDailyCRowToPublicView,
} from "../src/lib/public-analysis/project-daily-c-row";
import {
  legacyMigrationPublicView,
  unresolvedPublicView,
} from "../src/lib/public-analysis/project-fallbacks";
import { projectQuickPreview } from "../src/lib/public-analysis/project-quick-preview";
import {
  PUBLIC_FORBIDDEN_COPY,
  visiblePublicAnalysisCopy,
} from "../src/lib/public-analysis/visible-copy";
import type { DailyCGameRow } from "../src/lib/public-analysis/daily-c-types";
import PublicAnalysisViewer from "../src/components/analysis/public/PublicAnalysisViewer";
import {
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
} from "../src/lib/provider-legal-state";
import { loadFootballForwardEvidenceReadModel } from "../src/lib/football/forward-read-model-v1";

const ROOT = process.cwd();
const DATE = "2026-08-26";
const KBO_OWNER_ID = "kbo-ssg-landers-hanwha-eagles";
const LIST_IDENTITY = {
  sport: "football",
  league: "프리미어리그",
  homeTeam: "Manchester United",
  awayTeam: "Manchester City",
  startTime: "00:30",
};

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function publicAnalysisDirSource(): string {
  const dir = join(ROOT, "src/lib/public-analysis");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function sampleRow(overrides: Partial<DailyCGameRow> = {}): DailyCGameRow {
  return {
    operatorGameId: "KBO|2026-08-26|18:30|KBO|SSG|한화",
    sport: "KBO",
    rawLeagueLabel: "KBO",
    rawHome: "SSG",
    rawAway: "한화",
    canonicalHome: "SSG",
    canonicalAway: "한화",
    displayedStartKst: "18:30",
    displayedKickoffUtc: "2026-08-26T09:30:00.000Z",
    cState: "PASS_ENGINE_NOT_APPROVED",
    independentPrediction: {
      created: false,
      predictedSide: null,
      independentProbability: null,
      confidence: null,
    },
    marketBenchmark: {
      attached: false,
      marketBenchmarkOnly: true,
      source: null,
      observedAt: null,
      oddsHomeTeam: null,
      oddsAwayTeam: null,
      oddsBestHome: null,
      oddsBestDraw: null,
      oddsBestAway: null,
    },
    extraPublicGameIds: [],
    ...overrides,
  };
}

function officialRow(): DailyCGameRow {
  return sampleRow({
    cState: "PREDICTION",
    independentPrediction: {
      created: true,
      predictedSide: "HOME",
      independentProbability: 0.62,
      confidence: 0.7,
    },
  });
}

function previewText(view: { quickPreview: { sentences: string[] } }): string {
  return view.quickPreview.sentences.join("\n");
}

test("1 buildAnalysisPath without identity remains backward-compatible", () => {
  assert.equal(buildAnalysisPath("kbo-ssg-hanwha"), "/analysis/kbo-ssg-hanwha");
});

test("2 buildAnalysisPath carries fromDate", () => {
  assert.equal(
    buildAnalysisPath("kbo-ssg-hanwha", "2026-08-26"),
    "/analysis/kbo-ssg-hanwha?fromDate=2026-08-26",
  );
});

test("3 buildAnalysisPath safely encodes identity fields", () => {
  const path = buildAnalysisPath("la-liga-atletico-madrid-osasuna", "2026-09-19", {
    sport: "football",
    league: "라리가",
    homeTeam: "Atletico Madrid",
    awayTeam: "Osasuna",
    startTime: "02:00",
  });
  assert.match(path, /fromDate=2026-09-19/);
  assert.match(path, /homeTeam=Atletico(\+|%20)Madrid/);
  assert.match(path, /league=/);
  assert.equal(path.includes("externalId"), false);
});

test("4 GameCard passes existing GameData identity to AnalysisNavLink", () => {
  const src = readSrc("src/components/games/GameCard.tsx");
  assert.match(src, /homeTeam: game\.homeTeam/);
  assert.match(src, /awayTeam: game\.awayTeam/);
  assert.match(src, /league: game\.league/);
  assert.match(src, /sport: game\.sport/);
  assert.match(src, /startTime: game\.startTime/);
});

test("5 AnalysisNavLink passes identity to buildAnalysisPath", () => {
  const src = readSrc("src/components/analysis/AnalysisNavLink.tsx");
  assert.match(
    src,
    /buildAnalysisPath\(gameId, fromDate \?\? undefined, identity\)/,
  );
});

test("6 No externalId / externalProvider added to URL", () => {
  const path = buildAnalysisPath("x", "2026-08-26", LIST_IDENTITY);
  assert.equal(path.includes("externalId"), false);
  assert.equal(path.includes("externalProvider"), false);
  const card = readSrc("src/components/games/GameCard.tsx");
  const navBlock = card.slice(card.indexOf("<AnalysisNavLink"));
  assert.equal(navBlock.includes("externalId"), false);
  assert.equal(navBlock.includes("externalProvider"), false);
});

test("7 No odds/recommendation/research result added to URL", () => {
  const path = buildAnalysisPath("x", "2026-08-26", LIST_IDENTITY);
  assert.equal(/odds|recommendation|research/i.test(path), false);
  const nav = readSrc("src/components/analysis/AnalysisNavLink.tsx");
  assert.equal(nav.includes("odds"), false);
  assert.equal(nav.includes("recommendation"), false);
});

test("8-12 UNRESOLVED view with list metadata retains identity", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: "missing-fixture-for-preview",
    fromDate: DATE,
    listIdentity: LIST_IDENTITY,
  });
  assert.equal(result.resolution.source, "unresolved");
  assert.equal(result.view.game.homeTeam, "Manchester United");
  assert.equal(result.view.game.awayTeam, "Manchester City");
  assert.equal(result.view.game.league, "프리미어리그");
  assert.equal(result.view.game.sport, "football");
  assert.equal(result.view.game.startTimeKst, "00:30");
});

test("13 resolved Daily C identity is NOT overwritten by list metadata", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
    listIdentity: {
      homeTeam: "WRONG HOME",
      awayTeam: "WRONG AWAY",
      league: "WRONG LEAGUE",
      sport: "football",
      startTime: "99:99",
    },
  });
  assert.equal(result.resolution.source, "daily-c");
  assert.equal(result.view.game.homeTeam, "SSG");
  assert.equal(result.view.game.awayTeam, "한화");
  assert.equal(result.view.game.league, "KBO");
});

test("14 resolved legacy identity is NOT overwritten by list metadata", () => {
  const legacy = finalizePublicAnalysisView(
    {
      ...unresolvedPublicView("legacy-id", "2026-07-31"),
      game: {
        gameId: "legacy-id",
        dateKst: "2026-07-31",
        sport: "baseball",
        league: "KBO",
        startTimeKst: "18:30",
        homeTeam: "SSG",
        awayTeam: "한화",
      },
      analysis: {
        state: "OFFICIAL_PREDICTION_DEFERRED",
        headline: "공식 승패 분석 보류",
        description: "현재 검증을 마친 확률 모델이 없어 승패 확률은 제공하지 않습니다.",
        officialPredictionAvailable: false,
        predictedSide: null,
        probability: null,
        confidence: null,
      },
    },
    {
      homeTeam: "WRONG",
      awayTeam: "WRONG",
      league: "EPL",
    },
  );
  assert.equal(legacy.game.homeTeam, "SSG");
  assert.equal(legacy.game.awayTeam, "한화");
  assert.equal(legacy.game.league, "KBO");
});

test("15 list metadata is not used as Daily C lookup/join input", async () => {
  const loader = readSrc("src/lib/public-analysis/load-public-game-analysis.ts");
  assert.match(loader, /resolveDailyCRowByPublicGameId\(publicGameId, artifact\.games\)/);
  assert.equal(loader.includes("resolveDailyCRowByPublicGameId(listIdentity"), false);
  const result = await loadPublicGameAnalysis({
    publicGameId: "missing-fixture-for-preview",
    fromDate: DATE,
    listIdentity: {
      homeTeam: "SSG",
      awayTeam: "한화",
      league: "KBO",
    },
  });
  assert.equal(result.resolution.matched, false);
  assert.equal(result.resolution.operatorGameId, null);
  assert.equal(result.view.game.homeTeam, "SSG");
});

test("16 gameId reverse parsing is not introduced", () => {
  const source = [
    readSrc("src/lib/public-analysis/apply-list-identity.ts"),
    readSrc("src/lib/public-analysis/project-quick-preview.ts"),
    readSrc("src/lib/public-analysis/finalize-public-view.ts"),
    readSrc("src/lib/public-analysis/load-public-game-analysis.ts"),
  ].join("\n");
  assert.equal(source.includes("slugifyTeam"), false);
  assert.equal(/gameId\.split\(/.test(source), false);
  assert.equal(source.includes("reverse-parse"), false);
});

test("17 Quick Preview exists separately from analysis Prediction fields", () => {
  const preview = projectQuickPreview({
    homeTeam: "SSG",
    awayTeam: "한화",
    league: "KBO",
    startTimeKst: "18:30",
    state: "OFFICIAL_PREDICTION_DEFERRED",
    officialPredictionAvailable: false,
    identityBasis: "ANALYSIS_IDENTITY",
  });
  assert.equal("predictedSide" in preview, false);
  assert.equal("probability" in preview, false);
  assert.equal("confidence" in preview, false);
});

test("18-19 Preview has 2-4 sentences and names the matchup", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: "missing-fixture-for-preview",
    fromDate: DATE,
    listIdentity: LIST_IDENTITY,
  });
  const n = result.view.quickPreview.sentences.length;
  assert.ok(n >= 2 && n <= 4);
  assert.match(previewText(result.view), /Manchester United와 Manchester City/);
  assert.equal(result.view.quickPreview.basis, "LIST_METADATA");
});

test("20-25 Preview does not contain pick/probability/confidence/odds/edge/debug", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  const text = previewText(result.view);
  assert.equal(/\bHOME\b|\bAWAY\b|\bDRAW\b/.test(text), false);
  assert.equal(/\d\.\d{2}/.test(text), false);
  assert.equal(/odds|edge|confidence|Artifact|Pipeline|Provider/i.test(text), false);
  for (const forbidden of PUBLIC_FORBIDDEN_COPY) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test("26-27 LEGACY_MIGRATING public output has no migration wording", () => {
  const view = finalizePublicAnalysisView(
    legacyMigrationPublicView("x", DATE),
    LIST_IDENTITY,
  );
  const copy = `${previewText(view)}\n${view.analysis.headline}\n${view.analysis.description}`;
  assert.equal(copy.includes("새 분석 화면으로 이전 중"), false);
  assert.equal(copy.includes("옮겨지지 않았습니다"), false);
  assert.equal(view.analysis.state, "LEGACY_MIGRATING");
});

test("28 PREDICTION + created + side → official true", () => {
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "kbo-test",
      dateKst: DATE,
      row: officialRow(),
      recentForm: null,
      updatedAt: null,
    }),
  );
  assert.equal(isOfficialDailyCPrediction(officialRow()), true);
  assert.equal(view.analysis.officialPredictionAvailable, true);
  assert.equal(view.analysis.predictedSide, "HOME");
});

test("29 PASS_* + created=true → official false", () => {
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "kbo-test",
      dateKst: DATE,
      row: sampleRow({
        cState: "PASS_ENGINE_NOT_APPROVED",
        independentPrediction: {
          created: true,
          predictedSide: "HOME",
          independentProbability: 0.9,
          confidence: 0.9,
        },
      }),
      recentForm: null,
      updatedAt: null,
    }),
  );
  assert.equal(view.analysis.officialPredictionAvailable, false);
  assert.equal(view.analysis.predictedSide, null);
  assert.equal(view.analysis.probability, null);
  assert.equal(view.analysis.confidence, null);
});

test("30 PREDICTION + created=false → official false", () => {
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "kbo-test",
      dateKst: DATE,
      row: sampleRow({
        cState: "PREDICTION",
        independentPrediction: {
          created: false,
          predictedSide: "HOME",
          independentProbability: 0.6,
          confidence: 0.6,
        },
      }),
      recentForm: null,
      updatedAt: null,
    }),
  );
  assert.equal(view.analysis.officialPredictionAvailable, false);
});

test("31 PREDICTION + created=true + predictedSide=null → official false", () => {
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "kbo-test",
      dateKst: DATE,
      row: sampleRow({
        cState: "PREDICTION",
        independentPrediction: {
          created: true,
          predictedSide: null,
          independentProbability: 0.6,
          confidence: 0.6,
        },
      }),
      recentForm: null,
      updatedAt: null,
    }),
  );
  assert.equal(view.analysis.officialPredictionAvailable, false);
});

test("32 PASS state outputs null prediction fields", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  assert.equal(result.view.analysis.officialPredictionAvailable, false);
  assert.equal(result.view.analysis.predictedSide, null);
  assert.equal(result.view.analysis.probability, null);
  assert.equal(result.view.analysis.confidence, null);
});

test("33 PASS_COMPETITION_REVIEW_REQUIRED remains non-directional", () => {
  const copy = publicCopyForCState("PASS_COMPETITION_REVIEW_REQUIRED");
  assert.equal(copy.state, "ANALYSIS_PREPARING");
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "fb-test",
      dateKst: DATE,
      row: sampleRow({
        sport: "FOOTBALL",
        cState: "PASS_COMPETITION_REVIEW_REQUIRED",
        independentPrediction: {
          created: true,
          predictedSide: "HOME",
          independentProbability: 0.8,
          confidence: 0.8,
        },
      }),
      recentForm: null,
      updatedAt: null,
    }),
  );
  assert.equal(view.analysis.officialPredictionAvailable, false);
  assert.equal(view.analysis.predictedSide, null);
});

test("34 Core Judgment hidden when officialPredictionAvailable=false", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  const html = renderToStaticMarkup(
    createElement(PublicAnalysisViewer, {
      view: result.view,
      gamesBackHref: "/games",
    }),
  );
  assert.equal(html.includes("YANG EDGE 핵심 판단"), false);
  assert.match(html, /현재 분석 상태/);
});

test("35 Core Judgment visible when officialPredictionAvailable=true", () => {
  const view = finalizePublicAnalysisView(
    projectDailyCRowToPublicView({
      publicGameId: "kbo-test",
      dateKst: DATE,
      row: officialRow(),
      recentForm: null,
      updatedAt: null,
    }),
  );
  const html = renderToStaticMarkup(
    createElement(PublicAnalysisViewer, { view, gamesBackHref: "/games" }),
  );
  assert.match(html, /YANG EDGE 핵심 판단/);
  assert.match(html, /HOME/);
});

test("36 Analysis Status remains visible for PASS/unresolved", async () => {
  const unresolved = await loadPublicGameAnalysis({
    publicGameId: "missing-fixture-for-preview",
    fromDate: DATE,
    listIdentity: LIST_IDENTITY,
  });
  const html = renderToStaticMarkup(
    createElement(PublicAnalysisViewer, {
      view: unresolved.view,
      gamesBackHref: "/games",
    }),
  );
  assert.match(html, /현재 분석 상태/);
  assert.match(html, /빠른 경기 프리뷰/);
  assert.match(html, /Manchester United/);
});

test("37-38 No Provider/network in Quick Preview projector", () => {
  const src = readSrc("src/lib/public-analysis/project-quick-preview.ts");
  assert.equal(src.includes("api-football"), false);
  assert.equal(src.includes("the-odds-api"), false);
  assert.equal(src.includes("axios"), false);
  assert.equal(/\bfetch\s*\(/.test(src), false);
});

test("39-40 No postgame score/result or grade in preview path", () => {
  const src = [
    readSrc("src/lib/public-analysis/project-quick-preview.ts"),
    readSrc("src/lib/public-analysis/apply-list-identity.ts"),
    readSrc("src/lib/public-analysis/finalize-public-view.ts"),
  ].join("\n");
  assert.equal(src.includes("actualScore"), false);
  assert.equal(src.includes("gradeHash"), false);
  assert.equal(src.includes("actualClass"), false);
});

test("41-42 No Engine/model/weight/threshold change in this mission", () => {
  const src = publicAnalysisDirSource();
  assert.equal(src.includes("ENGINE_CHANGE_ALLOWED = true"), false);
});

test("43 Existing market block behavior remains", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  assert.ok(result.view.market);
  assert.equal(result.view.market!.marketBenchmarkOnly, true);
  const html = renderToStaticMarkup(
    createElement(PublicAnalysisViewer, {
      view: result.view,
      gamesBackHref: "/games",
    }),
  );
  assert.match(html, /시장 참고/);
  assert.equal(previewText(result.view).includes("2.57"), false);
});

test("44 Public analysis copy remains free of forbidden internals", async () => {
  const result = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  const copy = visiblePublicAnalysisCopy(result.view);
  for (const forbidden of PUBLIC_FORBIDDEN_COPY) {
    assert.equal(copy.includes(forbidden), false, forbidden);
  }
});

test("45 Football Forward Read Model regression PASS", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.gradedEvents.length, 15);
  assert.equal(model.integrity.oddsUsed, false);
});

test("46 API-Football Legal State regression PASS", () => {
  assert.equal(API_FOOTBALL_LAUNCHD, "LEGAL_PASS");
  assert.equal(API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY, "LEGAL_CONDITIONAL");
});

test("applyListIdentityFallback never fills dateKst from list", () => {
  const view = unresolvedPublicView("x", "2026-08-26");
  const next = applyListIdentityFallback(view, {
    ...LIST_IDENTITY,
  });
  assert.equal(next.game.dateKst, "2026-08-26");
});

test("empty identity query values are rejected", () => {
  const safe = sanitizeAnalysisPresentationIdentity({
    homeTeam: "  ",
    awayTeam: "",
    league: null,
  });
  assert.equal(safe, null);
});
