/** Synthetic tests only: no local historical archive reads or CLI execution. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {verifyCross,executeLeague,selectRegular,validateRegular,nameVariants,leagueProtocol,overall,report,CROSS_SHA,type ScopedMatch,type ExternalSpec} from './football-cross-league-backtest-v1-core';
import {eligibleHistory,validateProbability,sha,canonical} from './football-poisson-backtest-v1-core';
import {predictFootball} from '../src/lib/football/poisson-research-v1/index';
import {denyNetwork} from './run-football-poisson-chronological-backtest-v1';
// Import the real CLI graph to catch module-format failures without invoking its guarded main.
import './run-football-cross-league-backtest-v1';
const p=verifyCross(fs.readFileSync(new URL('../docs/FOOTBALL_POISSON_CROSS_LEAGUE_VALIDATION_V1.json',import.meta.url),'utf8'));
const day=86400000,T=Date.parse('2024-08-20T15:00:00.000Z');
function fixture(spec:ExternalSpec,id:number,season:number,kickoff:number,home=1,away=2):ScopedMatch {
  return {provider:'API_FOOTBALL',providerFixtureId:id,leagueId:spec.leagueId,leagueName:spec.name,season,kickoffUtc:new Date(kickoff).toISOString(),homeTeamId:home,awayTeamId:away,homeTeamName:`Team ${home}`,awayTeamName:`Team ${away}`,fixtureStatus:'FT',fullTimeHomeGoals:2,fullTimeAwayGoals:1,strictReplayEligible:false,resultCompletedAt:null,strictAsOfProvenance:'UNAVAILABLE',round:'Regular Season - 1'};
}
function synthetic(spec:ExternalSpec){const rows:ScopedMatch[]=[];const teams=spec.leagueId===78?18:20;let id=spec.leagueId*10000;for(const season of [2023,2024]){let n=0;for(let h=1;h<=teams;h++)for(let a=1;a<=teams;a++)if(h!==a){const r=fixture(spec,++id,season,Date.parse(`${season}-08-01T15:00:00.000Z`)+Math.floor(n/ (teams/2))*7*day,h,a);r.round=`Regular Season - ${Math.floor(n++/(teams/2))+1}`;rows.push(r);}}
  if(spec.leagueId===78)for(const season of [2023,2024])for(let i=0;i<2;i++){const r=fixture(spec,++id,season,T);r.round='Relegation Round';r.fixtureStatus=i?'PEN':'FT';Object.defineProperty(r,'fullTimeHomeGoals',{get(){throw Error('PLAYOFF_LABEL_READ');}});rows.push(r);}return rows;
}
test('protocol tampering rejected and model/temporal constants unchanged',()=>{
  assert.throws(()=>verifyCross(JSON.stringify({...p,temporal:{...p.temporal,resultLagMs:1}})),/PROTOCOL_HASH/);
  assert.deepEqual(p.model.policy,{minCompetitionMatches:30,minVenueMatches:5,priorMatches:5,lookbackDays:365,maxExpectedGoals:10});
  assert.equal(p.temporal.resultLagMs,172800000);
});
for(const spec of p.externalLeagues)test(`${spec.name}: exact targets, regular-only inputs, paired cohort and 30 bins`,()=>{
  const rows=synthetic(spec),selected=selectRegular(rows,spec);validateRegular(selected,spec);let calls=0;
  const r=executeLeague(rows,spec,p,text=>text,input=>{calls++;assert.equal(input.target.competitionId,String(spec.leagueId));assert.ok(input.history.every(h=>h.competitionId===String(spec.leagueId)));assert.ok(!input.history.some(h=>h.matchId===input.target.matchId));return predictFootball(input);});
  assert.equal(calls,spec.primaryTargets);assert.equal(r.records.length,spec.primaryTargets);assert.equal(r.poisson.calibration.length,30);assert.equal(r.comparator.calibration.length,30);assert.equal(r.comparator.count,r.poisson.count);
  assert.ok(r.records.every(x=>x.archiveSha256===spec.archiveSha256&&x.protocolSha256===CROSS_SHA));
  const playoffIds=rows.filter(x=>x.round==='Relegation Round').map(x=>x.providerFixtureId);assert.ok(r.records.every(x=>!playoffIds.includes(x.providerFixtureId)&&x.eligibleTrainingFixtureIds.every(id=>!playoffIds.includes(id))));
  const groups=new Map<string,string>();for(const x of r.records){const ids=JSON.stringify(x.eligibleTrainingFixtureIds);if(groups.has(x.kickoffUtc))assert.equal(ids,groups.get(x.kickoffUtc));groups.set(x.kickoffUtc,ids);}
});
test('cross-league and EPL input rejected, missing target count rejected',()=>{
  for(const spec of p.externalLeagues){const rows=synthetic(spec);assert.throws(()=>selectRegular([...rows,{...rows[0],leagueId:39}],spec),/CROSS_LEAGUE/);assert.throws(()=>selectRegular(rows.filter(r=>r.providerFixtureId!==rows[0].providerFixtureId),spec),/SCOPE_COUNT/);}
});
test('provider ID stays authoritative when display names vary; no rewriting',()=>{
  const spec=p.externalLeagues[0],rows=synthetic(spec);rows[0].homeTeamName='Team One';const before=JSON.stringify(rows);
  validateRegular(rows,spec);assert.equal(nameVariants(rows)[0].providerTeamId,1);assert.deepEqual(nameVariants(rows)[0].providerNames,['Team 1','Team One']);assert.equal(JSON.stringify(rows),before);
});
test('prediction persisted before labels, failed/tampered persistence stops join, PASS stays null',()=>{
  const spec={...p.externalLeagues[0],contextSeasons:[2024],regularSeasonCohort:1,primaryTargets:1};
  let saved=false;const r=fixture(spec,1,2024,T);Object.defineProperty(r,'fullTimeHomeGoals',{get(){assert.ok(saved,'LABEL_BEFORE_PERSISTENCE');return 1;}});
  assert.throws(()=>executeLeague([r],spec,p,()=>{throw Error('DISK_FAILURE');}),/DISK_FAILURE/);
  assert.throws(()=>executeLeague([r],spec,p,()=>'[]'),/PREDICTION_PERSISTENCE/);
  const result=executeLeague([r],spec,p,text=>{assert.doesNotMatch(text,/"actualClass"|"actualHomeGoals"|"resultObservedAt"/);saved=true;return text;},input=>{assert.deepEqual(Object.keys(input.target).sort(),['awayTeamId','competitionId','homeTeamId','kickoffAt','matchId']);return predictFootball(input);});
  assert.equal(result.records[0].status,'PASS');for(const k of ['pHome','pDraw','pAway','predictedClass','correct1X2'] as const)assert.equal(result.records[0][k],null);
});
test('48h strict and 365d inclusive boundaries retained',()=>{
  const spec=p.externalLeagues[0],lp=leagueProtocol(p,spec),target=fixture(spec,99,2024,T),c=T-1;
  const rows=[fixture(spec,1,2024,c-2*day),fixture(spec,2,2024,c-2*day-1),fixture(spec,3,2023,c-365*day),fixture(spec,4,2023,c-365*day-1),target,fixture(spec,5,2024,T+day)];
  assert.deepEqual(eligibleHistory(rows,target,lp).map(r=>r.providerFixtureId),[3,2]);
  assert.throws(()=>validateProbability([0.5,0.5,0.5],lp));assert.throws(()=>validateProbability([NaN,0,1],lp));
});
test('league execution order has no effect on synthetic outputs',()=>{
  const run=(reverse:boolean)=>{const specs=[...p.externalLeagues];if(reverse)specs.reverse();return Object.fromEntries(specs.map(original=>{const spec={...original,regularSeasonCohort:2,primaryTargets:1};const rows=[fixture(spec,1,2023,T-3*day),fixture(spec,2,2024,T)];return [spec.leagueId,sha(canonical(executeLeague(rows,spec,p,text=>text)))];}));};
  assert.deepEqual(run(false),run(true));
});
test('overall classification and comparison report do not auto-promote',()=>{
  const b={summary:{BACKTEST_CLASSIFICATION:'BASELINE_MEASURED'}};
  assert.equal(overall([b,b,b,b]),'ALL_BASELINES_MEASURED');assert.equal(overall([b]),'PARTIAL_BASELINE');assert.equal(overall([b,{summary:{BACKTEST_CLASSIFICATION:'INVALID'}}]),'INVALID');
  const spec={...p.externalLeagues[0],contextSeasons:[2024],regularSeasonCohort:1,primaryTargets:1};const r=executeLeague([fixture(spec,1,2024,T)],spec,p,text=>text);
  const text=report([r], 'synthetic-hash','PARTIAL_BASELINE');assert.match(text,/ComparatorLogLoss/);assert.match(text,/VALIDATED_MODEL=NO/);assert.match(text,/\[0.9,1\]/);
});
test('network guard records zero attempts for computation and denies fetch',()=>{
  const attempts=denyNetwork(),spec={...p.externalLeagues[0],contextSeasons:[2024],regularSeasonCohort:1,primaryTargets:1};executeLeague([fixture(spec,1,2024,T)],spec,p,text=>text);assert.equal(attempts(),0);assert.throws(()=>fetch('https://example.invalid'),/NETWORK_FORBIDDEN/);
});
