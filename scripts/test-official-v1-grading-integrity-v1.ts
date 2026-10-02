import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {envelope,freeze,MODEL_HASH,type Fixture} from './football-forward-shadow-v1';
import {grade,type ResultObservation} from './football-forward-postgame-v1';
import {collectPostgame,projectFt} from './run-football-forward-postgame-v1';
import {generateScorecards} from './football-forward-scorecard-v1';
import {canonicalForFixture,officialInventory} from '../src/lib/football/official-canonical-v1';
const kickoff='2030-01-03T12:00:00.000Z',early='2030-01-01T12:00:00.000Z',late='2030-01-02T12:00:00.000Z',after=Date.parse(kickoff)+7200000;
const fixture=(at=early):Fixture=>({fixtureId:7,leagueId:39,season:2029,kickoffUtc:kickoff,homeTeam:{id:10,name:'Home'},awayTeam:{id:20,name:'Away'},providerStatus:'NS',scheduleFetchedAt:new Date(Date.parse(at)-1000).toISOString()});
function setup(t:{after:(fn:()=>void)=>void}){
  const repo=mkdtempSync(join(tmpdir(),'grading-integrity-'));t.after(()=>rmSync(repo,{recursive:true,force:true}));
  mkdirSync(join(repo,'src/lib/football/poisson-research-v1'),{recursive:true});writeFileSync(join(repo,'package.json'),'{}');writeFileSync(join(repo,'src/lib/football/poisson-research-v1/index.ts'),'// synthetic managed repository marker');
  const base=join(repo,'data/cache/research/football/forward-shadow-v1'),batch=join(repo,'data/research/slate-batches/test-batch/data/cache/research/football/forward-shadow-v1');mkdirSync(base,{recursive:true});mkdirSync(batch,{recursive:true});return {base,batch};
}
function seal(root:string,at=early){
  const f=fixture(at),history=[{providerFixtureId:8,kickoffUtc:'2029-12-20T12:00:00.000Z',leagueId:39,homeTeamId:10,awayTeamId:20,fixtureStatus:'FT',fullTimeHomeGoals:1,fullTimeAwayGoals:1,providerFetchedAt:'2029-12-21T12:00:00.000Z',sourceHash:'a'.repeat(64)}];
  const input=envelope({target:{matchId:'API_FOOTBALL:7',competitionId:'39',homeTeamId:'10',awayTeamId:'20',kickoffAt:kickoff},targetScheduleObservation:f,cutoffAt:at,completedHistory:history});
  const snapshot=envelope({layer:'MODEL_FORWARD',fixtureId:7,leagueId:39,season:2029,homeTeam:f.homeTeam,awayTeam:f.awayTeam,kickoffUtc:kickoff,cutoffAt:at,predictionCreatedAt:at,status:'PREDICTED',pHome:.5,pDraw:.2,pAway:.3,predictedClass:'HOME',modelVersion:'football-poisson-research-v1',modelSourceHash:MODEL_HASH,inputSnapshotHash:input.sha256,trainingFixtureIds:['API_FOOTBALL:8'],trainingProviderFixtureIds:[8],TARGET_RESULT_DATA_USED:false,ODDS_USED:false,MARKET_USED:false,PROVIDER_PREDICTION_USED:false,OWNER_SHADOW_USED:false,EXTERNAL_SHADOW_USED:false});
  const dir=join(root,'MODEL_FORWARD/fixtures/7');mkdirSync(dir,{recursive:true});for(const [name,value] of Object.entries({'input.json':input,'snapshot.json':snapshot,'seal-receipt.json':envelope({fixtureId:7,snapshotHash:snapshot.sha256,sealedAt:at,validPregame:true})}))writeFileSync(join(dir,name),JSON.stringify(value));return snapshot;
}
const bytes=(root:string)=>['input.json','snapshot.json','seal-receipt.json'].map(n=>readFileSync(join(root,'MODEL_FORWARD/fixtures/7',n)));
const gradePath=(root:string)=>join(root,'MODEL_FORWARD/postgame/7.json');
const raw=()=>({fixture:{id:7,date:kickoff,status:{short:'FT'}},league:{id:39},teams:{home:{id:10},away:{id:20}},score:{fulltime:{home:2,away:1}}});
const response=(r:unknown):typeof fetch=>async()=>new Response(JSON.stringify({errors:[],results:1,response:[r]}),{status:200});
const result=():ResultObservation=>({fixtureId:7,leagueId:39,homeTeamId:10,awayTeamId:20,fixtureStatus:'FT',actualScore:{home:2,away:1},providerFetchedAt:new Date(after).toISOString(),sourceHash:'b'.repeat(64)});
const cases:[string,(r:ReturnType<typeof raw>)=>unknown,RegExp][]=[
  ['teams missing',r=>{delete (r as Partial<typeof r>).teams;return r;},/RESULT_TEAM_IDENTITY_MISSING/],
  ['home ID missing',r=>{delete (r.teams.home as Partial<typeof r.teams.home>).id;return r;},/RESULT_TEAM_IDENTITY_MISSING/],
  ['away ID missing',r=>{delete (r.teams.away as Partial<typeof r.teams.away>).id;return r;},/RESULT_TEAM_IDENTITY_MISSING/],
  ['home mismatch',r=>{r.teams.home.id=99;return r;},/HOME_TEAM_ID_MISMATCH/],
  ['away mismatch',r=>{r.teams.away.id=99;return r;},/AWAY_TEAM_ID_MISMATCH/],
  ['swapped orientation',r=>{r.teams.home.id=20;r.teams.away.id=10;return r;},/HOME_TEAM_ID_MISMATCH/],
  ['fixture mismatch',r=>{r.fixture.id=99;return r;},/FIXTURE_ID_MISMATCH/],
  ['league mismatch',r=>{r.league.id=140;return r;},/LEAGUE_ID_MISMATCH/],
  ['kickoff mismatch',r=>{r.fixture.date=late;return r;},/SCHEDULE_CHANGED_REQUIRES_REVIEW/]
];
for(const [name,mutate,error] of cases)test('collector fail closed: '+name,async t=>{
  const {base}=setup(t);seal(base);const original=bytes(base),r=mutate(raw());
  assert.throws(()=>projectFt(r as ReturnType<typeof raw>,7,39,kickoff,new Date(after).toISOString(),'b'.repeat(64),10,20),error);
  const report=await collectPostgame(base,'SYNTHETIC',{clock:()=>after,fetcher:response(r),delayMs:0});
  assert.equal(report.payload.errors,1);assert.equal(report.payload.requests,1);assert.match(report.payload.rows[0].error!,error);assert(!existsSync(gradePath(base)));assert.deepEqual(bytes(base),original);
});
for(const side of ['homeTeamId','awayTeamId'] as const)test('direct grade fail closed: '+side,t=>{
  const {base}=setup(t);seal(base);const original=bytes(base);assert.throws(()=>grade(base,{...result(),[side]:99},()=>after),side==='homeTeamId'?/HOME_TEAM_ID_MISMATCH/:/AWAY_TEAM_ID_MISMATCH/);assert(!existsSync(gradePath(base)));assert.deepEqual(bytes(base),original);
});
test('non-FT never accesses FT team IDs or score',async t=>{
  const {base}=setup(t);seal(base);const original=bytes(base),live={fixture:{id:7,date:kickoff,status:{short:'2H'}},league:{id:39}};
  for(const name of ['teams','score'])Object.defineProperty(live,name,{get(){throw Error('FT_ONLY_FIELD_READ');}});
  assert.equal(projectFt(live as ReturnType<typeof raw>,7,39,kickoff,new Date(after).toISOString(),'b'.repeat(64),10,20),null);
  const report=await collectPostgame(base,'SYNTHETIC',{clock:()=>after,fetcher:response({fixture:live.fixture,league:live.league}),delayMs:0});assert.equal(report.payload.errors,0);assert.equal(report.payload.rows[0].status,'NON_FT_PENDING');assert(!existsSync(gradePath(base)));assert.deepEqual(bytes(base),original);
});
test('batch-only canonical is discovered, graded once at its root, and visible without base copies',async t=>{
  const {base,batch}=setup(t),snapshot=seal(batch),original=bytes(batch);assert.equal(canonicalForFixture(base,7)?.root,batch);
  assert.equal(freeze(base,fixture(late),()=>Date.parse(late)).kind,'EXISTING_OFFICIAL_PREDICTION');assert(!existsSync(join(base,'MODEL_FORWARD/fixtures/7/snapshot.json')));
  const pending=await collectPostgame(base,undefined,{clock:()=>Date.parse(late),fetcher:async()=>{throw Error('MUST_NOT_CALL');}});assert.equal(pending.payload.requests,0);assert.equal(pending.payload.rows[0].status,'PREGAME_PENDING');
  const first=await collectPostgame(base,'SYNTHETIC',{clock:()=>after,fetcher:response(raw()),delayMs:0});assert.equal(first.payload.requests,1);assert.equal(first.payload.gradedThisRun,1);assert.equal(first.payload.errors,0);assert(!existsSync(gradePath(base)));assert.deepEqual(bytes(batch),original);
  const gradeBytes=readFileSync(gradePath(batch));assert.equal(JSON.parse(gradeBytes.toString()).payload.predictionHash,snapshot.sha256);
  const second=await collectPostgame(base,undefined,{clock:()=>after+1,fetcher:async()=>{throw Error('MUST_NOT_CALL');}});assert.equal(second.payload.requests,0);assert.equal(second.payload.errors,0);assert.deepEqual(readFileSync(gradePath(batch)),gradeBytes);
  const cards=generateScorecards(base,after+1),card=cards.cards.find(c=>c.payload.date===kickoff.slice(0,10))!.payload;assert.equal(card.predicted,1);assert.equal(card.graded,1);assert.equal(card.gradedPredicted,1);assert.equal(card.pending,0);assert.equal(card.scheduled,null);assert.equal(cards.milestones?.counter,1);assert(!existsSync(join(base,'MODEL_FORWARD/fixtures/7/snapshot.json')));assert.deepEqual(bytes(batch),original);
});
for(const winner of ['base','batch'] as const)test('duplicate counted and graded once: '+winner+' wins',async t=>{
  const {base,batch}=setup(t);seal(base,winner==='base'?early:late);seal(batch,winner==='batch'?early:late);const selected=winner==='base'?base:batch,other=winner==='base'?batch:base,original=[bytes(base),bytes(batch)];
  const inventory=officialInventory(base);assert.equal(inventory.counts.canonicalPredictions,1);assert.equal(inventory.counts.duplicateNoncanonical,1);assert.equal(canonicalForFixture(base,7)?.root,selected);
  const report=await collectPostgame(base,'SYNTHETIC',{clock:()=>after,fetcher:response(raw()),delayMs:0});assert.equal(report.payload.requests,1);assert.equal(report.payload.errors,0);assert.equal(report.payload.gradedThisRun,1);assert(existsSync(gradePath(selected)));assert(!existsSync(gradePath(other)));assert.deepEqual([bytes(base),bytes(batch)],original);
  const cards=generateScorecards(base,after),card=cards.cards.find(c=>c.payload.date===kickoff.slice(0,10))!.payload;assert.equal(card.predicted,1);assert.equal(card.graded,1);assert.equal(card.gradedPredicted,1);assert.equal(card.predictedCorrect!+card.predictedIncorrect!,1);assert.equal(card.homePredictions!+card.drawPredictions!+card.awayPredictions!,1);assert.equal(card.graded!+card.pending!,card.predicted!+card.pass!);assert.equal(card.accuracy,1);assert.equal(cards.milestones?.counter,1);assert.deepEqual(cards.milestones?.reached,[]);
});
test('exact team orientation is carried to the Grade writer',t=>{
  const {base}=setup(t);seal(base);const original=bytes(base),projected=projectFt(raw(),7,39,kickoff,new Date(after).toISOString(),'b'.repeat(64),10,20)!;assert.equal(projected.homeTeamId,10);assert.equal(projected.awayTeamId,20);assert.equal(grade(base,projected,()=>after).payload.actualClass,'HOME');assert.deepEqual(bytes(base),original);
});
test('batch Grade with wrong prediction hash is rejected without fetch or overwrite',async t=>{
  const {base,batch}=setup(t);seal(batch);const original=bytes(batch);grade(batch,result(),()=>after);const path=gradePath(batch),g=JSON.parse(readFileSync(path,'utf8'));g.payload.predictionHash='c'.repeat(64);writeFileSync(path,JSON.stringify(envelope(g.payload)));const existing=readFileSync(path);
  const report=await collectPostgame(base,undefined,{clock:()=>after+1,fetcher:async()=>{throw Error('MUST_NOT_CALL');}});assert.equal(report.payload.requests,0);assert.equal(report.payload.errors,1);assert.deepEqual(readFileSync(path),existing);assert.deepEqual(bytes(batch),original);assert(!existsSync(gradePath(base)));
  const cards=generateScorecards(base,after+1);assert.equal(cards.totalGradedPredicted,null);assert.equal(cards.milestones,null);assert.equal(cards.cards.find(c=>c.payload.date===kickoff.slice(0,10))!.payload.graded,null);
});
