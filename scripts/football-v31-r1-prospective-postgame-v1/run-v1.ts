/** One-shot FT collector for the sealed 20-target triple envelope. No watch, daemon, or pregame writes. */
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {storeRoot,writeSeal,readSeal,requireRule,sha} from '../football-v31-r1-prospective-v1/store-v1';
import {artifactPath,loadSealedTargets,readEnvelope,projectResult,gradeFixture,scorecard,FIRST_BATCH_AUDIT,FIRST_BATCH_AUDIT_SHA,type Outcome} from './grader-v1';

export const DEFAULT_ROOT='C:/Users/TCTCTC/YANG-EDGE/YANG-EDGE-INBOX/football-v31-r1-prospective-shadow-v1';
const ENDPOINT_PREFIX='https://v3.football.api-sports.io/fixtures?id=';

function keyFromEnv(env:NodeJS.ProcessEnv){
 const direct=env.FOOTBALL_API_KEY?.trim();if(direct)return direct;
 for(const file of [resolve(fileURLToPath(new URL('../../.env.local',import.meta.url))),'C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local']){
  if(!existsSync(file))continue;
  const m=/^FOOTBALL_API_KEY\s*=\s*(.*?)\s*$/m.exec(readFileSync(file,'utf8'));
  if(m?.[1])return m[1].replace(/^['"]|['"]$/g,'');
 }
 return '';
}

export async function collectOneShot(root:string,options:{key?:string;request?:typeof fetch;clock?:()=>number;delayMs?:number;auditFile?:string}={}){
 const clock=options.clock??Date.now,request=options.request??fetch,delayMs=options.delayMs??6500;
 const expected=loadSealedTargets(options.auditFile??join(fileURLToPath(new URL('../../',import.meta.url)),FIRST_BATCH_AUDIT),FIRST_BATCH_AUDIT_SHA);
 requireRule(expected.length===20,'SEALED_TARGET_COUNT');
 const startedAt=new Date(clock()).toISOString(),outcomes:Outcome[]=[];let requests=0;
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
 const receipt={schemaVersion:'FOOTBALL_V31_R1_PROSPECTIVE_POSTGAME_RUN_V1',startedAt,completedAt:new Date(clock()).toISOString(),requests,WATCH_STARTED:'NO' as const,ODDS_USED:false,MODEL_REFIT:false,PREGAME_MUTATED:false,outcomes,scorecard:card};
 const file=join(storeRoot(root),'batches','FIRST_REAL_ONE_SHOT_V1','postgame-scorecard-v1.json');
 const saved=existsSync(file)?readSeal(file):writeSeal(file,receipt);
 return {receipt,scorecard:card,outcomes,artifactHash:saved.sha256,scorecardPath:file};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireRule(process.argv[2]==='--run'&&process.argv.length===3,'EXPLICIT_RUN_ONLY');
 collectOneShot(DEFAULT_ROOT).then(r=>{
  console.log(JSON.stringify({TOTAL_SEALED:r.scorecard.TOTAL_SEALED,RESULT_AVAILABLE:r.scorecard.RESULT_AVAILABLE,RESULT_PENDING:r.scorecard.RESULT_PENDING,RESULT_BLOCKED:r.scorecard.RESULT_BLOCKED,R1_PREDICTED_GRADED:r.scorecard.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:r.scorecard.R1_PASS_PRESERVED,V1_PREDICTED_GRADED:r.scorecard.V1_PREDICTED_GRADED,H2_PREDICTED_GRADED:r.scorecard.H2_PREDICTED_GRADED,interpretation:r.scorecard.interpretation,MODEL_PROMOTED:r.scorecard.MODEL_PROMOTED,WATCH_STARTED:'NO',requests:r.receipt.requests,artifactHash:r.artifactHash},null,2));
 }).catch(e=>{console.error(String(e));process.exitCode=1;});
}
