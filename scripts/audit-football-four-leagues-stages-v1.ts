/** Offline descriptive audit only; never changes archived records or cohort eligibility. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {envelope,json,sha,normalize,type Batch,type LeagueSpec} from './ingest-football-epl-historical-archive-v1.ts';
export function stageInventory(batches:Batch[],spec:LeagueSpec) {
  return batches.map(b=>{
    const rows=b.rows.map(r=>normalize(r,b,spec));
    const groups=new Map<string,typeof rows>();
    for(const r of rows){const round=r.match.round??'MISSING_ROUND';const stage=round.startsWith('Regular Season - ')?'Regular Season':round;groups.set(stage,[...(groups.get(stage)??[]),r]);}
    const dates=rows.map(r=>r.match.kickoffUtc).filter((s):s is string=>s!==null).sort();
    return {season:b.season,canonicalDateRange:{earliest:dates[0]??null,latest:dates.at(-1)??null},
      stages:[...groups].map(([stage,rs])=>({providerStage:stage,rawRows:rs.length,canonicalMatches:new Set(rs.map(r=>r.match.providerFixtureId).filter(x=>x!==null)).size,
        usableCompletedMatches:rs.filter(r=>!r.reasons.length).length,statusCounts:Object.fromEntries([...new Set(rs.map(r=>r.match.fixtureStatus))].map(status=>[String(status),rs.filter(r=>r.match.fixtureStatus===status).length]))})),
      policy:'Descriptive grouping by provider round label only. Does not filter archive, change FT-only rule or approve a backtest cohort.'};
  });
}
async function main(repo:string) {
  const file=path.join(repo,'data/audits/football-four-major-leagues-historical-archive-v1.json');
  const aggregate=JSON.parse(await fs.readFile(file,'utf8'));
  for(const league of aggregate.leagues) {
    const dir=path.join(repo,league.localArchiveRelativePath),epl=league.league.id===39;
    const local=JSON.parse(await fs.readFile(path.join(dir,epl?'football-epl-historical-archive-v1.json':'manifest.json'),'utf8'));
    const batches:Batch[]=[];
    for(const b of local.batches){const bytes=await fs.readFile(path.join(dir,b.rawPath));if(sha(bytes)!==b.sourceHash)throw Error('RAW_HASH_MISMATCH');batches.push({...b,rows:envelope(JSON.parse(bytes.toString('utf8')),b.season,league.league.id).response as unknown[]});}
    league.providerStageInventory=stageInventory(batches,{...league.league,teamCount:league.league.id===78?18:20});
    if(league.league.id===78)league.reviewRequired='Provider includes Relegation Round in both seasons; one PEN fixture quarantined under unchanged FT-only rule. Aggregate is not cleared as a homogeneous regular-league backtest cohort.';
  }
  for(const [id,code] of [[39,'EPL'],[140,'LALIGA'],[135,'SERIEA'],[78,'BUNDESLIGA']] as const)aggregate[`${code}_HISTORICAL_ARCHIVE_SHA256`]=aggregate.leagues.find((l:{league:{id:number}})=>l.league.id===id).archiveSha256;
  aggregate['4_MAJOR_LEAGUES_DATA_READY']=aggregate.FOUR_MAJOR_LEAGUES_DATA_READY;
  aggregate.totalApiCallsIncludingInterruptedAttempt=aggregate.apiCallCount+(aggregate.priorFailedAttempt?.apiCalls??0);
  aggregate.finalStatus='FOOTBALL_4_MAJOR_LEAGUES_HISTORICAL_ARCHIVE_V1_READY_FOR_CTO_REVIEW';
  await fs.writeFile(file,json(aggregate));
  console.log(json({ready:aggregate.FOUR_MAJOR_LEAGUES_DATA_READY,canonical:aggregate.canonicalMatches,usable:aggregate.usableCompletedMatches,networkCalls:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
