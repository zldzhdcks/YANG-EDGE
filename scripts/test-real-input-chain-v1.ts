import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectFixtureEvidence} from '../src/lib/football/foundation/pregame-fixture-evidence';
import {selectExactFixture,type PregameIdentity} from '../src/lib/betman/daily-slate/exact-pregame-identity';
import {collectMlbInputManifest,loadSealedMlbInput,type MlbManifestTarget,type Dataset} from '../src/lib/mlb/prediction-v0/sealed-input-manifest';
import {loadAndPredictMlbV0,hashPredictions} from '../src/lib/mlb/prediction-v0/load-and-predict';
import {envelope,sha} from '../src/lib/research/terminal-decision/evidence';
import {freezeResearchSlateSource} from '../src/lib/research/slate-source-freeze';
import {lockResearchTargetScope,operatorBetmanDailySlateRel} from '../src/lib/research/daily-scope-lock';
import {loadScope,readDecisionCoverage} from '../src/lib/research/terminal-decision';
import {runLockedSealedForward} from './football-locked-sealed-forward-v1';

const start=new Date(Date.now()+3*86400000).toISOString(),date=new Date(Date.parse(start)+9*3600000).toISOString().slice(0,10);
const now=new Date().toISOString(),past=new Date(Date.now()-60000).toISOString(),scope='a'.repeat(64);
const f:PregameIdentity={provider:'API_FOOTBALL',fixtureId:123,leagueId:39,season:2026,kickoffUtc:start,homeTeamId:1,awayTeamId:2,homeTeamName:'Home',awayTeamName:'Away',status:'NS',observedAt:past};
const claim={fixtureId:123,homeTeamId:1,awayTeamId:2,leagueId:39,kickoff:start,verified:true};
test('soccer A exact fixture and directed IDs',()=>assert.equal(selectExactFixture(claim,[f],now).status,'EXACT_MATCH'));
test('soccer B team IDs league kickoff',()=>assert.equal(selectExactFixture({...claim,fixtureId:undefined},[f],now).status,'EXACT_MATCH'));
test('soccer C similar names without IDs never match',()=>assert.equal(selectExactFixture({...claim,homeTeamId:undefined},[f],now).status,'NO_PROVIDER_EVIDENCE'));
test('soccer D two possible fixtures ambiguous',()=>assert.equal(selectExactFixture({...claim,fixtureId:undefined},[f,{...f,fixtureId:124}],now).status,'AMBIGUOUS'));
test('soccer E reversed sides conflict',()=>assert.equal(selectExactFixture({...claim,homeTeamId:2,awayTeamId:1},[f],now).status,'CONFLICT'));
test('soccer F kickoff mismatch conflict',()=>assert.equal(selectExactFixture({...claim,kickoff:new Date(Date.parse(start)+1000).toISOString()},[f],now).status,'CONFLICT'));
test('soccer G neutral does not swap designated IDs',()=>assert.equal(selectExactFixture({...claim},[f],now).status,'EXACT_MATCH'));
test('soccer H post-start observation rejected',()=>assert.equal(selectExactFixture(claim,[{...f,observedAt:new Date(Date.parse(start)+1).toISOString()}],now).status,'CONFLICT'));
const temp=(t:any)=>{const p=mkdtempSync(join(tmpdir(),'ye-input-chain-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;};
const json=(p:string,v:unknown)=>{mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,JSON.stringify(v));};
test('soccer collector projects away result fields and seals exclusively',async t=>{
 const p=join(temp(t),'fixtures.json');const transport=(async(url:any)=>{assert.equal(new URL(url).searchParams.get('status'),'NS');return {ok:true,json:async()=>({errors:[],paging:{total:1},response:[{fixture:{id:123,date:start,status:{short:'NS'}},league:{id:39,season:2026},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}},score:{fulltime:{home:999,away:999}}}]})};}) as typeof fetch;
 const e=await collectFixtureEvidence(date,39,2026,p,transport);assert.equal(e.payload.fixtures[0].fixtureId,123);assert.ok(!readFileSync(p,'utf8').includes('999'));assert.ok(e.payload.collectedAt<=e.payload.observedAt);
 await assert.rejects(()=>collectFixtureEvidence(date,39,2026,p,transport));
});
test('soccer collector cannot retrieve September 20 or unsupported league',async t=>{const p=join(temp(t),'x');await assert.rejects(()=>collectFixtureEvidence('2026-09-20',39,2026,p));await assert.rejects(()=>collectFixtureEvidence(date,61,2026,p));});

const target:MlbManifestTarget={provider:'MLB_STATS_API',targetId:'operator-1',gamePk:123,homeTeamId:'1',awayTeamId:'2',scheduledStart:start,dateKst:date};
function docs(){const meta=(schemaVersion:string)=>({schemaVersion,generatedAt:past});return {
 Schedule:{meta:meta('mlb-schedule-v1'),games:[{gamePk:123,internalGameId:'synthetic-home-away',homeTeam:'Home',awayTeam:'Away',homeTeamId:1,awayTeamId:2,commenceTimeUtc:start,startTimeKst:start,statusDetailed:'Scheduled'}]},
 Starter:{meta:meta('mlb-starter-v1'),summary:{targetGameIncludedInStats:0,cutoffViolations:0},rows:['home','away'].map((side,i)=>({gamePk:123,side,teamId:i===0?1:2,opponentTeamId:i===0?2:1,probablePitcherId:10+i,probablePitcherName:side,seasonStats:{era:3+i,whip:1.1,inningsPitched:90,strikeOuts:90,baseOnBalls:20},statsAsOf:past,cutoffTime:start}))},
 Lineup:{meta:meta('mlb-lineup-v1'),rows:['home','away'].map(side=>({gamePk:123,side,teamId:side==='home'?1:2,opponentTeamId:side==='home'?2:1,collectionStatus:'CONFIRMED',lineupStatus:'COMPLETE',sourceTimestamp:past,cutoffTime:start,batters:Array.from({length:9},(_,i)=>({id:i+1}))}))},
 Odds:{meta:meta('mlb-odds-v1'),rows:[{gamePk:123,homeTeam:'Home',awayTeam:'Away',collectionStatus:'COLLECTED',capturedAt:past,cutoffTime:start,markets:[{marketType:'moneyline',selection:'home',priceDecimal:1.9},{marketType:'moneyline',selection:'away',priceDecimal:2.0}]}]}
};}
async function mlb(t:any){const root=temp(t),d=docs();const m=await collectMlbInputManifest(root,'manifest.json',target,scope,async kind=>({bytes:Buffer.from(JSON.stringify(d[kind])),sourceIdentity:'SYNTHETIC:'+kind,sourceAsOf:past}));return {root,m};}
test('mlb A valid manifest and hashes consumed by actual unchanged predictor without Provider',async t=>{
 const {root,m}=await mlb(t);const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('PREDICTOR_NETWORK_FORBIDDEN');};try{
 const r=await loadAndPredictMlbV0({cwd:root,dateKst:date,sealedInput:{path:'manifest.json',sha256:m.sha256,scopeSha256:scope,target}});
 assert.equal(r.kind,'ready');if(r.kind==='ready'){assert.equal(r.games.length,1);assert.equal(r.inputManifestHash,m.sha256);assert.ok(r.games[0].marketPredictions[0].homeProbability>0);}
 }finally{globalThis.fetch=original;}
});
test('mlb B changed bytes rejected',async t=>{const {root,m}=await mlb(t);writeFileSync(join(root,m.payload.inputs[0].artifactPath),'{}');assert.throws(()=>loadSealedMlbInput(root,'manifest.json',m.sha256,target,scope),/HASH/);});
test('mlb C missing artifact rejected',async t=>{const {root,m}=await mlb(t);rmSync(join(root,m.payload.inputs[0].artifactPath));assert.throws(()=>loadSealedMlbInput(root,'manifest.json',m.sha256,target,scope));});
test('mlb D post-start observation rejected',async t=>{const {root,m}=await mlb(t);m.payload.inputs[0].observedAt=new Date(Date.parse(start)+1).toISOString();const e=envelope(m.payload);json(join(root,'manifest.json'),e);assert.throws(()=>loadSealedMlbInput(root,'manifest.json',e.sha256,target,scope),/AS_OF/);});
test('mlb E wrong target rejected',async t=>{const {root,m}=await mlb(t);assert.throws(()=>loadSealedMlbInput(root,'manifest.json',m.sha256,{...target,gamePk:124},scope),/TARGET/);});
test('mlb F wrong scope rejected',async t=>{const {root,m}=await mlb(t);assert.throws(()=>loadSealedMlbInput(root,'manifest.json',m.sha256,target,'b'.repeat(64)),/SCOPE/);});
test('mlb G newer file ignored; source changes after read do not alter in-memory input',async t=>{const {root,m}=await mlb(t);const s=loadSealedMlbInput(root,'manifest.json',m.sha256,target,scope);const p=m.payload.inputs.find(i=>i.artifactType==='Starter')!.artifactPath;const before=await s.readJson(p);json(join(root,'newer-starter.json'),{wrong:true});writeFileSync(join(root,p),'{}');assert.deepEqual(await s.readJson(p),before);await assert.rejects(()=>s.readJson('newer-starter.json'));});
test('mlb H target/live fields rejected during collection',async t=>{const root=temp(t);await assert.rejects(()=>collectMlbInputManifest(root,'m.json',target,scope,async kind=>({bytes:Buffer.from(JSON.stringify({...docs()[kind],liveScore:1})),sourceIdentity:'synthetic',sourceAsOf:past})),/OUTCOME/);});
test('mlb production cannot silently fall back to unsealed date files',async t=>{const root=temp(t);const r=await loadAndPredictMlbV0({cwd:root,dateKst:date});assert.equal(r.kind,'blocked');if(r.kind==='blocked')assert.equal(r.message,'SEALED_INPUT_MANIFEST_REQUIRED');});
test('mlb same input bytes preserve legacy scoring fingerprint',async t=>{
 const {root,m}=await mlb(t);const input=m.payload.inputs.find(i=>i.artifactType==='Summary')!;
 json(join(root,`data/research/mlb/${date}-daily-research-summary-v1.json`),JSON.parse(readFileSync(join(root,input.artifactPath),'utf8')));
 const sealed=await loadAndPredictMlbV0({cwd:root,dateKst:date,sealedInput:{path:'manifest.json',sha256:m.sha256,scopeSha256:scope,target}});
 const legacy=await loadAndPredictMlbV0({cwd:root,dateKst:date,legacyOfflineResearch:true});
 assert.equal(sealed.kind,'ready');assert.equal(legacy.kind,'ready');if(sealed.kind==='ready'&&legacy.kind==='ready')assert.equal(hashPredictions(sealed.games),hashPredictions(legacy.games));
});
test('mlb missing away starter row provenance stays unsafe',async t=>{const root=temp(t),d=docs();(d.Starter.rows[1] as any).statsAsOf=null;await assert.rejects(()=>collectMlbInputManifest(root,'m.json',target,scope,async kind=>({bytes:Buffer.from(JSON.stringify(d[kind])),sourceIdentity:'synthetic',sourceAsOf:past})));});

test('soccer sealed collection -> exact bridge -> frozen Forward -> terminal Prediction; no network',async t=>{
 const cwd=temp(t);const game={operatorSlateGameId:'operator-soccer',sport:'SOCCER',competitionNameRaw:'EPL',competitionNameKo:null,operatorGameNumber:null,operatorMarketId:null,homeTeamRaw:'Home',awayTeamRaw:'Away',scheduledStartTimeKst:start,operatorHomeAwayStatus:'VERIFIED',marketRuleStatus:'VERIFIED',marketTypeRaw:null,marketSelections:[],reviewStatus:'VERIFIED',sourceReference:null,providerGameId:null,providerFixtureId:'123',capturedAt:null,manualIdentityReference:null,notes:null};
 json(join(cwd,operatorBetmanDailySlateRel(date)),{schemaVersion:'betman-daily-slate-v1',targetDateKst:date,sourceType:'OPERATOR_MANUAL',capturedAt:null,enteredAt:null,reviewedAt:past,reviewStatus:'VERIFIED',scopeCompletenessStatus:'COMPLETE',games:[game]});
 await freezeResearchSlateSource({cwd,dateKst:date});const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${cwd.replaceAll('\\','/')}`,...args],{cwd,stdio:'pipe'});git('init','--quiet');git('config','core.autocrlf','false');git('add','data');git('-c','user.name=Test','-c','user.email=test@invalid','-c','commit.gpgsign=false','commit','--quiet','-m','synthetic');await lockResearchTargetScope({cwd,dateKst:date});const s=loadScope(cwd,date);
 const sourceUtf8=JSON.stringify(f);const evidence=envelope({schemaVersion:'football-pregame-fixture-evidence-v1',collectedAt:past,observedAt:past,fixtures:[f]});json(join(cwd,'fixture.json'),evidence);
 const history=envelope({schemaVersion:'football-forward-observed-history-v1',sealedAt:past,observations:Array.from({length:40},(_,i)=>({providerFixtureId:1000+i,leagueId:39,homeTeamId:1,awayTeamId:2,kickoffUtc:new Date(Date.now()-(i+2)*86400000).toISOString(),fixtureStatus:'FT',fullTimeHomeGoals:2,fullTimeAwayGoals:1,providerFetchedAt:past,sourceHash:scope}))});json(join(cwd,'history.json'),history);
 const binding={targetId:game.operatorSlateGameId,scopeSha256:s.hash,homeRaw:'Home',awayRaw:'Away',competitionRaw:'EPL',providerFixtureId:123,homeProviderId:1,awayProviderId:2,leagueId:39,season:2026,scheduledStart:start,reviewStatus:'VERIFIED' as const,reviewedAt:now,evidenceSha256:sha(sourceUtf8)};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NO_NETWORK');};try{
 assert.throws(()=>runLockedSealedForward(cwd,date,game.operatorSlateGameId,{fixtureEvidencePath:join(cwd,'fixture.json'),fixtureEvidenceHash:'bad',binding,historyPath:join(cwd,'history.json'),historyHash:history.sha256}));assert.equal(readDecisionCoverage(cwd,date).UNRESOLVED_COUNT,1);assert.equal(readDecisionCoverage(cwd,date).SEALED_PASS_COUNT,0);
 const r=runLockedSealedForward(cwd,date,game.operatorSlateGameId,{fixtureEvidencePath:join(cwd,'fixture.json'),fixtureEvidenceHash:evidence.sha256,binding,historyPath:join(cwd,'history.json'),historyHash:history.sha256});assert.equal(r.readiness,'SEALED');assert.equal(readDecisionCoverage(cwd,date).SEALED_PREDICTION_COUNT,1);
 assert.throws(()=>runLockedSealedForward(cwd,date,game.operatorSlateGameId,{fixtureEvidencePath:join(cwd,'fixture.json'),fixtureEvidenceHash:evidence.sha256,binding,historyPath:join(cwd,'history.json'),historyHash:history.sha256}));
 }finally{globalThis.fetch=oldFetch;}
});
