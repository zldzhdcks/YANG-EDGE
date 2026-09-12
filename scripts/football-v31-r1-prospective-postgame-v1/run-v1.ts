/** One-shot FT collector for the sealed 20-target triple envelope. No polling loop. No pregame writes. */
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {storeRoot,writeSeal,readSeal,requireRule,sha,digest} from '../football-v31-r1-prospective-v1/store-v1';
import {artifactPath,loadSealedTargets,readEnvelope,projectResult,gradeFixture,scorecard,FIRST_BATCH_AUDIT,FIRST_BATCH_AUDIT_SHA,type ExpectedSeal,type Outcome,type Scorecard} from './grader-v1';

export const DEFAULT_ROOT='C:/Users/TCTCTC/YANG-EDGE/YANG-EDGE-INBOX/football-v31-r1-prospective-shadow-v1';
export const RUN_RECEIPT_SCHEMA='FOOTBALL_V31_R1_PROSPECTIVE_POSTGAME_RUN_RECEIPT_V1';
export const LEGACY_RECEIPT_FILE='postgame-scorecard-v1.json';
const ENDPOINT_PREFIX='https://v3.football.api-sports.io/fixtures?id=';

export type LegacyReceiptStatus='VALID'|'INVALID_SEAL_HASH'|'ABSENT';
export type RunReceipt={
 schemaVersion:typeof RUN_RECEIPT_SCHEMA;
 runId:string;
 startedAt:string;
 completedAt:string;
 requests:number;
 TOTAL_SEALED:number;
 RESULT_AVAILABLE:number;
 RESULT_PENDING:number;
 RESULT_BLOCKED:number;
 R1_PREDICTED_GRADED:number;
 R1_PASS_PRESERVED:number;
 V1_PREDICTED_GRADED:number;
 H2_PREDICTED_GRADED:number;
 outcomes:Outcome[];
 WATCH_STARTED:'NO';
 ODDS_USED:false;
 MODEL_REFIT:false;
 PREGAME_MUTATED:false;
 INTERPRETATION:'EARLY_DESCRIPTIVE_ONLY';
 MODEL_PROMOTED:'NO';
};

function keyFromEnv(env:NodeJS.ProcessEnv){
 const direct=env.FOOTBALL_API_KEY?.trim();if(direct)return direct;
 for(const file of [resolve(fileURLToPath(new URL('../../.env.local',import.meta.url))),'C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local']){
  if(!existsSync(file))continue;
  const m=/^FOOTBALL_API_KEY\s*=\s*(.*?)\s*$/m.exec(readFileSync(file,'utf8'));
  if(m?.[1])return m[1].replace(/^['"]|['"]$/g,'');
 }
 return '';
}

export function batchDir(root:string){return join(storeRoot(root),'batches','FIRST_REAL_ONE_SHOT_V1');}
export function legacyReceiptPath(root:string){return join(batchDir(root),LEGACY_RECEIPT_FILE);}
export function runReceiptDir(root:string){return join(batchDir(root),'postgame-runs');}
export function runReceiptPath(root:string,runId:string){return join(runReceiptDir(root),runId+'.json');}

export function diagnoseLegacyReceipt(root:string):LegacyReceiptStatus{
 const file=legacyReceiptPath(root);
 if(!existsSync(file))return 'ABSENT';
 try{
  const seal=readSeal(file);
  if(digest(seal.payload)!==seal.sha256)return 'INVALID_SEAL_HASH';
  return 'VALID';
 }catch{
  return 'INVALID_SEAL_HASH';
 }
}

function newRunId(startedAt:string){
 return `${startedAt.replace(/[:.]/g,'-')}-${randomUUID()}`;
}

function receiptFrom(card:Scorecard,input:{runId:string;startedAt:string;completedAt:string;requests:number;outcomes:Outcome[]}):RunReceipt{
 return {
  schemaVersion:RUN_RECEIPT_SCHEMA,
  runId:input.runId,
  startedAt:input.startedAt,
  completedAt:input.completedAt,
  requests:input.requests,
  TOTAL_SEALED:card.TOTAL_SEALED,
  RESULT_AVAILABLE:card.RESULT_AVAILABLE,
  RESULT_PENDING:card.RESULT_PENDING,
  RESULT_BLOCKED:card.RESULT_BLOCKED,
  R1_PREDICTED_GRADED:card.R1_PREDICTED_GRADED,
  R1_PASS_PRESERVED:card.R1_PASS_PRESERVED,
  V1_PREDICTED_GRADED:card.V1_PREDICTED_GRADED,
  H2_PREDICTED_GRADED:card.H2_PREDICTED_GRADED,
  outcomes:input.outcomes,
  WATCH_STARTED:'NO',
  ODDS_USED:false,
  MODEL_REFIT:false,
  PREGAME_MUTATED:false,
  INTERPRETATION:'EARLY_DESCRIPTIVE_ONLY',
  MODEL_PROMOTED:'NO',
 };
}

export async function collectOneShot(root:string,options:{key?:string;request?:typeof fetch;clock?:()=>number;delayMs?:number;auditFile?:string;expectedTargets?:ExpectedSeal[];runId?:string}={}){
 const clock=options.clock??Date.now,request=options.request??fetch,delayMs=options.delayMs??6500;
 const expected=options.expectedTargets??loadSealedTargets(options.auditFile??join(fileURLToPath(new URL('../../',import.meta.url)),FIRST_BATCH_AUDIT),FIRST_BATCH_AUDIT_SHA);
 if(!options.expectedTargets)requireRule(expected.length===20,'SEALED_TARGET_COUNT');
 requireRule(expected.length>0,'SEALED_TARGET_COUNT');
 const startedAt=new Date(clock()).toISOString(),outcomes:Outcome[]=[];let requests=0;
 const runId=options.runId??newRunId(startedAt);
 const file=runReceiptPath(root,runId);
 const legacyReceiptStatus=diagnoseLegacyReceipt(root);
 for(const row of expected){
  readEnvelope(root,row);
  const existing=artifactPath(root,row.fixtureId);
  if(existsSync(existing)){outcomes.push({fixtureId:row.fixtureId,status:'ALREADY_GRADED_IMMUTABLE',artifactHash:readSeal(existing).sha256});continue;}
  if(clock()<Date.parse(row.kickoffUtc)){outcomes.push({fixtureId:row.fixtureId,status:'RESULT_PENDING',reason:'NS'});continue;}
  const key=options.key??keyFromEnv(process.env);requireRule(key.length>0,'MISSING_API_KEY');
  if(requests)await new Promise(r=>setTimeout(r,delayMs));requests++;
  try{
   const response=await request(ENDPOINT_PREFIX+row.fixtureId,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
   const raw=await response.text(),observedAt=new Date(clock()).toISOString();
   if(response.status!==200){outcomes.push({fixtureId:row.fixtureId,status:'RESULT_BLOCKED',reason:'PROVIDER_UNAVAILABLE'});continue;}
   const projected=projectResult(JSON.parse(raw),row,observedAt,observedAt,sha(raw));
   if(projected.status==='RESULT_PENDING'||projected.status==='RESULT_BLOCKED'||!projected.result){outcomes.push({fixtureId:row.fixtureId,status:projected.status==='RESULT_PENDING'?'RESULT_PENDING':'RESULT_BLOCKED',reason:projected.reason});continue;}
   outcomes.push(gradeFixture(root,row,projected.result,clock));
  }catch(e){
   const reason=(e as {reason?:string}).reason??'PROVIDER_UNAVAILABLE';
   outcomes.push({fixtureId:row.fixtureId,status:'RESULT_BLOCKED',reason:/HASH|IDENTITY|SEAL/i.test(reason)?reason:'PROVIDER_UNAVAILABLE'});
  }
 }
 const card=scorecard(root,expected,outcomes);
 const receipt=receiptFrom(card,{runId,startedAt,completedAt:new Date(clock()).toISOString(),requests,outcomes});
 const saved=writeSeal(file,receipt);
 return {receipt:saved.payload,scorecard:card,outcomes,artifactHash:saved.sha256,scorecardPath:file,runReceiptPath:file,runId,legacyReceiptStatus};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireRule(process.argv[2]==='--run'&&process.argv.length===3,'EXPLICIT_RUN_ONLY');
 collectOneShot(DEFAULT_ROOT).then(r=>{
  console.log(JSON.stringify({TOTAL_SEALED:r.scorecard.TOTAL_SEALED,RESULT_AVAILABLE:r.scorecard.RESULT_AVAILABLE,RESULT_PENDING:r.scorecard.RESULT_PENDING,RESULT_BLOCKED:r.scorecard.RESULT_BLOCKED,R1_PREDICTED_GRADED:r.scorecard.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:r.scorecard.R1_PASS_PRESERVED,V1_PREDICTED_GRADED:r.scorecard.V1_PREDICTED_GRADED,H2_PREDICTED_GRADED:r.scorecard.H2_PREDICTED_GRADED,interpretation:r.scorecard.interpretation,MODEL_PROMOTED:r.scorecard.MODEL_PROMOTED,WATCH_STARTED:'NO',requests:r.receipt.requests,runId:r.runId,runReceiptPath:r.runReceiptPath,artifactHash:r.artifactHash,legacyReceiptStatus:r.legacyReceiptStatus},null,2));
 }).catch(e=>{console.error(String(e));process.exitCode=1;});
}
