import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {freezeResearchSlateSource} from '../src/lib/research/slate-source-freeze';
import {lockResearchTargetScope,operatorBetmanDailySlateRel} from '../src/lib/research/daily-scope-lock';
import {loadScope,readDecisionCoverage,terminalRoot} from '../src/lib/research/terminal-decision';
import {sha,envelope,readEnvelope} from '../src/lib/research/terminal-decision/evidence';
import {collectMlbFromNormalized,officialMlbCollector,type MlbCollectionBinding} from '../src/lib/mlb/prediction-v0/collection-adapter';
import {loadAndPredictMlbV0,hashPredictions} from '../src/lib/mlb/prediction-v0/load-and-predict';
import {loadSealedMlbInput,inspectSealedMlbInputAt} from '../src/lib/mlb/prediction-v0/sealed-input-manifest';
import {runLockedMlbPrediction} from './mlb-locked-sealed-prediction-v1';
import {mlbPredictionDir} from '../src/lib/research/terminal-decision/mlb-reference';
import {runDailyPregame} from './daily-pregame-production-v1';
import {collectFixtureEvidence} from '../src/lib/football/foundation/pregame-fixture-evidence';

const write=(p:string,v:unknown)=>{mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,JSON.stringify(v));};
async function authority(t:any,offset=3*86400000,sport='BASEBALL'){
  const cwd=mkdtempSync(join(tmpdir(),'ye-next-slate-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  const start=new Date(Date.now()+offset).toISOString(),date=new Date(Date.parse(start)+9*3600000).toISOString().slice(0,10),past=new Date(Date.now()-60000).toISOString();
  const game={operatorSlateGameId:'operator-1',sport,competitionNameRaw:sport==='BASEBALL'?'MLB':'EPL',competitionNameKo:null,operatorGameNumber:null,operatorMarketId:null,homeTeamRaw:'Home',awayTeamRaw:'Away',scheduledStartTimeKst:start,operatorHomeAwayStatus:'VERIFIED',marketRuleStatus:'VERIFIED',marketTypeRaw:null,marketSelections:[],reviewStatus:'VERIFIED',sourceReference:null,providerGameId:sport==='BASEBALL'?'123':null,providerFixtureId:sport==='SOCCER'?'123':null,capturedAt:null,manualIdentityReference:null,notes:null};
  write(join(cwd,operatorBetmanDailySlateRel(date)),{schemaVersion:'betman-daily-slate-v1',targetDateKst:date,sourceType:'OPERATOR_MANUAL',capturedAt:null,enteredAt:null,reviewedAt:past,reviewStatus:'VERIFIED',scopeCompletenessStatus:'COMPLETE',games:[game]});
  await freezeResearchSlateSource({cwd,dateKst:date});
  const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${cwd.replaceAll('\\','/')}`,...args],{cwd,stdio:'pipe'});
  git('init','--quiet');git('config','core.autocrlf','false');git('add','data');git('-c','user.name=Test','-c','user.email=test@invalid','-c','commit.gpgsign=false','commit','--quiet','-m','synthetic');
  await lockResearchTargetScope({cwd,dateKst:date});git('add','data');git('-c','user.name=Test','-c','user.email=test@invalid','-c','commit.gpgsign=false','commit','--quiet','-m','synthetic scope');const scope=loadScope(cwd,date);
  const binding:MlbCollectionBinding={target:{provider:'MLB_STATS_API',targetId:'operator-1',gamePk:123,homeTeamId:'1',awayTeamId:'2',scheduledStart:start,dateKst:date},scopeSha256:scope.hash,homeName:'Home',awayName:'Away',reviewStatus:'VERIFIED',reviewedAt:past,oddsEventId:'synthetic-event',bookmakerKey:'synthetic-book'};
  return {cwd,date,start,past,scope,binding};
}
function transportFor(b:MlbCollectionBinding,change?:(v:any,url:URL)=>void){
 const calls:string[]=[];
 const transport=(async(url:any)=>{
   const u=new URL(url);calls.push(u.origin+u.pathname);let v:any;
   if(u.pathname.endsWith('/schedule'))v={dates:[{games:[{gamePk:123,gameDate:b.target.scheduledStart,status:{abstractGameState:'Preview'},teams:{home:{team:{id:1,name:'Home'},probablePitcher:{id:11,fullName:'H Pitcher'}},away:{team:{id:2,name:'Away'},probablePitcher:{id:12,fullName:'A Pitcher'}}},lineups:{homePlayers:Array.from({length:9},(_,i)=>({id:i+1,fullName:`H${i}`})),awayPlayers:Array.from({length:9},(_,i)=>({id:i+21,fullName:`A${i}`}))}}]}]};
   else if(u.pathname.endsWith('/stats'))v={stats:[{splits:Array.from({length:12},(_,i)=>({date:new Date(Date.now()-(i+2)*86400000).toISOString().slice(0,10),game:{gamePk:1000+i},stat:{inningsPitched:'6.0',earnedRuns:2,hits:5,baseOnBalls:1,strikeOuts:7,gamesStarted:1,gamesPlayed:1,homeRuns:0}}))}]};
   else v={id:b.oddsEventId,home_team:'Home',away_team:'Away',commence_time:b.target.scheduledStart,bookmakers:[{key:b.bookmakerKey,last_update:new Date(Date.now()-1000).toISOString(),markets:[{key:'h2h',outcomes:[{name:'Home',price:1.9},{name:'Away',price:2.0}]}]}]};
   change?.(v,u);return {ok:true,json:async()=>v};
 }) as typeof fetch;
 return {transport,calls};
}
async function acquired(t:any){
 const a=await authority(t),mock=transportFor(a.binding);const old=process.env.ODDS_API_KEY;process.env.ODDS_API_KEY='synthetic-not-a-secret';
 try{const m=await collectMlbFromNormalized(a.cwd,'inputs/manifest.json',a.binding,officialMlbCollector(a.binding,mock.transport));return {...a,m,calls:mock.calls,input:{path:'inputs/manifest.json',sha256:m.sha256,target:a.binding.target}};}
 finally{if(old===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=old;}
}
test('MLB concrete official collector -> normalized bytes -> manifest -> predictor, no predictor network',async t=>{
 const a=await acquired(t);assert.equal(a.calls.length,5);assert.ok(a.calls.every(p=>!p.includes('boxscore')&&!p.includes('feed/live')));
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NO_NETWORK');};try{
 const r=await loadAndPredictMlbV0({cwd:a.cwd,dateKst:a.date,sealedInput:{...a.input,scopeSha256:a.scope.hash}});assert.equal(r.kind,'ready');
 if(r.kind==='ready'){assert.equal(r.games[0].leakage.blocked,false);assert.equal(r.inputManifestHash,a.m.sha256);assert.equal(r.games[0].officialPick,null);}
 }finally{globalThis.fetch=old;}
 assert.ok(!JSON.stringify(a.m).includes('synthetic-not-a-secret'));
});
test('MLB native collection preserves exact scoring fingerprint',async t=>{
 const a=await acquired(t);const summary=a.m.payload.inputs.find(x=>x.artifactType==='Summary')!;
 write(join(a.cwd,`data/research/mlb/${a.date}-daily-research-summary-v1.json`),JSON.parse(readFileSync(join(a.cwd,summary.artifactPath),'utf8')));
 const x=await loadAndPredictMlbV0({cwd:a.cwd,dateKst:a.date,sealedInput:{...a.input,scopeSha256:a.scope.hash}}),y=await loadAndPredictMlbV0({cwd:a.cwd,dateKst:a.date,legacyOfflineResearch:true});
 assert.equal(x.kind,'ready');assert.equal(y.kind,'ready');if(x.kind==='ready'&&y.kind==='ready')assert.equal(hashPredictions(x.games),hashPredictions(y.games));
});
test('MLB adapter rejects reversed exact provider IDs before manifest',async t=>{
 const a=await authority(t),mock=transportFor(a.binding,v=>{if(v.dates)v.dates[0].games[0].teams.home.team.id=2;});
 await assert.rejects(()=>collectMlbFromNormalized(a.cwd,'m.json',a.binding,officialMlbCollector(a.binding,mock.transport)));assert.ok(!existsSync(join(a.cwd,'m.json')));
});
test('MLB adapter rejects live status without boxscore access',async t=>{
 const a=await authority(t),mock=transportFor(a.binding,v=>{if(v.dates)v.dates[0].games[0].status.abstractGameState='Live';});
 await assert.rejects(()=>collectMlbFromNormalized(a.cwd,'m.json',a.binding,officialMlbCollector(a.binding,mock.transport)),/NOT_PREGAME/);assert.equal(mock.calls.length,1);
});
test('MLB collection needs authoritative exact provider game and scope before network',async t=>{
 const a=await authority(t);let calls=0;
 await assert.rejects(()=>collectMlbFromNormalized(a.cwd,'m.json',{...a.binding,scopeSha256:'f'.repeat(64)},async()=>{calls++;throw Error('NEVER');}));assert.equal(calls,0);
});
test('MLB terminal adapter seals once and preserves restart bytes',async t=>{
 const a=await acquired(t);const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NO_NETWORK');};try{
 const r=await runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input);assert.equal(r.readiness,'SEALED');
 const p=join(terminalRoot(a.cwd,a.date),sha('operator-1'),'decision.json'),before=readFileSync(p);
 assert.equal((await runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input)).readiness,'PRESERVED');assert.deepEqual(readFileSync(p),before);
 assert.equal(readDecisionCoverage(a.cwd,a.date).SEALED_PREDICTION_COUNT,1);
 }finally{globalThis.fetch=old;}
});
test('MLB changed manifest artifact prevents terminal and can retry valid original bytes',async t=>{
 const a=await acquired(t),p=join(a.cwd,a.m.payload.inputs[0].artifactPath),bytes=readFileSync(p);writeFileSync(p,'{}');
 await assert.rejects(()=>runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input),/HASH/);assert.equal(readDecisionCoverage(a.cwd,a.date).UNRESOLVED_COUNT,1);
 writeFileSync(p,bytes);assert.equal((await runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input)).readiness,'SEALED');
});
test('MLB post-cutoff audit validates historical input at sealed prediction time without replay',async t=>{
 const a=await acquired(t);await runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input);
 const p=readEnvelope(join(mlbPredictionDir(a.cwd,a.scope.hash,'operator-1'),'prediction.json')).payload;
 inspectSealedMlbInputAt(a.cwd,a.input.path,a.input.sha256,a.binding.target,a.scope.hash,p.predictionCreatedAt);
 assert.throws(()=>inspectSealedMlbInputAt(a.cwd,a.input.path,a.input.sha256,a.binding.target,a.scope.hash,new Date(Date.parse(a.start)+1).toISOString()),/AS_OF/);
});
test('runner future input gaps remain pending; restart creates no early PASS',async t=>{
 const a=await authority(t);for(let i=0;i<2;i++){const r=await runDailyPregame(a.cwd,a.date);assert.equal(r.coverage.status,'COVERAGE_INCOMPLETE');assert.equal(r.coverage.UNRESOLVED_COUNT,1);assert.equal(r.coverage.SEALED_PASS_COUNT,0);assert.equal(r.rows[0].terminalResearchArtifact,false);}
});
test('runner expired window seals legitimate PASS and restart preserves it',async t=>{
 const a=await authority(t,-120000);const r=await runDailyPregame(a.cwd,a.date);assert.equal(r.coverage.SEALED_PASS_COUNT,1);
 const p=join(terminalRoot(a.cwd,a.date),sha('operator-1'),'decision.json'),before=readFileSync(p);assert.equal(JSON.parse(before.toString()).payload.reason,'PASS_PREGAME_WINDOW_MISSED');
 await runDailyPregame(a.cwd,a.date);assert.deepEqual(readFileSync(p),before);
});
test('runner MLB requires reviewed real evidence after collection; approved synthetic evidence admits once',async t=>{
 const a=await acquired(t);const plan={scopeSha256:a.scope.hash,targets:{'operator-1':{mlb:{...a.input,evidenceReview:{status:'VERIFIED' as const,manifestHash:a.m.sha256,reviewedAt:a.past}}}}};
 const bad=await runDailyPregame(a.cwd,a.date,plan);assert.equal(bad.coverage.UNRESOLVED_COUNT,1);assert.equal(bad.coverage.SEALED_PASS_COUNT,0);
 plan.targets['operator-1'].mlb.evidenceReview.reviewedAt=new Date().toISOString();
 const good=await runDailyPregame(a.cwd,a.date,plan);assert.equal(good.coverage.SEALED_PREDICTION_COUNT,1);
 const again=await runDailyPregame(a.cwd,a.date,plan);assert.equal(again.coverage.SEALED_PREDICTION_COUNT,1);
});
test('runner rejects uncommitted source and wrong scope before collection',async t=>{
 const a=await authority(t);await assert.rejects(()=>runDailyPregame(a.cwd,a.date,{scopeSha256:'f'.repeat(64),targets:{}}));
 writeFileSync(join(a.cwd,`data/research/daily-slates/${a.date}-research-slate-source-freeze-v1.json`),'{}');await assert.rejects(()=>runDailyPregame(a.cwd,a.date));
});
test('soccer runner invalid pinned evidence remains pending without fabricated identity',async t=>{
 const a=await authority(t,3*86400000,'SOCCER');const r=await runDailyPregame(a.cwd,a.date,{scopeSha256:a.scope.hash,targets:{'operator-1':{soccer:{fixtureEvidencePath:'missing',fixtureEvidenceHash:'bad',historyPath:'missing',historyHash:'bad',binding:{} as any}}}});
 assert.equal(r.coverage.UNRESOLVED_COUNT,1);assert.equal(r.coverage.SEALED_PASS_COUNT,0);
});
test('soccer real-evidence collector rejects duplicate IDs',async t=>{
 const a=await authority(t,3*86400000,'SOCCER');const row={fixture:{id:123,date:a.start,status:{short:'NS'}},league:{id:39,season:2026},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}}};
 await assert.rejects(()=>collectFixtureEvidence(a.date,39,2026,join(a.cwd,'f.json'),(async()=>({ok:true,json:async()=>({response:[row,row],errors:[],paging:{total:1}})})) as unknown as typeof fetch),/DUPLICATE/);
});
test('soccer daily runner consumes exact sealed inputs and restart preserves Prediction',async t=>{
 const a=await authority(t,3*86400000,'SOCCER');
 const f={provider:'API_FOOTBALL',fixtureId:123,leagueId:39,season:2026,kickoffUtc:a.start,homeTeamId:1,awayTeamId:2,homeTeamName:'Home',awayTeamName:'Away',status:'NS',observedAt:a.past};
 const e=envelope({schemaVersion:'football-pregame-fixture-evidence-v1',collectedAt:a.past,observedAt:a.past,fixtures:[f]});write(join(a.cwd,'fixture.json'),e);
 const h=envelope({schemaVersion:'football-forward-observed-history-v1',sealedAt:a.past,observations:Array.from({length:40},(_,i)=>({providerFixtureId:1000+i,leagueId:39,homeTeamId:1,awayTeamId:2,kickoffUtc:new Date(Date.now()-(i+2)*86400000).toISOString(),fixtureStatus:'FT',fullTimeHomeGoals:2,fullTimeAwayGoals:1,providerFetchedAt:a.past,sourceHash:'a'.repeat(64)}))});write(join(a.cwd,'history.json'),h);
 const binding={targetId:'operator-1',scopeSha256:a.scope.hash,homeRaw:'Home',awayRaw:'Away',competitionRaw:'EPL',providerFixtureId:123,homeProviderId:1,awayProviderId:2,leagueId:39,season:2026,scheduledStart:a.start,reviewStatus:'VERIFIED' as const,reviewedAt:new Date().toISOString(),evidenceSha256:sha(JSON.stringify(f))};
 const plan={scopeSha256:a.scope.hash,targets:{'operator-1':{soccer:{fixtureEvidencePath:'fixture.json',fixtureEvidenceHash:e.sha256,historyPath:'history.json',historyHash:h.sha256,binding}}}};
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NO_PREDICTION_NETWORK');};try{
 const r=await runDailyPregame(a.cwd,a.date,plan);assert.equal(r.coverage.SEALED_PREDICTION_COUNT,1);
 const p=join(terminalRoot(a.cwd,a.date),sha('operator-1'),'decision.json'),bytes=readFileSync(p);
 const again=await runDailyPregame(a.cwd,a.date,plan);assert.equal(again.coverage.SEALED_PREDICTION_COUNT,1);assert.deepEqual(readFileSync(p),bytes);
 }finally{globalThis.fetch=old;}
});
test('MLB unconfirmed lineup remains input gap, never manufactures confirmed rows',async t=>{
 const a=await authority(t),mock=transportFor(a.binding,v=>{if(v.dates)v.dates[0].games[0].lineups.homePlayers=[];});
 const collect=officialMlbCollector(a.binding,mock.transport);await collect('Schedule');await assert.rejects(()=>collect('Lineup'),/CONFIRMED_LINEUP_PENDING/);
});
test('MLB odds exact event mismatch rejected, no name or nearest-time fallback',async t=>{
 const a=await authority(t),mock=transportFor(a.binding,(v,u)=>{if(u.pathname.endsWith('/odds'))v.id='wrong-event';});
 const old=process.env.ODDS_API_KEY;process.env.ODDS_API_KEY='synthetic';try{
 const collect=officialMlbCollector(a.binding,mock.transport);await collect('Schedule');await assert.rejects(()=>collect('Odds'));
 }finally{if(old===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=old;}
});
test('MLB missing seal receipt fails closed without regenerating prediction',async t=>{
 const a=await acquired(t);await runLockedMlbPrediction(a.cwd,a.date,'operator-1',a.input);
 const p=join(mlbPredictionDir(a.cwd,a.scope.hash,'operator-1'),'receipt.json');rmSync(p);
 const r=readDecisionCoverage(a.cwd,a.date);assert.notEqual(r.status,'COVERAGE_COMPLETE');
 await assert.rejects(()=>runDailyPregame(a.cwd,a.date));assert.ok(!existsSync(p));
});
test('runner interrupted MLB acquisition retries a new immutable attempt and then avoids recollection',async t=>{
 const a=await authority(t),mock=transportFor(a.binding);let fail=true,calls=0;
 const oldFetch=globalThis.fetch,oldKey=process.env.ODDS_API_KEY;process.env.ODDS_API_KEY='synthetic';
 globalThis.fetch=(async(...args:Parameters<typeof fetch>)=>{calls++;if(fail&&String(args[0]).includes('/odds'))throw Error('SYNTHETIC_OUTAGE');return mock.transport(...args);}) as typeof fetch;
 try{
   const plan={scopeSha256:a.scope.hash,targets:{'operator-1':{mlbCollection:a.binding}}};
   const first=await runDailyPregame(a.cwd,a.date,plan);assert.equal(first.coverage.UNRESOLVED_COUNT,1);assert.equal(first.coverage.SEALED_PASS_COUNT,0);
   fail=false;const second=await runDailyPregame(a.cwd,a.date,plan);assert.equal(second.coverage.UNRESOLVED_COUNT,1);assert.equal(second.rows[0].blocker,'REAL_COLLECTOR_EVIDENCE_REVIEW_REQUIRED');
   const count=calls;await runDailyPregame(a.cwd,a.date,plan);assert.equal(calls,count);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=oldKey;}
});
