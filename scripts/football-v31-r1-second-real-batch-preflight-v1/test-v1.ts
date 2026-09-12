import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NAMESPACE,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {targetCensus} from '../football-v31-r1-comparator-v1/preflight-v1';
import {ADAPTER_HASH,BETA_HASH,H2_HASH,MAP_HASH,V1_HASH,verifyFrozen} from './hashes-v1';
import {classify,IDENTITY_BLOCKED,NOT_NS_OR_DEADLINE,OUTSIDE_WINDOW,PASS_PRECHECK,READY,ALREADY_SEALED} from './classify-v1';
import {exactIdentity,projectIdentity} from './identity-v1';
import {preflight} from './preflight-v1';
import {FIRST_BATCH_WINDOW_MS,SEAL_DEADLINE_MS,withinWindow,windowEndUtc} from './window-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

const discoveryAt='2026-09-13T10:00:00.000Z';
const windowEnd=windowEndUtc(discoveryAt);
const target:Target={fixtureId:99999,leagueId:39,season:2026,kickoffUtc:'2026-09-13T15:00:00.000Z',homeTeamId:1,awayTeamId:2};
const observed='2026-09-12T09:00:00.000Z';
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{...target,fixtureId:i+1,homeTeamId:i%6+1,awayTeamId:(i+1)%6+1,season:2025,kickoffUtc:new Date(Date.parse(discoveryAt)-(93-i)*86400000).toISOString()},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));

function body(t:Target,status='NS',over:Record<string,unknown>={}){
 return {errors:{},response:[{fixture:{id:t.fixtureId,date:t.kickoffUtc,status:{short:status}},league:{id:t.leagueId,season:t.season},teams:{home:{id:t.homeTeamId},away:{id:t.awayTeamId}},...over}]};
}

test('target after actual discovery time can be READY',()=>{
 const c=classify({stored:target,verified:target,apiStatus:'VERIFIED',providerStatus:'NS',discoveryAt,windowEnd,alreadySealed:false,observations:rows});
 assert.equal(c.className,READY);
 assert.equal(c.V1_READY,true);assert.equal(c.H2_READY,true);assert.equal(c.R1_READY,true);
 assert(c.leadTimeMs>0);assert(Date.parse(c.kickoffUtc)>Date.parse(discoveryAt));
});

test('target before cutoff is rejected',()=>{
 const past={...target,kickoffUtc:'2026-09-13T09:00:00.000Z'};
 const c=classify({stored:past,verified:past,apiStatus:'VERIFIED',providerStatus:'NS',discoveryAt,windowEnd,alreadySealed:false,observations:rows});
 assert.equal(c.className,NOT_NS_OR_DEADLINE);
 assert.equal(c.FUTURE,false);assert.equal(c.V1_READY,false);assert.equal(c.R1_READY,false);
});

test('exact identity only; names never join',()=>{
 const named={...body(target),response:[{...body(target).response[0],teams:{home:{id:999,name:'Other Home'},away:{id:target.awayTeamId,name:'Other Away'}}}]};
 assert.equal(projectIdentity(named,target),null);
 assert.equal(exactIdentity(target,{...target,homeTeamId:2}),false);
 const c=classify({stored:target,verified:null,apiStatus:'NOT_VERIFIED',providerStatus:null,discoveryAt,windowEnd,alreadySealed:false,observations:rows});
 assert.equal(c.className,IDENTITY_BLOCKED);
});

test('no market import',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\bodds\b|\bmarket\b|\bbookmaker\b|\brecommendation\b/i);
  assert.doesNotMatch(text,/football-v31-internal-market-comparison|odds-1x2-v1|compare-v1/);
 }
});

test('no postgame-grade input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/postgame-v1|logLoss|Brier|actualClass|gradeFixture|scorecard/);
  assert.doesNotMatch(text,/FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'YES'/);
 }
});

test('no result input',()=>{
 const trap={
  errors:{},
  response:[{
   fixture:{id:target.fixtureId,date:target.kickoffUtc,status:{short:'NS'}},
   league:{id:target.leagueId,season:target.season},
   teams:{home:{id:target.homeTeamId},away:{id:target.awayTeamId}},
   get score():never{throw Error('SCORE_READ');},
   get goals():never{throw Error('GOALS_READ');},
   get events():never{throw Error('EVENTS_READ');},
   get lineups():never{throw Error('LINEUPS_READ');},
   get statistics():never{throw Error('STATISTICS_READ');},
   get predictions():never{throw Error('PREDICTIONS_READ');},
  }],
 };
 assert.deepEqual(projectIdentity(trap,target),{target,providerStatus:'NS'});
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\.(score|goals|events|lineups|statistics|predictions)\b/);
  assert.doesNotMatch(text,/\b(compare|predict|kernel|fitRates|predictFootball|joint|seal)\s*\(/);
 }
});

test('frozen parameter hashes unchanged',()=>{
 const frozen=verifyFrozen();
 assert.equal(frozen.V1_HASH,V1_HASH);
 assert.equal(frozen.ADAPTER_HASH,ADAPTER_HASH);
 assert.equal(frozen.H2_HASH,H2_HASH);
 assert.equal(frozen.MAP_HASH,MAP_HASH);
 assert.equal(frozen.BETA_HASH,BETA_HASH);
 assert.equal(V1_HASH,'6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf');
 assert.equal(ADAPTER_HASH,'125f715c85a5199b7f5725949c4b1ff6f12b1e5d6ef65095c5af0d0673682b6b');
 assert.equal(H2_HASH,'fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea');
 assert.equal(MAP_HASH,'244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26');
 assert.equal(BETA_HASH,'dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4');
});

test('same eligibility convention as first batch',()=>{
 assert.equal(FIRST_BATCH_WINDOW_MS,86400000);
 assert.equal(SEAL_DEADLINE_MS,60000);
 const executedAt='2026-09-12T12:45:12.352Z';
 const end=windowEndUtc(executedAt);
 assert.equal(end,'2026-09-13T12:45:12.352Z');
 assert.equal(withinWindow('2026-09-13T12:00:00.000Z',end),true);
 assert.equal(withinWindow('2026-09-13T13:00:00.000Z',end),false);
 const c=targetCensus(target,'NS',discoveryAt,rows);
 assert.equal(c.deadlineSatisfied,Date.parse(target.kickoffUtc)-Date.parse(discoveryAt)>=SEAL_DEADLINE_MS);
 assert.equal(c.historyPotentiallySatisfiable,true);
 assert(c.baseCounts&&c.baseCounts.competition>=30&&c.baseCounts.homeVenue>=5&&c.baseCounts.awayVenue>=5);
});

test('outside window, PASS_PRECHECK, already sealed, and no prediction seal',async()=>{
 const far={...target,fixtureId:100001,kickoffUtc:'2026-09-20T15:00:00.000Z'};
 const thin={...target,fixtureId:100002,homeTeamId:99,awayTeamId:98};
 const sealed={...target,fixtureId:100003};
 const past={...target,fixtureId:100004,kickoffUtc:'2026-09-13T09:00:00.000Z'};
 const byId=new Map([[target.fixtureId,target],[far.fixtureId,far],[thin.fixtureId,thin],[sealed.fixtureId,sealed],[past.fixtureId,past]]);
 const request=(async(url:string|URL)=>{
  const id=Number(String(url).split('id=')[1]);
  const t=byId.get(id)!;
  return new Response(JSON.stringify(body(t)),{status:200});
 }) as typeof fetch;
 const report=await preflight({root:join(mkdtempSync(join(tmpdir(),'v31-preflight-')),'football-v31-r1-prospective-shadow-v1'),key:'test-key',discoveryAt,request,observations:rows,targets:[target,far,thin,sealed,past],alreadySealed:new Set([sealed.fixtureId]),pauseMs:0});
 assert.equal(report.PREDICTION_SEAL_EXECUTED,'NO');
 assert.equal(report.FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING,'NO');
 assert.equal(report.MARKET_INPUT_USED,'NO');
 assert.equal(report.POSTGAME_INPUT_USED,'NO');
 assert.equal(report.TOTAL_DISCOVERED,5);
 assert.equal(report.OUTSIDE_WINDOW,1);
 assert.equal(report.READY_FOR_TRIPLE_SEAL,1);
 assert.equal(report.PASS_PRECHECK,1);
 assert.equal(report.ALREADY_SEALED,1);
 assert.equal(report.NOT_NS_OR_DEADLINE,1);
 assert.equal(report.V1_READY,1);assert.equal(report.H2_READY,1);assert.equal(report.R1_READY,1);
 const classes=Object.fromEntries(report.rows.map(r=>[r.fixtureId,r.className]));
 assert.equal(classes[target.fixtureId],READY);
 assert.equal(classes[far.fixtureId],OUTSIDE_WINDOW);
 assert.equal(classes[thin.fixtureId],PASS_PRECHECK);
 assert.equal(classes[sealed.fixtureId],ALREADY_SEALED);
 assert.equal(classes[past.fixtureId],NOT_NS_OR_DEADLINE);
});

test('transitive imports stay off recommendation, official runner, and postgame grader',()=>{
 const seen=new Set<string>();
 function walk(file:string){
  if(seen.has(file)||file.includes('node_modules')||file.includes('adapter-v1')||file.includes('store-v1')||file.includes('contracts-v1')||file.includes('feature-state')||file.includes('h2-ridge')||file.includes('numerics-v1'))return;
  seen.add(file);
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)){
   assert(!/recommendation|football-forward|evaluator|metrics|run-development|prepare-v1|grader-v1|postgame|internal-market/.test(m[1]));
   if(m[1].startsWith('.'))walk(resolve(dirname(file),m[1]+'.ts'));
  }
 }
 walk(fileURLToPath(new URL('./preflight-v1.ts',import.meta.url)));
});
