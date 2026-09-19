/** Consumer only: explicit sealed local artifacts; no collection imports or network. */
import assert from 'node:assert/strict';
import {mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadScope,readDecisionCoverage} from '../src/lib/research/terminal-decision';
import {advancePregame} from '../src/lib/research/terminal-decision/lifecycle';
import {readEnvelope,sha,time,envelope} from '../src/lib/research/terminal-decision/evidence';
import {resolveExactPregameIdentity,type ExactBinding} from '../src/lib/betman/daily-slate/exact-pregame-identity';
import {freeze,writeOnce,type Fixture,type Completed} from './football-forward-shadow-v1';

export function runLockedSealedForward(cwd:string,dateKst:string,targetId:string,inputs:{fixtureEvidencePath:string;fixtureEvidenceHash:string;binding:ExactBinding;historyPath:string;historyHash:string}){
  const scope=loadScope(cwd,dateKst);const target=scope.doc.targets.find(t=>t.targetId===targetId);assert.ok(target);
  const coverage=readDecisionCoverage(cwd,dateKst);assert.equal(coverage.status,'COVERAGE_INCOMPLETE');assert.ok(coverage.unresolvedTargetIds?.includes(targetId),'TERMINAL_ALREADY_EXISTS');
  const now=new Date().toISOString();assert.ok(time(now)+60000<time(target.scheduledStartTimeKst!),'PREGAME_CUTOFF');
  const e=readEnvelope(inputs.fixtureEvidencePath);assert.equal(e.sha256,inputs.fixtureEvidenceHash);assert.equal(e.payload.schemaVersion,'football-pregame-fixture-evidence-v1');
  assert.ok(time(e.payload.collectedAt)<=time(e.payload.observedAt)&&time(e.payload.observedAt)<=time(now));
  const matches=e.payload.fixtures.filter((f:any)=>f.fixtureId===inputs.binding.providerFixtureId);assert.equal(matches.length,1);
  const sourceUtf8=JSON.stringify(matches[0]);const identity=resolveExactPregameIdentity(target,scope.hash,inputs.binding,Buffer.from(sourceUtf8),now);
  assert.equal(identity.observedAt,e.payload.observedAt);
  const history=readEnvelope(inputs.historyPath);assert.equal(history.sha256,inputs.historyHash);
  assert.equal(history.payload.schemaVersion,'football-forward-observed-history-v1');assert.ok(time(history.payload.sealedAt)<=time(now));
  const observations=history.payload.observations as Completed[];assert.ok(Array.isArray(observations));
  for(const row of observations){assert.ok(time(row.providerFetchedAt)<=time(history.payload.sealedAt));assert.notEqual(row.providerFixtureId,identity.fixtureId);}
  const fixture:Fixture={fixtureId:identity.fixtureId,kickoffUtc:identity.kickoffUtc,leagueId:identity.leagueId,season:identity.season,homeTeam:{id:identity.homeTeamId,name:identity.homeTeamName},awayTeam:{id:identity.awayTeamId,name:identity.awayTeamName},providerStatus:'NS',scheduleFetchedAt:identity.observedAt};
  const bridge=envelope({binding:inputs.binding,sourceUtf8});const dir=join(cwd,'data/research/football/operator-identity-bridges',scope.hash);mkdirSync(dir,{recursive:true});
  const path=join(dir,`${sha(targetId)}.json`);
  if(existsSync(path))assert.equal(readEnvelope(path).sha256,bridge.sha256);else writeOnce(path,JSON.stringify(bridge,null,2)+'\n');
  const root=join(cwd,'data/cache/research/football/forward-shadow-v1');
  const result=freeze(root,fixture,()=>Date.now(),observations);
  if(result.envelope?.payload.status!=='PREDICTED')return {result,terminal:null,readiness:'INPUT_WAITING'};
  const terminal=advancePregame(cwd,dateKst,targetId,'PENDING',{prediction:{kind:'FOOTBALL_FORWARD_V1',fixtureId:identity.fixtureId,snapshotHash:result.envelope.sha256,scopeSha256:scope.hash,identityEvidenceHash:bridge.sha256}});
  return {result,terminal,readiness:'SEALED'};
}
