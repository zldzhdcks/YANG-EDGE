/** Offline exposed evaluation. One append-only execution; no tuning or operational imports. */
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {root,output,read,readSeal,writeSeal,sealSource,verifySource,preservation} from './evidence-evaluation-v1';
import {requireRule,sha,digest,DAY,order,targetOf,validateTarget,validateEvaluationTarget,validateDevelopmentPool,validateHistory,eligible,actual,predictSafely,historyReasons,PROTOCOL_HASH,DESIGN_HASH,type Match,type Target,type Prediction,type Fit} from './contracts-evaluation-v1';
import {baseline} from './v1-readonly-adapter';
import {fitDependence,predictDependence,tau} from './h1-dixon-coles-v1';
import {fitRates,predictRates,type RateParameters} from './h2-ridge-rates-v1';
import {fitTemperature,temperature} from './h3-temperature-v1';
import {joint} from './numerics-v1';
import {evaluateLeague,aggregateScreen} from './evaluator-evaluation-v1';
import type {ScoredRow} from '../evaluator-v1';
type CountHash={count:number;fixtureIdsSha256:string;firstKickoff:string};
type Cohort={leagueId:number;name:string;archiveSha256:string;development:CountHash;evaluation:CountHash;fixedPrimaryV1Predicted:CountHash;preservedV1Pass:CountHash};
type Parent={cohortManifest:Cohort[];evidenceSealVerification:{resultFileHashes:{path:string;sha256:string}[]}};
type Archive={provider:string;providerFixtureId:number;leagueId:number;season:number;round:string;kickoffUtc:string;homeTeamId:number;awayTeamId:number;fixtureStatus:string;fullTimeHomeGoals:number;fullTimeAwayGoals:number;strictReplayEligible:boolean};
type BaseRecord={providerFixtureId:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number;status:'PREDICTED'|'PASS';passReason:string[];pHome:number|null;pDraw:number|null;pAway:number|null;actualHomeGoals:number;actualAwayGoals:number;eligibleTrainingFixtureIds:number[]};
type Pregame={target:Target;prediction:Prediction};
export const idsHash=(rows:{fixtureId:number}[])=>sha(JSON.stringify(rows.map(r=>r.fixtureId)));
export function checkCohort(rows:{fixtureId:number}[],c:CountHash){requireRule(rows.length===c.count&&idsHash(rows)===c.fixtureIdsSha256,'COHORT_HASH_IDENTITY');}
// Metadata projection never reads scores. Selection precedes all history score access.
export function archiveTargets(rows:Archive[],leagueId:number):Target[]{
  const result:Target[]=[];
  for(const r of rows){requireRule(r.provider==='API_FOOTBALL'&&r.leagueId===leagueId,'ARCHIVE_IDENTITY');requireRule([2023,2024].includes(r.season),'SEASON_FIREWALL');
    const stage=/^Regular Season - ([1-9][0-9]*)$/.exec(r.round);
    if(!stage){requireRule(leagueId===78&&r.round==='Relegation Round','UNKNOWN_STAGE');continue;}
    requireRule(Number(stage[1])<=(leagueId===78?34:38)&&r.fixtureStatus==='FT'&&r.strictReplayEligible===false,'ARCHIVE_STAGE_ROLE');
    const t={fixtureId:r.providerFixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId};validateTarget(t);result.push(t);
  }requireRule(new Set(result.map(r=>r.fixtureId)).size===result.length,'DUPLICATE_ID');return order(result);
}
function scoreOf(t:Target,raw:Map<number,Archive>):Match{const r=raw.get(t.fixtureId)!;requireRule(r&&r.providerFixtureId===t.fixtureId,'SCORE_IDENTITY');return {...t,homeGoals:r.fullTimeHomeGoals,awayGoals:r.fullTimeAwayGoals};}
export function causalHistory(target:Target,targets:Target[],lookup:(t:Target)=>Match){
  validateTarget(target);const cutoff=Date.parse(target.kickoffUtc)-1;
  const selected=targets.filter(r=>r.leagueId===target.leagueId&&r.season<=target.season&&r.fixtureId!==target.fixtureId&&Date.parse(r.kickoffUtc)+2*DAY<cutoff&&Date.parse(r.kickoffUtc)>=cutoff-365*DAY);
  const rows=order(selected).map(lookup);validateHistory(target,rows);return rows;
}
export function finalDevelopmentExamples(rows:Match[],cutoff:number){validateDevelopmentPool(rows);return rows.filter(r=>Date.parse(r.kickoffUtc)+2*DAY<cutoff);}
function fitSummary(f:Fit<unknown>){const diagnostics={...f.diagnostics};delete diagnostics.armijoTrace;let parameters=f.parameters;
  if(parameters&&typeof parameters==='object'&&'theta' in parameters){const p=parameters as RateParameters;parameters={b:p.theta[0],h:p.theta[1],teamCount:p.teams.length,parameterVectorHash:digest(p.theta),teamUniverseHash:digest(p.teams)};}
  return {...f,parameters,diagnostics};
}
export function runEvaluation(){
  const source=verifySource();
  const git=(ref:string)=>execFileSync('git',['-C',root,'rev-parse',ref],{encoding:'utf8'}).trim();
  const head=git('HEAD');requireRule(head===git('origin/agent/astra/football-historical-source-gate-v1'),'SOURCE_NOT_PUSHED');
  const sealCommitted=execFileSync('git',['-C',root,'show','HEAD:data/audits/football-poisson-v2-evaluation-source-freeze-v1.json'],{encoding:'utf8'});
  requireRule(digest(JSON.parse(sealCommitted))===digest(source),'SEAL_NOT_COMMITTED');
  const startedAt=new Date().toISOString();
  writeSeal(join(output,'EVALUATION_V1_EXECUTION_STARTED.json'),{startedAt,sourceHash:source.sha256,sourceCommit:head,rerunAllowed:false});
  const runId=startedAt.replace(/[:.]/g,'-'),dir=join(output,runId),before=preservation();
  writeSeal(join(dir,'preservation-before.json'),before);
  try{
    const parent=read<Parent>(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json'));
    const manifest=read<{leagues:{league:{id:number};archiveSha256:string;localArchiveRelativePath:string}[]}>(join(root,'data/audits/football-four-major-leagues-historical-archive-v1.json'));
    const data=new Map<number,{targets:Target[];raw:Map<number,Archive>;development:Match[];devPregame:Pregame[]}>();
    const devAudit=readSeal<{startedAt:string;baselineSeals:{leagueId:number;predictionHash:string}[]}>(join(root,'data/audits/football-poisson-v2-development-v1.json'));
    const devRun=devAudit.payload.startedAt.replace(/[:.]/g,'-');
    const allIds=new Set<number>();
    for(const c of parent.cohortManifest){
      const m=manifest.leagues.find(l=>l.league.id===c.leagueId)!;requireRule(m&&m.archiveSha256===c.archiveSha256,'ARCHIVE_MANIFEST');
      const bytes=readFileSync(join(root,m.localArchiveRelativePath,'archive.json'));requireRule(sha(bytes)===c.archiveSha256,'ARCHIVE_HASH');
      const rawRows=JSON.parse(bytes.toString('utf8')).matches as Archive[],targets=archiveTargets(rawRows,c.leagueId),raw=new Map(rawRows.map(r=>[r.providerFixtureId,r]));
      requireRule(raw.size===rawRows.length,'RAW_DUPLICATE');
      checkCohort(targets.filter(t=>t.season===2023),c.development);checkCohort(targets.filter(t=>t.season===2024),c.evaluation);
      for(const t of targets){requireRule(!allIds.has(t.fixtureId),'GLOBAL_COHORT_OVERLAP');allIds.add(t.fixtureId);}
      const development=targets.filter(t=>t.season===2023).map(t=>scoreOf(t,raw));validateDevelopmentPool(development);
      const dev=readSeal<{rows:Pregame[]}>(join(root,'data/cache/research/football/poisson-v2-draw-research/protocol-v1/FROZEN_V1_REFERENCE',String(c.leagueId),devRun,'pregame.json'));
      requireRule(dev.sha256===devAudit.payload.baselineSeals.find(b=>b.leagueId===c.leagueId)!.predictionHash,'DEV_PREGAME_LINK');
      requireRule(digest(dev.payload.rows.map(r=>r.target))===digest(development.map(targetOf)),'DEV_PREGAME_IDENTITY');
      data.set(c.leagueId,{targets,raw,development,devPregame:dev.payload.rows});
    }
    requireRule(allIds.size===2892,'TOTAL_COHORT');
    // Final coefficients for ALL hypotheses and leagues sealed before reading evaluation labels or producing evaluation outputs.
    const fits=new Map<string,{fit:Fit<unknown>;parameterHash:string;sha256:string}>();
    const finalFitSummaries=[];
    for(const h of ['H1','H2','H3'] as const)for(const c of parent.cohortManifest){
      const d=data.get(c.leagueId)!,target=d.targets.find(t=>t.season===2024)!;validateEvaluationTarget(target);
      requireRule(target.kickoffUtc===c.evaluation.firstKickoff,'FINAL_BOUNDARY_IDENTITY');const cutoff=Date.parse(target.kickoffUtc)-1;
      const pregames=new Map(d.devPregame.map(r=>[r.target.fixtureId,r.prediction]));
      const rows=h==='H2'?eligible(d.development,target):finalDevelopmentExamples(d.development,cutoff).filter(r=>pregames.get(r.fixtureId)!.status==='PREDICTED');
      validateDevelopmentPool(rows);
      const input=writeSeal(join(dir,'final-fit',h,String(c.leagueId),'input.json'),{cutoffAt:new Date(cutoff).toISOString(),rows:rows.map(r=>({fixture:r,baseline:h==='H2'?null:pregames.get(r.fixtureId)})),sourceHash:source.sha256});
      const fit:Fit<unknown>=h==='H1'?fitDependence(rows.map(r=>({lambda:pregames.get(r.fixtureId)!.rates![0],mu:pregames.get(r.fixtureId)!.rates![1],x:r.homeGoals,y:r.awayGoals}))):h==='H2'?fitRates(rows):fitTemperature(rows.map(r=>({p:pregames.get(r.fixtureId)!.p!,actual:actual(r.homeGoals,r.awayGoals)})));
      const parameterHash=digest(fit.parameters),sealed=writeSeal(join(dir,'final-fit',h,String(c.leagueId),'parameters.json'),{fit,parameterHash,inputHash:input.sha256,fitIdsHash:idsHash(rows),cutoffAt:new Date(cutoff).toISOString(),sourceHash:source.sha256,createdAt:new Date().toISOString()});
      fits.set(h+':'+c.leagueId,{fit,parameterHash,sha256:sealed.sha256});finalFitSummaries.push({hypothesis:h,leagueId:c.leagueId,fit:fitSummary(fit),parameterHash,fitHash:sealed.sha256,inputHash:input.sha256,fitIdsHash:idsHash(rows),count:rows.length});
    }
    const finalSeal=writeSeal(join(dir,'FINAL_PARAMETERS_SEALED.json'),{createdAt:new Date().toISOString(),sourceHash:source.sha256,finalFitSummaries});
    // Existing sealed v1 comparator; rates recovered causally using the unchanged model and checked against sealed probabilities/status.
    const epl=read<{records:BaseRecord[]}>(join(root,parent.evidenceSealVerification.resultFileHashes[0].path));
    const cross=read<{leagueResults:{leagueId:number;records:BaseRecord[]}[]}>(join(root,parent.evidenceSealVerification.resultFileHashes[1].path));
    const baseRows=new Map<number,ScoredRow[]>(),basePred=new Map<number,Prediction>(),baselineSummaries=[];
    for(const c of parent.cohortManifest){
      const d=data.get(c.leagueId)!,targets=d.targets.filter(t=>t.season===2024),records=c.leagueId===39?epl.records:cross.leagueResults.find(l=>l.leagueId===c.leagueId)!.records;
      checkCohort(records.map(r=>({fixtureId:r.providerFixtureId})),c.evaluation);
      checkCohort(records.filter(r=>r.status==='PREDICTED').map(r=>({fixtureId:r.providerFixtureId})),c.fixedPrimaryV1Predicted);
      checkCohort(records.filter(r=>r.status==='PASS').map(r=>({fixtureId:r.providerFixtureId})),c.preservedV1Pass);
      const rows:ScoredRow[]=targets.map((t,i)=>{const r=records[i];requireRule(r.providerFixtureId===t.fixtureId&&r.kickoffUtc===t.kickoffUtc&&r.homeTeamId===t.homeTeamId&&r.awayTeamId===t.awayTeamId,'BASELINE_IDENTITY');
        const history=causalHistory(t,d.targets,x=>scoreOf(x,d.raw)),p=baseline(t,history);requireRule(p.status===r.status,'BASELINE_STATUS');
        requireRule(digest(history.map(x=>x.fixtureId))===digest(r.eligibleTrainingFixtureIds),'BASELINE_HISTORY');
        if(p.status==='PREDICTED'){const sealed=[r.pHome!,r.pDraw!,r.pAway!] as [number,number,number];requireRule(p.p!.every((v,k)=>Math.abs(v-sealed[k])<=1e-12),'BASELINE_PROBABILITY');p.p=sealed;}
        else requireRule(digest(p.reasons)===digest(r.passReason),'BASELINE_PASS_REASON');
        basePred.set(t.fixtureId,p);const score=scoreOf(t,d.raw);requireRule(score.homeGoals===r.actualHomeGoals&&score.awayGoals===r.actualAwayGoals,'BASELINE_SCORE_IDENTITY');
        return {fixtureId:t.fixtureId,prediction:p,homeGoals:score.homeGoals,awayGoals:score.awayGoals};});
      baseRows.set(c.leagueId,rows);const sealed=writeSeal(join(dir,'FROZEN_V1_REFERENCE',String(c.leagueId)+'.json'),{rows,sourceResultHash:parent.evidenceSealVerification.resultFileHashes[c.leagueId===39?0:1].sha256,finalParameterSealHash:finalSeal.sha256});
      baselineSummaries.push({leagueId:c.leagueId,cohortHash:c.evaluation.fixtureIdsSha256,primaryPairedIdsHash:c.fixedPrimaryV1Predicted.fixtureIdsSha256,preservedPassIdsHash:c.preservedV1Pass.fixtureIdsSha256,referenceHash:sealed.sha256});
    }
    requireRule([...baseRows.values()].flat().length===1446&&[...baseRows.values()].flat().filter(r=>r.prediction.status==='PREDICTED').length===1342,'PRIMARY_1342');
    const results:(ReturnType<typeof evaluateLeague>&{hypothesis:string;leagueId:number;league:string;finalFitHash:string;finalParameterHash:string;predictionHash:string;cohortHash:string;primaryPairedIdsHash:string})[]=[];
    for(const h of ['H1','H2','H3'] as const)for(const c of parent.cohortManifest){
      const d=data.get(c.leagueId)!,state=fits.get(h+':'+c.leagueId)!,fit=state.fit;let halted:Prediction|null=null;
      const pregame=d.targets.filter(t=>t.season===2024).map(t=>{
        validateEvaluationTarget(t);const history=causalHistory(t,d.targets,x=>scoreOf(x,d.raw)),b=basePred.get(t.fixtureId)!;
        const input=writeSeal(join(dir,h,String(c.leagueId),String(t.fixtureId),'input.json'),{target:t,history,cutoffAt:new Date(Date.parse(t.kickoffUtc)-1).toISOString(),finalParameterHash:state.parameterHash,sourceHash:source.sha256});
        let prediction:Prediction,parameterHash=state.parameterHash,refitHash:string|null=null;
        if(halted)prediction={...halted,reasons:[...halted.reasons,'DEPENDENT_EVALUATION_BLOCKED']};
        else if(fit.status!=='FITTED')prediction={status:fit.status,reasons:fit.reasons,p:null,rates:null,details:{finalFitUnavailable:true}};
        else if(h!=='H2'&&b.status!=='PREDICTED')prediction=b;
        else{const reasons=historyReasons(t,history);if(reasons.length)prediction={status:'PASS',reasons,p:null,rates:null,details:{}};
          else if(h==='H2'){
            const refit=fitRates(history);parameterHash=digest(refit.parameters);
            refitHash=writeSeal(join(dir,h,String(c.leagueId),String(t.fixtureId),'causal-fit.json'),{fit:refit,parameterHash,inputHash:input.sha256,historyIdsHash:idsHash(history),createdAt:new Date().toISOString()}).sha256;
            prediction=refit.status!=='FITTED'?{status:refit.status,reasons:refit.reasons,p:null,rates:null,details:{}}:predictSafely(()=>{const rates=predictRates(refit.parameters,t,history),q=joint(...rates);return {p:q.p,rates,details:{normalization:q.normalization}};});
          }else prediction=predictSafely(()=>{
            if(h==='H1'){const rho=(fit.parameters as {rho:number}).rho,[lh,la]=b.rates!,q=predictDependence(lh,la,rho),raw=joint(lh,la);return {p:q.p,rates:b.rates,details:{rho,rawCells:raw.cells,correctedCells:q.cells,tau:[tau(0,0,lh,la,rho),tau(0,1,lh,la,rho),tau(1,0,lh,la,rho),tau(1,1,lh,la,rho)],normalization:q.normalization}};}
            const beta=(fit.parameters as {beta:number}).beta;return {p:temperature(b.p!,beta),rates:b.rates,details:{beta,T:1/beta}};
          });
        }
        if(prediction.status==='FAIL'||prediction.status==='INVALID')halted=prediction;
        return {target:t,prediction,inputHash:input.sha256,parameterHash,refitHash};
      });
      const sealed=writeSeal(join(dir,h,String(c.leagueId),'pregame.json'),{rows:pregame,finalFitHash:state.sha256,sourceHash:source.sha256});
      const scored=pregame.map(r=>{const score=scoreOf(r.target,d.raw);return {fixtureId:r.target.fixtureId,prediction:r.prediction,homeGoals:score.homeGoals,awayGoals:score.awayGoals};});
      const evaluation=evaluateLeague(h,baseRows.get(c.leagueId)!,scored);
      const summary={hypothesis:h,leagueId:c.leagueId,league:c.name,finalFitHash:state.sha256,finalParameterHash:state.parameterHash,predictionHash:sealed.sha256,cohortHash:c.evaluation.fixtureIdsSha256,primaryPairedIdsHash:c.fixedPrimaryV1Predicted.fixtureIdsSha256,...evaluation};
      writeSeal(join(dir,h,String(c.leagueId),'scored.json'),{rows:scored,predictionHash:sealed.sha256,summary});results.push(summary);
    }
    verifySource();const after=preservation();requireRule(digest(before)===digest(after),'PRESERVATION_FAILURE');
    const report={schemaVersion:'FOOTBALL_POISSON_V2_EXPOSED_EVALUATION_V1',role:'EXPOSED_RETROSPECTIVE_COMPARISON',untouchedHoldout:false,
      startedAt,completedAt:new Date().toISOString(),sourceCommit:head,sourceHash:source.sha256,protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,sourceFiles:source.payload.files,
      finalParameterSealHash:finalSeal.sha256,finalFitSummaries,evaluationTargets:1446,primaryPairedTargets:1342,v1Pass:104,baselineSummaries,results,
      screens:['H1','H2','H3'].map(h=>({hypothesis:h,screen:aggregateScreen(results.filter(r=>r.hypothesis===h))})),
      preservation:{fileCount:Object.keys(before).length,beforeHash:digest(before),afterHash:digest(after)},
      executionOrder:['FROZEN_V1_REFERENCE','H1_ALONE','H2_ALONE','H3_ALONE'],FINAL_FITTING_EXECUTED:true,EVALUATION_EXECUTED:true,
      DEVELOPMENT_SOURCE_CHANGED:false,DEVELOPMENT_RESULT_CHANGED:false,ALGORITHM_CHANGED:false,HYPERPARAMETERS_CHANGED:false,PROMOTION_RULE_CHANGED:false,
      EVALUATION_EXECUTION_INFRA_CHANGED:true,FORWARD_MODEL_CHANGED:false,MODEL_PROMOTED:false,ODDS_USED:false,MARKET_USED:false,PROVIDER_PREDICTION_USED:false,INDEPENDENT_CONFIRMATION_REQUIRED:true};
    const local=writeSeal(join(dir,'report.json'),report);return writeSeal(join(root,'data/audits/football-poisson-v2-exposed-evaluation-v1.json'),{...report,localReportHash:local.sha256});
  }catch(e){writeSeal(join(dir,'EXECUTION_ABORTED.json'),{at:new Date().toISOString(),error:String(e),rerunAllowed:false});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  requireRule(process.argv.length===3&&['--seal','--verify','--run'].includes(process.argv[2]),'INVALID_COMMAND');
  const v=process.argv[2]==='--seal'?sealSource():process.argv[2]==='--verify'?verifySource():runEvaluation();
  console.log(JSON.stringify({status:'COMPLETE',sha256:v.sha256}));
}
