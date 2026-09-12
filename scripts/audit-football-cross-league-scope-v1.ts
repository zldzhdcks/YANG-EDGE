/** Read-only raw fixture stage inventory; never computes predictions or performance. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scope,evaluationTargets,ordered,LEAGUE_RULES,type ScopeRow} from './football-cross-league-scope-v1.ts';
export const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export function canonical(v:unknown):string {
  if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;
  if(v!==null&&typeof v==='object'){const o=v as Record<string,unknown>;return `{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;}
  return JSON.stringify(v);
}
export async function audit(repo:string) {
  const manifest=JSON.parse(await fs.readFile(path.join(repo,'data/audits/football-four-major-leagues-historical-archive-v1.json'),'utf8'));
  const summaries=[];const allIds=new Set<number>();
  for(const rule of LEAGUE_RULES) {
    const league=manifest.leagues.find((l:{league:{id:number}})=>l.league.id===rule.id);
    const dir=path.join(repo,league.localArchiveRelativePath);
    const local=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
    assert.equal(hash(await fs.readFile(path.join(dir,'archive.json'))),league.archiveSha256,'ARCHIVE_HASH_MISMATCH');
    for(const f of local.files as {path:string;sha256:string}[])assert.equal(hash(await fs.readFile(path.join(dir,f.path))),f.sha256);
    const metadata:ScopeRow[]=[];
    for(const batch of local.batches) {
      const bytes=await fs.readFile(path.join(dir,batch.rawPath));assert.equal(hash(bytes),batch.sourceHash);
      const envelope=JSON.parse(bytes.toString('utf8'));
      assert.equal(String(envelope.parameters.league),String(rule.id));assert.equal(String(envelope.parameters.season),String(batch.season));
      assert.equal(envelope.paging.total,1);assert.equal(envelope.paging.current,1);assert.equal(envelope.results,envelope.response.length);assert.equal(Object.keys(envelope.errors).length,0);
      for(const raw of envelope.response) {
        const row:ScopeRow={providerFixtureId:raw.fixture.id,leagueId:raw.league.id,season:raw.league.season,round:raw.league.round,kickoffUtc:new Date(raw.fixture.date).toISOString()};
        assert.equal(row.leagueId,rule.id);assert.equal(row.season,batch.season);assert.ok(Number.isSafeInteger(row.providerFixtureId)&&row.providerFixtureId>0&&!allIds.has(row.providerFixtureId));allIds.add(row.providerFixtureId);
        // Scope decision has no access to status, goals or any model output.
        const decision=scope(row);
        if(decision==='IN_SCOPE') {
          assert.equal(raw.fixture.status.short,'FT','IN_SCOPE_DATA_CONTRACT_FAILURE');
          assert.ok([raw.score.fulltime.home,raw.score.fulltime.away].every((n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100));
        }
        metadata.push(row);
      }
    }
    const seasons=[2023,2024].map(season=>{
      const rows=metadata.filter(r=>r.season===season),regular=rows.filter(r=>scope(r)==='IN_SCOPE'),excluded=rows.filter(r=>scope(r)==='OUT_OF_SCOPE_STAGE');
      assert.equal(regular.length,rule.targets,'REGULAR_SCOPE_COUNT_MISMATCH');assert.equal(excluded.length,rule.id===78?2:0);
      assert.equal(new Set(regular.map(r=>r.round)).size,rule.rounds);
      return {season,archiveCanonical:rows.length,regularSeasonCohort:regular.length,outOfScopeStage:excluded.length,providerRegularRoundLabels:[...new Set(regular.map(r=>r.round))].sort()};
    });
    assert.equal(metadata.length,rule.id===78?616:760);assert.equal(evaluationTargets(metadata,rule.id).length,rule.targets);
    const decisions=ordered(metadata).map(r=>({...r,scopeDecision:scope(r)}));
    summaries.push({leagueId:rule.id,archiveSha256:league.archiveSha256,archiveCanonical:metadata.length,regularSeasonCohort:seasons.reduce((n,s)=>n+s.regularSeasonCohort,0),
      outOfScopeStage:seasons.reduce((n,s)=>n+s.outOfScopeStage,0),primaryTargets:rule.targets,seasons,scopeMetadataSha256:hash(canonical(decisions)),archiveUnchanged:true});
  }
  return {schemaVersion:'FOOTBALL_CROSS_LEAGUE_SCOPE_AUDIT_V1',leagues:summaries,totalExternalTargets:summaries.reduce((n,s)=>n+s.primaryTargets,0),BACKTEST_EXECUTED:false,NETWORK_CALLS:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await audit(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')),null,2));
