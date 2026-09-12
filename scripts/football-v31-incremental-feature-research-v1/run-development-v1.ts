/** One-shot offline V31 execution; no network and no authorized season-2025 data path. */
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {CANDIDATES,BOUNDARY,DAY,selectTargets,digest,requireRule,ResearchError,blocked,type V31Candidate,type Target,type Prediction,type Fit} from './contracts-v1';
import {buildAnchor,type Anchor} from './causal-state-v1';
import {fitPrefix,prefixPool,fitStageMap,type MapRecord} from './residual-map-v1';
import {representation,predict,fitCandidate} from './candidate-v1';
import {diagnose,movement} from './diagnostics-v1';
import {loadData} from './data-v1';
import {root,output,sealSource,verifySource,writeSeal,readSeal,preservation,git} from './evidence-v1';
import {compare,population,type Pregame} from '../football-v3-feature-research-v1/metrics-v1';
import {type Example} from '../football-v3-feature-research-v1/ridge-offset-poisson-v1';
type Data=ReturnType<typeof loadData>;
type Bundle={rows:Pregame[];anchors:Anchor[]};
type Comparison=ReturnType<typeof compare>;
type FitResult={fit:Fit<number[]>;inputHash:string;parameterHash:string;counts:{total:number;used:number;pass:number;fail:number;invalid:number}};
type Stage={leagueId:number;candidate:V31Candidate;status:string;beta:Fit<number[]>;betaHash:string;mapStatus:string;mapHash:string|null;mapParameterHash:string|null;mapParameters:unknown;inputHash:string;fitCounts:FitResult['counts'];comparison:Comparison|null;reference:unknown;diagnostics:unknown};
export function split<T extends {target:Target}>(rows:T[]){requireRule(rows.every(r=>r.target.season===2023),'DEVELOPMENT_SEASON');return {initial:rows.filter(r=>Date.parse(r.target.kickoffUtc)<BOUNDARY&&Date.parse(r.target.kickoffUtc)+2*DAY<BOUNDARY),checks:rows.filter(r=>Date.parse(r.target.kickoffUtc)>=BOUNDARY)};}
function compactFit(f:Fit<number[]>):Fit<number[]>{const diagnostics={...f.diagnostics};delete diagnostics.trace;return {...f,diagnostics};}
function stageStatus(f:Fit<number[]>,map:MapRecord|null,ps:Prediction[]=[]){const statuses=[f.status,map?.fit.status,...ps.map(p=>p.status)];return statuses.includes('INVALID')?'INVALID':statuses.includes('FAIL')?'FAIL':f.status==='PASS'||map?.fit.status==='PASS'?'INSUFFICIENT':'PASS';}
function build(data:Data,targets:Target[],dir:string):Bundle{
  const rows:Pregame[]=[],anchors:Anchor[]=[];for(const [i,t]of targets.entries()){
    const selected=selectTargets(t,data.targets),base=selected.map(x=>data.score(x)),features=selected.map(x=>data.feature(x));const state=buildAnchor(t,base,features);
    writeSeal(join(dir,'states',t.fixtureId+'.json'),{...state,baseInput:base,featureInputHashes:features.map(f=>({fixtureId:f.target.fixtureId,hash:digest(f),sourceHash:f.sourceHash,providerFetchedAt:f.providerFetchedAt}))});
    rows.push({target:t,v1:state.v1,h2:{...state.h2,details:{inputHash:state.h2.details.inputHash??null,parameterHash:state.h2.details.parameterHash??null}}});anchors.push(state.anchor);
    if((i+1)%40===0)console.log(JSON.stringify({stage:'CAUSAL_STATE',season:t.season,leagueId:t.leagueId,completed:i+1,total:targets.length}));
  }return {rows,anchors};
}
function fit(data:Data,targets:Anchor[],all:Anchor[],candidate:V31Candidate,dir:string):FitResult{
  const examples:Example[]=[],census:unknown[]=[],counts={total:targets.length,used:0,pass:0,fail:0,invalid:0};let failure:ResearchError|null=null;
  for(const a of targets){try{
    if(a.status!=='PREDICTED')throw new ResearchError(a.status,a.reasons.join('|'));const map=candidate==='V31-R1'?fitPrefix(a.target,prefixPool(a.target,all)):null;
    if(map)writeSeal(join(dir,'prefix',a.target.fixtureId+'.json'),map);
    const x=representation(candidate,a,map,'TRAIN'),label=data.score(a.target);examples.push({target:a.target,home:x[0],away:x[1],offset:a.offset!,goals:[label.homeGoals,label.awayGoals]});counts.used++;
    census.push({target:a.target,status:'USED',anchorHash:digest(a),mapHash:map?digest(map):null,mapParameterHash:map?.parameterHash??null});
  }catch(e){if(!(e instanceof ResearchError))throw e;counts[e.kind.toLowerCase() as 'pass'|'fail'|'invalid']++;census.push({target:a.target,status:e.kind,reason:e.reason,anchorHash:digest(a)});if(e.kind==='INVALID'||e.kind==='FAIL'&&failure?.kind!=='INVALID')failure=e;}}
  const input=writeSeal(join(dir,'input.json'),{candidate,census,examples});const fitted:Fit<number[]>=failure?{status:failure.kind,reasons:[failure.reason],parameters:null,diagnostics:{}}:fitCandidate(examples);
  writeSeal(join(dir,'fit.json'),{candidate,inputHash:input.sha256,fit:fitted});return {fit:fitted,inputHash:input.sha256,parameterHash:digest(fitted.parameters),counts};
}
function reference(leagueId:number,stage:'development'|'exposed',c:Comparison){
  const file=stage==='development'?'data/audits/football-v3-feature-development-v1.json':'data/audits/football-v3-feature-2024-exposed-check-v1.json';
  const s=readSeal<{development?:{leagueId:number;candidate:string;comparison:Comparison}[];exposed?:{leagueId:number;candidate:string;comparison:Comparison}[]}>(join(root,file));
  const rows=stage==='development'?s.payload.development:s.payload.exposed,r=rows?.find(x=>x.leagueId===leagueId&&x.candidate==='F3')?.comparison;
  if(!r||r.pairedIdsHash!==c.pairedIdsHash||digest(r.v1)!==digest(c.v1)||digest(r.h2)!==digest(c.h2))return {status:'REFERENCE_NOT_COMPARABLE',sourceHash:s.sha256};
  return {status:'REFERENCE_ONLY',candidate:'V3-F3',sourceHash:s.sha256,metrics:r.candidate,delta:c.candidate&&r.candidate?{logLoss:c.candidate.logLoss!-r.candidate.logLoss!,brier:c.candidate.brier!-r.candidate.brier!}:null};
}
function check(data:Data,b:Bundle,candidate:V31Candidate,fitted:FitResult,map:MapRecord|null,dir:string){
  const mapBefore=map?digest(map):null,betaBefore=digest(fitted.fit.parameters);const predictions=b.anchors.map(a=>fitted.fit.status==='FITTED'?predict(candidate,a,map,fitted.fit.parameters):blocked(fitted.fit));
  writeSeal(join(dir,'pregame.json'),{candidate,mapHash:mapBefore,betaHash:betaBefore,rows:b.rows.map((r,i)=>({target:r.target,prediction:predictions[i]}))});
  requireRule((map?digest(map):null)===mapBefore&&digest(fitted.fit.parameters)===betaBefore,'CHECK_PARAMETERS_CHANGED');
  const comparison=compare(b.rows,predictions,b.rows.map(r=>data.score(r.target)));writeSeal(join(dir,'comparison.json'),comparison);const u=new Set(population(b.rows).ids),diagnostics=diagnose(predictions.filter((_,i)=>u.has(b.rows[i].target.fixtureId)));writeSeal(join(dir,'diagnostics.json'),diagnostics);
  return {comparison,predictions,diagnostics};
}
function stage(leagueId:number,candidate:V31Candidate,f:FitResult,map:MapRecord|null,comparison:Comparison|null=null,ps:Prediction[]=[]):Stage{return {leagueId,candidate,status:stageStatus(f.fit,map,ps),beta:compactFit(f.fit),betaHash:f.parameterHash,mapStatus:map?.fit.status??'FIXED_NO_FIT',mapHash:map?digest(map):null,mapParameterHash:map?.parameterHash??null,mapParameters:map?.fit.parameters??null,inputHash:f.inputHash,fitCounts:f.counts,comparison,reference:null,diagnostics:null};}
export function classification(rows:Stage[]){if(rows.length!==4||rows.some(r=>!r.comparison?.delta))return 'NOT_EVALUABLE';const d=rows.map(r=>r.comparison!.delta!.h2);return d.every(v=>v.logLoss< -1e-12&&v.brier< -1e-12)?'BETTER_THAN_H2_ALL_4_DESCRIPTIVELY':d.every(v=>v.logLoss>=-1e-12&&v.brier>=-1e-12)?'WORSE_OR_NO_INCREMENTAL_SIGNAL':'MIXED';}
function report(file:string,title:string,rows:Stage[],extra:unknown){let text='# '+title+'\n\nDESCRIPTIVE_ONLY. 2024 is exposed, not independent validation. No promotion or post-result tuning. Raw state/maps/traces remain LOCAL_ONLY.\n\n';
  for(const r of rows){text+='## '+r.leagueId+' / '+r.candidate+'\n\nStatus: '+r.status+'; map: '+r.mapStatus+'; beta: '+r.beta.status+'.\n\nMap hash: '+r.mapHash+'; map parameter hash: '+r.mapParameterHash+'; beta hash: '+r.betaHash+'.\n\nFit census: '+JSON.stringify(r.fitCounts)+'; beta: '+JSON.stringify(r.beta.parameters)+'; map: '+JSON.stringify(r.mapParameters)+'.\n\n';const c=r.comparison;if(c){text+='Full: '+JSON.stringify(c.full)+'; paired N='+c.pairedCount+'; '+c.primaryStatus+'.\n\n';for(const [name,m]of [['V1',c.v1],['H2',c.h2],['candidate',c.candidate]]as const){if(!m){text+=name+': null; no survivor-subset metric.\n\n';continue;}text+=name+': LL='+m.logLoss+'; Brier='+m.brier+'; accuracy='+m.accuracy+'.\n\n';for(const cl of m.classes)text+='- '+cl.name+': recall='+cl.recall+'; precision='+cl.precision+'; share='+cl.share+'; OVR Brier='+cl.brier+'; ECE='+cl.ece+'.\n';text+='\n';}text+='Delta: '+JSON.stringify(c.delta)+'.\n\nReference: '+JSON.stringify(r.reference)+'.\n\nDiagnostics: '+JSON.stringify(r.diagnostics)+'.\n\n';}}
  text+='## Provenance / final fits / diagnostics\n\n'+JSON.stringify(extra,null,2)+'\n\nMODEL_PROMOTED=NO\nFORWARD_MODEL_CHANGED=NO\n2025_HOLDOUT_PREDICTIONS_GENERATED=NO\n2025_HOLDOUT_METRICS_VIEWED=NO\n2025_HOLDOUT_METRICS_COMPUTED=NO\n';writeFileSync(file,text,{flag:'wx'});
}
export function run(){const source=verifySource(),sourceFreezeCommit=git('rev-parse','HEAD'),startedAt=new Date().toISOString(),dir=join(output,startedAt.replace(/[:.]/g,'-'));
  writeSeal(join(output,'EXECUTION_STARTED.json'),{startedAt,sourceHash:source.sha256,sourceFreezeCommit,rerunAllowed:false});const before=preservation();writeSeal(join(dir,'preservation-before.json'),before);
  try{
    const data=loadData(),development:Stage[]=[],finals:Stage[]=[],exposed:Stage[]=[],bundles=new Map<number,Bundle>(),maps=new Map<number,MapRecord>(),fits=new Map<string,FitResult>();
    for(const leagueId of [39,140,135,78]){
      const ld=join(dir,'development',String(leagueId)),targets=data.targets.filter(t=>t.season===2023&&t.leagueId===leagueId),b=build(data,targets,ld);bundles.set(leagueId,b);
      const parts=split(b.anchors),rows=split(b.rows),checkBundle={rows:rows.checks,anchors:parts.checks};writeSeal(join(ld,'comparator-seal.json'),{rows:rows.checks,population:population(rows.checks)});
      const map=fitStageMap('INITIAL',leagueId,parts.initial,targets,Date.now());writeSeal(join(ld,'initial-map.json'),map);
      for(const candidate of CANDIDATES){const f=fit(data,parts.initial,b.anchors,candidate,join(ld,candidate,'initial')),checked=check(data,checkBundle,candidate,f,candidate==='V31-R1'?map:null,join(ld,candidate,'internal-check'));
        const r=stage(leagueId,candidate,f,candidate==='V31-R1'?map:null,checked.comparison,checked.predictions);r.reference=reference(leagueId,'development',checked.comparison);r.diagnostics=checked.diagnostics;development.push(r);
      }
    }
    for(const leagueId of [39,140,135,78]){
      const b=bundles.get(leagueId)!;requireRule(b.rows.every(r=>Date.parse(r.target.kickoffUtc)+2*DAY<Date.now()),'FINAL_LABELS_NOT_YET_AVAILABLE');const map=fitStageMap('FINAL',leagueId,b.anchors,b.rows.map(r=>r.target),Date.now());maps.set(leagueId,map);writeSeal(join(dir,'development',String(leagueId),'final-map.json'),map);
      for(const candidate of CANDIDATES){const prior=development.find(r=>r.leagueId===leagueId&&r.candidate===candidate)!;const f:FitResult=prior.status==='PASS'?fit(data,b.anchors,b.anchors,candidate,join(dir,'development',String(leagueId),candidate,'final')):{fit:{status:prior.status==='INSUFFICIENT'?'PASS':prior.status as 'FAIL'|'INVALID',parameters:null,reasons:['FINAL_FIT_BLOCKED_BY_REQUIRED_CHECK'],diagnostics:{}},parameterHash:digest(null),inputHash:digest([]),counts:{total:0,used:0,pass:0,fail:0,invalid:0}};fits.set(leagueId+candidate,f);finals.push(stage(leagueId,candidate,f,candidate==='V31-R1'?map:null));}
    }
    const finalFile=join(dir,'FINAL_MAP_BETA_SEAL.json'),finalSeal=writeSeal(finalFile,{createdAt:new Date().toISOString(),sourceHash:source.sha256,finals});const executionBlocked=finals.some(r=>r.status!=='PASS');
    if(!executionBlocked){data.enableExposed(finalFile,source.sha256);for(const leagueId of [39,140,135,78]){const ld=join(dir,'exposed',String(leagueId)),b=build(data,data.targets.filter(t=>t.season===2024&&t.leagueId===leagueId),ld);writeSeal(join(ld,'comparator-seal.json'),{rows:b.rows,population:population(b.rows)});
      for(const candidate of CANDIDATES){const f=fits.get(leagueId+candidate)!,map=candidate==='V31-R1'?maps.get(leagueId)!:null,final=finals.find(r=>r.leagueId===leagueId&&r.candidate===candidate)!;requireRule(f.parameterHash===final.betaHash&&(map?digest(map):null)===final.mapHash,'FINAL_PARAMETERS_CHANGED');const checked=check(data,b,candidate,f,map,join(ld,candidate));const r=stage(leagueId,candidate,f,map,checked.comparison,checked.predictions);r.reference=reference(leagueId,'exposed',checked.comparison);r.diagnostics=checked.diagnostics;exposed.push(r);}
    }}
    requireRule(digest(before)===digest(preservation()),'PRESERVATION_CHANGED');verifySource();requireRule(readSeal<unknown>(finalFile).sha256===finalSeal.sha256,'FINAL_SEAL_CHANGED');
    const moves=finals.map(f=>{const i=development.find(x=>x.leagueId===f.leagueId&&x.candidate===f.candidate)!;return {leagueId:f.leagueId,candidate:f.candidate,beta:movement(i.beta.parameters,f.beta.parameters),map:movement(i.mapParameters?(i.mapParameters as number[][]).flat():null,f.mapParameters?(f.mapParameters as number[][]).flat():null)};});
    const classifications=Object.fromEntries(CANDIDATES.map(c=>[c,classification(exposed.filter(r=>r.candidate===c))]));
    const common={baseSha:'2763ce8aee4594c4ae48776b46254bf348cab32c',sourceFreezeCommit,sourceHash:source.sha256,startedAt,completedAt:new Date().toISOString(),localDirectory:dir,finalMapBetaSealHash:finalSeal.sha256,protectedFiles:Object.keys(before).length,preservationHash:digest(before),holdoutPredictions:false,holdoutMetricsViewed:false,holdoutMetricsComputed:false,forwardChanged:false,modelPromoted:false,postResultTuning:false};
    const dev=writeSeal(join(root,'data/audits/football-v31-development-v1.json'),{...common,stage:'PRIMARY_DEVELOPMENT',development,finals,coefficientMovement:moves});
    const exp=writeSeal(join(root,'data/audits/football-v31-2024-exposed-check-v1.json'),{...common,stage:'EXPOSED_DEVELOPMENT_CHECK',execution:executionBlocked?'NOT_EXECUTED_DEVELOPMENT_BLOCK':'EXECUTED',exposed,classifications,coefficientMovement:moves});
    report(join(root,'docs/FOOTBALL_V31_DEVELOPMENT_V1.md'),'FOOTBALL V31 DEVELOPMENT V1',development,{...common,auditHash:dev.sha256,finals,coefficientMovement:moves});report(join(root,'docs/FOOTBALL_V31_2024_EXPOSED_CHECK_V1.md'),'FOOTBALL V31 2024 EXPOSED CHECK V1',exposed,{...common,auditHash:exp.sha256,classifications,execution:exp.payload.execution,coefficientMovement:moves});
    writeSeal(join(dir,'COMPLETED.json'),{developmentHash:dev.sha256,exposedHash:exp.sha256,finalMapBetaSealHash:finalSeal.sha256,executionBlocked});console.log(JSON.stringify({completed:true,localDirectory:dir,developmentHash:dev.sha256,exposedHash:exp.sha256,classifications,executionBlocked}));
  }catch(e){writeSeal(join(dir,'EXECUTION_FAILURE.json'),{name:e instanceof Error?e.name:'UNKNOWN',message:e instanceof Error?e.message:'UNKNOWN',sourceHash:source.sha256});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--seal-source'))console.log(JSON.stringify({sourceHash:sealSource().sha256}));else if(process.argv.includes('--run'))run();else throw new Error('EXPLICIT_ACTION_REQUIRED');}
