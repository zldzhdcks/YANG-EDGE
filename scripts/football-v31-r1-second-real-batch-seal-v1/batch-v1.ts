/** Second-batch one-shot triple seal. No new discovery. First-batch fixture files are never rewritten. */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {compare} from '../football-v31-r1-comparator-v1/comparator-v1';
import {seal} from '../football-v31-r1-comparator-v1/seal-v1';
import {list,readSeal,writeSeal,sha,digest,requireRule,storeRoot,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';
import {projectIdentity} from '../football-v31-r1-second-real-batch-preflight-v1/identity-v1';
import {verifyFrozen} from '../football-v31-r1-second-real-batch-preflight-v1/hashes-v1';
import {DEFAULT_ROOT,keyFromEnv} from '../football-v31-r1-second-real-batch-preflight-v1/preflight-v1';
import {SEAL_DEADLINE_MS} from '../football-v31-r1-second-real-batch-preflight-v1/window-v1';
import {BATCH_ID,FIRST_BATCH_IDS,PREFLIGHT_AUDIT_SHA,PREFLIGHT_DISCOVERY_AT,READY_TARGETS,assertReadyTarget,loadReadyTargets,preflightAuditPath} from './targets-v1';
import {treeFingerprint} from './fingerprint-v1';

export {DEFAULT_ROOT,keyFromEnv};
const PROVIDER='https://v3.football.api-sports.io';

export type Outcome={
 target:Target;
 status:'SEALED'|'IDENTITY_BLOCKED'|'SEAL_PASS'|'UNSEALABLE'|'NOT_ATTEMPTED';
 reason?:string;
 providerStatus?:string|null;
 cutoffAt?:string;
 predictionCreatedAt?:string;
 sealedAt?:string;
 inputHash?:string;
 snapshotHash?:string;
 v1PredictionHash?:string;
 h2PredictionHash?:string;
 r1PredictionHash?:string;
 v1Status?:string;
 h2Status?:string;
 r1Status?:string;
};

export type BatchReport={
 schema:'FOOTBALL_V31_R1_SECOND_REAL_BATCH_SEAL_V1';
 batchId:typeof BATCH_ID;
 startedAt:string;
 sealedAt:string;
 preflightAuditHash:typeof PREFLIGHT_AUDIT_SHA;
 preflightDiscoveryAt:typeof PREFLIGHT_DISCOVERY_AT;
 TARGET_COUNT:number;
 SEALED_COUNT:number;
 PASS_COUNT:number;
 BLOCKED_COUNT:number;
 V1_PREDICTED:number;V1_PASS:number;H2_PREDICTED:number;H2_PASS:number;R1_PREDICTED:number;R1_PASS:number;
 FIRST_BATCH_FILES_MUTATED:'NO';
 MODEL_CHANGED:'NO';MAP_CHANGED:'NO';BETA_CHANGED:'NO';SELECTOR_CHANGED:'NO';
 FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'NO';MARKET_INPUT_USED:'NO';POSTGAME_INPUT_USED:'NO';
 FORWARD_CHANGED:'NO';RECOMMENDATION_ENGINE_CHANGED:'NO';MODEL_PROMOTED:'NO';
 R1_ROLE:'UNPROMOTED_PROSPECTIVE_SHADOW';
 outcomes:Outcome[];
};

export function batchDir(root:string){return join(storeRoot(root),'batches',BATCH_ID);}

function countStatus(outcomes:Outcome[],role:'v1Status'|'h2Status'|'r1Status',status:string){
 return outcomes.filter(o=>o.status==='SEALED'&&o[role]===status).length;
}

export function summarize(startedAt:string,sealedAt:string,outcomes:Outcome[]):BatchReport{
 const sealed=outcomes.filter(o=>o.status==='SEALED');
 return {
  schema:'FOOTBALL_V31_R1_SECOND_REAL_BATCH_SEAL_V1',
  batchId:BATCH_ID,startedAt,sealedAt,preflightAuditHash:PREFLIGHT_AUDIT_SHA,preflightDiscoveryAt:PREFLIGHT_DISCOVERY_AT,
  TARGET_COUNT:READY_TARGETS.length,
  SEALED_COUNT:sealed.length,
  PASS_COUNT:sealed.filter(o=>o.r1Status==='PASS').length,
  BLOCKED_COUNT:outcomes.filter(o=>o.status!=='SEALED').length,
  V1_PREDICTED:countStatus(outcomes,'v1Status','PREDICTED'),V1_PASS:countStatus(outcomes,'v1Status','PASS'),
  H2_PREDICTED:countStatus(outcomes,'h2Status','PREDICTED'),H2_PASS:countStatus(outcomes,'h2Status','PASS'),
  R1_PREDICTED:countStatus(outcomes,'r1Status','PREDICTED'),R1_PASS:countStatus(outcomes,'r1Status','PASS'),
  FIRST_BATCH_FILES_MUTATED:'NO',
  MODEL_CHANGED:'NO',MAP_CHANGED:'NO',BETA_CHANGED:'NO',SELECTOR_CHANGED:'NO',
  FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'NO',MARKET_INPUT_USED:'NO',POSTGAME_INPUT_USED:'NO',
  FORWARD_CHANGED:'NO',RECOMMENDATION_ENGINE_CHANGED:'NO',MODEL_PROMOTED:'NO',
  R1_ROLE:'UNPROMOTED_PROSPECTIVE_SHADOW',
  outcomes,
 };
}

async function recheck(target:Target,key:string,request:typeof fetch){
 const endpoint='/fixtures?id='+target.fixtureId;
 try{
  const response=await request(PROVIDER+endpoint,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
  const text=await response.text();
  // Strict projection: score, goals, events, lineups, statistics and predictions are never accessed or saved.
  if(response.status!==200)return {apiStatus:'NOT_VERIFIED' as const,providerStatus:null,sourceHash:sha(text)};
  const projected=projectIdentity(JSON.parse(text),target);
  if(!projected)return {apiStatus:'NOT_VERIFIED' as const,providerStatus:null,sourceHash:sha(text)};
  return {apiStatus:'VERIFIED' as const,providerStatus:projected.providerStatus,sourceHash:sha(text)};
 }catch{
  return {apiStatus:'NOT_VERIFIED' as const,providerStatus:null,sourceHash:null};
 }
}

export async function sealOne(input:{
 target:Target;root:string;key:string;observations:Observation[];request:typeof fetch;now?:()=>string;
}):Promise<Outcome>{
 assertReadyTarget(input.target);
 const check=await recheck(input.target,input.key,input.request);
 if(check.apiStatus!=='VERIFIED')return {target:input.target,status:'IDENTITY_BLOCKED',reason:'IDENTITY_OR_PROVIDER',providerStatus:check.providerStatus};
 const cutoffAt=(input.now??(()=>new Date().toISOString()))();
 const predictionCreatedAt=cutoffAt;
 const lead=Date.parse(input.target.kickoffUtc)-Date.parse(cutoffAt);
 if(check.providerStatus!=='NS'||lead<=0||lead<SEAL_DEADLINE_MS)return {target:input.target,status:'SEAL_PASS',reason:check.providerStatus!=='NS'?'NOT_NS':lead<=0?'NOT_FUTURE':'DEADLINE',providerStatus:check.providerStatus,cutoffAt,predictionCreatedAt};
 try{
  const bundle=compare(input.target,cutoffAt,predictionCreatedAt,input.observations);
  requireRule(bundle.sameCutoffV1.payload.cutoffAt===cutoffAt&&bundle.sameCutoffH2.payload.cutoffAt===cutoffAt&&bundle.r1.payload.cutoffAt===cutoffAt,'SAME_CUTOFF_CONTRACT');
  requireRule(bundle.sameCutoffV1.payload.predictionCreatedAt===predictionCreatedAt&&bundle.sameCutoffH2.payload.predictionCreatedAt===predictionCreatedAt&&bundle.r1.payload.predictionCreatedAt===predictionCreatedAt,'SAME_CREATED_AT');
  const statuses=[bundle.sameCutoffV1.payload.status,bundle.sameCutoffH2.payload.status,bundle.r1.payload.status];
  if(statuses.some(s=>s==='FAIL'||s==='INVALID'))return {target:input.target,status:'UNSEALABLE',reason:'FAIL_OR_INVALID',cutoffAt,predictionCreatedAt,providerStatus:check.providerStatus};
  const after=input.now?Date.parse(input.now()):Date.now();
  if(Date.parse(input.target.kickoffUtc)-after<SEAL_DEADLINE_MS)return {target:input.target,status:'SEAL_PASS',reason:'DEADLINE',cutoffAt,predictionCreatedAt,providerStatus:check.providerStatus};
  const saved=seal(input.root,bundle,input.observations,cutoffAt);
  const inputHash=readSeal(join(storeRoot(input.root),'fixtures',String(input.target.fixtureId),'input.json')).sha256;
  return {
   target:input.target,status:'SEALED',providerStatus:check.providerStatus,cutoffAt,predictionCreatedAt,sealedAt:saved.payload.sealedAt,
   inputHash,snapshotHash:saved.sha256,
   v1PredictionHash:bundle.sameCutoffV1.sha256,h2PredictionHash:bundle.sameCutoffH2.sha256,r1PredictionHash:bundle.r1.sha256,
   v1Status:bundle.sameCutoffV1.payload.status,h2Status:bundle.sameCutoffH2.payload.status,r1Status:bundle.r1.payload.status,
  };
 }catch(e){
  const error=e as {reason?:string;message?:string};
  const partial=existsSync(join(storeRoot(input.root),'fixtures',String(input.target.fixtureId)));
  return {target:input.target,status:'UNSEALABLE',reason:partial?'BLOCKED_PARTIAL':(error.reason??error.message??'UNKNOWN'),cutoffAt,predictionCreatedAt,providerStatus:check.providerStatus};
 }
}

export async function executeBatch(input:{
 root:string;key:string;request?:typeof fetch;observations?:Observation[];auditFile?:string;now?:()=>string;pauseMs?:number;writeManifest?:boolean;
}):Promise<BatchReport>{
 verifyFrozen();
 requireRule(input.key.length>0,'KEY_UNAVAILABLE');
 const targets=loadReadyTargets(input.auditFile??preflightAuditPath());
 requireRule(targets.length===4&&digest(targets.map(t=>t.fixtureId))===digest(READY_TARGETS.map(t=>t.fixtureId)),'TARGET_SET');
 const before=treeFingerprint(input.root,FIRST_BATCH_IDS);
 const observations=input.observations??list(input.root).map(s=>s.payload);
 const request=input.request??fetch;
 const pause=input.pauseMs??(input.request?0:250);
 const startedAt=(input.now??(()=>new Date().toISOString()))();
 if(input.writeManifest!==false)writeSeal(join(batchDir(input.root),'STARTED.json'),{batchId:BATCH_ID,startedAt,preflightAuditHash:PREFLIGHT_AUDIT_SHA,targetIds:targets.map(t=>t.fixtureId),scope:'ONE_SHOT_NO_RETRY'});
 const outcomes:Outcome[]=[];
 let halted=false;
 for(const target of targets){
  if(halted){outcomes.push({target,status:'NOT_ATTEMPTED',reason:'INTEGRITY_STOP'});continue;}
  const row=await sealOne({target,root:input.root,key:input.key,observations,request,now:input.now});
  outcomes.push(row);
  if(row.status==='UNSEALABLE')halted=true;
  if(pause)await new Promise(r=>setTimeout(r,pause));
 }
 requireRule(treeFingerprint(input.root,FIRST_BATCH_IDS)===before,'FIRST_BATCH_FILES_MUTATED');
 const sealedAt=(input.now??(()=>new Date().toISOString()))();
 const report=summarize(startedAt,sealedAt,outcomes);
 if(input.writeManifest!==false)writeSeal(join(batchDir(input.root),'COMPLETED.json'),report);
 return report;
}

export function publicAudit(report:BatchReport,extra:Record<string,unknown>={}){
 const {outcomes,...rest}=report;
 return {
  ...rest,...extra,
  outcomes:outcomes.map(o=>({
   fixtureId:o.target.fixtureId,leagueId:o.target.leagueId,season:o.target.season,kickoffUtc:o.target.kickoffUtc,
   homeTeamId:o.target.homeTeamId,awayTeamId:o.target.awayTeamId,status:o.status,reason:o.reason??null,
   providerStatus:o.providerStatus??null,cutoffAt:o.cutoffAt??null,predictionCreatedAt:o.predictionCreatedAt??null,
   sealedAt:o.sealedAt??null,inputHash:o.inputHash??null,snapshotHash:o.snapshotHash??null,
   v1PredictionHash:o.v1PredictionHash??null,h2PredictionHash:o.h2PredictionHash??null,r1PredictionHash:o.r1PredictionHash??null,
   v1Status:o.v1Status??null,h2Status:o.h2Status??null,r1Status:o.r1Status??null,
  })),
 };
}
