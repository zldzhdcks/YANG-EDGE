/** Discover / validate / readiness only. This path never seals a prediction. */
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {list,readSeal,sha,requireRule,storeRoot,writeSeal,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {validateTarget,type Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';
import {classify,ALREADY_SEALED,IDENTITY_BLOCKED,NOT_NS_OR_DEADLINE,OUTSIDE_WINDOW,PASS_PRECHECK,READY,type Classified} from './classify-v1';
import {projectIdentity} from './identity-v1';
import {verifyFrozen} from './hashes-v1';
import {FIRST_BATCH_WINDOW_MS,SCOPE,windowEndUtc} from './window-v1';

export const DEFAULT_ROOT=resolve(fileURLToPath(new URL('../../',import.meta.url)),'../YANG-EDGE-INBOX/football-v31-r1-prospective-shadow-v1');
export const FOUNDATION_CENSUS_HASH='5503411bd08384993a81487f516214b55c70f8750030d815e1dd4bfac60c3ec8';
const PROVIDER='https://v3.football.api-sports.io';

export type PreflightReport={
 schema:'FOOTBALL_V31_R1_SECOND_REAL_BATCH_PREFLIGHT_V1';
 discoveryAt:string;
 completedAt:string;
 windowEnd:string;
 scope:typeof SCOPE;
 windowMs:typeof FIRST_BATCH_WINDOW_MS;
 foundationCensusHash:string;
 TOTAL_DISCOVERED:number;
 WITHIN_WINDOW:number;
 READY_FOR_TRIPLE_SEAL:number;
 PASS_PRECHECK:number;
 IDENTITY_BLOCKED:number;
 OUTSIDE_WINDOW:number;
 ALREADY_SEALED:number;
 NOT_NS_OR_DEADLINE:number;
 V1_READY:number;
 H2_READY:number;
 R1_READY:number;
 earliestKickoff:string|null;
 latestKickoff:string|null;
 minimumLeadTimeMs:number|null;
 apiRequests:number;
 unverified:number;
 observationRecords:number;
 PREDICTION_SEAL_EXECUTED:'NO';
 MODEL_CHANGED:'NO';
 MAP_CHANGED:'NO';
 BETA_CHANGED:'NO';
 SELECTOR_CHANGED:'NO';
 FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'NO';
 MARKET_INPUT_USED:'NO';
 POSTGAME_INPUT_USED:'NO';
 FORWARD_CHANGED:'NO';
 RECOMMENDATION_ENGINE_CHANGED:'NO';
 MODEL_PROMOTED:'NO';
 R1_ROLE:'UNPROMOTED_PROSPECTIVE_SHADOW';
 rows:Classified[];
};

export function sealedIds(root:string){
 const dir=join(storeRoot(root),'fixtures');
 if(!existsSync(dir))return new Set<number>();
 return new Set(readdirSync(dir).filter(id=>existsSync(join(dir,id,'snapshot.json'))).map(Number).filter(n=>Number.isSafeInteger(n)));
}

export function loadCensusTargets(root:string){
 const seal=readSeal<{targetCensus:{target:Target}[]}>(join(storeRoot(root),'foundation','READY_CENSUS.json'));
 requireRule(seal.sha256===FOUNDATION_CENSUS_HASH,'FOUNDATION_CENSUS_CHANGED');
 const targets=seal.payload.targetCensus.map(r=>{validateTarget(r.target);return r.target;});
 requireRule(new Set(targets.map(t=>t.fixtureId)).size===targets.length,'DUPLICATE_TARGET');
 return {targets,foundationCensusHash:seal.sha256};
}

function causalHistory(at:string,rows:Observation[],targetId:number){
 return rows.filter(o=>{
  if(o.fixture.fixtureId===targetId)return false;
  const fetched=Date.parse(o.providerFetchedAt),completed=Date.parse(o.completion.providerFetchedAt),cutoff=Date.parse(at);
  return Number.isFinite(fetched)&&Number.isFinite(completed)&&fetched<cutoff&&completed<cutoff;
 });
}

async function recheck(target:Target,key:string,request:typeof fetch){
 const endpoint='/fixtures?id='+target.fixtureId;
 try{
  const response=await request(PROVIDER+endpoint,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
  const text=await response.text();
  // Strict projection: score, goals, events, lineups, statistics and predictions are never accessed or saved.
  if(response.status!==200)return {endpoint,apiStatus:'NOT_VERIFIED' as const,verified:null,providerStatus:null,sourceHash:sha(text)};
  const projected=projectIdentity(JSON.parse(text),target);
  if(!projected)return {endpoint,apiStatus:'NOT_VERIFIED' as const,verified:null,providerStatus:null,sourceHash:sha(text)};
  return {endpoint,apiStatus:'VERIFIED' as const,verified:projected.target,providerStatus:projected.providerStatus,sourceHash:sha(text)};
 }catch{
  return {endpoint,apiStatus:'NOT_VERIFIED' as const,verified:null,providerStatus:null,sourceHash:null};
 }
}

export async function preflight(input:{
 root:string;key:string;discoveryAt?:string;request?:typeof fetch;observations?:Observation[];targets?:Target[];alreadySealed?:Set<number>;pauseMs?:number;
}):Promise<PreflightReport>{
 verifyFrozen();
 requireRule(input.key.length>0,'KEY_UNAVAILABLE');
 const discoveryAt=input.discoveryAt??new Date().toISOString();
 const windowEnd=windowEndUtc(discoveryAt);
 const census=input.targets?{targets:input.targets,foundationCensusHash:FOUNDATION_CENSUS_HASH}:loadCensusTargets(input.root);
 const observations=input.observations??list(input.root).map(s=>s.payload);
 const already=input.alreadySealed??sealedIds(input.root);
 const request=input.request??fetch;
 const pause=input.pauseMs??(input.request?0:250);
 const rows:Classified[]=[];
 for(const stored of census.targets){
  const check=await recheck(stored,input.key,request);
  rows.push(classify({
   stored,
   verified:check.verified,
   apiStatus:check.apiStatus,
   providerStatus:check.providerStatus,
   discoveryAt,
   windowEnd,
   alreadySealed:already.has(stored.fixtureId),
   observations:causalHistory(discoveryAt,observations,stored.fixtureId),
  }));
  if(pause)await new Promise(r=>setTimeout(r,pause));
 }
 const within=rows.filter(r=>r.className!==OUTSIDE_WINDOW);
 const ready=rows.filter(r=>r.className===READY);
 const kickoffs=within.map(r=>r.kickoffUtc).sort();
 const leads=ready.map(r=>r.leadTimeMs);
 const completedAt=new Date().toISOString();
 return {
  schema:'FOOTBALL_V31_R1_SECOND_REAL_BATCH_PREFLIGHT_V1',
  discoveryAt,completedAt,windowEnd,scope:SCOPE,windowMs:FIRST_BATCH_WINDOW_MS,foundationCensusHash:census.foundationCensusHash,
  TOTAL_DISCOVERED:rows.length,
  WITHIN_WINDOW:within.length,
  READY_FOR_TRIPLE_SEAL:ready.length,
  PASS_PRECHECK:rows.filter(r=>r.className===PASS_PRECHECK).length,
  IDENTITY_BLOCKED:rows.filter(r=>r.className===IDENTITY_BLOCKED).length,
  OUTSIDE_WINDOW:rows.filter(r=>r.className===OUTSIDE_WINDOW).length,
  ALREADY_SEALED:rows.filter(r=>r.className===ALREADY_SEALED).length,
  NOT_NS_OR_DEADLINE:rows.filter(r=>r.className===NOT_NS_OR_DEADLINE).length,
  V1_READY:rows.filter(r=>r.V1_READY).length,
  H2_READY:rows.filter(r=>r.H2_READY).length,
  R1_READY:rows.filter(r=>r.R1_READY).length,
  earliestKickoff:kickoffs[0]??null,
  latestKickoff:kickoffs.at(-1)??null,
  minimumLeadTimeMs:leads.length?Math.min(...leads):null,
  apiRequests:rows.length,
  unverified:rows.filter(r=>r.apiStatus!=='VERIFIED').length,
  observationRecords:observations.length,
  PREDICTION_SEAL_EXECUTED:'NO',
  MODEL_CHANGED:'NO',MAP_CHANGED:'NO',BETA_CHANGED:'NO',SELECTOR_CHANGED:'NO',
  FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:'NO',
  MARKET_INPUT_USED:'NO',POSTGAME_INPUT_USED:'NO',FORWARD_CHANGED:'NO',RECOMMENDATION_ENGINE_CHANGED:'NO',
  MODEL_PROMOTED:'NO',R1_ROLE:'UNPROMOTED_PROSPECTIVE_SHADOW',
  rows,
 };
}

export function writeLocalDiscovery(file:string,report:PreflightReport){
 return writeSeal(file,{
  schema:report.schema,
  discoveryAt:report.discoveryAt,
  completedAt:report.completedAt,
  windowEnd:report.windowEnd,
  counts:{
   TOTAL_DISCOVERED:report.TOTAL_DISCOVERED,
   WITHIN_WINDOW:report.WITHIN_WINDOW,
   READY_FOR_TRIPLE_SEAL:report.READY_FOR_TRIPLE_SEAL,
   PASS_PRECHECK:report.PASS_PRECHECK,
   IDENTITY_BLOCKED:report.IDENTITY_BLOCKED,
   OUTSIDE_WINDOW:report.OUTSIDE_WINDOW,
   ALREADY_SEALED:report.ALREADY_SEALED,
   NOT_NS_OR_DEADLINE:report.NOT_NS_OR_DEADLINE,
   V1_READY:report.V1_READY,H2_READY:report.H2_READY,R1_READY:report.R1_READY,
  },
  earliestKickoff:report.earliestKickoff,
  latestKickoff:report.latestKickoff,
  minimumLeadTimeMs:report.minimumLeadTimeMs,
  rows:report.rows,
  LOCAL_ONLY:true,
 });
}

export function keyFromEnv(env:NodeJS.ProcessEnv=process.env){
 const direct=env.FOOTBALL_API_KEY?.trim();if(direct)return direct;
 for(const file of [resolve(fileURLToPath(new URL('../../.env.local',import.meta.url))),'C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local']){
  if(!existsSync(file))continue;
  const m=/^FOOTBALL_API_KEY\s*=\s*(.*?)\s*$/m.exec(readFileSync(file,'utf8'));
  if(m?.[1])return m[1].replace(/^['"]|['"]$/g,'');
 }
 return '';
}
