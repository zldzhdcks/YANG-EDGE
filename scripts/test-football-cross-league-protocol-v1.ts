/** Scope/protocol tests, no archive predictions or performance calculation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scope,eligibleMetadata,evaluationTargets,ordered,type ScopeRow} from './football-cross-league-scope-v1.ts';
import {canonical,hash} from './audit-football-cross-league-scope-v1.ts';
const read=(p:string)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const protocol=JSON.parse(read('docs/FOOTBALL_POISSON_CROSS_LEAGUE_VALIDATION_V1.json'));
const parent=JSON.parse(read('docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.json'));
const seal=JSON.parse(read('docs/FOOTBALL_POISSON_CROSS_LEAGUE_VALIDATION_V1.seal.json'));
const audit=JSON.parse(read('data/audits/football-cross-league-scope-v1.json'));
const T=Date.parse('2024-09-01T15:00:00Z'),day=86400000;
const row=(id:number,leagueId=78,time=T,round='Regular Season - 1',season=2024):ScopeRow=>({providerFixtureId:id,leagueId,kickoffUtc:new Date(time).toISOString(),round,season});
test('protocol, parent and scope evidence hashes verified',()=>{
  assert.equal(hash(canonical(protocol)),seal.protocolSha256);assert.equal(hash(canonical(parent)),protocol.parentProtocol.sha256);
  assert.equal(hash(canonical(audit)),protocol.scope.evidenceAuditCanonicalSha256);
  assert.equal(audit.totalExternalTargets,1066);
});
test('model sources, policy, all metrics and comparator unchanged',()=>{
  for(const [p,expected] of Object.entries(parent.model.sourceSha256))assert.equal(hash(read(p).replace(/\r\n/g,'\n')),expected);
  for(const key of ['model','temporal','output','metrics','calibration','comparator','classification'])assert.deepEqual(protocol[key],parent[key]);
  assert.equal(protocol.temporal.resultLagMs,172800000);assert.equal(protocol.temporal.cutoffOffsetMs,1);assert.equal(protocol.model.policy.lookbackDays,365);
});
test('Bundesliga inventory proves four retained playoffs and exact scope counts',()=>{
  const b=audit.leagues.find((l:{leagueId:number})=>l.leagueId===78);
  assert.equal(b.archiveCanonical,616);assert.equal(b.regularSeasonCohort,612);assert.equal(b.outOfScopeStage,4);
  assert.deepEqual(b.seasons.map((s:{regularSeasonCohort:number;outOfScopeStage:number})=>[s.regularSeasonCohort,s.outOfScopeStage]),[[306,2],[306,2]]);
  assert.equal(b.archiveSha256,'5ada547e57350befb660a44253a5c3f14c813a2e4c5423ad9f74ced3dd2c37c6');
});
test('stage exclusion independent of status and score; no record mutation',()=>{
  for(const status of ['FT','PEN','AET','NS'])for(const goals of [null,0,9]){
    const r={...row(1,78,T,'Relegation Round'),status,goals};const before=JSON.stringify(r);
    assert.equal(scope(r),'OUT_OF_SCOPE_STAGE');assert.equal(JSON.stringify(r),before);
    assert.equal(scope({...r,round:'Regular Season - 1'}),'IN_SCOPE');
  }
  assert.throws(()=>scope(row(1,78,T,'Relegation round')),/UNKNOWN_STAGE/);
  assert.throws(()=>scope(row(1,78,T,'Regular Season - 35')),/UNKNOWN_STAGE/);
});
for(const league of [140,135,78])test(`${league} uses only same-league regular history, never EPL`,()=>{
  const pool=[39,140,135,78].map((l,i)=>row(i+1,l,T-4*day));pool.push(row(5,78,T-5*day,'Relegation Round'));
  const actual=eligibleMetadata(pool,row(99,league));assert.deepEqual(actual.map(r=>r.leagueId),[league]);
  assert.equal(eligibleMetadata([row(1,39,T-4*day)],row(99,league)).length,0);
});
test('strict 48h, inclusive 365d, no target/self or same kickoff leakage',()=>{
  const c=T-1,history=[row(1,78,c-2*day),row(2,78,c-2*day-1),row(3,78,c-365*day,'Regular Season - 1',2023),row(4,78,c-365*day-1,'Regular Season - 1',2023),row(5),row(6,78,T+day),row(99)];
  assert.deepEqual(eligibleMetadata(history,row(99)).map(r=>r.providerFixtureId),[3,2]);
  assert.deepEqual(eligibleMetadata(history,row(100)),eligibleMetadata(history,row(99)));
});
test('2024 targets sorted deterministically; playoffs cannot enter target cohort',()=>{
  const rows=[row(10),row(2),row(3,78,T,'Relegation Round'),row(4,78,T,'Regular Season - 1',2023)];
  assert.deepEqual(evaluationTargets(rows,78).map(r=>r.providerFixtureId),[2,10]);
  assert.deepEqual(evaluationTargets([...rows].reverse(),78),evaluationTargets(rows,78));
  assert.deepEqual(ordered([row(10),row(2)]).map(r=>r.providerFixtureId),[2,10]);
  assert.deepEqual(protocol.externalLeagues.map((l:{primaryTargets:number})=>l.primaryTargets),[380,380,306]);
});
test('no external backtest/predictor/network/market dependency in scope modules',()=>{
  const source=read('scripts/football-cross-league-scope-v1.ts')+read('scripts/audit-football-cross-league-scope-v1.ts');
  assert.doesNotMatch(source,/\bpredictFootball\s*\(|\bfetch\s*\(|from ['"].*(?:poisson-research|odds-1x2|backtest-v1-core)/);
  for(const field of ['BACKTEST_EXECUTED','CROSS_LEAGUE_POOLING','ODDS_USED','PROVIDER_PREDICTION_USED','ENGINE_CHANGED','WEIGHTS_CHANGED','STRICT_REPLAY'])assert.equal(protocol.governance[field],false);
  assert.equal(protocol.reporting.VALIDATED_MODEL,false);assert.equal(protocol.researchQuestions.length,5);
});
