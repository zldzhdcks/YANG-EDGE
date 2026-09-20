/** Offline readiness probe only. Synthetic unexpected fields; never calls a provider. */
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {collect,type Scope,type Bridge} from '../src/lib/football/v4-prospective-evidence-v1/collector';
import {sha,stable} from '../src/lib/football/v4-prospective-evidence-v1/contracts';
async function main(){
 const root=await mkdtemp(join(tmpdir(),'v4-xi-readiness-probe-'));
 const before='2030-09-01T11:00:00.000Z';
 const bridge:Bridge={targetId:'SYNTHETIC_ONLY',scopeIdentity:sha('synthetic-scope'),providerFixtureId:'1',competitionProviderId:'39',season:'2030',homeTeamId:'10',awayTeamId:'20',homeTeamRaw:'synthetic-home',awayTeamRaw:'synthetic-away',scheduledStart:'2030-09-01T12:00:00.000Z',predictionCutoff:'2030-09-01T11:59:00.000Z',verified:true,sourceEvidenceSha256:sha('synthetic-bridge')};
 const scope:Scope={scopeHash:bridge.scopeIdentity,targets:[{targetId:bridge.targetId,operatorSlateGameId:bridge.targetId,sport:'SOCCER',competitionNameRaw:'SYNTHETIC',homeTeamRaw:bridge.homeTeamRaw,awayTeamRaw:bridge.awayTeamRaw,scheduledStartTimeKst:bridge.scheduledStart,providerFixtureId:'1',providerGameId:null}]};
 try{
 const raw=[{team:{id:10},startXI:[],substitutes:[],fixture:{id:1,status:{short:'LIVE'},goals:{home:7,away:8}},result:'SYNTHETIC_RESULT_SENTINEL',postgame:'SYNTHETIC_POSTGAME_SENTINEL'}];
 const result=await collect({scope,bridge,registry:[],root,source:'XI',teamId:'10',pollAt:before,now:()=>before,rightsEvidenceHash:sha('synthetic-rights'),requestBudget:1,fetchSource:async()=>({raw,observedAt:before,collectedAt:before,asOf:before,providerUpdatedAt:null})});
 const stored=JSON.parse(await readFile(join(root,'pregame',result.evidenceId+'.json'),'utf8'));
 const leaked=stored.payload.raw.some((r:any)=>r.result==='SYNTHETIC_RESULT_SENTINEL'||r.postgame==='SYNTHETIC_POSTGAME_SENTINEL'||r.fixture?.goals||r.fixture?.status?.short==='LIVE');
 const audit={schemaVersion:'v4-xi-partial-readiness-recheck-v1',auditedAt:new Date().toISOString(),probe:'SYNTHETIC_UNEXPECTED_TARGET_FIELDS',productionProviderCalls:0,productionEvidenceCreated:0,syntheticCollectorStatus:result.status,forbiddenFieldsPersisted:leaked,readiness:leaked?'FAIL':'PASS',blocker:leaked?'UNFILTERED_RAW_PROVIDER_FIELDS_PERSISTED_TO_PREGAME_EVIDENCE':null,temporaryStoreRemoved:true};
 await writeFile('data/audits/2026-09-20-v4-xi-partial-readiness-recheck-v1.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit));
 }finally{await rm(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
