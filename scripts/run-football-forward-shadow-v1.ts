/** Collector projects only schedule fields. Model process never receives raw provider payloads. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {restoreScheduleLedger,observeSchedule} from './football-forward-schedule-ledger-v1';
import {freeze,auditCoverage,validateFixture,envelope,writeOnce,MODEL_HASH,sha,readSealed,LAYERS,type Fixture,type Completed} from './football-forward-shadow-v1';
const root=fileURLToPath(new URL('../',import.meta.url));
const leagues=[39,140,135,78];
type RawSchedule={fixture:{id:number;date:string;status:{short:string}};league:{id:number;season:number};teams:{home:{id:number;name:string};away:{id:number;name:string}}};
export function projectSchedule(r:RawSchedule,leagueId:number,season:number,fetchedAt:string):Fixture {
  assert.equal(r.league.id,leagueId);assert.equal(r.league.season,season);
  const f:Fixture={fixtureId:r.fixture.id,kickoffUtc:new Date(r.fixture.date).toISOString(),leagueId,season,homeTeam:{id:r.teams.home.id,name:r.teams.home.name},awayTeam:{id:r.teams.away.id,name:r.teams.away.name},providerStatus:r.fixture.status.short,scheduleFetchedAt:fetchedAt};validateFixture(f);return f;
}
export function projectCompleted(r:RawSchedule & {score:{fulltime:{home:number;away:number}}},leagueId:number,season:number,fetchedAt:string,sourceHash:string):Completed {
  assert.equal(r.fixture.status.short,'FT','UNFINISHED_HISTORY');
  const f=projectSchedule(r,leagueId,season,fetchedAt);
  assert.ok(Date.parse(f.kickoffUtc)<Date.parse(fetchedAt));
  const goals=r.score.fulltime;for(const g of [goals.home,goals.away])assert.ok(Number.isSafeInteger(g)&&g>=0,'MISSING_FT_SCORE');
  return {providerFixtureId:f.fixtureId,kickoffUtc:f.kickoffUtc,leagueId,homeTeamId:f.homeTeam.id,awayTeamId:f.awayTeam.id,fixtureStatus:'FT',fullTimeHomeGoals:goals.home,fullTimeAwayGoals:goals.away,providerFetchedAt:fetchedAt,sourceHash};
}
export async function run(){
  const local=resolve(root,'data/cache/research/football/forward-shadow-v1');
  for(const layer of Object.values(LAYERS))mkdirSync(join(local,layer),{recursive:true});
  restoreScheduleLedger(local);
  assert.equal(sha(readFileSync(resolve(root,'src/lib/football/poisson-research-v1/index.ts'),'utf8').replace(/\r\n/g,'\n')),MODEL_HASH,'MODEL_CHANGED');
  assert.equal(sha(readFileSync(resolve(root,'src/lib/football/odds-1x2-v1/instant.ts'),'utf8').replace(/\r\n/g,'\n')),'c848e4f64438a76bb39531a0f702c01c0aa3c3076f33ef5d39f56c480e97c784');
  const key=process.env.FOOTBALL_API_KEY?.trim();assert.ok(key,'MISSING_PROVIDER_KEY');
  const startedAt=new Date().toISOString(),day=startedAt.slice(0,10),end=new Date(Date.parse(startedAt)+7*86400000).toISOString().slice(0,10);
  const schedule:Fixture[]=[],failures:unknown[]=[],seasons:unknown[]=[];
  const histories=new Map<number,Completed[]>(),historyAudits:unknown[]=[];let calls=0,last=0;
  const request=async(endpoint:string,params:Record<string,string>)=>{
    assert.ok(['/leagues','/fixtures'].includes(endpoint));if(++calls>16)throw Error('REQUEST_BUDGET');const delay=Math.max(0,6500-(Date.now()-last));if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
    const url=new URL(endpoint,'https://v3.football.api-sports.io');url.search=new URLSearchParams(params).toString();
    const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`PROVIDER_HTTP_${response.status}`);
    const data=await response.json();if(!data.errors||Object.keys(data.errors).length)throw Error(`PROVIDER_ACCESS: ${JSON.stringify(data.errors).replaceAll(key,'[REDACTED]')}`);
    assert.equal(data.paging.current,1);assert.equal(data.paging.total,1);assert.equal(data.results,data.response.length);return data;
  };
  for(const leagueId of leagues){try{
    const meta=await request('/leagues',{id:String(leagueId),current:'true'});assert.equal(meta.response.length,1);assert.equal(meta.response[0].league.id,leagueId);
    const current=meta.response[0].seasons.filter((s:{current:boolean})=>s.current);assert.equal(current.length,1);const season=current[0].year;assert.ok(Number.isSafeInteger(season));seasons.push({leagueId,season});
    const fixtures=await request('/fixtures',{league:String(leagueId),season:String(season),from:day,to:end,timezone:'UTC'});const fetchedAt=new Date().toISOString();
    for(const row of fixtures.response){const projected=projectSchedule(row,leagueId,season,fetchedAt);observeSchedule(local,projected,sha(JSON.stringify(projected)));schedule.push(projected);}
    const history:Completed[]=[];
    // Actual FT observations only. Never infer observedAt from historical kickoff.
    for(const historySeason of [season-1,season]){
      const past=await request('/fixtures',{league:String(leagueId),season:String(historySeason),from:new Date(Date.parse(startedAt)-365*86400000).toISOString().slice(0,10),to:day,status:'FT',timezone:'UTC'});
      const observedAt=new Date().toISOString(),sourceHash=sha(JSON.stringify(past));let excludedStages=0;
      for(const row of past.response){
        assert.ok(!schedule.some(f=>f.providerStatus==='NS'&&f.fixtureId===row.fixture.id),'TARGET_IN_HISTORY_RESPONSE');
        assert.equal(typeof row.league.round,'string','MISSING_HISTORY_STAGE');
        if(!/^Regular Season - \d+$/.test(row.league.round)){excludedStages++;continue;}
        history.push(projectCompleted(row,leagueId,historySeason,observedAt,sourceHash));
      }
      historyAudits.push({leagueId,season:historySeason,providerFetchedAt:observedAt,sourceHash,rawRows:past.response.length,excludedStages,regularSeasonRows:past.response.length-excludedStages});
    }
    histories.set(leagueId,history);
  }catch(e){failures.push({leagueId,error:String(e)});if(String(e).includes('Free plans')||String(e).includes('subscription'))break;}}
  const unique=new Map<number,Fixture>();for(const f of schedule){assert.ok(!unique.has(f.fixtureId),'DUPLICATE_FIXTURE');unique.set(f.fixtureId,f);}
  const ordered=[...unique.values()].sort((a,b)=>a.kickoffUtc.localeCompare(b.kickoffUtc)||a.fixtureId-b.fixtureId);
  const modelRoot=join(local,LAYERS.MODEL_FORWARD),runs=join(modelRoot,'runs');mkdirSync(runs,{recursive:true});
  const runId=startedAt.replace(/[:.]/g,'-')+'-'+randomUUID();
  writeOnce(join(runs,runId+'-schedule.json'),JSON.stringify(envelope({startedAt,seasons,fixtures:ordered,coverageComplete:failures.length===0,failures}),null,2)+'\n');
  // Frozen model requires observedAt strictly before cutoff, including millisecond boundaries.
  await new Promise(r=>setTimeout(r,2));
  const frozen=[];for(const f of ordered)try{
    if(!histories.has(f.leagueId))continue; // Provider failure must never become an empty-history PASS.
    const r=freeze(local,f,()=>Date.now(),histories.get(f.leagueId)!);if(r.envelope)frozen.push({fixtureId:f.fixtureId,kind:r.kind,hash:r.envelope.sha256,pastCompletedResultDataUsed:r.envelope.payload.PAST_COMPLETED_RESULT_DATA_USED??null});
  }catch(e){failures.push({fixtureId:f.fixtureId,error:String(e)});}
  // Revisit all previously observed schedule snapshots, including missed games during downtime.
  const known=new Map<number,Fixture>();for(const file of readdirSync(runs).filter(f=>f.endsWith('-schedule.json')).sort())for(const f of readSealed(join(runs,file)).payload.fixtures)known.set(f.fixtureId,f);
  const coverage=auditCoverage(local,[...known.values()],Date.now(),failures.length===0);
  const next=ordered.filter(f=>f.providerStatus==='NS'&&Date.parse(f.kickoffUtc)>Date.now());const slateDate=next[0]?.kickoffUtc.slice(0,10)??null;
  const slate=slateDate?coverage.find(a=>a.payload.date===slateDate):undefined;
  const predictionReferences=frozen.filter(s=>s.kind==='SEALED'||s.kind==='EXISTING').map(({fixtureId,hash})=>({fixtureId,hash}));
  const manifest=predictionReferences.length?envelope({schemaVersion:'FOOTBALL_FORWARD_SNAPSHOT_MANIFEST_V1',snapshots:predictionReferences}):null;
  if(manifest)writeOnce(join(runs,runId+'-snapshot-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const result=envelope({schemaVersion:'FOOTBALL_4_LEAGUE_FORWARD_SHADOW_V1',startedAt,completedAt:new Date().toISOString(),status:failures.length?'BLOCKED_OR_PARTIAL_PROVIDER_COVERAGE':frozen.some(s=>['SEALED','EXISTING'].includes(s.kind))?'LIVE_SNAPSHOTS_SEALED':slateDate?'READY_NO_ELIGIBLE_TARGET':'READY_NO_UPCOMING_SLATE',
    firstLiveSlateDate:slateDate,slate:slate?.payload??null,apiCalls:calls,seasons,historyAudits,failures,snapshotReferences:frozen,coverageComplete:failures.length===0,scheduledFixtures:failures.length?null:ordered.length,observedScheduledFixtures:ordered.length,historyPolicy:'ACTUALLY_OBSERVED_PAST_FT_SAME_LEAGUE_365D',
    forwardSnapshotSha256:manifest?.sha256??null,modelVersion:'football-poisson-research-v1',modelSourceHash:MODEL_HASH,MODEL_CHANGED:false,ODDS_USED:false,OWNER_SHADOW_USED:false,EXTERNAL_SHADOW_USED:false,TARGET_RESULT_DATA_USED:false,PAST_COMPLETED_RESULT_DATA_USED:predictionReferences.length?frozen.some(s=>s.pastCompletedResultDataUsed===true):null});
  writeOnce(join(runs,runId+'-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv.length===3&&['--run','--watch'].includes(process.argv[2]));
  if(process.argv[2]==='--run')run().then(r=>{if(!r.payload.coverageComplete)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
  else{const cycle=async()=>{try{await run();}catch(e){console.error(String(e));}setTimeout(cycle,6*3600000);};cycle();}
}
