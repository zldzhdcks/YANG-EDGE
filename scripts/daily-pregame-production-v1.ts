/** Operational orchestration, not a model. Only acquisition modules may use network. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readDecisionCoverage,terminalRoot} from '../src/lib/research/terminal-decision';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import {advancePregame} from '../src/lib/research/terminal-decision/lifecycle';
import {readEnvelope,envelope,sha,time} from '../src/lib/research/terminal-decision/evidence';
import {runLockedSealedForward} from './football-locked-sealed-forward-v1';
import {runLockedMlbPrediction} from './mlb-locked-sealed-prediction-v1';
import type {MlbCollectionBinding} from '../src/lib/mlb/prediction-v0/collection-adapter';

type SoccerInput=Parameters<typeof runLockedSealedForward>[3];
type MlbInput=Parameters<typeof runLockedMlbPrediction>[3];
export type ProductionPlan={scopeSha256:string;targets:Record<string,{
  soccer?:SoccerInput;
  soccerCollection?:{leagueId:number;season:number};
  mlbCollection?:MlbCollectionBinding;
  mlb?:MlbInput & {evidenceReview:{status:'VERIFIED';manifestHash:string;reviewedAt:string}};
}>};

export async function runDailyPregame(cwd:string,date:string,plan?:ProductionPlan){
  const scope=loadCommittedProductionScope(cwd,date);if(plan){assert.equal(plan.scopeSha256,scope.hash);for(const id of Object.keys(plan.targets))assert.ok(scope.doc.targets.some(t=>t.targetId===id),'OUT_OF_SCOPE_PLAN');}
  const initial=readDecisionCoverage(cwd,date);assert.ok(['COVERAGE_COMPLETE','COVERAGE_INCOMPLETE'].includes(initial.status),'INVALID_EXISTING_EVIDENCE');
  const rows=[];
  for(const t of scope.doc.targets){
    const before=advancePregame(cwd,date,t.targetId,'PENDING');
    if(before.audit.plan.action!=='WAIT'){rows.push({...before.audit,blocker:null});continue;}
    const p=plan?.targets[t.targetId];let readiness='INPUT_WAITING',blocker='NO_APPROVED_INPUT_REFERENCES';let evidencePointer:string|null=null;
    try{
      if(t.sport==='SOCCER'&&p?.soccer){
        const inputs={...p.soccer,fixtureEvidencePath:resolve(cwd,p.soccer.fixtureEvidencePath),historyPath:resolve(cwd,p.soccer.historyPath)};
        const r=runLockedSealedForward(cwd,date,t.targetId,inputs);readiness=r.readiness;blocker=r.readiness==='SEALED'?'':r.readiness;
        if(r.readiness==='SEALED'){
          const e=readEnvelope(inputs.fixtureEvidencePath),p=r.result.envelope!.payload;
          const terminalDir=join(terminalRoot(cwd,date),sha(t.targetId));
          const dir=join(cwd,'data/audits/production-predictions',date);mkdirSync(dir,{recursive:true});
          const file=join(dir,`${sha(t.targetId)}.json`);
          const audit=envelope({TARGET_ID:t.targetId,DATE:date,COMPETITION:t.competitionNameRaw,HOME:t.homeTeamRaw,AWAY:t.awayTeamRaw,START_KST:t.scheduledStartTimeKst,PROVIDER:'API_FOOTBALL',PROVIDER_FIXTURE_ID:p.fixtureId,PROVIDER_HOME_ID:p.homeTeam.id,PROVIDER_AWAY_ID:p.awayTeam.id,EVIDENCE_OBSERVED_AT:e.payload.observedAt,EVIDENCE_COLLECTED_AT:e.payload.collectedAt,EVIDENCE_SHA256:e.sha256,FORWARD_INPUT_CREATED_AT:p.cutoffAt,FORWARD_INPUT_SHA256:p.inputSnapshotHash,PREDICTION_CREATED_AT:p.predictionCreatedAt,PREDICTION_ARTIFACT:`data/cache/research/football/forward-shadow-v1/MODEL_FORWARD/fixtures/${p.fixtureId}/snapshot.json`,PREDICTION_SHA256:r.result.envelope!.sha256,EXACT_IDENTITY:true,AS_OF_SAFE:true,PROVIDER_CALLS_FROM_PREDICTION:0,NETWORK_CALLS_FROM_PREDICTION:0,TERMINAL_DECISION_ID:readEnvelope(join(terminalDir,'decision.json')).sha256,TERMINAL_RECEIPT:join(terminalDir,'seal.json')});
          if(existsSync(file))assert.equal(readEnvelope(file).sha256,audit.sha256);else writeFileSync(file,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
        }
      }else if(t.sport==='BASEBALL'&&p?.mlb){
        const review=p.mlb.evidenceReview;assert.equal(review.status,'VERIFIED');assert.equal(review.manifestHash,p.mlb.sha256);assert.ok(time(review.reviewedAt)<=Date.now());
        const manifest=readEnvelope(join(cwd,p.mlb.path));assert.ok(time(review.reviewedAt)>=time(manifest.payload.sealedAt),'EVIDENCE_REVIEW_PRECEDES_COLLECTION');
        const r=await runLockedMlbPrediction(cwd,date,t.targetId,p.mlb);readiness=r.readiness;blocker='';
      }else if(t.sport==='SOCCER'&&p?.soccerCollection){
        const {leagueId,season}=p.soccerCollection;
        const leagues:Record<string,number>={EPL:39,'La Liga':140,'라리가':140,'Serie A':135,'세리에A':135,Bundesliga:78,'분데스리':78};
        assert.equal(leagues[t.competitionNameRaw??''],leagueId,'COMPETITION_IDENTITY_REQUIRED');
        assert.ok(Date.now()+60000<time(t.scheduledStartTimeKst!),'PREGAME_CUTOFF');
        const dir=join(cwd,'data/cache/research/football/operator-collection',scope.hash);mkdirSync(dir,{recursive:true});
        const pointer=join(dir,`${sha(t.targetId)}.json`);
        evidencePointer=pointer;
        if(!existsSync(pointer)){
          const {collectFixtureEvidence}=await import('../src/lib/football/foundation/pregame-fixture-evidence');
          const path=join(dir,`${sha(t.targetId)}-${randomUUID()}.fixtures.json`);
          const e=await collectFixtureEvidence(date,leagueId,season,path,fetch,true);
          const candidates=e.payload.fixtures.filter(f=>String(f.fixtureId)===t.providerFixtureId);
          const binding=envelope({operatorTargetId:t.targetId,scopeIdentity:scope.hash,sourceArtifactSha256:e.sha256,sourceArtifact:path,providerName:'API_FOOTBALL',collectedAt:e.payload.collectedAt,observedAt:e.payload.observedAt,candidates,identityStatus:'REVIEW_REQUIRED'});
          writeFileSync(pointer,JSON.stringify(binding,null,2)+'\n',{flag:'wx'});
        }
        readiness='IDENTITY_BLOCKED';blocker='REVIEW_EXACT_BINDING_AND_PIN_HISTORY';
      }else if(t.sport==='BASEBALL'&&p?.mlbCollection){
        assert.equal(p.mlbCollection.target.targetId,t.targetId);assert.equal(p.mlbCollection.scopeSha256,scope.hash);
        const {collectOfficialMlbManifest}=await import('../src/lib/mlb/prediction-v0/collection-adapter');
        const base=`data/cache/research/mlb/operator-collection/${scope.hash}/${sha(t.targetId)}`;
        const pointer=join(cwd,base,'completed-collection.json');evidencePointer=pointer;
        if(!existsSync(pointer)){
          // Failed acquisition attempts remain orphaned; retry never overwrites their bytes.
          const path=`${base}/attempt-${randomUUID()}/manifest.json`;
          const m=await collectOfficialMlbManifest(cwd,path,p.mlbCollection);
          writeFileSync(pointer,JSON.stringify(envelope({targetId:t.targetId,scopeSha256:scope.hash,manifestPath:path,manifestHash:m.sha256}),null,2)+'\n',{flag:'wx'});
        }else{
          const prior=readEnvelope(pointer).payload;assert.equal(prior.targetId,t.targetId);assert.equal(prior.scopeSha256,scope.hash);
          assert.equal(readEnvelope(join(cwd,prior.manifestPath)).sha256,prior.manifestHash);
        }
        readiness='INPUT_WAITING';blocker='REAL_COLLECTOR_EVIDENCE_REVIEW_REQUIRED';
      }
    }catch(error){
      // Do not log provider errors/URLs (may contain secrets). Pending is explicit, not PASS.
      readiness='PIPELINE_BLOCKED';blocker=error instanceof assert.AssertionError?'INPUT_CONTRACT_FAILED':'COLLECTION_OR_PIPELINE_FAILED';
    }
    // The clock is read again after slow acquisition. Only a genuine expired window gets PASS.
    const after=advancePregame(cwd,date,t.targetId,'PENDING');
    rows.push({...after.audit,readiness,blocker,evidencePointer});
  }
  const coverage=readDecisionCoverage(cwd,date);
  const audit={schemaVersion:'daily-pregame-operational-status-v1',dateKst:date,scopeSha256:scope.hash,checkedAt:new Date().toISOString(),terminalResearchArtifact:false,intermediateIncompleteAllowed:true,rows,coverage};
  const dir=join(cwd,'data/audits/operational');mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,`${date}-daily-pregame-status.json`),JSON.stringify(audit,null,2)+'\n');return audit;
}
