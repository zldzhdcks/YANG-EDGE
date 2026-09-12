/** Official FT-only collector; no import of prediction runner and no pregame writes. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {grade,type ResultObservation} from './football-forward-postgame-v1';
import {validatePregame,validateGrade} from './football-forward-validation-v1';
import {envelope,sha,writeOnce} from './football-forward-shadow-v1';
type ProviderFixture={fixture:{id:number;date:string;status:{short:string}};league:{id:number};score:{fulltime:{home:number;away:number}}};
export function projectFt(r:ProviderFixture,id:number,leagueId:number,kickoffUtc:string,providerFetchedAt:string,sourceHash:string):ResultObservation|null{
  assert.equal(r.fixture.id,id,'FIXTURE_ID_MISMATCH');assert.equal(r.league.id,leagueId,'LEAGUE_ID_MISMATCH');
  if(r.fixture.status.short!=='FT')return null;
  assert.equal(new Date(r.fixture.date).toISOString(),kickoffUtc,'SCHEDULE_CHANGED_REQUIRES_REVIEW');
  return {fixtureId:id,leagueId,fixtureStatus:'FT',actualScore:{home:r.score.fulltime.home,away:r.score.fulltime.away},providerFetchedAt,sourceHash};
}
export async function collectPostgame(root:string,key:string|undefined,options:{fetcher?:typeof fetch;clock?:()=>number;delayMs?:number}={}){
  const fetcher=options.fetcher??fetch,clock=options.clock??Date.now,delayMs=options.delayMs??6500;
  const model=join(root,'MODEL_FORWARD');mkdirSync(model,{recursive:true});const lock=join(model,'postgame-collector.lock'),fd=openSync(lock,'wx');
  const startedAt=new Date(clock()).toISOString(),rows:{fixtureId:number;status:string;error?:string}[]=[];let requests=0;
  try{
    const fixtures=join(model,'fixtures');
    for(const id of (existsSync(fixtures)?readdirSync(fixtures):[]).filter(n=>/^\d+$/.test(n)).map(Number).sort((a,b)=>a-b)){
      if(!existsSync(join(fixtures,String(id),'snapshot.json')))continue;
      try{
        const s=validatePregame(root,id),p=s.payload;
        if(existsSync(join(model,'postgame',id+'.json'))){validateGrade(root,id,clock());rows.push({fixtureId:id,status:'EXISTING_GRADE_VERIFIED_SKIP'});continue;}
        if(clock()<=Date.parse(p.kickoffUtc)){rows.push({fixtureId:id,status:'PREGAME_PENDING'});continue;}
        assert.ok(key,'MISSING_PROVIDER_KEY');assert.ok(requests<100,'REQUEST_BUDGET_EXHAUSTED');
        if(requests)await new Promise(r=>setTimeout(r,delayMs));requests++;
        const response=await fetcher('https://v3.football.api-sports.io/fixtures?id='+id,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
        assert.equal(response.status,200,'PROVIDER_HTTP_ERROR');const raw=await response.text(),observedAt=new Date(clock()).toISOString(),body=JSON.parse(raw);
        assert.equal(Object.keys(body.errors??{}).length,0,'PROVIDER_RESPONSE_ERROR');assert.equal(body.results,1);assert.equal(body.response.length,1);
        const result=projectFt(body.response[0],id,p.leagueId,p.kickoffUtc,observedAt,sha(raw));
        if(!result){rows.push({fixtureId:id,status:'NON_FT_PENDING'});continue;}
        grade(root,result,clock);validateGrade(root,id,clock());rows.push({fixtureId:id,status:'GRADED'});
      }catch(e){rows.push({fixtureId:id,status:'ERROR',error:String(e).replaceAll(key||'__NO_KEY__','[REDACTED]')});}
    }
    const payload={schemaVersion:'FOOTBALL_FORWARD_POSTGAME_COLLECTION_V1',startedAt,completedAt:new Date(clock()).toISOString(),requests,gradedThisRun:rows.filter(r=>r.status==='GRADED').length,errors:rows.filter(r=>r.status==='ERROR').length,rows,ODDS_USED:false,PROVIDER_PREDICTION_USED:false,PREGAME_MUTATED:false};
    const dir=join(model,'postgame-runs');mkdirSync(dir,{recursive:true});const value=envelope(payload);writeOnce(join(dir,startedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json'),JSON.stringify(value,null,2)+'\n');return value;
  }finally{closeSync(fd);unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv[2],'--run');assert.equal(process.argv.length,3);
  const root=fileURLToPath(new URL('../data/cache/research/football/forward-shadow-v1/',import.meta.url));
  collectPostgame(root,process.env.FOOTBALL_API_KEY).then(r=>{console.log(JSON.stringify({requests:r.payload.requests,gradedThisRun:r.payload.gradedThisRun,errors:r.payload.errors,sha256:r.sha256},null,2));if(r.payload.errors)process.exitCode=1;}).catch(e=>{console.error(String(e));process.exitCode=1;});
}
