import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import * as h1 from '../h1-dixon-coles-v1';
import * as h2 from '../h2-ridge-rates-v1';
import * as h3 from '../h3-temperature-v1';
import * as e1 from './h1-dixon-coles-v1';
import * as e2 from './h2-ridge-rates-v1';
import * as e3 from './h3-temperature-v1';
import {validateTarget,validateEvaluationTarget,validateDevelopmentPool,validateHistory,eligible,DAY,type Target,type Match,type Prob,type Prediction} from './contracts-evaluation-v1';
import {equivalence,verifyDevelopment,root,code} from './evidence-evaluation-v1';
import {causalHistory,archiveTargets,finalDevelopmentExamples,checkCohort,idsHash} from './run-evaluation-v1';
import {evaluateLeague,guards,aggregateScreen,metrics} from './evaluator-evaluation-v1';
const time=Date.parse('2024-12-20T12:00:00.000Z');
const target:Target={fixtureId:999,leagueId:39,season:2024,kickoffUtc:new Date(time).toISOString(),homeTeamId:1,awayTeamId:2};
const history=():Match[]=>Array.from({length:60},(_,i)=>({fixtureId:i+1,leagueId:39,season:2023,kickoffUtc:new Date(time-365*DAY-(i+3)*DAY).toISOString(),homeTeamId:i%2?2:1,awayTeamId:i%2?1:2,homeGoals:i%3===0?0:2,awayGoals:i%4===0?0:1}));
const current=()=>history().map((r,i)=>({...r,season:2024,kickoffUtc:new Date(time-(i+3)*DAY).toISOString()}));
test('normalized candidates/numerics/adapter exactly equal frozen source; Development hashes unchanged',()=>{assert.equal(equivalence().normalizedSourceExact,true);verifyDevelopment();});
test('2023 development and 2024 evaluation accepted; 2025 rejected; final fit excludes evaluation population',()=>{
  validateTarget({...target,season:2023});validateDevelopmentPool(history());validateEvaluationTarget(target);
  assert.throws(()=>validateTarget({...target,season:2025}),/SEASON/);assert.throws(()=>validateEvaluationTarget({...target,season:2023}),/SEASON/);
  assert.throws(()=>validateDevelopmentPool(current()),/DEVELOPMENT_FIT/);assert.throws(()=>finalDevelopmentExamples(current(),time),/DEVELOPMENT_FIT/);
});
test('48-hour strict boundary and 365-day inclusive lower bound',()=>{
  const cutoff=time-1;const make=(id:number,t:number)=>({...current()[0],fixtureId:id,kickoffUtc:new Date(t).toISOString()});
  const rows=[make(1,cutoff-2*DAY),make(2,cutoff-2*DAY-1),make(3,cutoff-365*DAY),make(4,cutoff-365*DAY-1)];
  assert.deepEqual(eligible(rows,target).map(r=>r.fixtureId),[3,2]);
  assert.throws(()=>validateHistory(target,[rows[0]]),/LEAKAGE/);assert.throws(()=>validateHistory(target,[rows[3]]),/LEAKAGE/);
});
test('future/target/league results rejected and not read during causal selection',()=>{
  const good=current()[0],bad=[{...good,...target},{...good,fixtureId:201,kickoffUtc:new Date(time+DAY).toISOString()},{...good,fixtureId:202,leagueId:140}];
  for(const r of bad)assert.throws(()=>validateHistory(target,[r]),/LEAKAGE/);
  const picked=causalHistory(target,[good,...bad],t=>{assert.equal(t.fixtureId,good.fixtureId);return good;});assert.deepEqual(picked,[good]);
  assert.throws(()=>validateHistory({...target,season:2023},[good]),/LEAKAGE/);
});
test('metadata projection cannot access target score; 2025 metadata rejected',()=>{
  const raw={provider:'API_FOOTBALL',providerFixtureId:9,leagueId:39,season:2024,round:'Regular Season - 1',kickoffUtc:target.kickoffUtc,homeTeamId:1,awayTeamId:2,fixtureStatus:'FT',strictReplayEligible:false,get fullTimeHomeGoals():never{throw Error('TARGET_SCORE_READ');},get fullTimeAwayGoals():never{throw Error('TARGET_SCORE_READ');}};
  assert.equal(archiveTargets([raw],39)[0].season,2024);
  const future=Object.create(Object.getPrototypeOf(raw),Object.getOwnPropertyDescriptors(raw));future.season=2025;assert.throws(()=>archiveTargets([future],39),/SEASON/);
});
test('H1 exact deterministic fit and probability equivalence, including sample/domain failures',()=>{
  const rows=Array.from({length:60},(_,i)=>({lambda:1.4,mu:1.1,x:i%4<2?0:1,y:i%2}));
  assert.deepEqual(e1.fitDependence(rows),h1.fitDependence(rows));assert.deepEqual(e1.fitDependence(rows.slice(0,20)),h1.fitDependence(rows.slice(0,20)));
  for(const rho of [h1.RHO_LOWER,0,h1.RHO_UPPER])assert.deepEqual(e1.predictDependence(1.4,1.1,rho),h1.predictDependence(1.4,1.1,rho));
});
test('H2 exact parameters, optimizer trace and predictions on identical 2023 input',()=>{
  const rows=history(),dev=h2.fitRates(rows),evalFit=e2.fitRates(rows);assert.deepEqual(evalFit,dev);assert.equal(dev.status,'FITTED');
  if(dev.status==='FITTED'&&evalFit.status==='FITTED'){const t={...target,season:2023,kickoffUtc:new Date(time-365*DAY).toISOString()};assert.deepEqual(e2.predictRates(evalFit.parameters,t,rows),h2.predictRates(dev.parameters,t,rows));}
  assert.deepEqual(e2.fitRates(rows.slice(0,20)),h2.fitRates(rows.slice(0,20)));
});
test('H2 real 2024 identity accepted in causal fit without warm-start or relabeling',()=>{
  const rows=current(),fit=e2.fitRates(rows);assert.equal(fit.status,'FITTED');assert.deepEqual(fit,e2.fitRates(rows));assert.ok(rows.every(r=>r.season===2024));
  if(fit.status==='FITTED')assert.equal(e2.predictRates(fit.parameters,target,rows).length,2);
});
test('H3 exact fit/transformation equivalence and class rank preservation',()=>{
  const rows=Array.from({length:60},(_,i)=>({p:[0.6,0.25,0.15] as Prob,actual:i%3}));assert.deepEqual(e3.fitTemperature(rows),h3.fitTemperature(rows));
  for(const beta of [0.05,1,20])for(const p of [[0.6,0.25,0.15],[0,0.5,0.5]] as Prob[])assert.deepEqual(e3.temperature(p,beta),h3.temperature(p,beta));
});
const prediction:Prediction={status:'PREDICTED',reasons:[],p:[0.6,0.25,0.15],rates:[1.4,1.1],details:{}};
const rows=()=>Array.from({length:210},(_,i)=>({fixtureId:i+1,prediction,homeGoals:i%3===0?1:0,awayGoals:i%3===2?1:0}));
test('fixed protocol primary is exactly 1342 with all four ID hashes; cohort mismatch rejected',()=>{
  const p=JSON.parse(readFileSync(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json'),'utf8'));
  assert.deepEqual(p.cohortManifest.map((c:{fixedPrimaryV1Predicted:{count:number}})=>c.fixedPrimaryV1Predicted.count),[353,352,351,286]);
  assert.equal(p.baseline.predictedFixtures,1342);const r=rows();checkCohort(r,{count:210,fixtureIdsSha256:idsHash(r),firstKickoff:''});assert.throws(()=>checkCohort(r.slice(1),{count:210,fixtureIdsSha256:idsHash(r),firstKickoff:''}),/COHORT/);
});
test('missing primary prediction never produces survivor primary metrics',()=>{
  const base=rows(),cand=rows();cand[0]={...cand[0],prediction:{...prediction,status:'PASS',p:null,reasons:['PASS_INSUFFICIENT_FIT']}};
  const result=evaluateLeague('H3',base,cand);assert.equal(result.screen,'INVALID');assert.equal(result.candidate,null);assert.equal(result.pairedCount,210);
  assert.throws(()=>evaluateLeague('H3',base,cand.slice(1)),/IDENTITY/);assert.throws(()=>evaluateLeague('H3',base,[...cand.slice(1),cand[1]]),/IDENTITY/);
});
test('baseline PASS excluded from primary even when candidate predicts; no denominator expansion',()=>{
  const base=rows();base[0]={...base[0],prediction:{...prediction,status:'PASS',p:null,reasons:['PASS_HISTORY']}};
  const result=evaluateLeague('H3',base,rows());assert.equal(result.pairedCount,209);assert.equal(result.candidate!.predicted,209);assert.equal(result.fullCoverage.predicted,210);
});
test('promotion exact probability/tolerance and HOME/AWAY/calibration guards',()=>{
  const base=metrics(rows()),better=structuredClone(base);better.logLoss!-=0.01;better.brier!-=0.01;assert.equal(guards(base,better).pass,true);
  const same=structuredClone(better);same.logLoss=base.logLoss;assert.equal(guards(base,same).pass,false);
  const boundary=structuredClone(better);boundary.logLoss=base.logLoss!-1e-12;assert.equal(guards(base,boundary).probability,false);
  const badRecall=structuredClone(better);badRecall.classes[0].recall=base.classes[0].recall!-0.021;assert.equal(guards(base,badRecall).pass,false);
  const badBrier=structuredClone(better);badBrier.classes[2].brier=base.classes[2].brier!+1e-10;assert.equal(guards(base,badBrier).pass,false);
  const badEce=structuredClone(better);badEce.classes[1].ece=base.classes[1].ece!+0.011;assert.equal(guards(base,badEce).pass,false);
  const sparse=structuredClone(base);sparse.predicted=199;assert.equal(guards(sparse,better).sufficient,false);
});
test('mandatory per-league screen cannot pool or select winner; any failed league blocks',()=>{
  const r=[39,140,135,78].map(leagueId=>({leagueId,screen:'ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION' as const}));assert.equal(aggregateScreen(r),'ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION');
  assert.equal(aggregateScreen([...r.slice(0,3),{leagueId:78,screen:'SCREEN_NO'}]),'SCREEN_NO');assert.throws(()=>aggregateScreen(r.slice(0,3)),/FOUR_LEAGUE/);
});
test('market/owner fields rejected; no operational imports or external request/tuning entrypoint',()=>{
  for(const key of ['odds','market','providerPrediction','ownerShadow','actualScore'])assert.throws(()=>validateEvaluationTarget({...target,[key]:1}),/FIELD/);
  for(const name of readdirSync(code).filter(n=>n.endsWith('.ts')&&!n.startsWith('test-'))){const s=readFileSync(join(code,name),'utf8');assert.ok(!/\bfetch\s*\(/.test(s));const imports=[...s.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);assert.ok(imports.every(i=>!i.includes('forward')&&!i.includes('market')&&!i.includes('provider')));}
  const runner=readFileSync(join(code,'run-evaluation-v1.ts'),'utf8');assert.ok(runner.includes('FINAL_PARAMETERS_SEALED.json'));assert.ok(!runner.includes('writeFileSync'));verifyDevelopment();
});
