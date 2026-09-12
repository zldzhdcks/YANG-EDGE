import {metrics, compare, type ScoredRow} from '../evaluator-v1';
import {requireRule} from './contracts-evaluation-v1';
export {metrics};
export type Screen = 'ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION'|'SCREEN_NO'|'INVALID'|'INSUFFICIENT';
type Metrics=ReturnType<typeof metrics>;
const tolerance=1e-12;
export function guards(base:Metrics,candidate:Metrics){
  const values=[base.logLoss,base.brier,base.accuracy,candidate.logLoss,candidate.brier,candidate.accuracy,
    ...base.classes.flatMap(c=>[c.ece,c.brier,c.recall]),...candidate.classes.flatMap(c=>[c.ece,c.brier,c.recall])];
  const sufficient=base.predicted>=200&&base.classes.every(c=>c.actual>=20)&&values.every(n=>n!==null&&Number.isFinite(n));
  const probability=candidate.logLoss!==null&&base.logLoss!==null&&candidate.brier!==null&&base.brier!==null&&candidate.logLoss<base.logLoss-tolerance&&candidate.brier<base.brier-tolerance;
  const accuracy=candidate.accuracy!==null&&base.accuracy!==null&&candidate.accuracy>=base.accuracy-0.02-tolerance;
  const homeAway=[0,2].map(k=>({class:base.classes[k].name,
    recall:candidate.classes[k].recall!==null&&base.classes[k].recall!==null&&candidate.classes[k].recall!>=base.classes[k].recall!-0.02-tolerance,
    brier:candidate.classes[k].brier!==null&&base.classes[k].brier!==null&&candidate.classes[k].brier!<=base.classes[k].brier!+tolerance}));
  const calibration=base.classes.map((c,k)=>({class:c.name,delta:c.ece===null||candidate.classes[k].ece===null?null:candidate.classes[k].ece!-c.ece,
    pass:c.ece!==null&&candidate.classes[k].ece!==null&&candidate.classes[k].ece!<=c.ece+0.01+tolerance}));
  return {sufficient,probability,accuracy,homeAway,calibration,pass:sufficient&&probability&&accuracy&&homeAway.every(g=>g.recall&&g.brier)&&calibration.every(g=>g.pass)};
}
export function evaluateLeague(h:'H1'|'H2'|'H3',reference:ScoredRow[],candidate:ScoredRow[]){
  requireRule(new Set(reference.map(r=>r.fixtureId)).size===reference.length,'BASE_DUPLICATE');
  const map=new Map(candidate.map(r=>[r.fixtureId,r]));
  requireRule(map.size===candidate.length&&candidate.length===reference.length&&reference.every(r=>map.has(r.fixtureId)),'EVALUATION_COHORT_IDENTITY');
  requireRule(reference.every(r=>{const c=map.get(r.fixtureId)!;return c.homeGoals===r.homeGoals&&c.awayGoals===r.awayGoals;}),'LABEL_IDENTITY');
  const primary=reference.filter(r=>r.prediction.status==='PREDICTED');
  const complete=primary.every(r=>map.get(r.fixtureId)!.prediction.status==='PREDICTED');
  const fullCoverage={targets:candidate.length,predicted:candidate.filter(r=>r.prediction.status==='PREDICTED').length,
    pass:candidate.filter(r=>r.prediction.status==='PASS').length,fail:candidate.filter(r=>r.prediction.status==='FAIL').length,invalid:candidate.filter(r=>r.prediction.status==='INVALID').length,
    reasons:Object.fromEntries([...new Set(candidate.flatMap(r=>r.prediction.reasons))].map(reason=>[reason,candidate.filter(r=>r.prediction.reasons.includes(reason)).length]))};
  // Never compute candidate primary metrics on surviving rows.
  if(!complete||fullCoverage.invalid||fullCoverage.fail)return {screen:'INVALID' as Screen,pairedComplete:complete,pairedCount:primary.length,fullCoverage,baseline:metrics(primary),candidate:null,guards:null,comparison:null,delta:null};
  const comparison=compare(h,reference,candidate),base=comparison.baseline,cand=comparison.candidate!;
  const g=guards(base,cand);
  return {screen:(!g.sufficient?'INSUFFICIENT':g.pass?'ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION':'SCREEN_NO') as Screen,
    pairedComplete:true,pairedCount:primary.length,fullCoverage,baseline:base,candidate:cand,guards:g,comparison,
    delta:{logLoss:cand.logLoss!-base.logLoss!,brier:cand.brier!-base.brier!}};
}
export function aggregateScreen(rows:{leagueId:number;screen:Screen}[]):Screen{
  requireRule(rows.length===4&&[39,140,135,78].every(id=>rows.filter(r=>r.leagueId===id).length===1),'FOUR_LEAGUE_GATE');
  if(rows.some(r=>r.screen==='INVALID'))return 'INVALID';
  if(rows.some(r=>r.screen==='INSUFFICIENT'))return 'INSUFFICIENT';
  return rows.every(r=>r.screen==='ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION')?'ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION':'SCREEN_NO';
}
