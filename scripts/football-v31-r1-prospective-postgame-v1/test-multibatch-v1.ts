import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compare} from '../football-v31-r1-comparator-v1/comparator-v1';
import {select} from '../football-v31-r1-prospective-v1/adapter-v1';
import {NAMESPACE,digest,readSeal,writeSeal,storeRoot,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {gradeFixture,projectResult,artifactPath,type ExpectedSeal,type ResultObservation} from './grader-v1';
import {BATCHES,FIRST_BATCH_ID,SECOND_BATCH_ID,bindBatchAudit,descriptor} from './registry-v1';
import {loadExpectedSeals,identityOf} from './load-v1';
import {resolvePregameArtifact,batchReceiptDir} from './resolve-v1';
import {pregameFingerprint,verifyPregameHashes} from './fingerprint-batch-v1';
import {CHECKPOINT,aggregateScorecard,fromCard} from './aggregate-v1';
import {collectPrepared} from './run-multibatch-v1';

const cutoff='2026-09-12T10:00:00.000Z',kickoff='2026-09-13T15:00:00.000Z',observed='2026-09-12T09:00:00.000Z',later='2026-09-13T18:00:00.000Z';
const target={fixtureId:88881,leagueId:39,season:2026,kickoffUtc:kickoff,homeTeamId:1,awayTeamId:2};
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{...target,fixtureId:i+1,homeTeamId:i%6+1,awayTeamId:(i+1)%6+1,season:2025,kickoffUtc:new Date(Date.parse(cutoff)-(93-i)*86400000).toISOString()},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));
const predicted=compare(target,cutoff,cutoff,rows);
const passBundle=compare({...target,fixtureId:88882},cutoff,cutoff,rows.map(o=>({...o,features:{xG:null,shots:null,sot:null},quality:'MISSING_FEATURE' as const})));

function temp(){return join(mkdtempSync(join(tmpdir(),'multi-postgame-')),'football-v31-r1-prospective-shadow-v1');}
function sealBundle(root:string,bundle:typeof predicted,obs=rows){
 const selected=select(bundle.targetIdentity,bundle.cutoffAt,bundle.predictionCreatedAt,obs).selected;
 const snapshot={...structuredClone(bundle),sealedAt:cutoff};
 const dir=join(storeRoot(root),'fixtures',String(bundle.targetIdentity.fixtureId));
 const input=writeSeal(join(dir,'input.json'),selected),snap=writeSeal(join(dir,'snapshot.json'),snapshot);
 const expected:ExpectedSeal={...bundle.targetIdentity,cutoffAt:bundle.cutoffAt,predictionCreatedAt:bundle.predictionCreatedAt,snapshotHash:snap.sha256,v1PredictionHash:bundle.sameCutoffV1.sha256,h2PredictionHash:bundle.sameCutoffH2.sha256,r1PredictionHash:bundle.r1.sha256,inputHash:input.sha256};
 return {expected,dir};
}
function ft(expected:ExpectedSeal,home=2,away=1):ResultObservation{
 return {...expected,fixtureStatus:'FT',regularTime:{home,away},resultObservedAt:later,providerFetchedAt:later,sourceHash:'c'.repeat(64)};
}
function provider(expected:ExpectedSeal,status:string,home:number|null,away:number|null){
 return {errors:{},results:1,response:[{fixture:{id:expected.fixtureId,date:expected.kickoffUtc,status:{short:status}},league:{id:expected.leagueId,season:expected.season},teams:{home:{id:expected.homeTeamId},away:{id:expected.awayTeamId}},score:{fulltime:{home,away}}}]};
}
function implFiles(){
 const dir=fileURLToPath(new URL('.',import.meta.url));
 return readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-')&&['registry-v1.ts','resolve-v1.ts','load-v1.ts','fingerprint-batch-v1.ts','aggregate-v1.ts','run-multibatch-v1.ts'].includes(f));
}

test('first batch audit binding',()=>{
 const rows=loadExpectedSeals(FIRST_BATCH_ID);
 assert.equal(rows.length,20);
 assert.equal(bindBatchAudit(FIRST_BATCH_ID).sha256,BATCHES[FIRST_BATCH_ID].auditSha256);
 assert.equal(descriptor(FIRST_BATCH_ID).targetCount,20);
});

test('second batch audit binding',()=>{
 const rows=loadExpectedSeals(SECOND_BATCH_ID);
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.fixtureId),[1575159,1570376,1557404,1550123]);
 assert.equal(bindBatchAudit(SECOND_BATCH_ID).sha256,'405145c492935fc9c789e17e37af3758d77db528ef6a62b034c07ea0fe7fd8d5');
 for(const row of rows)assert.equal(row.kickoffUtc.slice(0,4),'2026');
});

test('wrong audit hash blocked',()=>{
 const file=join(temp(),'bad.json');
 mkdirSync(dirname(file),{recursive:true});
 writeSeal(file,{batchId:SECOND_BATCH_ID,TARGET_COUNT:4,outcomes:[]});
 assert.throws(()=>bindBatchAudit(SECOND_BATCH_ID,file),/BATCH_AUDIT_HASH_MISMATCH/);
 assert.throws(()=>loadExpectedSeals(FIRST_BATCH_ID,file),/BATCH_AUDIT_HASH_MISMATCH/);
});

test('exact target identity',()=>{
 const rows=loadExpectedSeals(SECOND_BATCH_ID);
 const first=rows[0];
 assert.deepEqual(identityOf(first),{fixtureId:1575159,leagueId:78,season:2026,kickoffUtc:'2026-09-13T13:30:00.000Z',homeTeamId:173,awayTeamId:175});
 assert.equal(digest(identityOf(first)),digest({fixtureId:1575159,leagueId:78,season:2026,kickoffUtc:'2026-09-13T13:30:00.000Z',homeTeamId:173,awayTeamId:175}));
});

test('first layout resolver',()=>{
 const files=resolvePregameArtifact(temp(),FIRST_BATCH_ID,1550119);
 assert.equal(files.layout,'NAMESPACE_FIXTURES_DIR');
 assert.match(files.snapshotPath,/[\\/]fixtures[\\/]1550119[\\/]snapshot\.json$/);
 assert.doesNotMatch(files.snapshotPath,/batches[\\/]FIRST_REAL_ONE_SHOT_V1[\\/]targets/);
});

test('second layout resolver',()=>{
 const files=resolvePregameArtifact(temp(),SECOND_BATCH_ID,1575159);
 assert.equal(files.layout,'NAMESPACE_FIXTURES_DIR');
 assert.match(files.inputPath,/[\\/]fixtures[\\/]1575159[\\/]input\.json$/);
 assert.match(files.postgamePath,/postgame-v1\.json$/);
 assert.doesNotMatch(files.dir,/batches[\\/]SECOND_REAL_ONE_SHOT_V1[\\/]targets/);
});

test('valid first-batch existing grade immutable',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const first=gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 const before=readFileSync(artifactPath(root,expected.fixtureId));
 const second=gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 assert.equal(first.status,'GRADED');
 assert.equal(second.status,'ALREADY_GRADED_IMMUTABLE');
 assert.deepEqual(readFileSync(artifactPath(root,expected.fixtureId)),before);
});

test('second-batch pending result',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const out=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(cutoff),delayMs:0,key:'k'});
 assert.equal(out.outcomes[0].status,'RESULT_PENDING');
 assert.equal(existsSync(artifactPath(root,expected.fixtureId)),false);
});

test('second-batch FT grade',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const request=(async()=>new Response(JSON.stringify(provider(expected,'FT',2,1)),{status:200})) as typeof fetch;
 const out=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(later),delayMs:0,key:'k',request});
 assert.equal(out.outcomes[0].status,'GRADED');
 const a=readSeal<{r1Grade:{status:string};v1Grade:{status:string};h2Grade:{status:string}}>(artifactPath(root,expected.fixtureId));
 assert.equal(a.payload.r1Grade.status,'GRADED');
});

test('second-batch duplicate grade blocked',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const request=(async()=>new Response(JSON.stringify(provider(expected,'FT',2,1)),{status:200})) as typeof fetch;
 const first=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(later),delayMs:0,key:'k',request,runId:'run-a'});
 const bytes=readFileSync(artifactPath(root,expected.fixtureId));
 const second=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(later),delayMs:0,key:'k',request,runId:'run-b'});
 assert.equal(first.outcomes[0].status,'GRADED');
 assert.equal(second.outcomes[0].status,'ALREADY_GRADED_IMMUTABLE');
 assert.deepEqual(readFileSync(artifactPath(root,expected.fixtureId)),bytes);
});

test('V1/H2/R1 independent grading',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 gradeFixture(root,expected,ft(expected,0,1),()=>Date.parse(later));
 const a=readSeal<{v1Grade:{status:string;actualClass:string};h2Grade:{status:string;actualClass:string};r1Grade:{status:string;actualClass:string}}>(artifactPath(root,expected.fixtureId));
 assert.equal(a.payload.v1Grade.status,'GRADED');
 assert.equal(a.payload.h2Grade.status,'GRADED');
 assert.equal(a.payload.r1Grade.status,'GRADED');
 assert.equal(a.payload.v1Grade.actualClass,'AWAY');
});

test('PASS preservation',()=>{
 const root=temp(),{expected}=sealBundle(root,passBundle,rows.map(o=>({...o,features:{xG:null,shots:null,sot:null},quality:'MISSING_FEATURE' as const})));
 gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 const a=readSeal<{r1Grade:{status:string;correct:null;probabilities:null}}>(artifactPath(root,expected.fixtureId));
 assert.equal(a.payload.r1Grade.status,'PREGAME_PASS_PRESERVED');
 assert.equal(a.payload.r1Grade.correct,null);
 assert.equal(a.payload.r1Grade.probabilities,null);
});

test('AET/PEN blocked per existing contract',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 assert.equal(projectResult(provider(expected,'AET',2,1),expected,later,later,'d'.repeat(64)).status,'RESULT_BLOCKED');
 assert.equal(projectResult(provider(expected,'PEN',2,1),expected,later,later,'d'.repeat(64)).status,'RESULT_BLOCKED');
 assert.equal(existsSync(artifactPath(root,expected.fixtureId)),false);
});

test('no prediction recompute',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of implFiles()){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\b(compare|predict|kernel|fitRates|predictFootball|predictRates|loadParameters|joint)\s*\(/);
 }
});

test('no market import',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of implFiles()){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\bodds\b|\bmarket\b|\bbookmaker\b|\brecommendation\b/i);
  assert.doesNotMatch(text,/football-v31-internal-market-comparison/);
 }
});

test('no model/refit import',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of implFiles()){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/run-development|prepare-v1|football-forward|evaluator/);
 }
});

test('first-batch existing files byte-identical',async()=>{
 const root=temp(),first=sealBundle(root,predicted),second=sealBundle(root,passBundle,rows.map(o=>({...o,features:{xG:null,shots:null,sot:null},quality:'MISSING_FEATURE' as const})));
 const before=pregameFingerprint(root,FIRST_BATCH_ID,[first.expected.fixtureId]);
 const request=(async()=>new Response(JSON.stringify(provider(second.expected,'FT',1,1)),{status:200})) as typeof fetch;
 await collectPrepared(root,SECOND_BATCH_ID,[second.expected],{clock:()=>Date.parse(later),delayMs:0,key:'k',request});
 assert.equal(pregameFingerprint(root,FIRST_BATCH_ID,[first.expected.fixtureId]),before);
});

test('append-only receipt per batch',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const a=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(cutoff),delayMs:0,key:'k',runId:'r1'});
 const firstBytes=readFileSync(a.runReceiptPath);
 const b=await collectPrepared(root,SECOND_BATCH_ID,[expected],{clock:()=>Date.parse(cutoff),delayMs:0,key:'k',runId:'r2'});
 assert.notEqual(a.runReceiptPath,b.runReceiptPath);
 assert.deepEqual(readFileSync(a.runReceiptPath),firstBytes);
 assert.equal(readdirSync(batchReceiptDir(root,SECOND_BATCH_ID)).sort().join(),'r1.json,r2.json');
});

test('aggregate scorecard coverage',()=>{
 const first=fromCard(FIRST_BATCH_ID,{TOTAL_SEALED:20,RESULT_AVAILABLE:6,RESULT_PENDING:14,RESULT_BLOCKED:0,R1_PREDICTED_GRADED:4,R1_PASS_PRESERVED:2,V1_PREDICTED_GRADED:4,H2_PREDICTED_GRADED:4,interpretation:'EARLY_DESCRIPTIVE_ONLY',MODEL_PROMOTED:'NO',checkpoint:{next:25,R1_PREDICTED_GRADED:4},descriptive:{}},Array.from({length:20},(_,i)=>({fixtureId:i,status:i<6?'ALREADY_GRADED_IMMUTABLE':'RESULT_PENDING'} as const)));
 const second=fromCard(SECOND_BATCH_ID,{TOTAL_SEALED:4,RESULT_AVAILABLE:0,RESULT_PENDING:4,RESULT_BLOCKED:0,R1_PREDICTED_GRADED:0,R1_PASS_PRESERVED:0,V1_PREDICTED_GRADED:0,H2_PREDICTED_GRADED:0,interpretation:'EARLY_DESCRIPTIVE_ONLY',MODEL_PROMOTED:'NO',checkpoint:{next:25,R1_PREDICTED_GRADED:0},descriptive:{}},Array.from({length:4},(_,i)=>({fixtureId:100+i,status:'RESULT_PENDING' as const})));
 const agg=aggregateScorecard([first,second]);
 assert.equal(agg.TOTAL_BATCHES,2);
 assert.equal(agg.TOTAL_SEALED,24);
 assert.equal(agg.RESULT_AVAILABLE,6);
 assert.equal(agg.RESULT_PENDING,18);
 assert.equal(agg.R1_PREDICTED_GRADED,4);
});

test('N<25 interpretation remains EARLY_DESCRIPTIVE_ONLY',()=>{
 const agg=aggregateScorecard([fromCard(SECOND_BATCH_ID,{TOTAL_SEALED:4,RESULT_AVAILABLE:0,RESULT_PENDING:4,RESULT_BLOCKED:0,R1_PREDICTED_GRADED:0,R1_PASS_PRESERVED:0,V1_PREDICTED_GRADED:0,H2_PREDICTED_GRADED:0,interpretation:'EARLY_DESCRIPTIVE_ONLY',MODEL_PROMOTED:'NO',checkpoint:{next:CHECKPOINT,R1_PREDICTED_GRADED:0},descriptive:{}},[])]);
 assert.equal(agg.INTERPRETATION,'EARLY_DESCRIPTIVE_ONLY');
 assert(agg.R1_PREDICTED_GRADED<CHECKPOINT);
 assert.equal(agg.MODEL_PROMOTED,'NO');
 assert.equal(agg.WATCH_STARTED,'NO');
});

test('verifyPregameHashes bind snapshot and input',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const files=verifyPregameHashes(root,SECOND_BATCH_ID,expected);
 assert.equal(existsSync(files.snapshotPath),true);
 assert.throws(()=>verifyPregameHashes(root,SECOND_BATCH_ID,{...expected,snapshotHash:'0'.repeat(64)}),/SNAPSHOT_HASH_MISMATCH/);
});
