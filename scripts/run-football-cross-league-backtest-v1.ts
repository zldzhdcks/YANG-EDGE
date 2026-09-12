import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASE_SHA,CROSS_SHA,verifyCross,selectRegular,validateRegular,nameVariants,executeLeague,comparison,questionEvidence,overall,report,type ScopedMatch,type LeagueResult,type LeagueSummary} from './football-cross-league-backtest-v1-core';
import {sha,canonical} from './football-poisson-backtest-v1-core';
import {denyNetwork} from './run-football-poisson-chronological-backtest-v1';
import {scope,ordered,type ScopeRow} from './football-cross-league-scope-v1';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
function save(path:string,text:string){const fd=openSync(path,'wx');try{writeFileSync(fd,text,'utf8');fsyncSync(fd);}finally{closeSync(fd);}}
async function main(){
  assert.deepEqual(process.argv.slice(2),['--execute-once']);
  const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/').replace(/\/$/,'')}`,...args],{cwd:root,encoding:'utf8'}).trim();
  assert.equal(git('rev-parse','HEAD'),BASE_SHA);assert.equal(git('rev-parse','origin/agent/astra/football-historical-source-gate-v1'),BASE_SHA);assert.equal(git('branch','--show-current'),'agent/astra/football-historical-source-gate-v1');
  assert.equal(git('diff','HEAD','--name-only'),'','EXISTING_TRACKED_FILES_CHANGED');
  const additions=['scripts/football-cross-league-backtest-v1-core.ts','scripts/run-football-cross-league-backtest-v1.ts','scripts/test-football-cross-league-backtest-v1.ts','docs/FOOTBALL_CROSS_LEAGUE_EXECUTION_HANDOFF_V1.md'];
  assert.ok(git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean).every(p=>additions.includes(p)),'UNEXPECTED_DIRTY_FILES');
  const p=verifyCross(readFileSync(resolve(root,'docs/FOOTBALL_POISSON_CROSS_LEAGUE_VALIDATION_V1.json'),'utf8'));
  const old=JSON.parse(readFileSync(resolve(root,'docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.json'),'utf8'));assert.equal(sha(canonical(old)),p.parentProtocol.sha256);
  for(const [path,hash] of Object.entries(p.model.sourceSha256))assert.equal(sha(readFileSync(resolve(root,path),'utf8').replace(/\r\n/g,'\n')),hash);
  const epl=JSON.parse(readFileSync(resolve(root,'data/audits/football-poisson-chronological-backtest-v1.json'),'utf8'));
  assert.equal(sha(readFileSync(resolve(root,epl.localResultRelativePath))),p.eplReference.resultSha256);
  const previousCode=['scripts/football-poisson-backtest-v1-core.ts','scripts/run-football-poisson-chronological-backtest-v1.ts'];
  for(const file of previousCode)assert.equal(sha(readFileSync(resolve(root,file),'utf8').replace(/\r\n/g,'\n')),epl.codeHashes[file],'EPL_IMPLEMENTATION_CHANGED');
  const sourceFiles=[...additions.filter(f=>f.endsWith('.ts')),...previousCode,'scripts/football-cross-league-scope-v1.ts','scripts/audit-football-cross-league-scope-v1.ts',...Object.keys(p.model.sourceSha256)];
  const codeHashes=Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(resolve(root,f),'utf8').replace(/\r\n/g,'\n'))]));
  const attempts=denyNetwork();
  const evidence=JSON.parse(readFileSync(resolve(root,'data/audits/football-cross-league-scope-v1.json'),'utf8'));assert.equal(sha(canonical(evidence)),p.scope.evidenceAuditCanonicalSha256,'SCOPE_EVIDENCE_MISMATCH');
  const archiveManifest=JSON.parse(readFileSync(resolve(root,'data/audits/football-four-major-leagues-historical-archive-v1.json'),'utf8'));
  const archives=p.externalLeagues.map(spec=>{
    const record=archiveManifest.leagues.find((l:{league:{id:number}})=>l.league.id===spec.leagueId);
    const dir=resolve(root,record.localArchiveRelativePath),rel=relative(resolve(root,'data/cache/research/football/historical-archive-v1'),dir);assert.ok(!rel.startsWith('..')&&!isAbsolute(rel));
    const path=resolve(dir,'archive.json'),bytes=readFileSync(path);assert.equal(sha(bytes),spec.archiveSha256,'ARCHIVE_HASH_MISMATCH');
    const parsed=JSON.parse(bytes.toString('utf8'));assert.equal(parsed.strictReplayEligible,false);assert.equal(parsed.schemaVersion,'football-league-historical-archive-v1');
    const rows:ScopedMatch[]=parsed.matches;validateRegular(selectRegular(rows,spec),spec);
    const local=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));const excluded:ScopeRow[]=[],metadata:ScopeRow[]=[];
    for(const b of local.batches){const bytes=readFileSync(resolve(dir,b.rawPath));assert.equal(sha(bytes),b.sourceHash);for(const r of JSON.parse(bytes.toString('utf8')).response){const m:ScopeRow={providerFixtureId:r.fixture.id,leagueId:r.league.id,season:r.league.season,round:r.league.round,kickoffUtc:new Date(r.fixture.date).toISOString()};metadata.push(m);if(scope(m)==='OUT_OF_SCOPE_STAGE')excluded.push(m);}}
    assert.equal(metadata.length,spec.archiveCanonical);assert.equal(new Set(metadata.map(m=>m.providerFixtureId)).size,metadata.length);
    assert.equal(sha(canonical(ordered(metadata).map(m=>({...m,scopeDecision:scope(m)})))),spec.scopeMetadataSha256,'RAW_SCOPE_DECISION_MISMATCH');
    assert.equal(excluded.length,spec.outOfScopeStage);return {spec,path,rows,excluded};
  });
  assert.deepEqual(archives.map(a=>a.spec.leagueId),[140,135,78]);assert.equal(archives.reduce((n,a)=>n+a.spec.primaryTargets,0),1066);
  const out=resolve(root,'data/cache/research/football/poisson-chronological-backtest-v1/cross-league-v1');mkdirSync(out);
  const receipt={startedAt:new Date().toISOString(),baseSha:BASE_SHA,protocolSha256:CROSS_SHA,codeHashes,entryGate:'HEAD/upstream matched and tree clean before authorized runner additions; all tracked files still unchanged',executionOrder:[140,135,78]};
  save(resolve(out,'execution-start.json'),json(receipt));
  try{
    const results:LeagueResult[]=[];
    for(const a of archives){
      save(resolve(out,`${a.spec.leagueId}-started.json`),json({leagueId:a.spec.leagueId,startedAt:new Date().toISOString(),runNumber:1}));
      const result=executeLeague(a.rows,a.spec,p,text=>{const path=resolve(out,`${a.spec.leagueId}-predictions-before-labels.json`);save(path,text);return readFileSync(path,'utf8');});
      results.push(result);save(resolve(out,`${a.spec.leagueId}-result.json`),json(result));
      // Do not print or inspect performance between independent executions.
    }
    for(const a of archives)assert.equal(sha(readFileSync(a.path)),a.spec.archiveSha256);
    for(const [file,h] of Object.entries(codeHashes))assert.equal(sha(readFileSync(resolve(root,file),'utf8').replace(/\r\n/g,'\n')),h);
    assert.equal(attempts(),0);
    const reference:LeagueSummary={leagueId:39,league:'EPL',summary:epl.summary,poisson:epl.poisson,comparator:epl.comparator};
    const all=[reference,...results],status=overall(all),questions=questionEvidence(all);
    const governance={POST_RESULT_TUNING:false,ENGINE_CHANGED:false,WEIGHTS_CHANGED:false,MIN_SAMPLE_CHANGED:false,RESULT_LAG_CHANGED:false,ODDS_USED:false,PROVIDER_PREDICTION_USED:false,NETWORK_CALLS:0,NETWORK_ATTEMPTS:attempts(),STRICT_REPLAY:false,STRICT_AS_OF_FABRICATED:false,IS_ACTUAL_OBSERVED_AT:false,OWNER_PRIVATE_DATA_USED:false,CROSS_LEAGUE_POOLING:false,PICK:false,STAKE:false,ROI:false,PROFIT:false,BACKTEST_EXECUTED:true,VALIDATED_MODEL:false};
    const result={schemaVersion:'football-poisson-cross-league-backtest-v1',...receipt,completedAt:new Date().toISOString(),modelVersion:p.model.version,
      eplReference:{...reference,resultSha256:p.eplReference.resultSha256,rerun:false},leagueResults:results,comparison:comparison(all),crossLeagueQuestions:questions,
      excludedStages:archives.flatMap(a=>a.excluded.map(r=>({...r,reason:'OUT_OF_SCOPE_STAGE',preservedInArchive:true}))),providerTeamNameVariants:archives.map(a=>({leagueId:a.spec.leagueId,variants:nameVariants(selectRegular(a.rows,a.spec))})),
      CROSS_LEAGUE_STATUS:status,ALL_4_LEAGUES_DRAW_PREDICTED_ZERO:questions.Q3.allFourZero,governance};
    const bytes=json(result),resultSha256=sha(bytes),file=resolve(out,'football-poisson-cross-league-backtest-v1.json');save(file,bytes);assert.equal(sha(readFileSync(file)),resultSha256);
    const leagueSummaries=results.map(({records,pairedFixtureIds,...summary})=>{assert.equal(records.length,summary.summary.TOTAL_TARGET_MATCHES);assert.equal(pairedFixtureIds.length,summary.summary.PREDICTED_MATCHES);return summary;});
    const summary={...receipt,schemaVersion:'football-poisson-cross-league-review-seal-v1',modelVersion:p.model.version,resultSha256,resultHashPolicy:'SHA256 exact UTF8 local result bytes including final newline',localResultRelativePath:relative(root,file).replaceAll('\\','/'),
      eplReference:result.eplReference,leagueResults:leagueSummaries,comparison:result.comparison,crossLeagueQuestions:questions,CROSS_LEAGUE_STATUS:status,ALL_4_LEAGUES_DRAW_PREDICTED_ZERO:questions.Q3.allFourZero,governance,
      perMatchData:'LOCAL_ONLY_GITIGNORED',excludedStageCount:result.excludedStages.length,finalStatus:'FOOTBALL_POISSON_CROSS_LEAGUE_BACKTEST_V1_READY_FOR_CTO_REVIEW'};
    save(resolve(root,'data/audits/football-poisson-cross-league-backtest-v1.json'),json(summary));
    save(resolve(root,'docs/FOOTBALL_POISSON_CROSS_LEAGUE_BACKTEST_V1.md'),report(all,resultSha256,status));
    console.log(json({comparison:result.comparison,status,resultSha256,allDrawZero:questions.Q3.allFourZero}));
  }catch(error){save(resolve(out,'INVALID.json'),json({...receipt,CROSS_LEAGUE_STATUS:'INVALID',error:String(error),retryAllowed:false,networkAttempts:attempts()}));throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
