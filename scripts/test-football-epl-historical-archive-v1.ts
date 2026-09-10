import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildArchive,envelope,sha,json,verifyRun,type Batch} from './ingest-football-epl-historical-archive-v1.ts';

const fetchedAt='2026-09-10T12:00:00.000Z';
const fixture=(season=2023,fixtureId=1,home=1,away=2)=>({fixture:{id:fixtureId,date:`${season}-08-15T19:00:00+00:00`,status:{short:'FT'}},league:{id:39,name:'Premier League',season,round:'Regular Season - 1'},teams:{home:{id:home,name:'Home '+home},away:{id:away,name:'Away '+away}},score:{fulltime:{home:1,away:0}},goals:{home:1,away:0}});
const batch=(season:number,rows:unknown[]):Batch=>({season,rows,fetchedAt,sourceHash:sha(json(rows))});
const run=(rows:unknown[])=>buildArchive([batch(2023,rows),batch(2024,[fixture(2024,1000)])]);
const response=(season:number,rows:unknown[])=>({errors:[],results:rows.length,paging:{current:1,total:1},parameters:{league:'39',season:String(season)},response:rows});

test('required provenance retained, UTC normalized, no fabricated observation/odds/prediction',()=>{
  const a=run([fixture()]);const r=a.archive.matches[0];
  assert.equal(r.providerFetchedAt,fetchedAt);assert.equal(r.kickoffUtc,'2023-08-15T19:00:00.000Z');assert.equal(r.strictReplayEligible,false);assert.equal(r.resultCompletedAt,null);
  assert.equal(r.historicalRole,'RETROSPECTIVE_HISTORICAL_RESULT');assert.equal(a.audit.strictReplayEligible,false);
  assert.doesNotMatch(json(a.archive),/"observedAt"|"asOf"|"odds"|"prediction"/);
});
test('unique fixture IDs, deterministic chronological then numeric ordering, season separation',()=>{
  const x=fixture(2023,10),y=fixture(2023,2);
  assert.equal(json(run([x,y]).archive),json(run([y,x]).archive).replaceAll(sha(json([y,x])),sha(json([x,y]))));
  assert.deepEqual(run([x,y]).archive.matches.map(r=>r.providerFixtureId),[2,10,1000]);
  assert.throws(()=>buildArchive([batch(2023,[x]),batch(2023,[y])]),/EXACT_TWO_SEASONS/);
});
test('exact duplicates collapse; conflicting duplicates quarantine',()=>{
  const x=fixture(),a=run([x,x]);assert.equal(a.audit.duplicateCount,1);assert.equal(a.audit.canonicalMatches,2);assert.equal(a.archive.matches.length,2);
  const y=fixture();y.teams.home.id=3;const b=run([x,y]);assert.deepEqual(b.audit.conflictingFixtureIds,[1]);assert.equal(b.archive.matches.length,1);assert.equal(b.audit.chronologicalResearchEligible,false);
});
test('missing fields and invalid scores are not synthesized',()=>{
  const x=fixture();const bad={...x,fixture:{...x.fixture,id:null,date:null},teams:{home:{},away:{}},score:{fulltime:{home:null,away:-1}}};
  const a=run([bad]);assert.equal(a.audit.missingFieldCounts.missingScore,1);assert.equal(a.audit.missingIdentityRows,1);assert.equal(a.audit.canonicalMatches,1);assert.equal(a.archive.matches.length,1);
  for(const score of [-1,0.5,Infinity,101])assert.equal(run([{...x,score:{fulltime:{home:score,away:0}}}]).audit.missingFieldCounts.missingScore,1);
});
test('penalties, awarded, unfinished and mismatched season never enter regular FT archive',()=>{
  for(const status of ['PEN','AET','AWD','PST','NS']){const x=fixture();x.fixture.status.short=status;assert.equal(run([x]).audit.missingFieldCounts.unexpectedStatus,1);}
  assert.equal(run([fixture(2024)]).audit.missingFieldCounts.leagueSeasonMismatch,1);
  const x=fixture();x.goals.home=9;assert.equal(run([x]).audit.missingFieldCounts.scoreConflict,1);
});
test('future kickoff and invalid retrieval timestamp fail closed',()=>{
  const x=fixture();x.fixture.date='2027-08-01T00:00:00Z';assert.equal(run([x]).audit.missingFieldCounts.futureOrUnfinishedAtRetrieval,1);
  x.fixture.date='2023-02-30T00:00:00Z';assert.equal(run([x]).audit.missingFieldCounts.missingKickoff,1);
  assert.throws(()=>buildArchive([{...batch(2023,[]),fetchedAt:'2023-01-01'},batch(2024,[])]),/INVALID_PROVENANCE/);
});
test('HTTP 200 error envelopes, wrong parameters, counts and paging are rejected',()=>{
  const x=response(2023,[fixture()]);assert.equal(envelope(x,2023).results,1);
  for(const bad of [{...x,errors:{plan:'blocked'}},{...x,results:2},{...x,paging:{current:1,total:2}},{...x,parameters:{season:2024,league:39}}])assert.throws(()=>envelope(bad,2023));
});
test('complete synthetic two-season round robin passes dataset integrity only',()=>{
  const batches=[2023,2024].map(season=>{const rows=[];let i=(season-2023)*1000;for(let h=1;h<=20;h++)for(let a=1;a<=20;a++)if(h!==a)rows.push(fixture(season,++i,h,a));return batch(season,rows);});
  const a=buildArchive(batches);assert.equal(a.audit.canonicalMatches,760);assert.equal(a.audit.chronologicalResearchEligible,true);assert.equal(a.audit.strictReplayEligible,false);assert.equal(a.audit.governance.backtestExecuted,false);
});
test('frozen raw hash, provenance and normalized archive can be rebuilt offline; tamper fails',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'epl-archive-test-'));const batches:Batch[]=[],evidence=[];const files=[];
  for(const season of [2023,2024]){const text=json(response(season,[fixture(season,season)])),file=`${season}.json`;await fs.writeFile(path.join(dir,file),text);batches.push({season,fetchedAt,sourceHash:sha(text),rows:[fixture(season,season)]});evidence.push({season,fetchedAt,sourceHash:sha(text),rawPath:file});files.push({path:file,sha256:sha(text)});}
  const a=buildArchive(batches),text=json(a.archive);await fs.writeFile(path.join(dir,'archive.json'),text);files.push({path:'archive.json',sha256:sha(text)});
  await fs.writeFile(path.join(dir,'football-epl-historical-archive-v1.json'),json({files,batches:evidence,audit:a.audit,FOOTBALL_EPL_HISTORICAL_ARCHIVE_SHA256:sha(text)}));
  assert.equal((await verifyRun(dir)).verified,true);await fs.appendFile(path.join(dir,'2023.json'),' ');await assert.rejects(verifyRun(dir),/HASH_MISMATCH/);
});
test('default command is dry-run without credentials or network',()=>{
  const script=fileURLToPath(new URL('./ingest-football-epl-historical-archive-v1.ts',import.meta.url));
  const output=execFileSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,FOOTBALL_API_KEY:''}});
  assert.equal(JSON.parse(output).networkCalls,0);
});
