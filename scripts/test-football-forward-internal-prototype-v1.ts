/**
 * Official Forward internal prototype card v1.
 * Render/static inspection only. Zero live Provider calls.
 *
 *   npm run test:football-forward-internal-prototype-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NAV_ITEMS, FOOTER_NAV_ITEMS } from "../src/constants/navigation";
import { loadFootballForwardEvidenceReadModel } from "../src/lib/football/forward-read-model-v1";
import {
  FORWARD_EVENT_ORDER,
  FORWARD_INTERNAL_ROUTE,
  formatResearchPercent,
  loadOfficialForwardInternalPage,
  orderOfficialForwardEvents,
} from "../src/lib/football/forward-internal-prototype-v1";
import {
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
} from "../src/lib/provider-legal-state";
import FootballForwardResearchDashboard from "../src/components/internal/football/forward/FootballForwardResearchDashboard";
import FootballForwardErrorState from "../src/components/internal/football/forward/FootballForwardErrorState";

const ROOT = process.cwd();
const MISSION_DIRS = [
  "src/app/internal/football/forward",
  "src/components/internal/football/forward",
  "src/lib/football/forward-internal-prototype-v1",
];
const PUBLIC_SURFACE_FILES = [
  "src/constants/navigation.ts",
  "src/components/layout/Header.tsx",
  "src/components/layout/Footer.tsx",
  "src/app/games/page.tsx",
  "src/app/api/football/fixtures/route.ts",
];

function readMissionSource(): string {
  const chunks: string[] = [];
  for (const dir of MISSION_DIRS) {
    const abs = join(ROOT, dir);
    for (const name of readdirSync(abs)) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        chunks.push(readFileSync(join(abs, name), "utf8"));
      }
    }
  }
  return chunks.join("\n");
}

function renderDashboard() {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  return { model, html };
}

test("1 Official Forward read model renders summary", () => {
  const { model, html } = renderDashboard();
  assert.ok(html.includes("Official Forward Football Research"));
  assert.ok(html.includes("Research evidence / pregame-sealed evaluation"));
  assert.ok(html.includes("OFFICIAL FORWARD"));
  assert.equal(model.schemaVersion, "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1");
});

test("2 modelVersion visible", () => {
  const { model, html } = renderDashboard();
  assert.ok(html.includes(model.model.version));
  assert.ok(html.includes("football-poisson-research-v1"));
});

test("3 N / target N derives from model, not hardcoded", () => {
  const { model, html } = renderDashboard();
  const source = readFileSync(
    join(ROOT, "src/components/internal/football/forward/FootballForwardResearchDashboard.tsx"),
    "utf8",
  );
  assert.equal(source.includes("15 / 25"), false);
  assert.ok(html.includes(`${model.checkpoint.currentN} / ${model.checkpoint.targetN}`));
  assert.ok(html.includes(`N=${model.checkpoint.currentN} / ${model.checkpoint.targetN}`));
});

test("4 accuracy derives from model", () => {
  const { model, html } = renderDashboard();
  const expected = formatResearchPercent(model.sample.accuracy);
  assert.ok(html.includes(expected));
  assert.ok(html.includes(`${model.sample.correct} / ${model.sample.totalGraded}`));
});

test("5 all gradedEvents rendered", () => {
  const { model, html } = renderDashboard();
  assert.equal(model.gradedEvents.length, 15);
  for (const event of model.gradedEvents) {
    assert.ok(
      html.includes(`data-forward-event="${event.fixtureId}"`),
      String(event.fixtureId),
    );
  }
});

test("6 resolved identity displays names", () => {
  const { model, html } = renderDashboard();
  const resolved = model.gradedEvents.find((e) => e.identityStatus === "RESOLVED");
  assert.ok(resolved);
  assert.ok(resolved.homeTeam);
  assert.ok(resolved.awayTeam);
  assert.ok(html.includes(`${resolved.homeTeam} vs ${resolved.awayTeam}`));
  assert.ok(html.includes(resolved.league ?? ""));
});

test("7 UNRESOLVED identity retains event and displays fixtureId", () => {
  const { model, html } = renderDashboard();
  const unresolved = model.gradedEvents.filter((e) => e.identityStatus === "UNRESOLVED");
  assert.ok(unresolved.length > 0);
  for (const event of unresolved) {
    assert.ok(html.includes(`data-forward-event="${event.fixtureId}"`));
    assert.ok(html.includes(`Fixture #${event.fixtureId}`));
  }
  assert.ok(html.includes("팀 정보 미해결"));
});

test("8 HOME/DRAW/AWAY probabilities display correctly", () => {
  const { model, html } = renderDashboard();
  assert.ok(html.includes(">HOME<"));
  assert.ok(html.includes(">DRAW<"));
  assert.ok(html.includes(">AWAY<"));
  const sample = model.gradedEvents[0];
  assert.ok(html.includes(formatResearchPercent(sample.probabilities.home)));
});

test("9 predictedClass displays", () => {
  const { model, html } = renderDashboard();
  for (const event of model.gradedEvents) {
    assert.ok(html.includes(`data-forward-predicted="${event.predictedClass}"`));
    assert.ok(html.includes(`예측 ${event.predictedClass}`));
  }
});

test("10 actualClass displays", () => {
  const { model, html } = renderDashboard();
  for (const event of model.gradedEvents) {
    assert.ok(html.includes(`data-forward-actual="${event.actualClass}"`));
    assert.ok(html.includes(`실제 결과 ${event.actualClass}`));
  }
});

test("11 correct event displays correct state", () => {
  const { model, html } = renderDashboard();
  const correct = model.gradedEvents.find((e) => e.correct);
  assert.ok(correct);
  assert.ok(
    html.includes(
      `data-forward-event="${correct.fixtureId}"`,
    ),
  );
  assert.ok(html.includes("정답"));
  assert.match(html, new RegExp(`data-forward-event="${correct.fixtureId}"[^>]*data-forward-correct="true"`));
});

test("12 incorrect event displays incorrect state", () => {
  const { model, html } = renderDashboard();
  const wrong = model.gradedEvents.find((e) => !e.correct);
  assert.ok(wrong);
  assert.ok(html.includes("오답"));
  assert.match(
    html,
    new RegExp(`data-forward-event="${wrong.fixtureId}"[^>]*data-forward-correct="false"`),
  );
});

test("13 sampleInsufficient visibly represented", () => {
  const { model, html } = renderDashboard();
  assert.equal(model.sample.sampleInsufficient, true);
  assert.ok(html.includes("EARLY DESCRIPTIVE ONLY"));
  assert.ok(html.includes("표본 부족"));
  assert.ok(html.includes('data-forward-sample-insufficient="true"'));
});

test("14 engineChangeAllowed=false visibly represented", () => {
  const { model, html } = renderDashboard();
  assert.equal(model.checkpoint.engineChangeAllowed, false);
  assert.ok(html.includes("engineChangeAllowed=false"));
  assert.ok(html.includes('data-engine-change-allowed="false"'));
});

test("15 ODDS_ROLE=OBSERVATION_ONLY visible", () => {
  const { html } = renderDashboard();
  assert.ok(html.includes("Observation only"));
  assert.ok(html.includes("OBSERVATION_ONLY"));
});

test("16 providerPredictionUsed=false visible", () => {
  const { html } = renderDashboard();
  assert.ok(html.includes("Provider prediction used"));
  assert.ok(html.includes('data-forward-fact="provider-prediction"'));
  assert.match(html, /data-forward-fact="provider-prediction"[^>]*>No</);
});

test("17 no mock fallback", () => {
  assert.throws(() =>
    loadFootballForwardEvidenceReadModel({
      evalRel: "data/audits/football-forward-cumulative-evaluation-MISSING-v1.json",
      identityIndex: new Map(),
    }),
  );
  const html = renderToStaticMarkup(
    createElement(FootballForwardErrorState, { code: "FORWARD_EVAL_MISSING" }),
  );
  assert.ok(html.includes("Official Forward evidence unavailable"));
  assert.ok(html.includes("FORWARD_EVAL_MISSING"));
  assert.equal(html.includes("data-forward-event"), false);
  assert.equal(html.toLowerCase().includes("mock"), false);
  const page = loadOfficialForwardInternalPage;
  assert.equal(typeof page, "function");
});

test("18 no R1 fallback", () => {
  const { html } = renderDashboard();
  const source = readMissionSource();
  for (const forbidden of [
    "v31-internal-research-console",
    "loadResearchConsole",
    "FootballV31ResearchConsoleView",
    "/internal/football/research",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/\bR1\b/.test(html), false);
  assert.equal(html.includes("V3.1"), false);
  const errorHtml = renderToStaticMarkup(
    createElement(FootballForwardErrorState, { code: "FORWARD_EVAL_MISSING" }),
  );
  assert.equal(/\bR1\b/.test(errorHtml), false);
});

test("19 new route has noindex/no-follow metadata", () => {
  const page = readFileSync(
    join(ROOT, "src/app/internal/football/forward/page.tsx"),
    "utf8",
  );
  assert.ok(page.includes("index: false"));
  assert.ok(page.includes("follow: false"));
  assert.equal(FORWARD_INTERNAL_ROUTE, "/internal/football/forward");
});

test("20 no new public navigation entry", () => {
  assert.equal(
    NAV_ITEMS.some((item) => item.href.includes("/internal/football/forward")),
    false,
  );
  assert.equal(
    FOOTER_NAV_ITEMS.some((item) => item.href.includes("/internal/football/forward")),
    false,
  );
  for (const rel of PUBLIC_SURFACE_FILES) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    assert.equal(text.includes("/internal/football/forward"), false, rel);
  }
});

test("21 no Provider/network import in mission UI files", () => {
  const source = readMissionSource();
  for (const forbidden of [
    'from "../api-football-provider"',
    'from "@/lib/football/api-football-provider"',
    "get-football-provider",
    "the-odds-api",
    "axios",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
});

test("22 no logo/image asset added", () => {
  const source = readMissionSource();
  assert.equal(source.includes("next/image"), false);
  assert.equal(/<img\b/.test(source), false);
  assert.equal(/\.(png|jpe?g|gif|webp|svg)/i.test(source), false);
});

test("23 mobile-compatible structural classes present", () => {
  const source = readMissionSource();
  assert.ok(source.includes("sm:grid-cols-3"));
  assert.ok(source.includes("flex-wrap"));
  assert.ok(source.includes("min-w-0"));
  assert.ok(source.includes("break-words") || source.includes("break-all"));
});

test("24 Read Model regression still PASS", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.gradedEvents.length, 15);
  assert.equal(model.checkpoint.currentN, model.sample.totalGraded);
  assert.equal(FORWARD_EVENT_ORDER, "kickoffUtc_desc_fixtureId_desc");
  const ordered = orderOfficialForwardEvents(model.gradedEvents);
  for (let i = 1; i < ordered.length; i++) {
    const prev = Date.parse(ordered[i - 1].kickoffUtc);
    const next = Date.parse(ordered[i].kickoffUtc);
    assert.ok(prev >= next);
  }
});

test("25 Provider Legal State regression still PASS", () => {
  assert.equal(API_FOOTBALL_LAUNCHD, "LEGAL_PASS");
  assert.equal(API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY, "LEGAL_CONDITIONAL");
});
