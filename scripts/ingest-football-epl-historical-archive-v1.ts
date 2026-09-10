import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';

type Obj = Record<string, unknown>;
export type LeagueSpec = {id:number;name:string;teamCount:number};
export const EPL: LeagueSpec = {id:39,name:'Premier League',teamCount:20};
export type Batch = {season: number; fetchedAt: string; sourceHash: string; rows: unknown[]};
export const SEASONS = [2023, 2024] as const;
export const LOCAL_ROOT = 'data/cache/research/football/historical-archive-v1';
export const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const id = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
const name = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const goal = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 100 ? v : null;
const instant = (v: unknown): string | null => {
  if(typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v)))return null;
  const day = v.slice(0,10), parsedDay = Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(parsedDay)||new Date(parsedDay).toISOString().slice(0,10)!==day)return null;
  return new Date(v).toISOString();
};
export const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

export function envelope(value: unknown, season?: number, leagueId = 39): Obj {
  const j = obj(value);
  if(!j.errors || typeof j.errors !== 'object' || Object.keys(j.errors).length) throw Error('API_ERRORS_OR_MISSING_ERROR_ENVELOPE');
  if(!Array.isArray(j.response) || j.results !== j.response.length) throw Error('RESPONSE_COUNT_MISMATCH');
  const paging = obj(j.paging);
  if(paging.current !== 1 || paging.total !== 1) throw Error('PAGINATION_NOT_COMPLETE');
  if(season !== undefined && (String(obj(j.parameters).league) !== String(leagueId) || String(obj(j.parameters).season) !== String(season))) throw Error('QUERY_ECHO_MISMATCH');
  return j;
}

export function normalize(value: unknown, batch: Batch, spec: LeagueSpec) {
  const row = obj(value), fixture = obj(row.fixture), league = obj(row.league), teams = obj(row.teams);
  const home = obj(teams.home), away = obj(teams.away), scores = obj(obj(row.score).fulltime);
  const match = {
    provider: 'API_FOOTBALL', providerFixtureId: id(fixture.id), leagueId: id(league.id), leagueName: name(league.name), season: league.season,
    round: name(league.round), kickoffUtc: instant(fixture.date), homeTeamId: id(home.id), homeTeamName: name(home.name),
    awayTeamId: id(away.id), awayTeamName: name(away.name), fixtureStatus: name(obj(fixture.status).short),
    fullTimeHomeGoals: goal(scores.home), fullTimeAwayGoals: goal(scores.away), providerFetchedAt: batch.fetchedAt,
    sourceHash: batch.sourceHash, historicalRole: 'RETROSPECTIVE_HISTORICAL_RESULT', strictReplayEligible: false,
    resultCompletedAt: null, strictAsOfProvenance: 'UNAVAILABLE', completionEvidence: 'TERMINAL_STATUS_AT_RETRIEVAL_ONLY',
  };
  const reasons: string[] = [];
  if(!match.providerFixtureId) reasons.push('missingFixtureId');
  if(!match.kickoffUtc) reasons.push('missingKickoff');
  if(!match.homeTeamId || !match.homeTeamName) reasons.push('missingHomeTeam');
  if(!match.awayTeamId || !match.awayTeamName) reasons.push('missingAwayTeam');
  if(match.fullTimeHomeGoals === null || match.fullTimeAwayGoals === null) reasons.push('missingScore');
  if(match.leagueId !== spec.id || !match.leagueName || match.season !== batch.season) reasons.push('leagueSeasonMismatch');
  if(match.homeTeamId && match.homeTeamId === match.awayTeamId) reasons.push('sameTeam');
  if(match.fixtureStatus !== 'FT') reasons.push('unexpectedStatus');
  if(!match.round) reasons.push('missingRound');
  if(match.kickoffUtc && match.kickoffUtc >= batch.fetchedAt) reasons.push('futureOrUnfinishedAtRetrieval');
  if(fixture.timestamp !== undefined && match.kickoffUtc && fixture.timestamp !== Date.parse(match.kickoffUtc)/1000) reasons.push('kickoffTimestampConflict');
  if(match.fixtureStatus === 'FT' && row.goals !== undefined && (obj(row.goals).home !== match.fullTimeHomeGoals || obj(row.goals).away !== match.fullTimeAwayGoals)) reasons.push('scoreConflict');
  return {match, reasons};
}

export function buildArchive(batches: Batch[], spec: LeagueSpec = EPL) {
  const expected = spec.teamCount * (spec.teamCount - 1);
  if(batches.length !== 2 || SEASONS.some(s => batches.filter(b=>b.season === s).length !== 1)) throw Error('EXACT_TWO_SEASONS_REQUIRED');
  for(const b of batches) if(instant(b.fetchedAt) !== b.fetchedAt || !/^[a-f0-9]{64}$/.test(b.sourceHash)) throw Error('INVALID_PROVENANCE');
  const all = batches.flatMap(b => b.rows.map(r => ({...normalize(r,b,spec), batchSeason:b.season})));
  const missingFieldCounts: Record<string,number> = {};
  for(const row of all) for(const reason of row.reasons) missingFieldCounts[reason] = (missingFieldCounts[reason] ?? 0) + 1;
  const groups = new Map<number, typeof all>();
  for(const row of all) if(row.match.providerFixtureId) {const g = groups.get(row.match.providerFixtureId) ?? [];g.push(row);groups.set(row.match.providerFixtureId,g);}
  const unique: typeof all = [], duplicateFixtureIds: number[] = [], conflictingFixtureIds: number[] = [];
  let duplicateCount = 0;
  for(const [fixtureId, rows] of groups) {
    if(rows.length > 1) {duplicateFixtureIds.push(fixtureId);duplicateCount += rows.length-1;}
    const signature = (r: typeof all[number]) => {const v = {...r.match, providerFetchedAt:undefined, sourceHash:undefined};return JSON.stringify(v);};
    rows.sort((a,b)=>a.match.providerFetchedAt.localeCompare(b.match.providerFetchedAt)||a.match.sourceHash.localeCompare(b.match.sourceHash));
    const first = rows[0];
    if(new Set(rows.map(signature)).size > 1 || new Set(rows.map(r=>r.batchSeason)).size > 1) {conflictingFixtureIds.push(fixtureId);first.reasons = [...first.reasons,'duplicateConflict'];}
    unique.push(first);
  }
  const usable = unique.filter(r=>!r.reasons.length).map(r=>r.match).sort((a,b)=>a.kickoffUtc!.localeCompare(b.kickoffUtc!)||a.providerFixtureId!-b.providerFixtureId!);
  const seasonCounts = SEASONS.map(season=>{
    const rows = unique.filter(r=>r.batchSeason === season), valid = usable.filter(r=>r.season === season);
    const teamIds = new Set(valid.flatMap(r=>[r.homeTeamId,r.awayTeamId]));
    const pairCounts = new Map<string,number>();
    for(const r of valid) {const key = `${r.homeTeamId}:${r.awayTeamId}`;pairCounts.set(key,(pairCounts.get(key)??0)+1);}
    return {season, rawRows:all.filter(r=>r.batchSeason===season).length, expectedLeagueMatchCount:expected, canonicalMatches:rows.length,
      completedFixtures:rows.filter(r=>['FT','AET','PEN'].includes(r.match.fixtureStatus??'')).length, usableCompletedMatches:valid.length,
      completenessPercentage:rows.length/expected*100, usableCompletenessPercentage:valid.length/expected*100, teamCount:teamIds.size,
      directedPairCount:pairCounts.size, repeatedPairCount:[...pairCounts.values()].filter(n=>n!==1).length,
      earliestKickoff:valid[0]?.kickoffUtc??null, latestKickoff:valid.at(-1)?.kickoffUtc??null};
  });
  const eligible = !Object.keys(missingFieldCounts).length && !conflictingFixtureIds.length && seasonCounts.every(s=>s.canonicalMatches===expected&&s.usableCompletedMatches===expected&&s.teamCount===spec.teamCount&&s.directedPairCount===expected&&s.repeatedPairCount===0);
  const archive = {schemaVersion:spec.id===39?'football-epl-historical-archive-v1':'football-league-historical-archive-v1',historicalRole:'RETROSPECTIVE_HISTORICAL_RESULTS',strictReplayEligible:false,matches:usable};
  const audit = {provider:'API_FOOTBALL',league:{id:spec.id,name:spec.name},seasons:[...SEASONS],retrievedAt:batches.map(b=>b.fetchedAt).sort().at(-1),
    rawRows:all.length,canonicalMatches:groups.size,completedFixtures:seasonCounts.reduce((n,s)=>n+s.completedFixtures,0),usableCompletedMatches:usable.length,
    seasonCounts,duplicateCount,duplicateFixtureIds:duplicateFixtureIds.sort((a,b)=>a-b),conflictingFixtureIds:conflictingFixtureIds.sort((a,b)=>a-b),missingFieldCounts,
    missingIdentityRows:all.filter(r=>r.reasons.some(s=>['missingFixtureId','missingHomeTeam','missingAwayTeam','leagueSeasonMismatch','sameTeam'].includes(s))).length,
    dateRange:{earliest:usable[0]?.kickoffUtc??null,latest:usable.at(-1)?.kickoffUtc??null},chronologicalResearchEligible:eligible,strictReplayEligible:false,
    temporalAudit:{ordering:'kickoffUtc ASC, providerFixtureId ASC (numeric)',providerFetchedAtPreserved:true,strictAsOfProvenance:'UNAVAILABLE',
      resultCompletionTimestampAvailable:false,futureFabricated:false,observedAtFabricated:false,
      futureBacktestRequirement:'Resolve/document result completion availability before target cutoff; kickoff-only sorting is not a completion proof. No backtest is executed.'},
    governance:{oddsUsed:false,providerPredictionUsed:false,engineChanged:false,weightsChanged:false,backtestExecuted:false,strictAsOfFabricated:false}};
  return {archive,audit,quarantine:unique.filter(r=>r.reasons.length),invalidIdRows:all.filter(r=>!r.match.providerFixtureId)};
}

export async function verifyRun(dir: string) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir,'football-epl-historical-archive-v1.json'),'utf8'));
  for(const item of manifest.files as {path:string;sha256:string}[]) {
    if(path.isAbsolute(item.path) || item.path.split(/[\\/]/).includes('..')) throw Error('INVALID_MANIFEST_PATH');
    if(sha(await fs.readFile(path.join(dir,item.path))) !== item.sha256) throw Error('ARCHIVE_HASH_MISMATCH');
  }
  const batches: Batch[] = [];
  for(const batch of manifest.batches as {season:number;fetchedAt:string;sourceHash:string;rawPath:string}[]) {
    if(!manifest.files.some((f:{path:string;sha256:string})=>f.path===batch.rawPath&&f.sha256===batch.sourceHash)) throw Error('RAW_PROVENANCE_MISMATCH');
    const data = envelope(JSON.parse(await fs.readFile(path.join(dir,batch.rawPath),'utf8')),batch.season);
    batches.push({...batch,rows:data.response as unknown[]});
  }
  const rebuilt = buildArchive(batches);
  if(sha(json(rebuilt.archive)) !== manifest.FOOTBALL_EPL_HISTORICAL_ARCHIVE_SHA256 || JSON.stringify(rebuilt.audit)!==JSON.stringify(manifest.audit)) throw Error('REBUILD_MISMATCH');
  return {verified:true,hash:manifest.FOOTBALL_EPL_HISTORICAL_ARCHIVE_SHA256,canonicalMatches:manifest.audit.canonicalMatches};
}

async function execute(repo: string) {
  const key = process.env.FOOTBALL_API_KEY?.trim();if(!key)throw Error('FOOTBALL_API_KEY_MISSING');
  const terms = JSON.parse(await fs.readFile(path.join(repo,'docs/FOOTBALL_EPL_ARCHIVE_TERMS_V1.json'),'utf8'));
  const age = Date.now()-Date.parse(terms.TERMS_CHECKED_AT);
  if(!Number.isFinite(age)||age<0||age>86400000||terms.EXECUTION_SCOPE!=='INTERNAL_LOCAL_ONLY')throw Error('FRESH_TERMS_CHECK_REQUIRED');
  const dir = path.join(repo,LOCAL_ROOT,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
  await fs.mkdir(dir,{recursive:true});
  let calls = 0;
  const request = async (endpoint: string, parameters: Record<string,string>) => {
    if(++calls>4)throw Error('API_BUDGET_EXCEEDED');
    const url = new URL(endpoint,'https://v3.football.api-sports.io');url.search = new URLSearchParams(parameters).toString();
    const requestedAt = new Date().toISOString();
    const response = await fetch(url,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(30000),redirect:'error'});
    const text = await response.text(), fetchedAt = new Date().toISOString();
    if(text.includes(key))throw Error('SECRET_IN_RESPONSE_NOT_SAVED');
    if(!response.ok)throw Error(`PROVIDER_HTTP_${response.status}`);
    if(Buffer.byteLength(text)>10_000_000)throw Error('RESPONSE_SIZE_LIMIT');
    const data = JSON.parse(text) as Obj;
    if(!data.errors||typeof data.errors!=='object'||Object.keys(data.errors).length)throw Error('PROVIDER_ERROR_ENVELOPE');
    return {text,data,metadata:{provider:'API_FOOTBALL',endpoint,requestParameters:parameters,requestedAt,fetchedAt,http:response.status,sourceHash:sha(text),
      dailyRemaining:response.headers.get('x-ratelimit-requests-remaining'),minuteRemaining:response.headers.get('x-ratelimit-remaining')}};
  };
  try {
    const status = await request('/status',{}), account = obj(status.data.response), subscription = obj(account.subscription), requests = obj(account.requests);
    if(subscription.active!==true || typeof requests.limit_day!=='number'||typeof requests.current!=='number'||requests.limit_day-requests.current<3)throw Error('ACCOUNT_OR_QUOTA_BLOCKED');
    // Sequential calls spaced below the known Free per-minute allowance. No retries or alternate routes.
    const pause = () => new Promise(r=>setTimeout(r,6500));
    await pause();const leagues = await request('/leagues',{id:'39'});envelope(leagues.data);
    const league = obj((leagues.data.response as unknown[])[0]);
    if(obj(league.league).id!==39||obj(league.league).name!=='Premier League')throw Error('LEAGUE_METADATA_MISMATCH');
    const seasonDefinitions = SEASONS.map(year=>{
      const s = (Array.isArray(league.seasons)?league.seasons:[]).map(obj).find(s=>s.year===year);
      if(!s||typeof s.start!=='string'||typeof s.end!=='string')throw Error('SEASON_DEFINITION_MISSING');
      return {apiSeason:year,start:s.start,end:s.end};
    });
    await fs.writeFile(path.join(dir,'league-metadata.json'),leagues.text,{flag:'wx'});
    const batches: Batch[] = [], evidence: Obj[] = [], files = [{path:'league-metadata.json',sha256:leagues.metadata.sourceHash}];
    for(const season of SEASONS) {
      await pause();const result = await request('/fixtures',{league:'39',season:String(season),timezone:'UTC'});
      const data = envelope(result.data,season), rawPath = `${season}/raw.json`;
      await fs.mkdir(path.join(dir,String(season)));await fs.writeFile(path.join(dir,rawPath),result.text,{flag:'wx'});
      batches.push({season,fetchedAt:result.metadata.fetchedAt,sourceHash:result.metadata.sourceHash,rows:data.response as unknown[]});
      evidence.push({...result.metadata,leagueId:39,season,query:'season (no date filter)',responseCount:data.results,rawPath});
      files.push({path:rawPath,sha256:result.metadata.sourceHash});
    }
    const built = buildArchive(batches);
    for(const season of seasonDefinitions) {
      const rows = built.archive.matches.filter(r=>r.season===season.apiSeason);
      if(rows.some(r=>r.kickoffUtc!.slice(0,10)<season.start || r.kickoffUtc!.slice(0,10)>season.end))throw Error('KICKOFF_OUTSIDE_PROVIDER_SEASON');
    }
    const outputs: Record<string,string> = {'archive.json':json(built.archive),'quarantine.json':json({rows:built.quarantine,invalidIdRows:built.invalidIdRows})};
    for(const season of SEASONS)outputs[`${season}/normalized.json`]=json(built.archive.matches.filter(r=>r.season===season));
    for(const [file,text] of Object.entries(outputs)){await fs.writeFile(path.join(dir,file),text,{flag:'wx'});files.push({path:file,sha256:sha(text)});}
    const manifest = {schemaVersion:'football-epl-historical-archive-manifest-v1',provider:'API_FOOTBALL',league:39,seasons:[...SEASONS],seasonDefinitions,
      retrievedAt:built.audit.retrievedAt,apiCallCount:calls,account:{plan:subscription.plan,active:subscription.active,limitDay:requests.limit_day},
      terms,rawProviderResponse:'LOCAL_ONLY',normalizedMatches:'LOCAL_ONLY',batches:evidence,leagueMetadata:leagues.metadata,files,
      audit:built.audit,FOOTBALL_EPL_HISTORICAL_ARCHIVE_SHA256:sha(outputs['archive.json'])};
    await fs.writeFile(path.join(dir,'football-epl-historical-archive-v1.json'),json(manifest),{flag:'wx'});
    await verifyRun(dir);
    console.log(json({localArchive:dir,...manifest,files:undefined,batches:undefined,leagueMetadata:undefined}));
    if(!built.audit.chronologicalResearchEligible)process.exitCode=2;
  } catch(e) {
    await fs.writeFile(path.join(dir,'FAILED.json'),json({at:new Date().toISOString(),apiCallCount:calls,error:e instanceof Error?e.message:'FAILED',archiveFrozen:false}),{flag:'wx'});
    throw e;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const args = process.argv.slice(2);
  if(args.length===0) console.log(json({mode:'DRY_RUN',networkCalls:0,league:39,seasons:SEASONS,outputRoot:LOCAL_ROOT,execute:'--execute',verify:'--verify <local-run-directory>'}));
  else if(args.length===1&&args[0]==='--execute') await execute(repo).catch(e=>{console.error(e instanceof Error?e.message:'INGEST_FAILED');process.exitCode=1;});
  else if(args.length===2&&args[0]==='--verify') console.log(json(await verifyRun(args[1])));
  else throw Error('USAGE: no args | --execute | --verify <local-run-directory>');
}
