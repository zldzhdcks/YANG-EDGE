import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NAMESPACE,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {ADAPTER_HASH,BETA_HASH,H2_HASH,MAP_HASH,V1_HASH,verifyFrozen} from '../football-v31-r1-second-real-batch-preflight-v1/hashes-v1';
import {ALREADY_SEALED,NOT_NS_OR_DEADLINE,OUTSIDE_WINDOW,PASS_PRECHECK,READY} from '../football-v31-r1-second-real-batch-preflight-v1/classify-v1';
import {exactIdentity,projectIdentity} from '../football-v31-r1-second-real-batch-preflight-v1/identity-v1';
import {FIRST_BATCH_WINDOW_MS,SEAL_DEADLINE_MS,withinWindow,windowEndUtc} from '../football-v31-r1-second-real-batch-preflight-v1/window-v1';
import {preflight} from './preflight-v1';
import {CURRENT_SEALED_R1_PREDICTED,loadSealedExclusion,SECOND_BATCH_IDS} from './sealed-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

const discoveryAt='2026-09-13T10:00:00.000Z';
const windowEnd=windowEndUtc(discoveryAt);
const target:Target={fixtureId:99999,leagueId:39,season:2026,kickoffUtc:'2026-09-13T15:00:00.000Z',homeTeamId:1,awayTeamId:2};
const observed='2026-09-12T09:00:00.000Z';
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{...target,fixtureId:i+1,homeTeamId:i%6+1,awayTeamId:(i+1)%6+1,season:2025,kickoffUtc:new Date(Date.parse(discoveryAt)-(93-i)*86400000).toISOString()},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));

function body(t:Target,status='NS'){
 return {errors:{},response:[{fixture:{id:t.fixtureId,date:t.kickoffUtc,status:{short:status}},league:{id:t.leagueId,season:t.season},teams:{home:{id:t.homeTeamId},away:{id:t.awayTeamId}}}]};
}
function tempRoot(){return join(mkdtempSync(join(tmpdir(),'v31-third-preflight-')),'football-v31-r1-prospective-shadow-v1');}
function requestFor(byId:Map<number,Target>){
 return (async(url:string|URL)=>{
  const id=Number(String(url).split('id=')[1]);
  return new Response(JSON.stringify(body(byId.get(id)!)),{status:200});
 }) as typeof fetch;
}

test('first 20 already sealed excluded',async()=>{
 const exclusion=loadSealedExclusion();
 assert.equal(exclusion.firstIds.length,20);
 const first=exclusion.firstIds.map((id,i)=>({...target,fixtureId:id,kickoffUtc:'2026-09-13T15:00:00.000Z',homeTeamId:i%6+1,awayTeamId:(i+1)%6+1}));
 const byId=new Map(first.map(t=>[t.fixtureId,t]));
 const report=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:rows,targets:first,pauseMs:0});
 assert.equal(report.ALREADY_SEALED,20);
 assert.equal(report.READY_FOR_TRIPLE_SEAL,0);
 assert(report.rows.every(r=>r.className===ALREADY_SEALED));
});

test('second 4 already sealed excluded',async()=>{
 const second=SECOND_BATCH_IDS.map((id,i)=>({...target,fixtureId:id,kickoffUtc:'2026-09-13T15:00:00.000Z',homeTeamId:i+10,awayTeamId:i+20}));
 const byId=new Map(second.map(t=>[t.fixtureId,t]));
 const report=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:rows,targets:[...second],pauseMs:0});
 assert.deepEqual(report.rows.map(r=>r.fixtureId),[...SECOND_BATCH_IDS]);
 assert(report.rows.every(r=>r.className===ALREADY_SEALED));
 assert.equal(report.READY_FOR_TRIPLE_SEAL,0);
});

test('duplicate target rejection',async()=>{
 const byId=new Map([[target.fixtureId,target]]);
 await assert.rejects(()=>preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:rows,targets:[target,target],pauseMs:0}),/DUPLICATE_TARGET/);
});

test('exact identity only',()=>{
 const named={...body(target),response:[{...body(target).response[0],teams:{home:{id:999,name:'Other Home'},away:{id:target.awayTeamId,name:'Other Away'}}}]};
 assert.equal(projectIdentity(named,target),null);
 assert.equal(exactIdentity(target,{...target,homeTeamId:2}),false);
});

test('24h rule unchanged',()=>{
 assert.equal(FIRST_BATCH_WINDOW_MS,86400000);
 assert.equal(windowEndUtc(discoveryAt),windowEnd);
 assert.equal(withinWindow('2026-09-14T10:00:00.000Z',windowEnd),true);
 assert.equal(withinWindow('2026-09-14T10:00:00.001Z',windowEnd),false);
});

test('future/NS/deadline gate',async()=>{
 const past={...target,fixtureId:100004,kickoffUtc:'2026-09-13T09:00:00.000Z'};
 const live={...target,fixtureId:100005};
 const byId=new Map([[past.fixtureId,past],[live.fixtureId,live]]);
 const request=(async(url:string|URL)=>{
  const id=Number(String(url).split('id=')[1]);
  const t=byId.get(id)!;
  return new Response(JSON.stringify(body(t,id===live.fixtureId?'1H':'NS')),{status:200});
 }) as typeof fetch;
 const report=await preflight({root:tempRoot(),key:'k',discoveryAt,request,observations:rows,targets:[past,live],pauseMs:0});
 assert.equal(report.rows.find(r=>r.fixtureId===past.fixtureId)?.className,NOT_NS_OR_DEADLINE);
 assert.equal(report.rows.find(r=>r.fixtureId===live.fixtureId)?.className,NOT_NS_OR_DEADLINE);
 assert.equal(SEAL_DEADLINE_MS,60000);
});

test('causal history only',async()=>{
 const late=rows.map(o=>({...o,providerFetchedAt:'2026-09-13T11:00:00.000Z',completion:{...o.completion,providerFetchedAt:'2026-09-13T11:00:00.000Z'}}));
 const byId=new Map([[target.fixtureId,target]]);
 const blocked=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:late,targets:[target],pauseMs:0});
 const ok=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:rows,targets:[target],pauseMs:0});
 assert.equal(blocked.rows[0].className,PASS_PRECHECK);
 assert.equal(ok.rows[0].className,READY);
});

test('target excluded from history',async()=>{
 const onlySelf=rows.map(o=>({...o,fixture:{...o.fixture,fixtureId:target.fixtureId},endpoint:'/fixtures/statistics?fixture='+target.fixtureId}));
 const byId=new Map([[target.fixtureId,target]]);
 const report=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:onlySelf,targets:[target],pauseMs:0});
 assert.equal(report.rows[0].className,PASS_PRECHECK);
 assert.equal(report.READY_FOR_TRIPLE_SEAL,0);
});

test('no postgame input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/postgame-v1|logLoss|Brier|actualClass|gradeFixture|scorecard/);
  assert.doesNotMatch(text,/FIRST_SECOND_BATCH_PERFORMANCE_USED_FOR_TUNING:'YES'/);
 }
});

test('no market input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\bodds\b|\bmarket\b|\bbookmaker\b|\brecommendation\b/i);
  assert.doesNotMatch(text,/football-v31-internal-market-comparison|odds-1x2-v1/);
 }
});

test('frozen hashes unchanged',()=>{
 const frozen=verifyFrozen();
 assert.equal(frozen.V1_HASH,V1_HASH);
 assert.equal(frozen.ADAPTER_HASH,ADAPTER_HASH);
 assert.equal(frozen.H2_HASH,H2_HASH);
 assert.equal(frozen.MAP_HASH,MAP_HASH);
 assert.equal(frozen.BETA_HASH,BETA_HASH);
 assert.equal(V1_HASH,'6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf');
 assert.equal(MAP_HASH,'244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26');
 assert.equal(BETA_HASH,'dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4');
});

test('checkpoint gaming prohibited',async()=>{
 const far={...target,fixtureId:100001,kickoffUtc:'2026-09-20T15:00:00.000Z'};
 const thin={...target,fixtureId:100002,homeTeamId:99,awayTeamId:98};
 const byId=new Map([[far.fixtureId,far],[thin.fixtureId,thin]]);
 const report=await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(byId),observations:rows,targets:[far,thin],pauseMs:0});
 assert.equal(report.CHECKPOINT_GAMING,'NO');
 assert.equal(report.READY_FOR_TRIPLE_SEAL,0);
 assert.equal(report.CURRENT_SEALED_R1_PREDICTED,CURRENT_SEALED_R1_PREDICTED);
 assert.equal(report.PROJECTED_MAX_R1_PREDICTED_IF_ALL_READY_PREDICT,19);
 assert.equal(report.PREDICTION_SEAL_EXECUTED,'NO');
 assert.equal(FIRST_BATCH_WINDOW_MS,86400000);
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/READY_FOR_TRIPLE_SEAL\s*>=\s*6|windowMs\s*\+|FIRST_BATCH_WINDOW_MS\s*\*/);
  assert.doesNotMatch(text,/\b(compare|predict|kernel|fitRates|predictFootball|joint|seal)\s*\(/);
 }
 assert.equal(report.rows.find(r=>r.fixtureId===far.fixtureId)?.className,OUTSIDE_WINDOW);
 assert.equal(report.rows.find(r=>r.fixtureId===thin.fixtureId)?.className,PASS_PRECHECK);
 const seen=new Set<string>();
 function walk(file:string){
  if(seen.has(file)||file.includes('node_modules')||file.includes('adapter-v1')||file.includes('store-v1')||file.includes('contracts-v1')||file.includes('feature-state')||file.includes('h2-ridge')||file.includes('numerics-v1')||file.includes('hashes-v1')||file.includes('window-v1')||file.includes('identity-v1')||file.includes('classify-v1'))return;
  seen.add(file);
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)){
   assert(!/recommendation|football-forward|evaluator|metrics|run-development|prepare-v1|grader-v1|postgame|internal-market/.test(m[1]));
   if(m[1].startsWith('.'))walk(resolve(dirname(file),m[1]+'.ts'));
  }
 }
 walk(fileURLToPath(new URL('./preflight-v1.ts',import.meta.url)));
 assert.equal((await preflight({root:tempRoot(),key:'k',discoveryAt,request:requestFor(new Map([[target.fixtureId,target]])),observations:rows,targets:[target],pauseMs:0})).rows[0].className,READY);
});
