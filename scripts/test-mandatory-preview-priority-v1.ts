import test from "node:test";
import assert from "node:assert/strict";
import { resolvePreviewPriority, mandatoryPreviewContract } from "../src/lib/public-analysis/preview-priority";
import { finalizePublicAnalysisView } from "../src/lib/public-analysis/finalize-public-view";
import { unresolvedPublicView } from "../src/lib/public-analysis/project-fallbacks";

const city = { targetId: "synthetic-city", sport: "football", home: "Manchester City", away: "Other", matchKind: "OFFICIAL_FIRST_TEAM" as const };
test("City first-team official target requires preview, at home or away", () => {
  assert.equal(resolvePreviewPriority(city).PREVIEW_REQUIRED, true);
  assert.equal(resolvePreviewPriority({...city, home: city.away, away: city.home}).PREVIEW_REQUIRED, true);
});
test("City PASS still has limited preview without fabricated values", () => {
  const p = mandatoryPreviewContract({...city, predictionAvailable: false, predictionReason: "PASS_ENGINE_NOT_APPROVED", updatedAt: null})!;
  assert.equal(p.PREVIEW_STATUS, "LIMITED_PREVIEW");
  assert.equal(p.PREDICTION_STATUS, "UNAVAILABLE");
  assert.equal(p.PREVIEW_REQUIRED, true);
  assert.equal(p.LAST_UPDATED_AT, null);
  assert.equal(/probability|modelPick|xG/.test(JSON.stringify(p)), false);
});
test("special matchup applies without inventing a fixture date", () => {
  assert.equal(resolvePreviewPriority({...city, home: "Atlético de Madrid", away: "Real Madrid"}).PREVIEW_REQUIRED, true);
  assert.equal(resolvePreviewPriority({...city, home: "Real Madrid", away: "Atlético de Madrid"}).PREVIEW_REQUIRED, false);
});
test("unknown team, youth and friendlies retain normal policy", () => {
  for (const input of [{...city, home: "Other"}, {...city, home: "Manchester City U21"}, {...city, matchKind: "OTHER_SQUAD" as const}, {...city, matchKind: "FRIENDLY" as const}])
    assert.equal(resolvePreviewPriority(input).PREVIEW_REQUIRED, false);
});
test("manual target priority and extensible exact registry", () => {
  assert.equal(resolvePreviewPriority({...city, home: "Other", previewPriority: "MANDATORY"}).PREVIEW_REQUIRED, true);
  assert.equal(resolvePreviewPriority({...city, home: "Other"}, {teams: [], matches: [], targets: [city.targetId]}).PREVIEW_REQUIRED, true);
});
test("unknown squad classification retains preview but flags review", () => {
  const p = mandatoryPreviewContract({...city, matchKind: "UNKNOWN", predictionAvailable: false, predictionReason: "UNKNOWN", updatedAt: null})!;
  assert.equal(p.PREVIEW_STATUS, "PREVIEW_AWAITING_UPDATE");
});
test("public finalizer supplies body despite unavailable prediction; never changes prediction", () => {
  const view = unresolvedPublicView("synthetic-city", "2099-01-01");
  const p = finalizePublicAnalysisView(view, {sport: "football", homeTeam: "Manchester City", awayTeam: "Other"});
  assert.equal(p.quickPreview.available, true);
  assert.ok(p.quickPreview.sentences.length >= 2);
  assert.equal(p.quickPreview.priority?.PREVIEW_REQUIRED, true);
  assert.deepEqual(p.analysis, view.analysis);
});
