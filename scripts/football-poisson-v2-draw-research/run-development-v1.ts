/** Offline season-2023-only execution. No evaluation entry point. */
import {existsSync,mkdirSync,readFileSync,readdirSync,openSync,closeSync,writeFileSync,fsyncSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROTOCOL_HASH,DESIGN_HASH,MODEL_HASH,BOUNDARY,DAY,sha,digest,requireRule,validatePool,order,eligible,targetOf,historyReasons,predictSafely,actual,type Match,type Prediction,type Fit} from './contracts-v1';
import {baseline} from './v1-readonly-adapter';
import {fitDependence,predictDependence,tau} from './h1-dixon-coles-v1';
import {fitRates,predictRates,type RateParameters} from './h2-ridge-rates-v1';
import {fitTemperature,temperature} from './h3-temperature-v1';
import {joint} from './numerics-v1';
import {metrics,compare,developmentScreen,type ScoredRow} from './evaluator-v1';

const root=fileURLToPath(new URL('../../',import.meta.url)),codeDir=join(root,'scripts/football-poisson-v2-draw-research');
const local=join(root,'data/cache/research/football/poisson-v2-draw-research/protocol-v1');
const sourceFile=join(root,'data/audits/football-poisson-v2-development-source-freeze-v1.json');
type Cohort={leagueId:number;name:string;archiveSha256:string;development:{count:number;fixtureIdsSha256:string};developmentFit:{count:number;fixtureIdsSha256:string};developmentCheck:{count:number;fixtureIdsSha256:string}};
type Parent={cohortManifest:Cohort[]};
type SourceSeal={createdAt:string;files:Record<string,string>;h1:string;h2:string;h3:string;commonRunnerSha256:string;protocolHash:string;designHash:string;clarificationHash:string;nodeVersion:string};
const read=<T>(file:string)=>JSON.parse(readFileSync(file,'utf8')) as T;
function writeSeal<T>(file:string,payload:T){mkdirSync(resolve(file,'..'),{recursive:true});const value={payload,sha256:digest(payload)},fd=openSync(file,'wx');try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}return value;}
function readSeal<T>(file:string){const value=read<{payload:T;sha256:string}>(file);requireRule(digest(value.payload)===value.sha256,'HASH_MISMATCH');return value;}
function contracts(){const parent=read<Parent>(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json'));requireRule(digest(parent)===PROTOCOL_HASH,'PROTOCOL_HASH_MISMATCH');requireRule(digest(read(join(root,'docs/FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.json')))===DESIGN_HASH,'DESIGN_HASH_MISMATCH');requireRule(sha(readFileSync(join(root,'src/lib/football/poisson-research-v1/index.ts'),'utf8').replace(/\r\n/g,'\n'))===MODEL_HASH,'MODEL_HASH_MISMATCH');requireRule(sha(readFileSync(join(root,'src/lib/football/odds-1x2-v1/instant.ts'),'utf8').replace(/\r\n/g,'\n'))==='c848e4f64438a76bb39531a0f702c01c0aa3c3076f33ef5d39f56c480e97c784','TIME_HELPER_HASH_MISMATCH');return parent;}
function sourceHashes(){return Object.fromEntries(readdirSync(codeDir).filter(f=>f.endsWith('.ts')).sort().map(f=>[f,sha(readFileSync(join(codeDir,f),'utf8').replace(/\r\n/g,'\n'))]));}
export function sealSources(){contracts();const files=sourceHashes(),h1=files['h1-dixon-coles-v1.ts'],h2=files['h2-ridge-rates-v1.ts'],h3=files['h3-temperature-v1.ts'];requireRule(h1&&h2&&h3,'MISSING_IMPLEMENTATION');const common=Object.fromEntries(Object.entries(files).filter(([n])=>!['h1-dixon-coles-v1.ts','h2-ridge-rates-v1.ts','h3-temperature-v1.ts'].includes(n)));
  return writeSeal(sourceFile,{createdAt:new Date().toISOString(),files,h1,h2,h3,commonRunnerSha256:digest(common),protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,clarificationHash:sha(readFileSync(join(root,'docs/FOOTBALL_POISSON_V2_DEVELOPMENT_EXECUTION_CLARIFICATION_V1.md'),'utf8').replace(/\r\n/g,'\n')),nodeVersion:process.version});}
function verifySources(){const seal=readSeal<SourceSeal>(sourceFile);requireRule(digest(sourceHashes())===digest(seal.payload.files),'SOURCE_CHANGED_NEW_VERSION_REQUIRED');requireRule(seal.payload.protocolHash===PROTOCOL_HASH&&seal.payload.designHash===DESIGN_HASH,'CONTRACT_MISMATCH');requireRule(seal.payload.clarificationHash===sha(readFileSync(join(root,'docs/FOOTBALL_POISSON_V2_DEVELOPMENT_EXECUTION_CLARIFICATION_V1.md'),'utf8').replace(/\r\n/g,'\n')),'CLARIFICATION_CHANGED');return seal;}
type ArchiveRow={provider:string;providerFixtureId:number;leagueId:number;season:number;round:string;kickoffUtc:string;homeTeamId:number;awayTeamId:number;fixtureStatus:string;fullTimeHomeGoals:number;fullTimeAwayGoals:number;strictReplayEligible:boolean};
export function extractDevelopment(value:{matches:ArchiveRow[]},leagueId:number):Match[]{
  const rows:Match[]=[];
  // Filter season metadata BEFORE accessing scores: never project season-2024 labels.
  for(const r of value.matches){if(r.season!==2023)continue;requireRule(r.leagueId===leagueId&&r.provider==='API_FOOTBALL','IDENTITY_MISMATCH');const match=/^Regular Season - ([1-9][0-9]*)$/.exec(r.round);if(!match){requireRule(leagueId===78&&r.round==='Relegation Round','UNKNOWN_STAGE');continue;}requireRule(Number(match[1])<=(leagueId===78?34:38),'UNKNOWN_STAGE');requireRule(r.fixtureStatus==='FT'&&r.strictReplayEligible===false,'INVALID_ARCHIVE_ROLE');rows.push({fixtureId:r.providerFixtureId,leagueId,season:2023,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId,homeGoals:r.fullTimeHomeGoals,awayGoals:r.fullTimeAwayGoals});}
  validatePool(rows);return order(rows);
}
const idsHash=(rows:{fixtureId:number}[])=>sha(JSON.stringify(rows.map(r=>r.fixtureId)));
function byteInventory(){const files:string[]=[];const walk=(dir:string)=>{if(!existsSync(dir))return;for(const d of readdirSync(dir,{withFileTypes:true})){const f=join(dir,d.name);if(d.isDirectory())walk(f);else files.push(f);}};
  walk(join(root,'data/cache/research/football/forward-shadow-v1'));for(const n of ['football-poisson-chronological-backtest-v1','football-poisson-cross-league-backtest-v1']){const audit=read<{localResultRelativePath:string;resultSha256:string}>(join(root,'data/audits',n+'.json'));const f=join(root,audit.localResultRelativePath);requireRule(sha(readFileSync(f))===audit.resultSha256,'SEALED_RESULT_CHANGED');files.push(f);}for(const f of readdirSync(join(root,'scripts')).filter(n=>n.includes('football-forward')&&n.endsWith('.ts')))files.push(join(root,'scripts',f));files.push(join(root,'src/lib/football/poisson-research-v1/index.ts'),join(root,'src/lib/football/odds-1x2-v1/instant.ts'));return Object.fromEntries(files.sort().map(f=>[relative(root,f).replace(/\\/g,'/'),sha(readFileSync(f))]));}
function fitSummary(fit:Fit<unknown>){const d={...fit.diagnostics};delete d.armijoTrace;let parameters=fit.parameters;if(parameters&&typeof parameters==='object'&&'teams' in parameters&&'theta' in parameters){const p=parameters as RateParameters,k=p.teams.length;parameters={b:p.theta[0],h:p.theta[1],teamCount:k,teamUniverseHash:digest(p.teams),coefficientVectorHash:digest(p.theta),attackSum:p.theta.slice(2,2+k).reduce((a,b)=>a+b,0),defenceSum:p.theta.slice(2+k).reduce((a,b)=>a+b,0)};}return {...fit,parameters,diagnostics:d};}
export function runDevelopment(){
  const parent=contracts(),source=verifySources(),startedAt=new Date().toISOString();requireRule(Date.parse(source.payload.createdAt)<=Date.parse(startedAt),'SOURCE_NOT_FROZEN');
  const runId=startedAt.replace(/[:.]/g,'-');const lock=join(local,'DEVELOPMENT_V1_EXECUTION_STARTED.json');writeSeal(lock,{startedAt,sourceSealHash:source.sha256,rerunAllowed:false});
  const before=byteInventory();writeSeal(join(local,'execution',runId,'preservation-before.json'),before);
  const manifest=read<{leagues:{league:{id:number};archiveSha256:string;localArchiveRelativePath:string}[]}>(join(root,'data/audits/football-four-major-leagues-historical-archive-v1.json'));
  const data=new Map<number,Match[]>(),archiveBytes=new Map<string,string>();const allIds=new Set<number>();
  for(const c of parent.cohortManifest){const l=manifest.leagues.find(l=>l.league.id===c.leagueId)!;requireRule(l&&l.archiveSha256===c.archiveSha256,'ARCHIVE_IDENTITY');const f=join(root,l.localArchiveRelativePath,'archive.json'),bytes=readFileSync(f);requireRule(sha(bytes)===c.archiveSha256,'ARCHIVE_HASH_MISMATCH');archiveBytes.set(f,c.archiveSha256);const rows=extractDevelopment(JSON.parse(bytes.toString('utf8')),c.leagueId);requireRule(rows.length===c.development.count&&idsHash(rows)===c.development.fixtureIdsSha256,'DEVELOPMENT_COHORT_MISMATCH');for(const r of rows){requireRule(!allIds.has(r.fixtureId),'CROSS_LEAGUE_DUPLICATE');allIds.add(r.fixtureId);}for(const [subset,seal] of [[rows.filter(r=>Date.parse(r.kickoffUtc)<BOUNDARY),c.developmentFit],[rows.filter(r=>Date.parse(r.kickoffUtc)>=BOUNDARY),c.developmentCheck]] as const)requireRule(subset.length===seal.count&&idsHash(subset)===seal.fixtureIdsSha256,'FIT_CHECK_COHORT_MISMATCH');data.set(c.leagueId,rows);}
  requireRule(allIds.size===1446,'TOTAL_COHORT_MISMATCH');
  const baseRows=new Map<number,ScoredRow[]>(),baselineSeals:unknown[]=[],summaries:unknown[]=[];
  // All four v1 references sealed before the first H1 fit. No output printed until all phases finish.
  for(const c of parent.cohortManifest){const rows=data.get(c.leagueId)!,dir=join(local,'FROZEN_V1_REFERENCE',String(c.leagueId),runId);const input=writeSeal(join(dir,'development-input.json'),rows);
    const pregame=rows.map(r=>{const t=targetOf(r),history=eligible(rows,t);return {target:t,cutoffAt:new Date(Date.parse(t.kickoffUtc)-1).toISOString(),inputSnapshotHash:digest({target:t,history}),historyFixtureIdsHash:idsHash(history),prediction:baseline(t,history)};});
    const sealed=writeSeal(join(dir,'pregame.json'),{protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,sourceSealHash:source.sha256,inputHash:input.sha256,rows:pregame});
    const scored=rows.map((r,i)=>({fixtureId:r.fixtureId,prediction:pregame[i].prediction,homeGoals:r.homeGoals,awayGoals:r.awayGoals}));const result=writeSeal(join(dir,'scored.json'),{predictionHash:sealed.sha256,rows:scored});baseRows.set(c.leagueId,scored);
    baselineSeals.push({leagueId:c.leagueId,predictionHash:sealed.sha256,scoredHash:result.sha256,cohortHash:idsHash(rows),fitMetrics:metrics(scored.filter((_,i)=>Date.parse(rows[i].kickoffUtc)<BOUNDARY)),checkMetrics:metrics(scored.filter((_,i)=>Date.parse(rows[i].kickoffUtc)>=BOUNDARY)),allMetrics:metrics(scored)});
  }
  for(const h of ['H1','H2','H3'] as const)for(const c of parent.cohortManifest){verifySources();const rows=data.get(c.leagueId)!,base=baseRows.get(c.leagueId)!;const fitIndices=rows.map((r,i)=>({r,i})).filter(({r})=>Date.parse(r.kickoffUtc)+2*DAY<BOUNDARY&&Date.parse(r.kickoffUtc)>=BOUNDARY-365*DAY);
    const allowed=h==='H2'?fitIndices:fitIndices.filter(({i})=>base[i].prediction.status==='PREDICTED'),dir=join(local,h,String(c.leagueId),runId);
    const fitInput=writeSeal(join(dir,'initial-fit-input.json'),{protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,sourceSealHash:source.sha256,fitBoundary:new Date(BOUNDARY).toISOString(),fitPhase:'INITIAL_FIT',rows:allowed.map(({r,i})=>({fixture:r,baseline:h==='H2'?null:base[i].prediction}))});
    const fit:Fit<unknown>=h==='H1'?fitDependence(allowed.map(({r,i})=>({lambda:base[i].prediction.rates![0],mu:base[i].prediction.rates![1],x:r.homeGoals,y:r.awayGoals}))):h==='H2'?fitRates(allowed.map(({r})=>r)):fitTemperature(allowed.map(({r,i})=>({p:base[i].prediction.p!,actual:actual(r.homeGoals,r.awayGoals)})));
    const fitSeal=writeSeal(join(dir,'initial-fit.json'),{fit,inputSnapshotHash:fitInput.sha256,fitFixtureIdsHash:idsHash(allowed.map(({r})=>r)),parameterHash:digest(fit.parameters),protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,sourceHash:source.payload[h==='H1'?'h1':h==='H2'?'h2':'h3'],sourceSealHash:source.sha256});
    const checkIndices=rows.map((r,i)=>({r,i})).filter(({r})=>Date.parse(r.kickoffUtc)>=BOUNDARY);let halted:Prediction|null=null;
    const pregame=checkIndices.map(({r,i})=>{const t=targetOf(r),history=eligible(rows,t);let prediction:Prediction;
      if(halted)prediction={...halted,reasons:[...halted.reasons,'DEPENDENT_CHECK_BLOCKED']};
      else if(fit.status!=='FITTED')prediction={status:fit.status,reasons:fit.reasons,p:null,rates:null,details:{initialFitUnavailable:true}};
      else if(h!=='H2'&&base[i].prediction.status!=='PREDICTED')prediction=base[i].prediction;
      else{const reasons=historyReasons(t,history);if(reasons.length)prediction={status:'PASS',reasons,p:null,rates:null,details:{}};else prediction=predictSafely(()=>{
        if(h==='H1'){const rho=(fit.parameters as {rho:number}).rho,[lh,la]=base[i].prediction.rates!,q=predictDependence(lh,la,rho),raw=joint(lh,la);return {p:q.p,rates:[lh,la],details:{rho,rawCells:raw.cells,correctedCells:q.cells,tau:[tau(0,0,lh,la,rho),tau(0,1,lh,la,rho),tau(1,0,lh,la,rho),tau(1,1,lh,la,rho)],normalization:q.normalization,classDeltas:q.p.map((p,k)=>p-base[i].prediction.p![k])}};}
        if(h==='H2'){const rates=predictRates(fit.parameters as RateParameters,t,history),q=joint(...rates);return {p:q.p,rates,details:{normalization:q.normalization}};}
        const beta=(fit.parameters as {beta:number}).beta;return {p:temperature(base[i].prediction.p!,beta),rates:base[i].prediction.rates,details:{beta,T:1/beta}};
      });}
      if(prediction.status==='INVALID'||prediction.status==='FAIL')halted=prediction;
      return {target:t,prediction,inputSnapshotHash:digest({target:t,history,parameterHash:digest(fit.parameters)}),parameterHash:digest(fit.parameters)};
    });
    const pregameSeal=writeSeal(join(dir,'check-pregame.json'),{fitHash:fitSeal.sha256,protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,sourceSealHash:source.sha256,rows:pregame});
    const scored=checkIndices.map(({r},i)=>({fixtureId:r.fixtureId,prediction:pregame[i].prediction,homeGoals:r.homeGoals,awayGoals:r.awayGoals}));
    const comparison=compare(h,checkIndices.map(({i})=>base[i]),scored),summary={hypothesis:h,leagueId:c.leagueId,league:c.name,developmentScreen:developmentScreen(fit,scored),fit:fitSummary(fit),fitTargetCount:c.developmentFit.count,checkTargetCount:c.developmentCheck.count,fitEligibleExamples:allowed.length,fitActualClassCounts:[0,1,2].map(k=>allowed.filter(({r})=>actual(r.homeGoals,r.awayGoals)===k).length),fitLowCellCounts:[0,1,2,3].map(k=>allowed.filter(({r})=>r.homeGoals<2&&r.awayGoals<2&&2*r.homeGoals+r.awayGoals===k).length),fitInputHash:fitInput.sha256,fitFixtureIdsHash:idsHash(allowed.map(({r})=>r)),fitTargetIdsHash:c.developmentFit.fixtureIdsSha256,checkTargetIdsHash:c.developmentCheck.fixtureIdsSha256,parameterHash:digest(fit.parameters),fitArtifactHash:fitSeal.sha256,checkPredictionHash:pregameSeal.sha256,metrics:metrics(scored),comparison};
    writeSeal(join(dir,'check-scored.json'),{predictionHash:pregameSeal.sha256,rows:scored,summary});summaries.push(summary);
  }
  const after=byteInventory();requireRule(digest(before)===digest(after),'PRESERVATION_FAILURE');for(const [f,h] of archiveBytes)requireRule(sha(readFileSync(f))===h,'ARCHIVE_CHANGED');verifySources();contracts();
  const report={schemaVersion:'FOOTBALL_POISSON_V2_DEVELOPMENT_V1',startedAt,completedAt:new Date().toISOString(),sourceSealHash:source.sha256,sourceHashes:source.payload,protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,developmentTargets:1446,fitTargets:parent.cohortManifest.reduce((n,c)=>n+c.developmentFit.count,0),checkTargets:parent.cohortManifest.reduce((n,c)=>n+c.developmentCheck.count,0),executionOrder:['FROZEN_V1_REFERENCE','H1_ALONE','H2_ALONE','H3_ALONE'],baselineSeals,results:summaries,preservation:{fileCount:Object.keys(before).length,beforeHash:digest(before),afterHash:digest(after),archivesUnchanged:true,modelUnchanged:true,forwardUnchanged:true,existingBacktestsUnchanged:true},interpretation:'DESCRIPTIVE DEVELOPMENT RESULT; DEVELOPMENT_SCREEN is execution validity only',EVALUATION_EXECUTED:false,FINAL_DEVELOPMENT_REFIT_EXECUTED:false,FORWARD_V1_CHANGED:false,MODEL_CHANGED:false,ENGINE_CHANGED:false,ODDS_USED:false,PROVIDER_PREDICTION_USED:false,PROMOTION_EXECUTED:false};
  const result=writeSeal(join(local,'execution',runId,'development-report.json'),report);writeSeal(join(root,'data/audits/football-poisson-v2-development-v1.json'),{...report,localReportHash:result.sha256});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  requireRule(process.argv.length===3&&['--seal','--run'].includes(process.argv[2]),'NO_EVALUATION_ENTRY_POINT');
  try{const result=process.argv[2]==='--seal'?sealSources():runDevelopment();console.log(JSON.stringify({sha256:result.sha256,status:'COMPLETE'},null,2));}catch(e){console.error(String(e));process.exitCode=1;}
}
