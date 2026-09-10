import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES,expandAudit,seasonWindowAudit} from './ingest-football-four-leagues-v1.ts';
import {envelope,sha,json} from './ingest-football-epl-historical-archive-v1.ts';
import {stageInventory} from './audit-football-four-leagues-stages-v1.ts';
function fixture(leagueId:number,leagueName:string,season:number,id:number,home=1,away=2) {
  return {fixture:{id,date:`${season}-08-15T19:00:00Z`,status:{short:'FT'}},league:{id:leagueId,name:leagueName,season,round:'Regular Season - 1'},teams:{home:{id:home,name:`Team ${home}`},away:{id:away,name:`Team ${away}`}},score:{fulltime:{home:2,away:1}},goals:{home:2,away:1}};
}
const batch=(season:number,rows:unknown[])=>({season,rows,fetchedAt:'2026-09-10T13:00:00.000Z',sourceHash:sha(json(rows))});
test('explicit fixture season preserved outside general metadata window',()=>{
  const rows=[{season:2023,kickoffUtc:'2024-06-02T16:00:00.000Z'}];
  const before=json(rows),audit=seasonWindowAudit(rows,[{season:2023,start:'2023-08-19',end:'2024-05-26'}]);
  assert.equal(audit[0].outsideMetadataWindow,1);assert.equal(json(rows),before);
});
for(const league of LEAGUES)test(`${league.code}: actual directed round robin count and immutable provenance`,()=>{
  const batches=[2023,2024].map(season=>{const rows=[];let id=season*1000;for(let h=1;h<=league.teamCount;h++)for(let a=1;a<=league.teamCount;a++)if(h!==a)rows.push(fixture(league.id,league.name,season,++id,h,a));return batch(season,rows);});
  const built=expandAudit(batches,league);assert.equal(built.audit.canonicalMatches,2*league.teamCount*(league.teamCount-1));
  assert.equal(built.audit.chronologicalResearchEligible,true);assert.ok(built.audit.seasonCounts.every(s=>s.completeness==='COMPLETE'));
  assert.ok(built.archive.matches.every(r=>r.strictReplayEligible===false&&r.resultCompletedAt===null&&r.providerFetchedAt==='2026-09-10T13:00:00.000Z'));
  assert.doesNotMatch(json(built.archive),/"observedAt"|"odds"|"prediction"/);
  batches[0].rows.pop();const missing=expandAudit(batches,league);assert.equal(missing.audit.canonicalMatches,built.audit.canonicalMatches-1);assert.equal(missing.audit.chronologicalResearchEligible,false);
});
test('duplicates and missing fields reported without manufactured rows',()=>{
  const l=LEAGUES[0],x=fixture(l.id,l.name,2023,1),bad={...x,fixture:{...x.fixture,id:null},score:{fulltime:{home:null,away:null}}};
  const built=expandAudit([batch(2023,[x,x,bad]),batch(2024,[])],l),s=built.audit.seasonCounts[0];
  assert.equal(s.rawRows,3);assert.equal(s.canonicalMatches,1);assert.equal(s.duplicates,1);assert.equal(s.missingScore,1);assert.equal(s.missingIdentity,1);assert.equal(s.completeness,'INCOMPLETE');
});
test('query echo wrong league, pagination and status rejected',()=>{
  const e={errors:[],results:0,response:[],parameters:{league:'140',season:'2023'},paging:{current:1,total:1}};
  assert.equal(envelope(e,2023,140).results,0);assert.throws(()=>envelope(e,2023,135));assert.throws(()=>envelope({...e,paging:{current:1,total:2}},2023,140));
  const x=fixture(140,'La Liga',2023,1);x.fixture.status.short='PEN';assert.equal(expandAudit([batch(2023,[x]),batch(2024,[])],LEAGUES[0]).audit.usableCompletedMatches,0);
});
test('stage audit retains playoff/PEN inventory without changing source records',()=>{
  const x=fixture(78,'Bundesliga',2023,1),y=fixture(78,'Bundesliga',2023,2);y.league.round='Relegation Round';y.fixture.status.short='PEN';
  const batches=[batch(2023,[x,y])],before=json(batches),s=stageInventory(batches,LEAGUES[2])[0];
  assert.equal(s.stages.length,2);assert.equal(s.stages[1].canonicalMatches,1);assert.equal(s.stages[1].usableCompletedMatches,0);assert.equal(s.stages[1].statusCounts.PEN,1);assert.equal(json(batches),before);
});
