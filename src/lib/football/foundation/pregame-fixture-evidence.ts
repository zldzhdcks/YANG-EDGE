/** Collection boundary. Never import this module from a Prediction consumer. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {envelope,time} from '../../research/terminal-decision/evidence';
import type {PregameIdentity} from '../../betman/daily-slate/exact-pregame-identity';

export type FixtureEvidence = {schemaVersion:'football-pregame-fixture-evidence-v1';provider:'API_FOOTBALL';dateKst:string;leagueId:number;season:number;collectedAt:string;observedAt:string;sourceIdentity:string;fixtures:PregameIdentity[]};
export async function collectFixtureEvidence(dateKst:string,leagueId:number,season:number,destination:string,transport:typeof fetch=fetch,allowCurrentDate=false){
  assert.match(dateKst,/^\d{4}-\d{2}-\d{2}$/);assert.equal(new Date(`${dateKst}T00:00:00Z`).toISOString().slice(0,10),dateKst);
  assert.ok([39,140,135,78].includes(leagueId));assert.ok(Number.isSafeInteger(season));
  const requestStartedAt=new Date().toISOString();
  // This collector deliberately cannot retrieve the sealed September 20 slate.
  assert.ok(time(`${dateKst}T00:00:00+09:00`)+(allowCurrentDate?86400000:0)>time(requestStartedAt),'FUTURE_DATE_REQUIRED');
  const url=new URL('https://v3.football.api-sports.io/fixtures');
  url.search=new URLSearchParams({date:dateKst,league:String(leagueId),season:String(season),timezone:'Asia/Seoul',status:'NS'}).toString();
  const response=await transport(url,{headers:{'x-apisports-key':process.env.FOOTBALL_API_KEY??''},cache:'no-store',redirect:'error'});
  assert.ok(response.ok,'FIXTURE_PROVIDER_HTTP_ERROR');const raw=await response.json();
  const observedAt=new Date().toISOString();
  const collectedAt=observedAt;
  assert.equal(Object.keys(raw.errors??{}).length,0,'FIXTURE_PROVIDER_ERROR');
  assert.ok(Array.isArray(raw.response));assert.ok((raw.paging?.total??1)===1,'INCOMPLETE_PROVIDER_PAGE');
  const fixtures:PregameIdentity[]=raw.response.map((r:any)=>{
    assert.equal(r.fixture?.status?.short,'NS');assert.equal(r.league?.id,leagueId);assert.equal(r.league?.season,season);
    const kickoffUtc=new Date(r.fixture.date).toISOString();assert.ok(time(kickoffUtc)>time(observedAt));
    assert.equal(new Date(time(kickoffUtc)+9*3600000).toISOString().slice(0,10),dateKst);
    for(const id of [r.fixture.id,r.teams?.home?.id,r.teams?.away?.id])assert.ok(Number.isSafeInteger(id)&&id>0);
    assert.notEqual(r.teams.home.id,r.teams.away.id);
    for(const name of [r.teams.home.name,r.teams.away.name])assert.ok(typeof name==='string'&&name.trim());
    // Deliberate projection: raw goals/score/status detail never leave collection.
    return {provider:'API_FOOTBALL',fixtureId:r.fixture.id,leagueId,season,kickoffUtc,homeTeamId:r.teams.home.id,homeTeamName:r.teams.home.name,awayTeamId:r.teams.away.id,awayTeamName:r.teams.away.name,status:'NS',observedAt};
  });
  assert.equal(new Set(fixtures.map(f=>f.fixtureId)).size,fixtures.length,'DUPLICATE_PROVIDER_ID');
  const artifact=envelope<FixtureEvidence>({schemaVersion:'football-pregame-fixture-evidence-v1',provider:'API_FOOTBALL',dateKst,leagueId,season,collectedAt,observedAt,sourceIdentity:url.toString(),fixtures});
  writeFileSync(destination,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});return artifact;
}
