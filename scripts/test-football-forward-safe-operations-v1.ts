import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {freeze,auditCoverage,markMiss,envelope,sha,type Fixture,type Completed} from './football-forward-shadow-v1';
import {observeSchedule,scheduleState,restoreScheduleLedger} from './football-forward-schedule-ledger-v1';
import {collectPostgame,projectFt} from './run-football-forward-postgame-v1';
import {generateScorecards,milestoneCrossings} from './football-forward-scorecard-v1';
import {grade} from './football-forward-postgame-v1';
const kickoff=Date.parse('2026-09-12T15:00:00.000Z'),before=kickoff-86400000,after=kickoff+7200000;
const temp=()=>mkdtempSync(join(tmpdir(),'safe-forward-'));
const fixture=(id=100,fetched=before-1000):Fixture=>({fixtureId:id,leagueId:39,season:2026,kickoffUtc:new Date(kickoff).toISOString(),homeTeam:{id:1,name:'Home'},awayTeam:{id:2,name:'Away'},providerStatus:'NS',scheduleFetchedAt:new Date(fetched).toISOString()});
const history=():Completed[]=>Array.from({length:40},(_,i)=>({providerFixtureId:1000+i,leagueId:39,homeTeamId:i<10?1:3,awayTeamId:i<10?4:2,kickoffUtc:new Date(before-(i+2)*86400000).toISOString(),fixtureStatus:'FT',fullTimeHomeGoals:2,fullTimeAwayGoals:1,providerFetchedAt:new Date(before-1000).toISOString(),sourceHash:sha('synthetic FT')}));
const result=(id=100)=>({fixtureId:id,leagueId:39,fixtureStatus:'FT' as const,actualScore:{home:2,away:1},providerFetchedAt:new Date(after).toISOString(),sourceHash:sha('synthetic result')});
const raw=(id=100,status='FT')=>({fixture:{id,date:new Date(kickoff).toISOString(),status:{short:status}},league:{id:39},score:{fulltime:{home:2,away:1}}});
const pregameBytes=(root:string,id=100)=>['snapshot.json','input.json','seal-receipt.json'].map(n=>readFileSync(join(root,'MODEL_FORWARD','fixtures',String(id),n),'utf8'));
const mockFetch=(status='FT'):typeof fetch=>async(url,init)=>{assert.equal(String(url),'https://v3.football.api-sports.io/fixtures?id=100');assert.equal(init?.redirect,'error');return new Response(JSON.stringify({errors:[],results:1,response:[raw(100,status)]}),{status:200});};

test('pre-observed absence is MISS; late discovery is separate and cannot backfill',()=>{
  const root=temp();observeSchedule(root,fixture(),sha('before'),before);
  const earlyBytes=readFileSync(join(root,'MODEL_FORWARD','schedule-ledger','100','first.json'),'utf8');
  const reread=fixture(100,after);assert.equal(freeze(root,reread,()=>after).kind,'MISSED');
  assert.equal(readFileSync(join(root,'MODEL_FORWARD','schedule-ledger','100','first.json'),'utf8'),earlyBytes);
  const late=fixture(101,after);assert.equal(freeze(root,late,()=>after).kind,'FIRST_SEEN_AFTER_KICKOFF');
  assert.ok(!existsSync(join(root,'MODEL_FORWARD','fixtures','101','miss.json')));
  assert.equal(freeze(root,{...late,kickoffUtc:new Date(after+86400000).toISOString()},()=>after+1).kind,'FIRST_SEEN_AFTER_KICKOFF');
  const card=auditCoverage(root,[reread,late],after)[0].payload;assert.equal(card.missed,1);assert.equal(card.firstSeenAfterKickoff,1);
  assert.throws(()=>markMiss(root,late,after),/FIRST_SEEN_AFTER/);
});
test('first observation and source remain immutable across provider schedule changes',()=>{
  const root=temp(),f=fixture();observeSchedule(root,f,sha('a'),before);
  observeSchedule(root,{...f,kickoffUtc:new Date(kickoff+3600000).toISOString(),scheduleFetchedAt:new Date(before+1000).toISOString()},sha('b'),before+1000);
  const state=scheduleState(root,100);assert.equal(state.first.firstObservedAt,f.scheduleFetchedAt);assert.equal(state.first.firstSourceHash,sha('a'));assert.equal(state.observations.length,2);assert.equal(state.latest.latestObservedAt,new Date(before+1000).toISOString());
});
test('restore uses sealed actual observation, never fabricates pregame evidence for delayed discovery',()=>{
  const root=temp(),runs=join(root,'MODEL_FORWARD','runs');mkdirSync(runs,{recursive:true});
  writeFileSync(join(runs,'old-schedule.json'),JSON.stringify(envelope({fixtures:[fixture(100,after)]})));
  restoreScheduleLedger(root,after+1);assert.equal(freeze(root,fixture(100,after+1),()=>after+1).kind,'FIRST_SEEN_AFTER_KICKOFF');
  assert.equal(scheduleState(root,100).first.firstObservedAt,new Date(after).toISOString());
});
test('official collector grades valid FT, verifies existing grade without API and preserves pregame bytes',async()=>{
  const root=temp();freeze(root,fixture(),()=>before,history());const original=pregameBytes(root);
  const first=await collectPostgame(root,'TEST_KEY',{clock:()=>after,fetcher:mockFetch(),delayMs:0});assert.equal(first.payload.gradedThisRun,1);assert.equal(first.payload.errors,0);
  assert.deepEqual(pregameBytes(root),original);const gradeFile=join(root,'MODEL_FORWARD','postgame','100.json'),bytes=readFileSync(gradeFile,'utf8');
  const second=await collectPostgame(root,'TEST_KEY',{clock:()=>after+1,fetcher:async()=>{throw Error('MUST_NOT_CALL');},delayMs:0});
  assert.equal(second.payload.requests,0);assert.equal(second.payload.errors,0);assert.equal(readFileSync(gradeFile,'utf8'),bytes);
  assert.throws(()=>markMiss(root,fixture(),after),/SEALED_FIXTURE/);
});
test('future and non-FT fixtures remain pending without grade',async()=>{
  const root=temp();freeze(root,fixture(),()=>before);
  const future=await collectPostgame(root,undefined,{clock:()=>before+1000,fetcher:async()=>{throw Error('NO_REQUEST');}});assert.equal(future.payload.requests,0);assert.equal(future.payload.errors,0);
  const live=await collectPostgame(root,'TEST_KEY',{clock:()=>after,fetcher:mockFetch('2H'),delayMs:0});assert.equal(live.payload.gradedThisRun,0);assert.equal(live.payload.errors,0);assert.ok(!existsSync(join(root,'MODEL_FORWARD','postgame','100.json')));
});
test('FT projection ignores market/predictions and non-FT score; identity mismatch fails closed',()=>{
  const r=raw();for(const key of ['odds','predictions','ownerShadow','externalShadow'])Object.defineProperty(r,key,{get(){throw Error('FORBIDDEN_READ');}});
  assert.equal(projectFt(r,100,39,fixture().kickoffUtc,new Date(after).toISOString(),sha('a'))?.actualScore.home,2);
  const live=raw(100,'2H');Object.defineProperty(live,'score',{get(){throw Error('SCORE_READ');}});assert.equal(projectFt(live,100,39,fixture().kickoffUtc,new Date(after).toISOString(),sha('a')),null);
  assert.throws(()=>projectFt(raw(101),100,39,fixture().kickoffUtc,new Date(after).toISOString(),sha('a')));
});
test('grade preflight rejects each tampered seal and late receipt without creating grade',()=>{
  for(const name of ['snapshot.json','input.json','seal-receipt.json']){
    const root=temp();freeze(root,fixture(),()=>before);const path=join(root,'MODEL_FORWARD','fixtures','100',name);const obj=JSON.parse(readFileSync(path,'utf8'));obj.payload.tampered=true;writeFileSync(path,JSON.stringify(obj));
    assert.throws(()=>grade(root,result(),()=>after),/TAMPERED/);assert.ok(!existsSync(join(root,'MODEL_FORWARD','postgame','100.json')));
  }
  const root=temp();freeze(root,fixture(),()=>before);const path=join(root,'MODEL_FORWARD','fixtures','100','seal-receipt.json'),obj=JSON.parse(readFileSync(path,'utf8'));obj.payload.sealedAt=new Date(kickoff).toISOString();writeFileSync(path,JSON.stringify(envelope(obj.payload)));assert.throws(()=>grade(root,result(),()=>after),/RECEIPT_TIME/);
});
test('invalid, MISS, wrong league, non-FT and unavailable observations cannot grade',()=>{
  for(const flag of ['invalid.json','miss.json']){const root=temp();freeze(root,fixture(),()=>before);writeFileSync(join(root,'MODEL_FORWARD','fixtures','100',flag),'{}');assert.throws(()=>grade(root,result(),()=>after),/INVALID_PREGAME_STATE/);}
  const root=temp();freeze(root,fixture(),()=>before);
  assert.throws(()=>grade(root,{...result(),leagueId:140},()=>after));
  assert.throws(()=>grade(root,{...result(),fixtureStatus:'2H'} as never,()=>after));
  for(const fetched of [kickoff,after+1])assert.throws(()=>grade(root,{...result(),providerFetchedAt:new Date(fetched).toISOString()},()=>after));
});
test('PASS grades actual result with null correctness; scorecard excludes PASS from accuracy and milestones',()=>{
  const root=temp();freeze(root,fixture(),()=>before,history());freeze(root,fixture(101),()=>before);
  grade(root,result(),()=>after);assert.equal(grade(root,result(101),()=>after).payload.correct1X2,null);
  const report=generateScorecards(root,after),c=report.cards.find(c=>c.payload.date==='2026-09-12')!.payload;
  assert.equal(c.homePredictions!+c.drawPredictions!+c.awayPredictions!,c.predicted);assert.equal(c.graded!+c.pending!,c.predicted!+c.pass!);assert.equal(c.predictedCorrect!+c.predictedIncorrect!,c.gradedPredicted);
  assert.equal(c.graded,2);assert.equal(c.gradedPredicted,1);assert.equal(c.accuracy,1);assert.equal(c.scheduled,null);assert.equal(report.milestones?.counter,1);assert.deepEqual(report.milestones?.reached,[]);
  const firstFiles=readdirSync(join(root,'MODEL_FORWARD','scorecards','2026-09-12'));generateScorecards(root,after+1);assert.equal(readdirSync(join(root,'MODEL_FORWARD','scorecards','2026-09-12')).length,firstFiles.length+1);
});
test('tampered existing grade is an error, never overwritten or reported as zero known grades',async()=>{
  const root=temp();freeze(root,fixture(),()=>before);grade(root,result(),()=>after);
  const file=join(root,'MODEL_FORWARD','postgame','100.json'),g=JSON.parse(readFileSync(file,'utf8'));g.payload.actualScore.home=9;writeFileSync(file,JSON.stringify(g));const bytes=readFileSync(file,'utf8');
  const r=await collectPostgame(root,'TEST_KEY',{clock:()=>after+1,fetcher:mockFetch(),delayMs:0});assert.equal(r.payload.errors,1);assert.equal(r.payload.requests,0);assert.equal(readFileSync(file,'utf8'),bytes);
  const score=generateScorecards(root,after+1);assert.equal(score.totalGradedPredicted,null);assert.equal(score.milestones,null);assert.equal(score.cards.find(c=>c.payload.date==='2026-09-12')!.payload.graded,null);
});
test('exact checkpoint cohorts are deterministic, immutable and crossing-only',()=>{
  const root=temp(),refs=Array.from({length:50},(_,i)=>({fixtureId:i+1,predictionHash:sha('p'+i),gradeHash:sha('g'+i),gradedAt:new Date(after+i).toISOString()}));
  assert.deepEqual(milestoneCrossings(root,refs.slice(0,24)).reached,[]);assert.deepEqual(milestoneCrossings(root,refs.slice(0,25)).reached,[25]);
  const bytes=readFileSync(join(root,'MODEL_FORWARD','milestones','25.json'),'utf8');assert.deepEqual(milestoneCrossings(root,[...refs].reverse()).reached,[50]);assert.deepEqual(milestoneCrossings(root,refs).reached,[]);assert.equal(readFileSync(join(root,'MODEL_FORWARD','milestones','25.json'),'utf8'),bytes);
});
