/** Offline, one-shot execution. No networking and no season-2025 raw input path. */
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {root,output,loadData,verifySource,sealSource,writeSeal,preservation,git} from './evidence-v1';
import {BOUNDARY,DAY,REQUIRED,selectTargets,causalHistory,digest,requireRule,type Candidate,type Prediction,type Target,type Fit} from './contracts-v1';
import {causalOffset,baseline} from './h2-causal-offset-v1';
import {prepare,predict} from './candidate-v1';
import {fitBeta,type Example} from './ridge-offset-poisson-v1';
import {population,compare,type Pregame} from './metrics-v1';
const candidates:Candidate[]=['F1','F2','F3'];
type Data=ReturnType<typeof loadData>;
type Result=ReturnType<typeof compare>;
type StageRow={leagueId:number;candidate:Candidate;fit:ReturnType<typeof summarizeFit>;parameterHash:string;inputHash:string;fitCounts:Record<string,number>;developmentStatus:string;comparison:Result|null};
export function splitDevelopment(rows:Pregame[]){requireRule(rows.every(r=>r.target.season===2023),'DEVELOPMENT_SEASON');return {initial:rows.filter(r=>Date.parse(r.target.kickoffUtc)<BOUNDARY&&Date.parse(r.target.kickoffUtc)+2*DAY<BOUNDARY),checks:rows.filter(r=>Date.parse(r.target.kickoffUtc)>=BOUNDARY)};}
function summarizeFit(f:Fit<number[]>){const diagnostics={...f.diagnostics};delete diagnostics.trace;return {...f,diagnostics};}
function unavailable(f:Fit<number[]>):Prediction{return {status:f.status==='FITTED'?'INVALID':f.status,reasons:f.status==='FITTED'?['INVALID_FIT_STATE']:f.reasons,p:null,rates:null,details:{}};}
function status(f:Fit<number[]>,predictions:Prediction[]){if(f.status==='INVALID'||predictions.some(p=>p.status==='INVALID'))return 'INVALID';if(f.status==='FAIL'||predictions.some(p=>p.status==='FAIL'))return 'FAIL';return f.status==='PASS'?'INSUFFICIENT':'PASS';}
function comparators(data:Data,targets:Target[],dir:string):Pregame[]{
  return targets.map((t,i)=>{const history=causalHistory(t,data.targets,x=>data.score(x)),v1=baseline(t,history),raw=causalOffset(t,history);const evidence=writeSeal(join(dir,'h2',String(t.fixtureId)+'.json'),{target:t,prediction:raw});
    const h2={...raw,details:{inputHash:raw.details.inputHash??null,parameterHash:raw.details.parameterHash??null,fullOffsetSealHash:evidence.sha256}};
    if((i+1)%50===0)console.log(JSON.stringify({stage:'CAUSAL_COMPARATORS',season:t.season,leagueId:t.leagueId,processed:i+1,total:targets.length}));return {target:t,v1,h2};});
}
function fitExamples(data:Data,rows:Pregame[],candidate:Candidate,dir:string){
  const examples:Example[]=[],preparations=[],counts={total:rows.length,used:0,pass:0,fail:0,invalid:0};let blocking:Prediction|null=null;
  for(const r of rows){const history=selectTargets(r.target,data.targets).map(t=>data.feature(t,candidate));const prepared=prepare(candidate,r.target,history,r.h2);preparations.push({target:r.target,candidate,...prepared});
    const p=prepared.prediction;if(p.status!=='PREDICTED'){counts[p.status.toLowerCase() as 'pass'|'fail'|'invalid']++;if(p.status==='INVALID'||p.status==='FAIL'&&blocking?.status!=='INVALID')blocking=p;continue;}
    requireRule(prepared.state,'MISSING_FEATURE_STATE');const label=data.score(r.target);examples.push({target:r.target,home:prepared.state.home,away:prepared.state.away,offset:r.h2.rates!,goals:[label.homeGoals,label.awayGoals]});counts.used++;
  }
  const input=writeSeal(join(dir,'input.json'),{candidate,preparations,examples});const fit:Fit<number[]>=blocking?{status:blocking.status as 'FAIL'|'INVALID',reasons:blocking.reasons,parameters:null,diagnostics:{}}:fitBeta(examples,2*REQUIRED[candidate].length);
  const sealed=writeSeal(join(dir,'fit.json'),{candidate,inputHash:input.sha256,fit});return {fit,inputHash:input.sha256,parameterHash:digest(fit.parameters),fitSealHash:sealed.sha256,counts};
}
function check(data:Data,rows:Pregame[],candidate:Candidate,fit:Fit<number[]>,dir:string){
  const predictions=rows.map(r=>fit.status==='FITTED'?predict(candidate,r.target,selectTargets(r.target,data.targets).map(t=>data.feature(t,candidate)),r.h2,fit.parameters):unavailable(fit));
  // Seal probabilities before target label projection and metric access.
  writeSeal(join(dir,'pregame.json'),{candidate,rows:rows.map((r,i)=>({target:r.target,prediction:predictions[i]}))});
  const comparison=compare(rows,predictions,rows.map(r=>data.score(r.target)));writeSeal(join(dir,'comparison.json'),comparison);return {comparison,predictions};
}
function report(file:string,heading:string,rows:StageRow[],extra:Record<string,unknown>){
  let text='# '+heading+'\n\nDESCRIPTIVE_ONLY. No promotion screen applied. Season 2025 was not evaluated. Full traces and feature input values remain local only.\n\n';
  for(const row of rows){text+='## '+row.leagueId+' / '+row.candidate+'\n\n';text+='Fit status: '+row.fit.status+'; execution: '+row.developmentStatus+'; parameter hash: '+row.parameterHash+'; input hash: '+row.inputHash+'.\n\n';text+='Beta: '+JSON.stringify(row.fit.parameters)+'; fit census: '+JSON.stringify(row.fitCounts)+'.\n\n';const c=row.comparison;if(c){text+='Full coverage: '+JSON.stringify(c.full)+'. Paired count: '+c.pairedCount+'; primary status: '+c.primaryStatus+'.\n\n';for(const [name,m] of [['V1',c.v1],['H2',c.h2],['candidate',c.candidate]] as const){if(!m){text+=name+': unavailable; no denominator deletion.\n\n';continue;}text+=name+': LL='+m.logLoss+'; Brier='+m.brier+'; accuracy='+m.accuracy+'.\n\n';for(const cl of m.classes)text+='- '+cl.name+': recall='+cl.recall+'; precision='+cl.precision+'; share='+cl.share+'; OVR Brier='+cl.brier+'; ECE='+cl.ece+'.\n';text+='\n';}text+='Descriptive classification: '+c.descriptive+'.\n\n';}}
  text+='## Provenance and governance\n\n'+JSON.stringify(extra,null,2)+'\n\nMODEL_PROMOTED=NO\nFORWARD_MODEL_CHANGED=NO\n2025_HOLDOUT_PREDICTIONS_GENERATED=NO\n2025_HOLDOUT_METRICS_VIEWED=NO\n2025_HOLDOUT_METRICS_COMPUTED=NO\n\nNo specification, feature, ridge, window, lag, missingness or threshold was changed after source freeze.\n';writeFileSync(file,text,{flag:'wx'});
}
export function run(){
  const source=verifySource(),sourceFreezeCommit=git('rev-parse','HEAD'),startedAt=new Date().toISOString(),dir=join(output,startedAt.replace(/[:.]/g,'-'));
  writeSeal(join(output,'EXECUTION_STARTED.json'),{startedAt,sourceFreezeCommit,sourceHash:source.sha256,rerunAllowed:false});const before=preservation();writeSeal(join(dir,'preservation-before.json'),before);
  try{
    const data=loadData(),development:StageRow[]=[],finals:StageRow[]=[],exposed:StageRow[]=[],finalFits=new Map<string,Fit<number[]>>(),developmentPregames=new Map<number,Pregame[]>();
    for(const leagueId of [39,140,135,78]){
      const leagueDir=join(dir,'development',String(leagueId)),targets=data.targets.filter(t=>t.leagueId===leagueId&&t.season===2023),pregames=comparators(data,targets,leagueDir);
      developmentPregames.set(leagueId,pregames);const {initial,checks}=splitDevelopment(pregames);
      writeSeal(join(leagueDir,'comparator-seal.json'),{rows:checks,population:population(checks),initialFitTargets:initial.map(r=>r.target),notYetAvailableAtBoundary:pregames.filter(r=>Date.parse(r.target.kickoffUtc)<BOUNDARY&&!initial.includes(r)).map(r=>r.target)});
      for(const candidate of candidates){
        const fitDir=join(leagueDir,candidate),initialFit=fitExamples(data,initial,candidate,join(fitDir,'initial'));const checked=check(data,checks,candidate,initialFit.fit,join(fitDir,'internal-check'));
        const stageStatus=status(initialFit.fit,checked.predictions);development.push({leagueId,candidate,fit:summarizeFit(initialFit.fit),parameterHash:initialFit.parameterHash,inputHash:initialFit.inputHash,fitCounts:initialFit.counts,developmentStatus:stageStatus,comparison:checked.comparison});
      }
    }
    // All internal checks finish before any final fit. Failed checks cannot be repaired by refitting.
    for(const leagueId of [39,140,135,78])for(const candidate of candidates){
      const prior=development.find(r=>r.leagueId===leagueId&&r.candidate===candidate)!;
      if(prior.developmentStatus!=='PASS'){const fit:Fit<number[]>={status:prior.developmentStatus==='INSUFFICIENT'?'PASS':prior.developmentStatus as 'FAIL'|'INVALID',reasons:['FINAL_FIT_BLOCKED_BY_REQUIRED_CHECK'],parameters:null,diagnostics:{}};finalFits.set(leagueId+candidate,fit);finals.push({...prior,fit:summarizeFit(fit),parameterHash:digest(null),inputHash:digest([]),fitCounts:{total:0,used:0,pass:0,fail:0,invalid:0},comparison:null});continue;}
      const pregames=developmentPregames.get(leagueId)!;requireRule(pregames.every(r=>Date.parse(r.target.kickoffUtc)+2*DAY<Date.now()),'FINAL_FIT_NOT_YET_AVAILABLE');const final=fitExamples(data,pregames,candidate,join(dir,'development',String(leagueId),candidate,'final'));
      finalFits.set(leagueId+candidate,final.fit);finals.push({leagueId,candidate,fit:summarizeFit(final.fit),parameterHash:final.parameterHash,inputHash:final.inputHash,fitCounts:final.counts,developmentStatus:status(final.fit,[]),comparison:null});
    }
    const betaSeal=writeSeal(join(dir,'FINAL_BETA_SEAL.json'),{createdAt:new Date().toISOString(),sourceHash:source.sha256,finals});
    const blocked=finals.some(r=>r.developmentStatus!=='PASS');
    if(!blocked){data.enableExposed();for(const leagueId of [39,140,135,78]){const leagueDir=join(dir,'exposed',String(leagueId)),targets=data.targets.filter(t=>t.leagueId===leagueId&&t.season===2024),pregames=comparators(data,targets,leagueDir);writeSeal(join(leagueDir,'comparator-seal.json'),{rows:pregames,population:population(pregames)});
      for(const candidate of candidates){const final=finals.find(r=>r.leagueId===leagueId&&r.candidate===candidate)!,fit=finalFits.get(leagueId+candidate)!;requireRule(digest(fit.parameters)===final.parameterHash,'FINAL_BETA_CHANGED');const checked=check(data,pregames,candidate,fit,join(leagueDir,candidate));exposed.push({...final,developmentStatus:status(fit,checked.predictions),comparison:checked.comparison});}
    }}
    requireRule(digest(before)===digest(preservation()),'PRESERVATION_FAILURE');verifySource();
    const common={baseSha:'4edbc0e8ce9ebce4f36cb7db8303c4f6843e333a',sourceFreezeCommit,sourceHash:source.sha256,startedAt,completedAt:new Date().toISOString(),localDirectory:dir,finalBetaSealHash:betaSeal.sha256,protectedFiles:Object.keys(before).length,preservationHash:digest(before),holdoutPredictions:false,holdoutMetricsViewed:false,holdoutMetricsComputed:false,modelPromoted:false,forwardChanged:false,postResultTuning:false};
    const dev=writeSeal(join(root,'data/audits/football-v3-feature-development-v1.json'),{...common,stage:'PRIMARY_DEVELOPMENT',development,finals});
    const exp=writeSeal(join(root,'data/audits/football-v3-feature-2024-exposed-check-v1.json'),{...common,stage:'EXPOSED_DEVELOPMENT_CHECK',execution:blocked?'NOT_EXECUTED_DEVELOPMENT_BLOCK':'EXECUTED',exposed,descriptiveByCandidate:Object.fromEntries(candidates.map(c=>{const rs=exposed.filter(r=>r.candidate===c).map(r=>r.comparison!.descriptive);return [c,!rs.length?'NOT_EXECUTED':rs.every(s=>s==='BETTER_THAN_BOTH_DESCRIPTIVELY')?'BETTER_THAN_BOTH_DESCRIPTIVELY':rs.every(s=>s==='WORSE')?'WORSE':rs.includes('INSUFFICIENT')?'INSUFFICIENT':'MIXED'];}))});
    report(join(root,'docs/FOOTBALL_V3_FEATURE_DEVELOPMENT_V1.md'),'FOOTBALL V3 FEATURE DEVELOPMENT V1',development,{...common,auditHash:dev.sha256,finals});report(join(root,'docs/FOOTBALL_V3_FEATURE_2024_EXPOSED_CHECK_V1.md'),'FOOTBALL V3 FEATURE 2024 EXPOSED CHECK V1',exposed,{...common,auditHash:exp.sha256,execution:exp.payload.execution,descriptive:exp.payload.descriptiveByCandidate});
    writeSeal(join(dir,'COMPLETED.json'),{developmentHash:dev.sha256,exposedHash:exp.sha256,blocked});console.log(JSON.stringify({completed:true,blocked,developmentHash:dev.sha256,exposedHash:exp.sha256,finalBetaSealHash:betaSeal.sha256,localDirectory:dir}));
  }catch(e){writeSeal(join(dir,'EXECUTION_FAILURE.json'),{name:e instanceof Error?e.name:'UNKNOWN',reason:e instanceof Error?e.message:'UNKNOWN',sourceHash:source.sha256});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--seal-source'))console.log(JSON.stringify({sourceFreezeSha256:sealSource().sha256}));else if(process.argv.includes('--run'))run();else throw new Error('EXPLICIT_ACTION_REQUIRED');}
