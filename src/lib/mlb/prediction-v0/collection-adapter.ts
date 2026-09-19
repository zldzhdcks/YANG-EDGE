/** Acquisition boundary only. Native normalized documents -> immutable manifest.
 * No daily-file lookup, boxscore, live feed, postgame review or fuzzy join.
 */
import assert from 'node:assert/strict';
import {collectMlbInputManifest, type Dataset, type MlbManifestTarget} from './sealed-input-manifest';
import {loadScope,readDecisionCoverage} from '../../research/terminal-decision';
import {loadCommittedProductionScope} from '../../research/terminal-decision/production-authority';
import {time} from '../../research/terminal-decision/evidence';
import {buildDerivedPitcherStats} from '../build-starter-dataset';

export type MlbCollectionBinding={
  target:MlbManifestTarget; scopeSha256:string; homeName:string; awayName:string;
  reviewStatus:'VERIFIED'; reviewedAt:string;
  oddsEventId:string; bookmakerKey:string;
};
export type NormalizedAcquisition={document:unknown;sourceIdentity:string;sourceAsOf:string};
export type NativeCollector=(kind:Dataset)=>Promise<NormalizedAcquisition>;

export function assertMlbCollectionAuthority(cwd:string,b:MlbCollectionBinding){
  const s=loadCommittedProductionScope(cwd,b.target.dateKst), t=s.doc.targets.find(x=>x.targetId===b.target.targetId);
  assert.ok(t,'OUT_OF_SCOPE');assert.equal(t.sport,'BASEBALL');assert.equal(t.competitionNameRaw,'MLB');
  assert.equal(s.hash,b.scopeSha256);assert.equal(t.providerGameId,String(b.target.gamePk),'VERIFIED_PROVIDER_GAME_ID_REQUIRED');
  assert.equal(t.homeTeamRaw,b.homeName);assert.equal(t.awayTeamRaw,b.awayName);
  assert.equal(time(t.scheduledStartTimeKst!),time(b.target.scheduledStart));
  assert.equal(b.reviewStatus,'VERIFIED');assert.ok(time(b.reviewedAt)<=Date.now());
  assert.equal(b.target.provider,'MLB_STATS_API');
  for(const id of [b.target.homeTeamId,b.target.awayTeamId])assert.match(id,/^[1-9]\d*$/);
  assert.notEqual(b.target.homeTeamId,b.target.awayTeamId);
  const c=readDecisionCoverage(cwd,b.target.dateKst);assert.equal(c.status,'COVERAGE_INCOMPLETE');
  assert.ok(c.unresolvedTargetIds?.includes(t.targetId),'TERMINAL_ALREADY_EXISTS');
  assert.ok(Date.now()<time(b.target.scheduledStart),'PREGAME_WINDOW_MISSED');return t;
}

/** Connect an actual normalized collector invocation, not a reread of yesterday's files. */
export async function collectMlbFromNormalized(cwd:string,path:string,b:MlbCollectionBinding,collector:NativeCollector){
  assertMlbCollectionAuthority(cwd,b);
  return collectMlbInputManifest(cwd,path,b.target,b.scopeSha256,async kind=>{
    assertMlbCollectionAuthority(cwd,b);
    const a=await collector(kind);
    return {bytes:Buffer.from(JSON.stringify(a.document)),sourceIdentity:a.sourceIdentity,sourceAsOf:a.sourceAsOf};
  });
}

/** Existing approved sources; explicit IDs only. Network is confined to this factory.
 * Schedule hydrate is used for lineups: target boxscore/live endpoints are never called.
 * Historical pitching aggregation reuses the unchanged existing aggregation function.
 */
export function officialMlbCollector(b:MlbCollectionBinding,transport:typeof fetch=fetch):NativeCollector{
  let schedule:any;
  const guard=()=>assert.ok(Date.now()<time(b.target.scheduledStart),'PREGAME_WINDOW_MISSED');
  async function get(url:URL){
    guard();const r=await transport(url,{cache:'no-store',redirect:'error'});
    assert.ok(r.ok,'MLB_PROVIDER_HTTP_ERROR');const body=await r.json();guard();return body;
  }
  const meta=(schemaVersion:string)=>({schemaVersion,generatedAt:new Date().toISOString(),researchOnly:true});
  async function scheduleOnly(){
    const u=new URL('https://statsapi.mlb.com/api/v1/schedule');
    u.search=new URLSearchParams({sportId:'1',gamePk:String(b.target.gamePk),hydrate:'probablePitcher,lineups',fields:'dates,games,gamePk,gameDate,status,abstractGameState,detailedState,teams,home,away,team,id,name,probablePitcher,fullName,lineups,homePlayers,awayPlayers,person,battingOrder,position,abbreviation'}).toString();
    const body=await get(u);const games=(body.dates??[]).flatMap((d:any)=>d.games??[]);
    assert.equal(games.length,1,'SINGLE_EXACT_PROVIDER_GAME_REQUIRED');const g=games[0];
    assert.equal(g.gamePk,b.target.gamePk);assert.equal(time(g.gameDate),time(b.target.scheduledStart));
    assert.equal(g.status?.abstractGameState,'Preview','NOT_PREGAME');
    for(const side of ['home','away'] as const){
      assert.equal(String(g.teams?.[side]?.team?.id),side==='home'?b.target.homeTeamId:b.target.awayTeamId);
      assert.equal(g.teams[side].team.name,side==='home'?b.homeName:b.awayName);
    }
    schedule=g;return g;
  }
  return async kind=>{
    guard();const observed=()=>new Date().toISOString();
    if(kind==='Schedule'){
      const g=await scheduleOnly();const at=observed();
      return {sourceIdentity:`MLB_STATS_API:schedule:gamePk=${g.gamePk}`,sourceAsOf:at,document:{meta:meta('mlb-schedule-v1'),games:[{gamePk:g.gamePk,internalGameId:`mlb-game-${g.gamePk}`,homeTeam:b.homeName,awayTeam:b.awayName,homeTeamId:Number(b.target.homeTeamId),awayTeamId:Number(b.target.awayTeamId),commenceTimeUtc:g.gameDate,startTimeKst:b.target.scheduledStart,statusDetailed:'Scheduled'}]}};
    }
    assert.ok(schedule,'SCHEDULE_FIRST');
    if(kind==='Starter'){
      const rows=[];
      for(const side of ['home','away'] as const){
        const p=schedule.teams[side].probablePitcher;assert.ok(Number.isSafeInteger(p?.id)&&p.id>0&&p.fullName,'PROBABLE_PITCHER_PENDING');
        const u=new URL(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats`);
        u.search=new URLSearchParams({stats:'gameLog',group:'pitching',season:b.target.scheduledStart.slice(0,4)}).toString();
        const raw=await get(u);const asOf=observed();const splits=raw.stats?.[0]?.splits;
        assert.ok(Array.isArray(splits),'PITCHING_HISTORY_PENDING');
        // Availability cutoff is execution time, not the still-future target kickoff.
        const derived=buildDerivedPitcherStats({splits,cutoffTime:asOf,targetGamePk:b.target.gamePk});
        assert.ok(derived.keptSplitCount>0,'PITCHING_HISTORY_PENDING');
        rows.push({gamePk:b.target.gamePk,side,teamId:Number(side==='home'?b.target.homeTeamId:b.target.awayTeamId),opponentTeamId:Number(side==='home'?b.target.awayTeamId:b.target.homeTeamId),probablePitcherId:p.id,probablePitcherName:p.fullName,seasonStats:derived.seasonStats,recentStarts:derived.recentStarts,sampleSize:derived.sampleSize,statsAsOf:asOf,sourceTimestamp:asOf,cutoffTime:b.target.scheduledStart});
      }
      return {sourceIdentity:'MLB_STATS_API:probablePitcher+pitching-gameLog:target-excluded',sourceAsOf:observed(),document:{meta:meta('mlb-starter-v1'),rows,summary:{targetGameIncludedInStats:0,cutoffViolations:0}}};
    }
    if(kind==='Lineup'){
      const g=await scheduleOnly();const at=observed();
      const rows=['home','away'].map(side=>{
        const players=g.lineups?.[`${side}Players`];assert.ok(Array.isArray(players)&&players.length===9,'CONFIRMED_LINEUP_PENDING');
        const ids=players.map((p:any)=>p.id??p.person?.id);assert.ok(ids.every((id:any)=>Number.isSafeInteger(id)&&id>0));assert.equal(new Set(ids).size,9);
        return {gamePk:b.target.gamePk,side,teamId:Number(side==='home'?b.target.homeTeamId:b.target.awayTeamId),opponentTeamId:Number(side==='home'?b.target.awayTeamId:b.target.homeTeamId),collectionStatus:'CONFIRMED',lineupStatus:'COMPLETE',sourceTimestamp:at,cutoffTime:b.target.scheduledStart,batters:players.map((p:any,i:number)=>({id:ids[i],fullName:p.fullName??p.person?.fullName??null}))};
      });
      return {sourceIdentity:`MLB_STATS_API:schedule-hydrate-lineups:${b.target.gamePk}`,sourceAsOf:at,document:{meta:meta('mlb-lineup-v1'),rows}};
    }
    assert.match(b.oddsEventId,/^[a-zA-Z0-9_-]+$/);assert.match(b.bookmakerKey,/^[a-zA-Z0-9_-]+$/);
    const key=process.env.ODDS_API_KEY;assert.ok(key,'ODDS_API_KEY_REQUIRED');
    const u=new URL(`https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${b.oddsEventId}/odds`);
    u.search=new URLSearchParams({apiKey:key,markets:'h2h',oddsFormat:'decimal',bookmakers:b.bookmakerKey}).toString();
    const raw=await get(u),at=observed();assert.equal(raw.id,b.oddsEventId);assert.equal(raw.home_team,b.homeName);assert.equal(raw.away_team,b.awayName);assert.equal(time(raw.commence_time),time(b.target.scheduledStart));
    const books=(raw.bookmakers??[]).filter((x:any)=>x.key===b.bookmakerKey);assert.equal(books.length,1);
    const markets=books[0].markets.filter((x:any)=>x.key==='h2h');assert.equal(markets.length,1);
    const sourceAt=markets[0].last_update??books[0].last_update;assert.ok(time(sourceAt)<=time(at));
    const outcomes=markets[0].outcomes;assert.equal(outcomes.length,2);
    const prices=['home','away'].map(side=>{const matches=outcomes.filter((o:any)=>o.name===(side==='home'?b.homeName:b.awayName));assert.equal(matches.length,1);assert.ok(Number.isFinite(matches[0].price)&&matches[0].price>1);return {marketType:'moneyline',selection:side,priceDecimal:matches[0].price};});
    return {sourceIdentity:`THE_ODDS_API:event=${b.oddsEventId}:bookmaker=${b.bookmakerKey}`,sourceAsOf:sourceAt,document:{meta:meta('mlb-odds-v1'),rows:[{gamePk:b.target.gamePk,homeTeam:b.homeName,awayTeam:b.awayName,collectionStatus:'COLLECTED',capturedAt:at,cutoffTime:b.target.scheduledStart,markets:prices}]}};
  };
}

export async function collectOfficialMlbManifest(cwd:string,path:string,b:MlbCollectionBinding){
  assertMlbCollectionAuthority(cwd,b);
  return collectMlbFromNormalized(cwd,path,b,officialMlbCollector(b));
}
