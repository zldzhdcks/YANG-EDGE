import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadResearchExplorer } from '../src/lib/public-analysis/load-research-explorer';
import { dashboardView } from '../src/components/research/dashboard-view';
import ResearchHome from '../src/components/research/ResearchHome';
import { NAV_ITEMS } from '../src/constants/navigation';

process.env.YANG_EDGE_OWNER_PREVIEW = '1';
const data = loadResearchExplorer('round-111-odds-new-v1', '2026-09-20');
const render = (value = data) => renderToStaticMarkup(createElement(ResearchHome, { data: value }));
const html = render();
const text = html.replace(/<[^>]*>/g, '');

test('dashboard counts come from admitted lines and original scope denominator', () => {
  const v = dashboardView(data);
  assert.equal(v.covered, 50); assert.equal(data.total, 50);
  assert.deepEqual(v.sports.map(s => s.value), [31, 11, 3, 5]);
  assert.equal(v.standard, 17); assert.equal(v.basic, 14); assert.equal(v.full, 0);
  const subset = { ...data, date: '2026-09-21', total: 3, lines: [data.lines[0]], details: [data.details[0]] };
  assert.equal(dashboardView(subset).covered, 1);
  const output = render(subset);
  assert(output.includes('전체 3경기 보기')); assert(output.includes('1 / 3'));
  assert(output.includes('2026-09-21')); assert(!output.includes('전체 50경기 보기'));
});

test('eight-section information architecture puts optional pick near the bottom', () => {
  assert.deepEqual([...html.matchAll(/data-dashboard-section="([^"]+)"/g)].map(m => m[1]), ['hero', 'today', 'featured', 'explorer', 'engine', 'coverage', 'pick', 'disclosure']);
  assert.equal((html.match(/data-dashboard-preview=/g) ?? []).length, 8);
  assert(html.indexOf('데이터 기반 스포츠 리서치') < html.indexOf('OPTIONAL PICK'));
});

test('both featured targets preserve canonical values and their identities', () => {
  const featured = dashboardView(data).featured;
  assert.deepEqual(featured.map(d => d.line.targetId), ['BETMAN-20260920-91', 'BETMAN-20260920-86']);
  assert.deepEqual(featured.map(d => d.preview!.fixtureId), [1570394, 1557413]);
  for (const p of ['42.20%', '25.79%', '32.01%', '72.36%', '18.07%', '9.57%']) assert(text.includes(p));
  assert(text.includes('YANG EDGE Model Probability'));
});

test('missing probabilities, teams and timestamps cannot be filled with featured constants', () => {
  const missing = { ...data, lines: data.lines.map(l => ({ ...l, probability: null })), details: data.details.map(d => ({ ...d, preview: null, line: { ...d.line, probability: null, engineAsOf: null, previewAsOf: null } })) };
  const output = render(missing).replace(/<[^>]*>/g, '');
  assert(output.includes('모델 확률 준비 전')); assert(output.includes('확인 중'));
  assert(!output.includes('%')); assert(!output.includes('Atletico Madrid'));
});

test('presentation does not mutate input, re-tier, rank by probability or drop the full denominator', () => {
  const before = JSON.stringify(data);
  const preview = dashboardView(data).preview;
  const inverse = { ...data, lines: data.lines.map(l => ({ ...l, probability: { home: 0, draw: 0, away: 1 } })) };
  assert.deepEqual(dashboardView(inverse).preview.map(l => l.targetId), preview.map(l => l.targetId));
  render(); assert.equal(JSON.stringify(data), before);
  for (const l of preview) assert.equal(l, data.lines.find(row => row.targetId === l.targetId));
});

test('homepage engine research conveys official baseline, closed unpromoted research and unimplemented V4', () => {
  for (const copy of ['Official Baseline', 'V3 / V3.1', 'xG', 'Total Shots', 'Shots on Goal', '승격 기준을 충족하지 않아', 'V4 엔진은 미구현', '현재 공식 확률에는 반영되지 않습니다.']) assert(text.includes(copy));
  for (const raw of ['MODEL_STATUS=', 'ENGINE_AS_OF', 'PREVIEW_AS_OF', 'PLAYER_CONTEXT', 'NOT_AVAILABLE', 'NOT_IMPLEMENTED', 'NOT_PROMOTED']) assert(!text.includes(raw));
  for (const bad of ['Best Bet', '필승', '추천 베팅', '돈 되는 경기', '강승부', '안전한 경기']) assert(!text.includes(bad));
  assert(text.includes('최종 판단은 이용자에게 있습니다.'));
});

test('navigation and every research link preserve explicit batch and date with real anchors', () => {
  assert.deepEqual(NAV_ITEMS.map(n => n.label), ['오늘의 리서치', 'Research Explorer', 'Engine Research', '내 가계부']);
  assert(html.includes('id="engine-research"'));
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    assert(href.startsWith('/research')); assert(href.includes('batch=round-111-odds-new-v1')); assert(href.includes('date=2026-09-20'));
  }
});

test('renderer never inspects target outcome or live fields', () => {
  const guarded = { ...data, lines: data.lines.map(l => ({ ...l })) };
  for (const l of guarded.lines) for (const key of ['result', 'actualScore', 'postgame', 'live']) Object.defineProperty(l, key, { get() { throw Error('FORBIDDEN_TARGET_FIELD'); } });
  assert(render(guarded).includes('오늘의 리서치'));
});
