import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compare} from '../football-v31-r1-comparator-v1/comparator-v1';
import {NAMESPACE,digest,readSeal,writeSeal,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {ADAPTER_HASH,BETA_HASH,H2_HASH,MAP_HASH,V1_HASH,verifyFrozen} from '../football-v31-r1-second-real-batch-preflight-v1/hashes-v1';
import {SEAL_DEADLINE_MS} from '../football-v31-r1-second-real-batch-preflight-v1/window-v1';
import {executeBatch,publicAudit,sealOne} from './batch-v1';
import {treeFingerprint} from './fingerprint-v1';
import {FIRST_BATCH_IDS,PREFLIGHT_AUDIT_SHA,READY_TARGETS,assertReadyTarget,loadReadyTargets,preflightAuditPath} from './targets-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

const cutoff='2026-09-13T10:00:00.000Z';
const observed='2026-09-12T09:00:00.000Z';
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{fixtureId:i+1,leagueId:39,season:2025,kickoffUtc:new Date(Date.parse(cutoff)-(93-i)*86400000).toISOString(),homeTeamId:i%6+1,awayTeamId:(i+1)%6+1},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));

function tempRoot(){return join(mkdtempSync(join(tmpdir(),'v31-second-seal-')),'football-v31-r1-prospective-shadow-v1');}
function body(t:Target,status='NS',over:Record<string,unknown>={}){
 return {errors:{},response:[{fixture:{id:t.fixtureId,date:t.kickoffUtc,status:{short:status}},league:{id:t.leagueId,season:t.season},teams:{home:{id:t.homeTeamId},away:{id:t.awayTeamId}},...over}]};
}
function requestAll(status='NS',mutate?:(t:Target)=>Target):typeof fetch{
 return(async(url:string|URL)=>{
  const id=Number(String(url).split('id=')[1]);
  const t=READY_TARGETS.find(x=>x.fixtureId===id);
  if(!t)return new Response(JSON.stringify({errors:{id:'unknown'},response:[]}),{status:200});
  const use=mutate?mutate(t):t;
  return new Response(JSON.stringify(body(use,status)),{status:200});
 }) as typeof fetch;
}

test('exactly 4 preflight READY targets only',()=>{
 const ready=loadReadyTargets();
 assert.equal(ready.length,4);
 assert.deepEqual(ready.map(t=>t.fixtureId),[1575159,1570376,1557404,1550123]);
 assert.equal(new Set(ready.map(t=>t.fixtureId)).size,4);
 assert.equal(FIRST_BATCH_IDS.some(id=>ready.some(t=>t.fixtureId===id)),false);
});

test('non-READY fixture rejected',()=>{
 const blocked:Target={fixtureId:1550122,leagueId:135,season:2026,kickoffUtc:'2026-09-13T13:00:00.000Z',homeTeamId:867,awayTeamId:1579};
 assert.throws(()=>assertReadyTarget(blocked),/NON_READY_TARGET/);
 assert.throws(()=>assertReadyTarget({...READY_TARGETS[0],homeTeamId:1}),/NON_READY_TARGET/);
});

test('preflight audit hash binding',()=>{
 const seal=readSeal(preflightAuditPath());
 assert.equal(seal.sha256,PREFLIGHT_AUDIT_SHA);
 assert.equal(digest(seal.payload),PREFLIGHT_AUDIT_SHA);
 const file=join(tempRoot(),'bad-preflight.json');
 mkdirSync(dirname(file),{recursive:true});
 writeSeal(file,{...seal.payload,discoveryAt:'1999-01-01T00:00:00.000Z'});
 assert.throws(()=>loadReadyTargets(file),/PREFLIGHT_AUDIT_HASH/);
});

test('exact seal-time identity',async()=>{
 const root=tempRoot();
 const row=await sealOne({target:READY_TARGETS[0],root,key:'k',observations:[],request:requestAll('NS',t=>({...t,homeTeamId:999})),now:()=>cutoff});
 assert.equal(row.status,'IDENTITY_BLOCKED');
});

test('NS/future/deadline gate',async()=>{
 const root=tempRoot();
 const ns=await sealOne({target:READY_TARGETS[0],root,key:'k',observations:[],request:requestAll('1H'),now:()=>cutoff});
 assert.equal(ns.status,'SEAL_PASS');assert.equal(ns.reason,'NOT_NS');
 const future=await sealOne({target:READY_TARGETS[0],root,key:'k',observations:[],request:requestAll(),now:()=>'2026-09-13T13:30:00.000Z'});
 assert.equal(future.status,'SEAL_PASS');assert.equal(future.reason,'NOT_FUTURE');
 const late=await sealOne({target:READY_TARGETS[0],root,key:'k',observations:[],request:requestAll(),now:()=>'2026-09-13T13:29:30.000Z'});
 assert.equal(late.status,'SEAL_PASS');assert.equal(late.reason,'DEADLINE');
 assert.equal(SEAL_DEADLINE_MS,60000);
});

test('same cutoff V1/H2/R1',async()=>{
 const root=tempRoot();
 const row=await sealOne({target:READY_TARGETS[0],root,key:'k',observations:[],request:requestAll(),now:()=>cutoff});
 assert.equal(row.status,'SEALED');
 const snap=readSeal<{cutoffAt:string;predictionCreatedAt:string;sameCutoffV1:{payload:{cutoffAt:string;predictionCreatedAt:string}};sameCutoffH2:{payload:{cutoffAt:string;predictionCreatedAt:string}};r1:{payload:{cutoffAt:string;predictionCreatedAt:string}}}>(join(root,'V31_R1_PROSPECTIVE_SHADOW','fixtures',String(READY_TARGETS[0].fixtureId),'snapshot.json'));
 assert.equal(snap.payload.cutoffAt,cutoff);
 assert.equal(snap.payload.sameCutoffV1.payload.cutoffAt,cutoff);
 assert.equal(snap.payload.sameCutoffH2.payload.cutoffAt,cutoff);
 assert.equal(snap.payload.r1.payload.cutoffAt,cutoff);
 assert.equal(snap.payload.sameCutoffV1.payload.predictionCreatedAt,snap.payload.r1.payload.predictionCreatedAt);
});

test('causal history before cutoff',()=>{
 const after={...rows[0],observationId:'after',fixture:{...rows[0].fixture,fixtureId:999},endpoint:'/fixtures/statistics?fixture=999',providerFetchedAt:'2026-09-13T11:00:00.000Z',sealCreatedAt:'2026-09-13T11:00:00.000Z',completion:{...rows[0].completion,providerFetchedAt:'2026-09-13T11:00:00.000Z'}};
 const t={...READY_TARGETS[2],homeTeamId:1,awayTeamId:2};
 assert.throws(()=>compare(t,cutoff,cutoff,rows.map((o,i)=>i?o:{...o,providerFetchedAt:cutoff,sealCreatedAt:cutoff,completion:{...o.completion,providerFetchedAt:cutoff}})),/SAME_CUTOFF_OBSERVATION_BOUNDARY/);
 const mixed=compare(t,cutoff,cutoff,[...rows,after]);
 assert.equal(mixed.baseHistoryIds.includes(999),false);
 assert.equal(mixed.r1.payload.cutoffAt,cutoff);
});

test('target excluded from history',()=>{
 const own={...rows[0],observationId:'own',fixture:{...READY_TARGETS[0],season:2025,kickoffUtc:'2026-09-01T00:00:00.000Z'},endpoint:'/fixtures/statistics?fixture='+READY_TARGETS[0].fixtureId};
 assert.throws(()=>compare(READY_TARGETS[0],cutoff,cutoff,[own]),/TARGET_OWN_DATA/);
});

test('no postgame imports/input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/postgame-v1|gradeFixture|scorecard|logLoss|Brier|actualClass/);
  assert.doesNotMatch(text,/FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'YES'/);
 }
});

test('no market imports/input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\bodds\b|\bmarket\b|\bbookmaker\b|\brecommendation\b/i);
  assert.doesNotMatch(text,/football-v31-internal-market-comparison|odds-1x2-v1/);
 }
});

test('no result/performance input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\.(score|goals|events|lineups|statistics|predictions)\b/);
  assert.doesNotMatch(text,/first-real-batch-v1\.json|108 screenshot|actualClass|\bBrier\b|\blogLoss\b/);
 }
});

test('frozen V1/H2/R1/map/beta hashes unchanged',()=>{
 const frozen=verifyFrozen();
 assert.equal(frozen.V1_HASH,V1_HASH);
 assert.equal(frozen.ADAPTER_HASH,ADAPTER_HASH);
 assert.equal(frozen.H2_HASH,H2_HASH);
 assert.equal(frozen.MAP_HASH,MAP_HASH);
 assert.equal(frozen.BETA_HASH,BETA_HASH);
});

test('existing first-batch files byte-identical',async()=>{
 const root=tempRoot();
 const dir=join(root,'V31_R1_PROSPECTIVE_SHADOW','fixtures','1550119');
 mkdirSync(dir,{recursive:true});
 const marker=Buffer.from('FIRST_BATCH_BYTE_MARKER');
 writeFileSync(join(dir,'input.json'),marker);
 writeFileSync(join(dir,'snapshot.json'),marker);
 const before=treeFingerprint(root,FIRST_BATCH_IDS);
 const report=await executeBatch({root,key:'k',request:requestAll(),observations:[],now:()=>cutoff,pauseMs:0});
 assert.equal(report.SEALED_COUNT,4);
 assert.deepEqual(readFileSync(join(dir,'input.json')),marker);
 assert.deepEqual(readFileSync(join(dir,'snapshot.json')),marker);
 assert.equal(treeFingerprint(root,FIRST_BATCH_IDS),before);
 assert.equal(report.FIRST_BATCH_FILES_MUTATED,'NO');
});

test('duplicate seal overwrite blocked',async()=>{
 const root=tempRoot();
 const first=await sealOne({target:READY_TARGETS[1],root,key:'k',observations:[],request:requestAll(),now:()=>cutoff});
 assert.equal(first.status,'SEALED');
 const second=await sealOne({target:READY_TARGETS[1],root,key:'k',observations:[],request:requestAll(),now:()=>cutoff});
 assert.equal(second.status,'UNSEALABLE');
 const bytes=readFileSync(join(root,'V31_R1_PROSPECTIVE_SHADOW','fixtures',String(READY_TARGETS[1].fixtureId),'snapshot.json'));
 const again=readFileSync(join(root,'V31_R1_PROSPECTIVE_SHADOW','fixtures',String(READY_TARGETS[1].fixtureId),'snapshot.json'));
 assert.deepEqual(again,bytes);
});

test('PASS preserved',async()=>{
 const root=tempRoot();
 const row=await sealOne({target:READY_TARGETS[3],root,key:'k',observations:[],request:requestAll(),now:()=>cutoff});
 assert.equal(row.status,'SEALED');
 assert.equal(row.v1Status,'PASS');assert.equal(row.h2Status,'PASS');assert.equal(row.r1Status,'PASS');
 const snap=readSeal<{r1:{payload:{status:string;probabilities:null;passReason:string[]}}}>(join(root,'V31_R1_PROSPECTIVE_SHADOW','fixtures',String(READY_TARGETS[3].fixtureId),'snapshot.json'));
 assert.equal(snap.payload.r1.payload.status,'PASS');
 assert.equal(snap.payload.r1.payload.probabilities,null);
 assert(snap.payload.r1.payload.passReason.length>0);
});

test('private detailed output not committed',async()=>{
 const root=tempRoot();
 const report=await executeBatch({root,key:'k',request:requestAll(),observations:[],now:()=>cutoff,pauseMs:0,writeManifest:false});
 const published=JSON.stringify(publicAudit(report));
 assert.doesNotMatch(published,/"probabilities"/);
 assert.doesNotMatch(published,/"rates"/);
 assert.equal(report.TARGET_COUNT,4);
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/data\/audits\/football-v31-r1-second-real-batch-seal-v1/);
 }
});

test('transitive imports stay off recommendation, official runner, and postgame grader',()=>{
 const seen=new Set<string>();
 function walk(file:string){
  if(seen.has(file)||file.includes('node_modules')||file.includes('adapter-v1')||file.includes('store-v1')||file.includes('contracts-v1')||file.includes('feature-state')||file.includes('h2-ridge')||file.includes('numerics-v1')||file.includes('poisson-research')||file.includes('instant.ts')||file.includes('preflight-v1')||file.includes('identity-v1')||file.includes('hashes-v1')||file.includes('window-v1')||file.includes('classify-v1'))return;
  seen.add(file);
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)){
   assert(!/recommendation|football-forward|evaluator|metrics|run-development|prepare-v1|grader-v1|postgame|internal-market/.test(m[1]));
   if(m[1].startsWith('.'))walk(resolve(dirname(file),m[1]+'.ts'));
  }
 }
 walk(fileURLToPath(new URL('./batch-v1.ts',import.meta.url)));
});
