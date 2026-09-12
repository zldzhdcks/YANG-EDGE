import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compare} from '../football-v31-r1-comparator-v1/comparator-v1';
import {select} from '../football-v31-r1-prospective-v1/adapter-v1';
import {NAMESPACE,digest,readSeal,writeSeal,storeRoot,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {gradeFixture,projectResult,scorecard,artifactPath,readEnvelope,LOG_LOSS_FLOOR,type ExpectedSeal,type ResultObservation} from './grader-v1';

const cutoff='2026-09-12T10:00:00.000Z',kickoff='2026-09-13T15:00:00.000Z',observed='2026-09-12T09:00:00.000Z';
const target={fixtureId:99999,leagueId:39,season:2026,kickoffUtc:kickoff,homeTeamId:1,awayTeamId:2};
const later='2026-09-13T18:00:00.000Z';
const rows:Observation[]=Array.from({length:90},(_,i)=>({observationId:String(i+1),namespace:NAMESPACE,fixture:{...target,fixtureId:i+1,homeTeamId:i%6+1,awayTeamId:(i+1)%6+1,season:2025,kickoffUtc:new Date(Date.parse(cutoff)-(93-i)*86400000).toISOString()},round:'Regular Season - 1',fixtureStatus:'FT',providerFetchedAt:observed,sealCreatedAt:observed,features:{xG:[1.2,1.1],shots:[12,10],sot:[4,3]},presence:{xG:['VALUE','VALUE'],shots:['VALUE','VALUE'],sot:['VALUE','VALUE']},rawPath:'SYNTHETIC',rawResponseSha256:'a'.repeat(64),endpoint:'/fixtures/statistics?fixture='+(i+1),collectorVersion:'synthetic',completion:{providerFetchedAt:observed,rawHash:'b'.repeat(64),homeGoals:i%3+1,awayGoals:i%2+1},quality:'VALID',role:'PROSPECTIVE_INPUT_HISTORY_ONLY'}));
const predicted=compare(target,cutoff,cutoff,rows);
const passR1=compare({...target,fixtureId:99998},cutoff,cutoff,rows.map(o=>({...o,features:{xG:null,shots:null,sot:null},quality:'MISSING_FEATURE' as const})));

function temp(){return join(mkdtempSync(join(tmpdir(),'postgame-')),'football-v31-r1-prospective-shadow-v1');}
function sealBundle(root:string,bundle:typeof predicted){
 const selected=select(bundle.targetIdentity,bundle.cutoffAt,bundle.predictionCreatedAt,bundle.targetIdentity.fixtureId===99998?rows.map(o=>({...o,features:{xG:null,shots:null,sot:null},quality:'MISSING_FEATURE' as const})):rows).selected;
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
function hashes(root:string,id:number){
 const dir=join(storeRoot(root),'fixtures',String(id));
 return {input:digest(JSON.parse(readFileSync(join(dir,'input.json'),'utf8'))),snapshot:digest(JSON.parse(readFileSync(join(dir,'snapshot.json'),'utf8'))),names:readdirSync(dir).sort()};
}
function walk(file:string,seen=new Set<string>()):string[]{
 if(seen.has(file)||!file.endsWith('.ts'))return [...seen];seen.add(file);
 const text=readFileSync(file,'utf8');
 for(const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g))if(m[1].startsWith('.'))walk(resolve(dirname(file),m[1].endsWith('.ts')?m[1]:m[1]+'.ts'),seen);
 return [...seen];
}

test('valid triple envelope grade',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted),before=hashes(root,target.fixtureId);
 const p=predicted.r1.payload.probabilities!;assert.equal(predicted.r1.payload.status,'PREDICTED');
 const out=gradeFixture(root,expected,ft(expected,2,1),()=>Date.parse(later));
 assert.equal(out.status,'GRADED');
 const a=readSeal<{r1Grade:{correct:boolean;logLoss:number;multiclassBrier:number;predictedClass:string;actualClass:string};v1Grade:{status:string};h2Grade:{status:string}}>(artifactPath(root,target.fixtureId));
 assert.equal(a.payload.r1Grade.actualClass,'HOME');assert.equal(a.payload.r1Grade.predictedClass,predicted.r1.payload.class);
 assert.equal(a.payload.r1Grade.correct,predicted.r1.payload.class==='HOME');
 assert.ok(Math.abs(a.payload.r1Grade.logLoss- -Math.log(Math.max(p[0],LOG_LOSS_FLOOR)))<1e-12);
 assert.ok(Math.abs(a.payload.r1Grade.multiclassBrier-((p[0]-1)**2+p[1]**2+p[2]**2))<1e-12);
 assert.equal(a.payload.v1Grade.status,'GRADED');assert.equal(a.payload.h2Grade.status,'GRADED');
 assert.deepEqual(hashes(root,target.fixtureId),{...before,names:['input.json','postgame-v1.json','snapshot.json']});
});

test('prediction hash mismatch fail closed',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 assert.throws(()=>gradeFixture(root,{...expected,v1PredictionHash:'0'.repeat(64)},ft(expected)),/PREDICTION_HASH_MISMATCH/);
 assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
 assert.deepEqual(readdirSync(join(storeRoot(root),'fixtures',String(target.fixtureId))).sort(),['input.json','snapshot.json']);
});

test('snapshot hash mismatch fail closed',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 assert.throws(()=>gradeFixture(root,{...expected,snapshotHash:'0'.repeat(64)},ft(expected)),/SNAPSHOT_HASH_MISMATCH/);
 assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
});

test('target identity mismatch fail closed',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 assert.throws(()=>gradeFixture(root,{...expected,homeTeamId:99},ft({...expected,homeTeamId:99})),/TARGET_IDENTITY_MISMATCH/);
 assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
});

test('unfinished result remains pending',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const projected=projectResult(provider(expected,'2H',1,0),expected,later,later,'d'.repeat(64));
 assert.equal(projected.status,'RESULT_PENDING');
 const out=gradeFixture(root,expected,{...ft(expected),fixtureStatus:'2H',regularTime:null});
 assert.equal(out.status,'RESULT_PENDING');assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
});

test('R1 PASS preserved',()=>{
 const root=temp(),{expected}=sealBundle(root,passR1);
 assert.equal(passR1.r1.payload.status,'PASS');
 const out=gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 const a=readSeal<{r1Grade:{status:string;predictedClass:null;correct:null;probabilities:null}}>(artifactPath(root,99998));
 assert.equal(out.status,'GRADED');assert.equal(a.payload.r1Grade.status,'PREGAME_PASS_PRESERVED');
 assert.equal(a.payload.r1Grade.predictedClass,null);assert.equal(a.payload.r1Grade.correct,null);assert.equal(a.payload.r1Grade.probabilities,null);
});

test('V1/H2/R1 independently graded',()=>{
 const root=temp(),{expected}=sealBundle(root,passR1);
 gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 const a=readSeal<{v1Grade:{status:string;predictionStatus:string};h2Grade:{status:string;predictionStatus:string};r1Grade:{status:string;predictionStatus:string}}>(artifactPath(root,99998));
 assert.equal(a.payload.v1Grade.status,'GRADED');assert.equal(a.payload.v1Grade.predictionStatus,'PREDICTED');
 assert.equal(a.payload.h2Grade.status,'GRADED');assert.equal(a.payload.h2Grade.predictionStatus,'PREDICTED');
 assert.equal(a.payload.r1Grade.status,'PREGAME_PASS_PRESERVED');assert.equal(a.payload.r1Grade.predictionStatus,'PASS');
});

test('duplicate grade overwrite blocked',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const first=gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 const bytes=readFileSync(artifactPath(root,target.fixtureId));
 const second=gradeFixture(root,expected,ft(expected,0,3),()=>Date.parse(later)+1000);
 assert.equal(first.status,'GRADED');assert.equal(second.status,'ALREADY_GRADED_IMMUTABLE');
 assert.equal(second.artifactHash,first.artifactHash);assert.deepEqual(readFileSync(artifactPath(root,target.fixtureId)),bytes);
 const a=readSeal<{result:{regularTime:{home:number;away:number}}}>(artifactPath(root,target.fixtureId));
 assert.deepEqual(a.payload.result.regularTime,{home:2,away:1});
});

test('no pregame file mutation',()=>{
 const root=temp(),{expected,dir}=sealBundle(root,predicted);
 const before={input:readFileSync(join(dir,'input.json')),snapshot:readFileSync(join(dir,'snapshot.json'))};
 gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 assert.deepEqual(readFileSync(join(dir,'input.json')),before.input);
 assert.deepEqual(readFileSync(join(dir,'snapshot.json')),before.snapshot);
});

test('no market input',()=>{
 const dir=fileURLToPath(new URL('.',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts')&&f!=='test-v1.ts')){
  const text=readFileSync(join(dir,file),'utf8');
  assert.doesNotMatch(text,/\bodds\b|\bmarket\b|\bbookmaker\b|\brecommendation\b/i);
 }
});

test('no model/refit call',()=>{
 const files=walk(fileURLToPath(new URL('./grader-v1.ts',import.meta.url))).concat(walk(fileURLToPath(new URL('./run-v1.ts',import.meta.url))));
 for(const file of files){
  const text=readFileSync(file,'utf8');
  assert.doesNotMatch(text,/\b(predictFootball|fitRates|predictRates|kernel|compare|loadParameters|joint|appendGrade|predict)\s*\(/);
  assert.doesNotMatch(text,/football-forward|evaluator|metrics-v1|run-development|recommendation/);
 }
});

test('append-only behavior',()=>{
 const root=temp(),{expected,dir}=sealBundle(root,predicted);
 const out=gradeFixture(root,expected,ft(expected),()=>Date.parse(later));
 assert.equal(out.status,'GRADED');
 assert.throws(()=>writeSeal(artifactPath(root,target.fixtureId),{}),/EEXIST/);
 assert.deepEqual(readdirSync(dir).sort(),['input.json','postgame-v1.json','snapshot.json']);
 assert.equal(existsSync(join(dir,'grades')),false);
 const card=scorecard(root,[expected],[out]);
 assert.equal(card.TOTAL_SEALED,1);assert.equal(card.RESULT_AVAILABLE,1);assert.equal(card.interpretation,'EARLY_DESCRIPTIVE_ONLY');assert.equal(card.MODEL_PROMOTED,'NO');
});

test('AET remains blocked not graded',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const projected=projectResult(provider(expected,'AET',2,1),expected,later,later,'e'.repeat(64));
 assert.equal(projected.status,'RESULT_BLOCKED');assert.equal(projected.reason,'RESULT_STATUS_NOT_FT');
 assert.equal(gradeFixture(root,expected,{...ft(expected),fixtureStatus:'AET'}).status,'RESULT_BLOCKED');
 assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
});

test('result identity mismatch blocked without nearest matching',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const raw=provider(expected,'FT',1,0);raw.response[0].fixture.id=11111;
 assert.equal(projectResult(raw,expected,later,later,'f'.repeat(64)).reason,'RESULT_IDENTITY_UNCERTAIN');
 raw.response[0].fixture.id=expected.fixtureId;raw.response[0].fixture.date='2026-09-13T16:00:00.000Z';
 assert.equal(projectResult(raw,expected,later,later,'f'.repeat(64)).reason,'RESULT_IDENTITY_UNCERTAIN');
 assert.equal(gradeFixture(root,expected,{...ft(expected),homeTeamId:99}).status,'RESULT_BLOCKED');
 assert.equal(existsSync(artifactPath(root,target.fixtureId)),false);
});

test('envelope read binds all three prediction hashes',()=>{
 const root=temp(),{expected}=sealBundle(root,predicted);
 const snap=readEnvelope(root,expected);
 assert.equal(snap.sha256,expected.snapshotHash);
 assert.equal(snap.payload.sameCutoffV1.sha256,expected.v1PredictionHash);
 assert.equal(snap.payload.sameCutoffH2.sha256,expected.h2PredictionHash);
 assert.equal(snap.payload.r1.sha256,expected.r1PredictionHash);
});
