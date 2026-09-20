import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadResearchExplorer } from '../src/lib/public-analysis/load-research-explorer';
import { exactProbabilityIdentity, loadProbabilityIdentities, canonicalProbability, applyCanonicalProbabilities } from '../src/lib/public-analysis/canonical-research-probability';
import { canonicalForFixture, officialInventory, digest } from '../src/lib/football/official-canonical-v1';
import ResearchExplorer from '../src/components/research/ResearchExplorer';
import ResearchHome from '../src/components/research/ResearchHome';
import UniversalResearch from '../src/components/research/UniversalResearch';
process.env.YANG_EDGE_OWNER_PREVIEW = '1';
const audit = JSON.parse(readFileSync('data/audits/2026-09-20-v1-pregame-probability-coverage-v1.json', 'utf8'));
const data = loadResearchExplorer(audit.batch, audit.date);
const evidence = loadProbabilityIdentities(process.cwd(), data.scopeHash);

test('31 targets partition exactly once; no eligible fixture silently skipped', () => {
  assert.equal(audit.rows.length, 31); assert.equal(new Set(audit.rows.map((r: any) => r.targetId)).size, 31);
  assert.equal(Object.values(audit.counts).reduce((n: number, v: any) => n + v, 0), 31);
  assert.equal(audit.counts.ELIGIBLE_TO_GENERATE, 0); assert.equal(audit.generated, 0);
  for (const r of audit.rows) {
    assert(r.eligibilityReason); assert.equal(r.newPredictionCreated, false);
    if (r.eligibilityStatus === 'KICKOFF_ALREADY_PASSED') assert(Date.parse(r.checkedAt) >= Date.parse(r.kickoff));
    if (r.eligibilityStatus !== 'EXISTING_CANONICAL') for (const k of ['homeProbability', 'drawProbability', 'awayProbability']) assert.equal(r[k], null);
  }
});

test('all protected snapshots, PASS, inputs, receipts and V4 manifests stay byte-identical', () => {
  for (const [file, hash] of Object.entries(audit.protectedFiles)) assert.equal(digest(readFileSync(file)), hash, file);
  assert.deepEqual(officialInventory(process.cwd()).counts, audit.globalCanonicalCounts);
  assert.equal(audit.v4.reservedBudgetUsed, 0);
});

test('seven product probabilities are exact global canonical values; no pick or tier promotion', () => {
  assert.equal(data.lines.length, 50); assert.equal(data.lines.filter(l => l.probability).length, 7);
  assert.equal(data.lines.filter(l => l.sport === 'SOCCER' && l.tier === 'STANDARD').length, 17);
  assert.equal(data.lines.filter(l => l.sport === 'SOCCER' && l.tier === 'BASIC').length, 14);
  for (const l of data.lines) {
    assert.equal(l.pick, null);
    if (!l.probability) continue;
    const row = audit.rows.find((r: any) => r.targetId === l.targetId);
    const selected = canonicalForFixture(process.cwd(), row.providerFixtureId)!;
    assert.equal(selected.predictionId, row.canonicalPredictionId);
    assert.deepEqual(l.probability, { home: row.homeProbability, draw: row.drawProbability, away: row.awayProbability });
    assert.equal(l.engineAsOf, selected.createdAt);
    assert(Math.abs(l.probability.home + l.probability.draw + l.probability.away - 1) < 1e-10);
  }
});

test('identity reversal, kickoff drift, ambiguous metadata and invalid mass reject', () => {
  const l = data.lines.find(l => l.targetId === 'BETMAN-20260920-84')!;
  assert.throws(() => exactProbabilityIdentity({ ...l, home: l.away, away: l.home }, evidence));
  assert.throws(() => exactProbabilityIdentity({ ...l, kickoff: '2026-09-21T22:00:00+09:00' }, evidence));
  const identity = exactProbabilityIdentity(l, evidence).identity!;
  const selected = canonicalForFixture(process.cwd(), identity.fixtureId)!;
  assert.throws(() => canonicalProbability({ ...identity, awayId: 99999 }, selected));
  assert.throws(() => canonicalProbability(identity, { ...selected, classification: 'DUPLICATE_NONCANONICAL' }));
  assert.throws(() => canonicalProbability(identity, { ...selected, snapshot: { payload: { pHome: .9, pDraw: .9, pAway: .9 } } }), /MASS/);
});

test('unresolved identities and existing sealed PASS never receive probabilities', () => {
  for (const r of audit.rows.filter((r: any) => r.eligibilityStatus !== 'EXISTING_CANONICAL')) assert.equal(data.lines.find(l => l.targetId === r.targetId)!.probability, null);
  const passes = audit.rows.filter((r: any) => r.existingPass);
  assert.equal(passes.length, 2);
  assert(passes.some((r: any) => r.existingPass.reasons.includes('INSUFFICIENT_AWAY_HISTORY')));
  assert(passes.some((r: any) => r.existingPass.reasons.includes('INSUFFICIENT_HOME_HISTORY')));
});

test('projection cannot read result/live/postgame fields or generate a prediction', () => {
  const lines = structuredClone(data.lines);
  for (const l of lines) for (const key of ['result', 'actualScore', 'live', 'postgame']) Object.defineProperty(l, key, { get() { throw Error('FORBIDDEN_TARGET_ACCESS'); } });
  applyCanonicalProbabilities(lines, process.cwd(), data.scopeHash);
  assert.equal(lines.filter(l => l.probability).length, 7);
  const source = readFileSync('src/lib/public-analysis/canonical-research-probability.ts', 'utf8');
  for (const bad of ['fetch(', 'predictFootball(', 'freeze(', 'writeFileSync', 'postgame/']) assert(!source.includes(bad));
});

test('Explorer, detail and homepage dynamically display linked probabilities with no research loss', () => {
  const explorer = renderToStaticMarkup(createElement(ResearchExplorer, { lines: data.lines, batch: data.batch, date: data.date }));
  assert.equal((explorer.match(/data-research-line=/g) ?? []).length, 50);
  assert(explorer.includes('모델 확률 준비 전'));
  for (const d of data.details.filter(d => d.line.probability)) {
    const value = (d.line.probability!.home * 100).toFixed(2) + '%';
    assert(explorer.includes(value));
    const detail = renderToStaticMarkup(createElement(UniversalResearch, { detail: d }));
    assert(detail.includes(value)); assert(detail.includes('공식 선택 의견: 없음'));
    assert(!d.depth?.summary.join(' ').includes('공식 V1 확률은 제공되지'));
  }
  const home = renderToStaticMarkup(createElement(ResearchHome, { data }));
  assert(home.includes('data-dashboard-preview="BETMAN-20260920-84"'));
  const p = data.lines.find(l => l.targetId === 'BETMAN-20260920-84')!.probability!;
  assert(home.includes((p.home * 100).toFixed(2) + '%'));
});
