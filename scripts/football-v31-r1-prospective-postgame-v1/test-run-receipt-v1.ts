import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compare} from '../football-v31-r1-comparator-v1/comparator-v1';
import {select} from '../football-v31-r1-prospective-v1/adapter-v1';
import {NAMESPACE,digest,readSeal,writeSeal,storeRoot,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {gradeFixture,artifactPath,type ExpectedSeal,type ResultObservation} from './grader-v1';
import {
  collectOneShot,
  diagnoseLegacyReceipt,
  legacyReceiptPath,
  runReceiptPath,
  runReceiptDir,
  RUN_RECEIPT_SCHEMA,
} from './run-v1';

const cutoff='2026-09-12T10:00:00.000Z',kickoff='2026-09-13T15:00:00.000Z',observed='2026-09-12T09:00:00.000Z';
const target={fixtureId:99999,leagueId:39,season:2026,kickoffUtc:kickoff,homeTeamId:1,awayTeamId:2};
const later='2026-09-13T18:00:00.000Z';
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{...target,fixtureId:i+1,homeTeamId:i%6+1,awayTeamId:(i+1)%6+1,season:2025,kickoffUtc:new Date(Date.parse(cutoff)-(93-i)*86400000).toISOString()},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));
const predicted=compare(target,cutoff,cutoff,rows);

function temp(){return join(mkdtempSync(join(tmpdir(),'postgame-run-')),'football-v31-r1-prospective-shadow-v1');}
function sealBundle(root:string,bundle:typeof predicted){
 const selected=select(bundle.targetIdentity,bundle.cutoffAt,bundle.predictionCreatedAt,rows).selected;
 const snapshot={...structuredClone(bundle),sealedAt:cutoff};
 const dir=join(storeRoot(root),'fixtures',String(bundle.targetIdentity.fixtureId));
 const input=writeSeal(join(dir,'input.json'),selected),snap=writeSeal(join(dir,'snapshot.json'),snapshot);
 const expected:ExpectedSeal={...bundle.targetIdentity,cutoffAt:bundle.cutoffAt,predictionCreatedAt:bundle.predictionCreatedAt,snapshotHash:snap.sha256,v1PredictionHash:bundle.sameCutoffV1.sha256,h2PredictionHash:bundle.sameCutoffH2.sha256,r1PredictionHash:bundle.r1.sha256,inputHash:input.sha256};
 return {expected,input,snap,dir};
}
function ft(expected:ExpectedSeal,home=2,away=1):ResultObservation{
 return {...expected,fixtureStatus:'FT',regularTime:{home,away},resultObservedAt:later,providerFetchedAt:later,sourceHash:'c'.repeat(64)};
}
function provider(expected:ExpectedSeal,status:string,home:number|null,away:number|null){
 return {errors:{},results:1,response:[{fixture:{id:expected.fixtureId,date:expected.kickoffUtc,status:{short:status}},league:{id:expected.leagueId,season:expected.season},teams:{home:{id:expected.homeTeamId},away:{id:expected.awayTeamId}},score:{fulltime:{home,away}}}]};
}
function clockAt(iso:string){return ()=>Date.parse(iso);}
function requestFt(expected:ExpectedSeal):typeof fetch{
 return (async ()=>new Response(JSON.stringify(provider(expected,'FT',2,1)),{status:200})) as typeof fetch;
}

test('first run creates receipt',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-one'});
 assert.equal(out.receipt.schemaVersion,RUN_RECEIPT_SCHEMA);
 assert.equal(out.receipt.runId,'run-one');
 assert.equal(out.runReceiptPath,runReceiptPath(root,'run-one'));
 assert.equal(existsSync(out.runReceiptPath),true);
 assert.equal(readSeal(out.runReceiptPath).sha256,out.artifactHash);
 assert.equal(out.scorecard.RESULT_AVAILABLE,1);
 assert.equal(out.outcomes[0].status,'GRADED');
});

test('second run creates different receipt',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const first=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-a'});
 const second=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-b'});
 assert.notEqual(first.runReceiptPath,second.runReceiptPath);
 assert.notEqual(first.receipt.runId,second.receipt.runId);
 assert.equal(existsSync(first.runReceiptPath),true);
 assert.equal(existsSync(second.runReceiptPath),true);
 assert.equal(readdirSync(runReceiptDir(root)).sort().join(','),'run-a.json,run-b.json');
});

test('first receipt remains byte-identical',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const first=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-a'});
 const bytes=readFileSync(first.runReceiptPath);
 await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-b'});
 assert.deepEqual(readFileSync(first.runReceiptPath),bytes);
});

test('existing graded fixture returns ALREADY_GRADED_IMMUTABLE',async()=>{
 const root=temp(),{expected,dir}=sealBundle(root,predicted);
 const graded=gradeFixture(root,expected,ft(expected),clockAt(later));
 const bytes=readFileSync(artifactPath(root,expected.fixtureId));
 const names=readdirSync(dir).sort();
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-refresh'});
 assert.equal(graded.status,'GRADED');
 assert.equal(out.outcomes[0].status,'ALREADY_GRADED_IMMUTABLE');
 assert.equal(out.outcomes[0].artifactHash,graded.artifactHash);
 assert.equal(out.receipt.requests,0);
 assert.deepEqual(readFileSync(artifactPath(root,expected.fixtureId)),bytes);
 assert.deepEqual(readdirSync(dir).sort(),names);
});

test('invalid legacy fixed receipt does not block refresh',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 mkdirSync(dirname(legacyReceiptPath(root)),{recursive:true});
 writeFileSync(legacyReceiptPath(root),JSON.stringify({payload:{broken:true},sha256:'0'.repeat(64)}));
 const legacy=readFileSync(legacyReceiptPath(root));
 assert.equal(diagnoseLegacyReceipt(root),'INVALID_SEAL_HASH');
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-after-invalid'});
 assert.equal(out.legacyReceiptStatus,'INVALID_SEAL_HASH');
 assert.equal(out.scorecard.RESULT_AVAILABLE,1);
 assert.equal(existsSync(out.runReceiptPath),true);
 assert.notEqual(out.runReceiptPath,legacyReceiptPath(root));
 assert.deepEqual(readFileSync(legacyReceiptPath(root)),legacy);
});

test('valid legacy receipt does not get reused as current receipt',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const legacy=writeSeal(legacyReceiptPath(root),{schemaVersion:'LEGACY',note:'fixed-path-receipt'});
 const bytes=readFileSync(legacyReceiptPath(root));
 assert.equal(diagnoseLegacyReceipt(root),'VALID');
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-current'});
 assert.equal(out.legacyReceiptStatus,'VALID');
 assert.notEqual(out.runReceiptPath,legacyReceiptPath(root));
 assert.notEqual(out.artifactHash,legacy.sha256);
 assert.equal(out.receipt.runId,'run-current');
 assert.deepEqual(readFileSync(legacyReceiptPath(root)),bytes);
});

test('new receipt seal verifies',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-seal'});
 const seal=readSeal<typeof out.receipt>(out.runReceiptPath);
 assert.equal(digest(seal.payload),seal.sha256);
 assert.equal(seal.sha256,out.artifactHash);
 assert.equal(seal.payload.WATCH_STARTED,'NO');
 assert.equal(seal.payload.ODDS_USED,false);
 assert.equal(seal.payload.MODEL_REFIT,false);
 assert.equal(seal.payload.PREGAME_MUTATED,false);
 assert.equal(seal.payload.INTERPRETATION,'EARLY_DESCRIPTIVE_ONLY');
 assert.equal(seal.payload.MODEL_PROMOTED,'NO');
});

test('scorecard reflects current postgame artifacts',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 gradeFixture(root,expected,ft(expected),clockAt(later));
 const out=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-card'});
 assert.equal(out.scorecard.TOTAL_SEALED,1);
 assert.equal(out.scorecard.RESULT_AVAILABLE,1);
 assert.equal(out.scorecard.RESULT_PENDING,0);
 assert.equal(out.scorecard.RESULT_BLOCKED,0);
 assert.equal(out.receipt.TOTAL_SEALED,1);
 assert.equal(out.receipt.RESULT_AVAILABLE,1);
 assert.equal(out.receipt.R1_PREDICTED_GRADED,1);
 assert.equal(out.receipt.V1_PREDICTED_GRADED,1);
 assert.equal(out.receipt.H2_PREDICTED_GRADED,1);
 assert.equal(out.scorecard.interpretation,'EARLY_DESCRIPTIVE_ONLY');
});

test('no pregame mutation',async()=>{
 const root=temp(),{expected,dir}=sealBundle(root,predicted);
 const before={input:readFileSync(join(dir,'input.json')),snapshot:readFileSync(join(dir,'snapshot.json'))};
 await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-1'});
 await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-2'});
 assert.deepEqual(readFileSync(join(dir,'input.json')),before.input);
 assert.deepEqual(readFileSync(join(dir,'snapshot.json')),before.snapshot);
});

test('no postgame overwrite',async()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const first=await collectOneShot(root,{expectedTargets:[expected],request:requestFt(expected),clock:clockAt(later),delayMs:0,key:'k',runId:'run-1'});
 const bytes=readFileSync(artifactPath(root,expected.fixtureId));
 const second=await collectOneShot(root,{expectedTargets:[expected],request:(async()=>{throw new Error('no-fetch');}) as typeof fetch,clock:clockAt(later),delayMs:0,key:'k',runId:'run-2'});
 assert.equal(first.outcomes[0].status,'GRADED');
 assert.equal(second.outcomes[0].status,'ALREADY_GRADED_IMMUTABLE');
 assert.deepEqual(readFileSync(artifactPath(root,expected.fixtureId)),bytes);
});

test('no watch',()=>{
 const text=readFileSync(fileURLToPath(new URL('./run-v1.ts',import.meta.url)),'utf8');
 assert.doesNotMatch(text,/\bwatch\s*\(|\bdaemon\b/i);
 assert.match(text,/WATCH_STARTED:'NO'/);
});

test('no market/model/refit imports',()=>{
 function walk(file:string,seen=new Set<string>()):string[]{
  if(seen.has(file)||!file.endsWith('.ts'))return [...seen];seen.add(file);
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g))if(m[1].startsWith('.'))walk(resolve(dirname(file),m[1].endsWith('.ts')?m[1]:m[1]+'.ts'),seen);
  return [...seen];
 }
 for(const file of walk(fileURLToPath(new URL('./run-v1.ts',import.meta.url)))){
  const text=readFileSync(file,'utf8');
  assert.doesNotMatch(text,/from ['"][^'"]*recommendation[^'"]*['"]/);
  assert.doesNotMatch(text,/\b(predictFootball|fitRates|predictRates|kernel|compare|loadParameters|joint|appendGrade|predict)\s*\(/);
  assert.doesNotMatch(text,/football-forward|run-development|evaluator|metrics-v1/);
 }
});
