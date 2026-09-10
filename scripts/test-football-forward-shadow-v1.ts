import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {freeze,sha,canonical,envelope,MODEL_HASH,auditCoverage,validateFixture,type Fixture,type Completed} from './football-forward-shadow-v1';
import {projectSchedule,projectCompleted} from './run-football-forward-shadow-v1';
import {grade} from './football-forward-postgame-v1';
const T=Date.parse('2026-09-12T15:00:00.000Z'),now=T-86400000;
const fixture=():Fixture=>({fixtureId:100,leagueId:39,season:2026,kickoffUtc:new Date(T).toISOString(),homeTeam:{id:1,name:'Home'},awayTeam:{id:2,name:'Away'},providerStatus:'NS',scheduleFetchedAt:new Date(now-1000).toISOString()});
const temp=()=>mkdtempSync(join(tmpdir(),'forward-shadow-test-'));
test('schedule projection never reads target results or market fields',()=>{
  const raw={fixture:{id:100,date:new Date(T).toISOString(),status:{short:'NS'}},league:{id:39,season:2026},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}}};
  for(const k of ['goals','score','odds','predictions','ownerShadow','externalShadow'])Object.defineProperty(raw,k,{get(){throw Error('FORBIDDEN_ACCESS');}});
  assert.equal(projectSchedule(raw,39,2026,new Date(now).toISOString()).fixtureId,100);
  for(const k of ['actualScore','history','odds','ownerShadow','externalShadow'])assert.throws(()=>validateFixture({...fixture(),[k]:1} as Fixture),/NON_SCHEDULE/);
});
test('real frozen model hash and deterministic snapshot hash; PASS remains null',()=>{
  assert.equal(sha(readFileSync(new URL('../src/lib/football/poisson-research-v1/index.ts',import.meta.url),'utf8').replace(/\r\n/g,'\n')),MODEL_HASH);
  const a=freeze(temp(),fixture(),()=>now),b=freeze(temp(),fixture(),()=>now);assert.equal(a.kind,'SEALED');assert.equal(a.envelope?.sha256,b.envelope?.sha256);
  const p=a.envelope!.payload;assert.equal(p.status,'PASS');assert.equal(p.pHome,null);assert.equal(p.trainingMatchCount,0);assert.equal(p.TARGET_RESULT_DATA_USED,false);
  assert.equal(envelope({b:2,a:1}).sha256,sha(canonical({a:1,b:2})));
});
test('existing snapshot cannot be overwritten even after kickoff',()=>{
  const dir=temp(),first=freeze(dir,fixture(),()=>now);const file=join(dir,'MODEL_FORWARD','fixtures','100','snapshot.json'),bytes=readFileSync(file,'utf8');
  assert.equal(freeze(dir,fixture(),()=>T+1000).kind,'EXISTING');assert.equal(readFileSync(file,'utf8'),bytes);assert.equal(freeze(dir,fixture(),()=>now+10000).envelope?.sha256,first.envelope?.sha256);
});
test('post-kickoff fixture becomes permanent MISS and cannot be backfilled',()=>{
  const dir=temp();assert.equal(freeze(dir,fixture(),()=>T).kind,'MISSED');assert.ok(!existsSync(join(dir,'MODEL_FORWARD','fixtures','100','snapshot.json')));
  assert.equal(freeze(dir,{...fixture(),kickoffUtc:new Date(T+2*86400000).toISOString()},()=>T+100).kind,'MISSED');
  assert.equal(auditCoverage(dir,[fixture()],T+100)[0].payload.missed,1);
});
test('deadline crossed during prediction blocks snapshot publication',()=>{
  const dir=temp();let call=0;assert.throws(()=>freeze(dir,fixture(),()=>++call===1?now:T),/KICKOFF_PASSED/);assert.ok(!existsSync(join(dir,'MODEL_FORWARD','fixtures','100','snapshot.json')));
});
test('daily audit records missed snapshots without postgame backfill',()=>{
  const dir=temp();freeze(dir,fixture(),()=>now);const absent={...fixture(),fixtureId:101};const a=auditCoverage(dir,[fixture(),absent],T+100)[0].payload;
  assert.equal(a.scheduledFixtures,2);assert.equal(a.pass,1);assert.equal(a.predicted,0);assert.equal(a.missed,1);
});

const history=():Completed[]=>Array.from({length:40},(_,i)=>({providerFixtureId:1000+i,leagueId:39,homeTeamId:i<10?1:3,awayTeamId:i<10?4:2,kickoffUtc:new Date(now-(i+2)*86400000).toISOString(),fixtureStatus:'FT',fullTimeHomeGoals:2,fullTimeAwayGoals:1,providerFetchedAt:new Date(now-1000).toISOString(),sourceHash:sha('synthetic provider response')}));
test('actual observed FT history produces prediction and freezes each observation',()=>{
  const dir=temp(),h=history(),a=freeze(dir,fixture(),()=>now,h).envelope!;
  assert.equal(a.payload.status,'PREDICTED');assert.equal(a.payload.trainingMatchCount,40);assert.equal(a.payload.homeRelevantSampleCount,10);assert.equal(a.payload.awayRelevantSampleCount,30);
  assert.equal(a.payload.TARGET_RESULT_DATA_USED,false);assert.equal(a.payload.PAST_COMPLETED_RESULT_DATA_USED,true);
  const input=JSON.parse(readFileSync(join(dir,'MODEL_FORWARD','fixtures','100','input.json'),'utf8'));
  assert.equal(input.sha256,a.payload.inputSnapshotHash);assert.equal(input.payload.completedHistory[0].providerFetchedAt,h[0].providerFetchedAt);
  assert.equal(freeze(temp(),fixture(),()=>now,[...h].reverse()).envelope!.sha256,a.sha256);
  assert.notEqual(freeze(temp(),fixture(),()=>now,h.map(r=>({...r,providerFetchedAt:new Date(now-2000).toISOString()}))).envelope!.payload.inputSnapshotHash,a.payload.inputSnapshotHash);
});
test('target history rejected; unavailable, unfinished, other league and old scores never accessed',()=>{
  assert.throws(()=>freeze(temp(),fixture(),()=>now,[{...history()[0],providerFixtureId:100}]),/TARGET_RESULT/);
  const invalid=[{...history()[0],providerFetchedAt:new Date(now+1).toISOString()},{...history()[1],fixtureStatus:'1H'},{...history()[2],leagueId:140},{...history()[3],kickoffUtc:new Date(now-366*86400000).toISOString()},{...history()[4],kickoffUtc:new Date(T+1).toISOString()}];
  for(const row of invalid)Object.defineProperty(row,'fullTimeHomeGoals',{get(){throw Error('UNAVAILABLE_SCORE_ACCESS');},enumerable:true});
  assert.equal(freeze(temp(),fixture(),()=>now,invalid as Completed[]).envelope!.payload.trainingMatchCount,0);
  for(const key of ['odds','ownerShadow','externalShadow'])assert.throws(()=>freeze(temp(),fixture(),()=>now,[{...history()[0],[key]:1}]),/NON_HISTORY_FIELDS/);
});
test('FT projector rejects unfinished result before score access',()=>{
  const raw={fixture:{id:1,date:new Date(now-86400000).toISOString(),status:{short:'1H'}},league:{id:39,season:2026},teams:{home:{id:1,name:'H'},away:{id:2,name:'A'}},get score():never{throw Error('SCORE_READ');}};
  assert.throws(()=>projectCompleted(raw,39,2026,new Date(now).toISOString(),sha('x')),/UNFINISHED_HISTORY/);
});
test('incomplete coverage never reports zero scheduled fixtures',()=>{
  const a=auditCoverage(temp(),[],now,false)[0].payload;assert.equal(a.scheduledFixtures,null);assert.equal(a.providerCoverageComplete,false);
});
test('separate postgame grading cannot mutate pregame or overwrite grade',()=>{
  const dir=temp();freeze(dir,fixture(),()=>now,history());const file=join(dir,'MODEL_FORWARD','fixtures','100','snapshot.json'),before=readFileSync(file,'utf8');
  const r={fixtureId:100,leagueId:39,fixtureStatus:'FT' as const,actualScore:{home:2,away:1},providerFetchedAt:new Date(T+7200000).toISOString(),sourceHash:sha('result')};
  assert.throws(()=>grade(dir,r,()=>now),/NOT_OBSERVED_POSTGAME/);
  assert.equal(grade(dir,r,()=>T+7200001).payload.actualClass,'HOME');assert.equal(readFileSync(file,'utf8'),before);
  assert.throws(()=>grade(dir,r,()=>T+7200002),/EEXIST/);
});
test('late disk seal is invalidated and permanently missed',()=>{
  const dir=temp();let calls=0;assert.equal(freeze(dir,fixture(),()=>++calls<4?now:T).kind,'MISSED');
  assert.ok(existsSync(join(dir,'MODEL_FORWARD','fixtures','100','invalid.json')));
  assert.equal(freeze(dir,fixture(),()=>T+1).kind,'MISSED');
});
test('tampered input is rejected on reuse, not silently trusted',()=>{
  const dir=temp();freeze(dir,fixture(),()=>now);const file=join(dir,'MODEL_FORWARD','fixtures','100','input.json');
  const input=JSON.parse(readFileSync(file,'utf8'));input.payload.cutoffAt=new Date(now-1000).toISOString();writeFileSync(file,JSON.stringify(input));
  assert.throws(()=>freeze(dir,fixture(),()=>now+1),/TAMPERED_SNAPSHOT/);
});
