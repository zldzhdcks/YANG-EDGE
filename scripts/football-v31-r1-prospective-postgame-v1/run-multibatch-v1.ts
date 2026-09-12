/** Multi-batch one-shot FT collector. Result → Grade only. No watch. No pregame writes. */
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeSeal,readSeal,requireRule,sha} from '../football-v31-r1-prospective-v1/store-v1';
import {DEFAULT_ROOT,keyFromEnv} from '../football-v31-r1-second-real-batch-preflight-v1/preflight-v1';
import {artifactPath,readEnvelope,projectResult,gradeFixture,scorecard,type ExpectedSeal,type Outcome} from './grader-v1';
import {FIRST_BATCH_ID,SECOND_BATCH_ID,descriptor,type BatchId} from './registry-v1';
import {loadExpectedSeals} from './load-v1';
import {batchReceiptDir} from './resolve-v1';
import {pregameFingerprint,postgameFingerprint,verifyPregameHashes,existingPostgameIds} from './fingerprint-batch-v1';
import {aggregateScorecard,fromCard,CHECKPOINT,type AggregateScorecard} from './aggregate-v1';

export const MULTI_RECEIPT_SCHEMA='FOOTBALL_V31_MULTI_BATCH_POSTGAME_RUN_RECEIPT_V1';
const ENDPOINT_PREFIX='https://v3.football.api-sports.io/fixtures?id=';

export type MultiRunReceipt={
 schemaVersion:typeof MULTI_RECEIPT_SCHEMA;
 batchId:string;
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
 NEW_POSTGAME_APPENDED:number;
 outcomes:Outcome[];
 WATCH_STARTED:'NO';
 MARKET_INPUT_USED:'NO';
 MODEL_REFIT:false;
 PREGAME_MUTATED:false;
 INTERPRETATION:'EARLY_DESCRIPTIVE_ONLY';
 MODEL_PROMOTED:'NO';
};

function newRunId(startedAt:string){return `${startedAt.replace(/[:.]/g,'-')}-${randomUUID()}`;}

export function parseBatchArg(argv:string[]):BatchId[]{
 if(argv[2]!=='--run')requireRule(false,'EXPLICIT_RUN_ONLY');
 if(argv.length===3)return [FIRST_BATCH_ID,SECOND_BATCH_ID];
 requireRule(argv[3]==='--batch'&&argv.length===5,'EXPLICIT_RUN_ONLY');
 if(argv[4]==='all')return [FIRST_BATCH_ID,SECOND_BATCH_ID];
 requireRule(argv[4]===FIRST_BATCH_ID||argv[4]===SECOND_BATCH_ID,'UNKNOWN_BATCH');
 return [argv[4]];
}

export async function collectPrepared(root:string,batchId:string,expected:ExpectedSeal[],options:{key?:string;request?:typeof fetch;clock?:()=>number;delayMs?:number;runId?:string}={}){
 const clock=options.clock??Date.now,request=options.request??fetch,delayMs=options.delayMs??6500;
 const desc=descriptor(batchId);
 requireRule(expected.length>0,'SEALED_TARGET_COUNT');
 const ids=expected.map(e=>e.fixtureId);
 const beforePregame=pregameFingerprint(root,batchId,ids);
 const existingIds=existingPostgameIds(root,batchId,ids);
 const beforeExistingPostgame=postgameFingerprint(root,batchId,existingIds);
 const startedAt=new Date(clock()).toISOString(),outcomes:Outcome[]=[];let requests=0;
 const runId=options.runId??newRunId(startedAt);
 const file=join(batchReceiptDir(root,batchId),runId+'.json');
 for(const row of expected){
  verifyPregameHashes(root,batchId,row);
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
 requireRule(pregameFingerprint(root,batchId,ids)===beforePregame,'PREGAME_MUTATED');
 requireRule(postgameFingerprint(root,batchId,existingIds)===beforeExistingPostgame,'EXISTING_POSTGAME_MUTATED');
 const card=scorecard(root,expected,outcomes);
 const receipt:MultiRunReceipt={
  schemaVersion:MULTI_RECEIPT_SCHEMA,batchId:desc.batchId,runId,startedAt,completedAt:new Date(clock()).toISOString(),requests,
  TOTAL_SEALED:card.TOTAL_SEALED,RESULT_AVAILABLE:card.RESULT_AVAILABLE,RESULT_PENDING:card.RESULT_PENDING,RESULT_BLOCKED:card.RESULT_BLOCKED,
  R1_PREDICTED_GRADED:card.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:card.R1_PASS_PRESERVED,V1_PREDICTED_GRADED:card.V1_PREDICTED_GRADED,H2_PREDICTED_GRADED:card.H2_PREDICTED_GRADED,
  NEW_POSTGAME_APPENDED:outcomes.filter(o=>o.status==='GRADED').length,outcomes,
  WATCH_STARTED:'NO',MARKET_INPUT_USED:'NO',MODEL_REFIT:false,PREGAME_MUTATED:false,
  INTERPRETATION:card.interpretation,MODEL_PROMOTED:'NO',
 };
 requireRule(receipt.R1_PREDICTED_GRADED<CHECKPOINT||receipt.INTERPRETATION==='EARLY_DESCRIPTIVE_ONLY','EARLY_ONLY');
 const saved=writeSeal(file,receipt);
 const score=fromCard(desc.batchId,card,outcomes,{receiptHash:saved.sha256,runId});
 return {receipt:saved.payload,scorecard:card,score,outcomes,artifactHash:saved.sha256,runReceiptPath:file,runId,pregameUnchanged:true,existingPostgameUnchanged:true};
}

export async function collectBatch(root:string,batchId:string,options:{key?:string;request?:typeof fetch;clock?:()=>number;delayMs?:number;auditFile?:string;runId?:string}={}){
 const expected=loadExpectedSeals(batchId,options.auditFile);
 requireRule(expected.length===descriptor(batchId).targetCount,'SEALED_TARGET_COUNT');
 return collectPrepared(root,batchId,expected,options);
}

export async function collectMultiBatch(root:string,batchIds:BatchId[],options:{key?:string;request?:typeof fetch;clock?:()=>number;delayMs?:number}={}):Promise<{aggregate:AggregateScorecard;batches:Awaited<ReturnType<typeof collectBatch>>[]}>{
 const batches:Awaited<ReturnType<typeof collectBatch>>[]=[];
 for(const id of batchIds)batches.push(await collectBatch(root,id,options));
 return {aggregate:aggregateScorecard(batches.map(b=>b.score)),batches};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const ids=parseBatchArg(process.argv);
 collectMultiBatch(process.env.FOOTBALL_V31_PRIVATE_ROOT||DEFAULT_ROOT,ids).then(r=>{
  console.log(JSON.stringify({
   TOTAL_BATCHES:r.aggregate.TOTAL_BATCHES,TOTAL_SEALED:r.aggregate.TOTAL_SEALED,
   RESULT_AVAILABLE:r.aggregate.RESULT_AVAILABLE,RESULT_PENDING:r.aggregate.RESULT_PENDING,RESULT_BLOCKED:r.aggregate.RESULT_BLOCKED,
   R1_PREDICTED_GRADED:r.aggregate.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:r.aggregate.R1_PASS_PRESERVED,
   V1_PREDICTED_GRADED:r.aggregate.V1_PREDICTED_GRADED,H2_PREDICTED_GRADED:r.aggregate.H2_PREDICTED_GRADED,
   NEW_POSTGAME_APPENDED:r.aggregate.NEW_POSTGAME_APPENDED,checkpoint:r.aggregate.checkpoint,
   INTERPRETATION:r.aggregate.INTERPRETATION,MODEL_PROMOTED:r.aggregate.MODEL_PROMOTED,WATCH_STARTED:r.aggregate.WATCH_STARTED,
   MARKET_INPUT_USED:'NO',batches:r.batches.map(b=>({batchId:b.score.batchId,runId:b.runId,artifactHash:b.artifactHash,TOTAL_SEALED:b.score.TOTAL_SEALED,RESULT_AVAILABLE:b.score.RESULT_AVAILABLE,RESULT_PENDING:b.score.RESULT_PENDING,RESULT_BLOCKED:b.score.RESULT_BLOCKED,R1_PREDICTED_GRADED:b.score.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:b.score.R1_PASS_PRESERVED,NEW_POSTGAME_APPENDED:b.score.NEW_POSTGAME_APPENDED})),
  },null,2));
 }).catch(e=>{console.error(String(e));process.exitCode=1;});
}
