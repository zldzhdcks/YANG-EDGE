/** Offline serialization proof. No provider import, credentials, real data, or persistent receipts. */
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {collect,type Bridge,type Scope} from './collector';
import {sha,requireProof,type SourceType} from './contracts';
import type {Registry} from './registry';
import {exactEvidence} from './store';
import {readPregame} from './projection';
export const CANARIES=['LEAK_CANARY_FINAL_SCORE','LEAK_CANARY_LIVE_EVENT','LEAK_CANARY_POSTGAME_STATS'] as const;
export function canaryCount(value:unknown):number {
 if(typeof value==='string')return CANARIES.reduce((n,s)=>n+value.split(s).length-1,0);
 if(!value||typeof value!=='object')return 0;
 return Object.entries(value).reduce((n,[k,v])=>n+canaryCount(k)+canaryCount(v),0);
}
export function contaminatedResponse(source:SourceType):unknown[] {
 const extra={result:CANARIES[0],liveData:{events:[CANARIES[1]]},metadata:{extensions:[{postgameStats:CANARIES[2]}]}};
 if(source==='XI')return [10,20].map((id,side)=>({team:{id,...extra},formation:'4-4-2',...extra,fixture:{status:{short:'LIVE',long:CANARIES[1]},goals:{home:CANARIES[0]}},startXI:Array.from({length:11},(_,i)=>({player:{id:side*11+i+1,pos:'D',...extra},...extra})),substitutes:[],providerExtension:[extra]}));
 if(source==='INJURY')return [{fixture:{id:1,...extra},team:{id:10,...extra},player:{id:1,type:'Missing Fixture',reason:'Suspended',...extra},...extra,extension:[extra]}];
 return [{player:{id:1,...extra},statistics:[extra],...extra}];
}
export function syntheticIsolationContext(){
 const before='2030-09-01T11:00:00.000Z';
 const bridge:Bridge={targetId:'SYNTHETIC_ONLY',scopeIdentity:sha('synthetic-scope'),providerFixtureId:'1',competitionProviderId:'39',season:'2030',homeTeamId:'10',awayTeamId:'20',homeTeamRaw:'synthetic-home',awayTeamRaw:'synthetic-away',scheduledStart:'2030-09-01T12:00:00.000Z',predictionCutoff:'2030-09-01T11:59:00.000Z',verified:true,sourceEvidenceSha256:sha('synthetic-bridge')};
 const scope:Scope={scopeHash:bridge.scopeIdentity,targets:[{targetId:bridge.targetId,operatorSlateGameId:bridge.targetId,sport:'SOCCER',competitionNameRaw:'SYNTHETIC',homeTeamRaw:bridge.homeTeamRaw,awayTeamRaw:bridge.awayTeamRaw,scheduledStartTimeKst:bridge.scheduledStart,providerFixtureId:'1',providerGameId:null}]};
 const registry:Registry=Array.from({length:22},(_,i)=>({recordId:String(i+1),provider:'api-football',providerPlayerId:String(i+1),canonicalPlayerId:'synthetic-'+(i+1),displayNameRaw:'Synthetic',teamProviderId:i<11?'10':'20',competitionProviderId:'39',season:'2030',validFrom:'2030-01-01T00:00:00.000Z',validTo:null,verificationStatus:'EXACT',recordedAt:'2030-01-01T00:00:00.000Z',sourceSha256:sha('synthetic')}));
 return {before,bridge,scope,registry};
}
export async function provePregameIsolation(){
 const root=await mkdtemp(join(tmpdir(),'v4-isolation-proof-'));let matches=0,artifacts=0;
 try{
  const {before,bridge,scope,registry}=syntheticIsolationContext();
  for(const source of ['XI','INJURY','PLAYER_STATS'] as const)for(const late of [false,true]){
   const store=join(root,source+(late?'-late':'')),at=late?bridge.predictionCutoff:before;
   const result=await collect({scope,bridge,registry,root:store,source,teamId:'10',pollAt:before,now:()=>before,rightsEvidenceHash:sha('synthetic-rights'),requestBudget:1,fetchSource:async()=>({raw:contaminatedResponse(source),observedAt:at,collectedAt:at,asOf:at,providerUpdatedAt:null,paging:{current:1,total:1}})});
   requireProof(result.status===(late?'TEMPORAL_REJECTED':'SEALED'),'ISOLATION_PROBE_NOT_STORED');
   if(!late){const e=await exactEvidence(join(store,'pregame'),result.evidenceId,result.sha256!);const safe=readPregame(e,bridge);requireProof(e.validationStatus===(source==='XI'?'CONFIRMED_COMPLETE':source==='INJURY'?'VALID':'UNRESOLVED'),'ISOLATION_LEGITIMATE_EVIDENCE_LOST');if(safe.sourceType==='XI')requireProof(safe.teams.every(t=>t.starters.length===11&&t.formation==='4-4-2'),'ISOLATION_XI_LOST');}
  }
  async function scan(dir:string):Promise<void>{for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else {const bytes=await readFile(path,'utf8');matches+=canaryCount(JSON.parse(bytes));artifacts++;}}}
  await scan(root);requireProof(matches===0,'PREGAME_RESULT_FIELD_ISOLATION_FAILED');
  return {PREGAME_RESULT_FIELD_ISOLATION:'PASS' as const,CANARY_MATCH_COUNT:matches,PROVIDER_CALLS:0,syntheticCases:6,artifactsScanned:artifacts,realCollectionEnabled:false};
 }finally{await rm(root,{recursive:true,force:true});}
}
