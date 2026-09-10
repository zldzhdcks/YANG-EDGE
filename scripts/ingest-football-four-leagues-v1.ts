/** Official fixtures only. Raw data local; no prediction, odds or backtest imports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {buildArchive, normalize, envelope, json, sha, verifyRun, LOCAL_ROOT, SEASONS, type Batch, type LeagueSpec} from './ingest-football-epl-historical-archive-v1.ts';

export const LEAGUES = [
  {id:140,name:'La Liga',teamCount:20,code:'LALIGA'},
  {id:135,name:'Serie A',teamCount:20,code:'SERIEA'},
  {id:78,name:'Bundesliga',teamCount:18,code:'BUNDESLIGA'},
] as const;
const obj = (v:unknown):Record<string,unknown> => v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function expandAudit(batches:Batch[], spec:LeagueSpec) {
  const built = buildArchive(batches,spec);
  const problems = batches.flatMap(b=>b.rows.map(r=>({...normalize(r,b,spec),batchSeason:b.season})));
  const seasons = built.audit.seasonCounts.map(s=>{
    const ids = batches.find(b=>b.season===s.season)!.rows.map(r=>obj(obj(r).fixture).id).filter(x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0);
    const missingScore = problems.filter(r=>r.batchSeason===s.season&&r.reasons.includes('missingScore')).length;
    const missingIdentity = problems.filter(r=>r.batchSeason===s.season&&r.reasons.some(x=>['missingFixtureId','missingHomeTeam','missingAwayTeam','leagueSeasonMismatch','sameTeam'].includes(x))).length;
    const duplicates = ids.length-new Set(ids).size;
    const complete = s.usableCompletedMatches===s.expectedLeagueMatchCount&&s.canonicalMatches===s.expectedLeagueMatchCount&&s.teamCount===spec.teamCount&&s.directedPairCount===s.expectedLeagueMatchCount&&s.repeatedPairCount===0&&duplicates===0&&problems.filter(r=>r.batchSeason===s.season&&r.reasons.length).length===0;
    return {...s,duplicates,missingScore,missingIdentity,completeness:complete?'COMPLETE':'INCOMPLETE',
      completenessBasis:'Provider returned counts + complete directed home/away pair inventory; expected count is an audit comparator only; no rows synthesized'};
  });
  return {...built,audit:{...built.audit,seasonCounts:seasons,
    chronologicalResearchEligible:built.audit.chronologicalResearchEligible&&seasons.every(s=>s.completeness==='COMPLETE')&&built.audit.duplicateCount===0}};
}
export function seasonWindowAudit(matches:{season:unknown;kickoffUtc:string|null}[],definitions:{season:number;start:string;end:string}[]) {
  return definitions.map(s=>({season:s.season,providerStart:s.start,providerEnd:s.end,
    outsideMetadataWindow:matches.filter(m=>m.season===s.season&&m.kickoffUtc&&(m.kickoffUtc.slice(0,10)<s.start||m.kickoffUtc.slice(0,10)>s.end)).length,
    policy:'Fixture explicit league/season identity determines membership; metadata date boundary discrepancies retained, never guessed, clipped or dropped'}));
}
export async function verifyLeague(dir:string) {
  const m = JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  for(const f of m.files as {path:string;sha256:string}[]) {
    if(path.isAbsolute(f.path)||f.path.split(/[\\/]/).includes('..'))throw Error('INVALID_PATH');
    if(sha(await fs.readFile(path.join(dir,f.path)))!==f.sha256)throw Error('FILE_HASH_MISMATCH');
  }
  const batches:Batch[]=[];
  for(const b of m.batches as (Batch&{rawPath:string})[]) {
    const bytes=await fs.readFile(path.join(dir,b.rawPath));if(sha(bytes)!==b.sourceHash)throw Error('SOURCE_HASH_MISMATCH');
    const response=envelope(JSON.parse(bytes.toString('utf8')),b.season,m.league.id);
    batches.push({...b,rows:response.response as unknown[]});
  }
  const rebuilt=expandAudit(batches,m.league);
  if(sha(json(rebuilt.archive))!==m.archiveSha256||json(rebuilt.audit)!==json(m.audit))throw Error('REBUILD_MISMATCH');
  return m;
}
async function execute(repo:string, resume?:string) {
  const key=process.env.FOOTBALL_API_KEY?.trim();if(!key)throw Error('FOOTBALL_API_KEY_MISSING');
  const terms=JSON.parse(await fs.readFile(path.join(repo,'docs/FOOTBALL_EPL_ARCHIVE_TERMS_V1.json'),'utf8'));
  if(Date.now()-Date.parse(terms.TERMS_CHECKED_AT)>86400000||terms.EXECUTION_SCOPE!=='INTERNAL_LOCAL_ONLY')throw Error('FRESH_TERMS_REQUIRED');
  const epl=JSON.parse(await fs.readFile(path.join(repo,'data/audits/football-epl-historical-archive-v1.json'),'utf8'));
  const eplDir=path.join(repo,epl.localArchiveRelativePath);await verifyRun(eplDir);
  if(!epl.chronologicalResearchEligible||epl.duplicateCount!==0||Object.keys(epl.missingFieldCounts).length)throw Error('EPL_AUDIT_NOT_COMPLETE');
  const eplBytes=await fs.readFile(path.join(eplDir,'archive.json'));
  if(sha(eplBytes)!=='df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76')throw Error('EPL_HASH_MISMATCH');
  const runDir=path.join(repo,LOCAL_ROOT,'four-leagues-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
  await fs.mkdir(runDir,{recursive:true});
  let calls=0,lastRequest=0;
  const request=async(endpoint:string,parameters:Record<string,string>)=>{
    if(++calls>10)throw Error('REQUEST_BUDGET_EXCEEDED');
    const delay=Math.max(0,6500-(Date.now()-lastRequest));if(delay)await new Promise(r=>setTimeout(r,delay));
    lastRequest=Date.now();const url=new URL(endpoint,'https://v3.football.api-sports.io');url.search=new URLSearchParams(parameters).toString();
    const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
    const text=await response.text();if(text.includes(key))throw Error('SECRET_IN_RESPONSE');
    if(!response.ok)throw Error(`PROVIDER_HTTP_${response.status}`);if(Buffer.byteLength(text)>10000000)throw Error('RESPONSE_TOO_LARGE');
    const data=JSON.parse(text);if(!data.errors||Object.keys(data.errors).length)throw Error('PROVIDER_ERRORS');
    return {text,data,fetchedAt:new Date().toISOString(),sourceHash:sha(text)};
  };
  try {
    const status=await request('/status',{});const account=obj(status.data.response),subscription=obj(account.subscription),quota=obj(account.requests);
    if(subscription.active!==true||typeof quota.limit_day!=='number'||typeof quota.current!=='number'||quota.limit_day-quota.current<9)throw Error('ACCOUNT_OR_QUOTA_BLOCKED');
    const summaries:unknown[]=[];const globalIds=new Set<number>(JSON.parse(eplBytes.toString('utf8')).matches.map((r:{providerFixtureId:number})=>r.providerFixtureId));
    for(const league of LEAGUES) {
      if(resume) {
        const previous=path.resolve(resume,league.code);
        const manifestExists=await fs.access(path.join(previous,'manifest.json')).then(()=>true,()=>false);
        if(manifestExists) {
          const reused=await verifyLeague(previous);
          if(reused.league.id!==league.id)throw Error('RESUME_LEAGUE_MISMATCH');
          const archived=JSON.parse(await fs.readFile(path.join(previous,'archive.json'),'utf8'));
          for(const m of archived.matches){if(globalIds.has(m.providerFixtureId))throw Error('GLOBAL_FIXTURE_ID_COLLISION');globalIds.add(m.providerFixtureId);}
          summaries.push({...reused.audit,archiveSha256:reused.archiveSha256,localArchiveRelativePath:path.relative(repo,previous).replaceAll('\\','/'),completeness:reused.audit.chronologicalResearchEligible?'COMPLETE':'INCOMPLETE',reusedVerifiedArchive:true});
          continue;
        }
      }
      const dir=path.join(runDir,league.code);await fs.mkdir(dir);
      const metadata=await request('/leagues',{id:String(league.id)});envelope(metadata.data);
      if(metadata.data.response.length!==1||obj(metadata.data.response[0].league).id!==league.id||obj(metadata.data.response[0].league).name!==league.name)throw Error('LEAGUE_MISMATCH');
      const definitions=SEASONS.map(year=>{const s=(metadata.data.response[0].seasons as Record<string,unknown>[]).find(s=>s.year===year);if(!s||typeof s.start!=='string'||typeof s.end!=='string')throw Error('SEASON_MISSING');return {season:year,start:s.start,end:s.end};});
      await fs.writeFile(path.join(dir,'league-metadata.json'),metadata.text,{flag:'wx'});
      const files=[{path:'league-metadata.json',sha256:metadata.sourceHash}];const batches:Batch[]=[];const evidence:unknown[]=[];
      for(const season of SEASONS) {
        const result=await request('/fixtures',{league:String(league.id),season:String(season),timezone:'UTC'});
        const data=envelope(result.data,season,league.id),rawPath=`${season}/raw.json`;
        await fs.mkdir(path.join(dir,String(season)));await fs.writeFile(path.join(dir,rawPath),result.text,{flag:'wx'});
        batches.push({season,fetchedAt:result.fetchedAt,sourceHash:result.sourceHash,rows:data.response as unknown[]});
        evidence.push({season,fetchedAt:result.fetchedAt,sourceHash:result.sourceHash,rawPath});files.push({path:rawPath,sha256:result.sourceHash});
      }
      const built=expandAudit(batches,league);
      const providerSeasonWindowAudit=seasonWindowAudit(built.archive.matches,definitions);
      for(const m of built.archive.matches) {
        if(globalIds.has(m.providerFixtureId!))throw Error('GLOBAL_FIXTURE_ID_COLLISION');globalIds.add(m.providerFixtureId!);
      }
      const output:Record<string,string>={'archive.json':json(built.archive),'quarantine.json':json({rows:built.quarantine,invalidIdRows:built.invalidIdRows})};
      for(const season of SEASONS)output[`${season}/normalized.json`]=json(built.archive.matches.filter(r=>r.season===season));
      for(const [p,text] of Object.entries(output)){await fs.writeFile(path.join(dir,p),text,{flag:'wx'});files.push({path:p,sha256:sha(text)});}
      const manifest={schemaVersion:'football-league-historical-archive-manifest-v1',league,seasons:SEASONS,seasonDefinitions:definitions,terms,batches:evidence,files,audit:built.audit,providerSeasonWindowAudit,archiveSha256:sha(output['archive.json']),rawProviderPayload:'LOCAL_ONLY'};
      await fs.writeFile(path.join(dir,'manifest.json'),json(manifest),{flag:'wx'});await verifyLeague(dir);
      summaries.push({...built.audit,providerSeasonWindowAudit,archiveSha256:manifest.archiveSha256,localArchiveRelativePath:path.relative(repo,dir).replaceAll('\\','/'),completeness:built.audit.chronologicalResearchEligible?'COMPLETE':'INCOMPLETE'});
      console.log(json({league:league.code,canonical:built.audit.canonicalMatches,usable:built.audit.usableCompletedMatches,eligible:built.audit.chronologicalResearchEligible}));
    }
    const eplLocal=JSON.parse(await fs.readFile(path.join(eplDir,'football-epl-historical-archive-v1.json'),'utf8'));
    const all=[{...eplLocal.audit,seasonCounts:eplLocal.audit.seasonCounts.map((s:Record<string,unknown>)=>({...s,duplicates:0,missingScore:0,missingIdentity:0,completeness:'COMPLETE'})),archiveSha256:sha(eplBytes),localArchiveRelativePath:epl.localArchiveRelativePath,completeness:'COMPLETE'},...summaries] as {canonicalMatches:number;usableCompletedMatches:number;chronologicalResearchEligible:boolean}[];
    const result={schemaVersion:'FOOTBALL_4_MAJOR_LEAGUES_HISTORICAL_ARCHIVE_V1',baseSha:'80cf220bb99b2cac3a248f9e14c6927e1c0c88bc',retrievedAt:new Date().toISOString(),apiCallCount:calls,priorFailedAttempt:resume?JSON.parse(await fs.readFile(path.join(resume,'FAILED.json'),'utf8')):null,
      leagues:all,canonicalMatches:all.reduce((n,l)=>n+l.canonicalMatches,0),usableCompletedMatches:all.reduce((n,l)=>n+l.usableCompletedMatches,0),
      FOUR_MAJOR_LEAGUES_DATA_READY:all.every(l=>l.chronologicalResearchEligible),terms,rawProviderPayload:'LOCAL_ONLY',normalizedMatches:'LOCAL_ONLY',
      governance:{oddsUsed:false,providerPredictionUsed:false,engineChanged:false,weightsChanged:false,minSampleChanged:false,backtestExecuted:false,strictAsOfFabricated:false,strictReplayEligible:false}};
    await fs.writeFile(path.join(repo,'data/audits/football-four-major-leagues-historical-archive-v1.json'),json(result),{flag:'wx'});
    console.log(json({manifest:'data/audits/football-four-major-leagues-historical-archive-v1.json',canonical:result.canonicalMatches,usable:result.usableCompletedMatches,ready:result.FOUR_MAJOR_LEAGUES_DATA_READY,apiCalls:calls}));
    if(!result.FOUR_MAJOR_LEAGUES_DATA_READY)process.exitCode=2;
  } catch(e) {await fs.writeFile(path.join(runDir,'FAILED.json'),json({at:new Date().toISOString(),apiCalls:calls,error:e instanceof Error?e.message:'FAILED'}),{flag:'wx'});throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--execute')await execute(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')).catch(e=>{console.error(e instanceof Error?e.message:'FAILED');process.exitCode=1;});
  else if(args.length===2&&args[0]==='--resume')await execute(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),path.resolve(args[1])).catch(e=>{console.error(e instanceof Error?e.message:'FAILED');process.exitCode=1;});
  else if(args.length===2&&args[0]==='--verify')console.log(json((await verifyLeague(args[1])).audit));
  else throw Error('USAGE --execute | --verify <local league directory>');
}
