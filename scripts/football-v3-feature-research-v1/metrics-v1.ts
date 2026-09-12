import {validateTarget,targetOf,requireRule,digest,type Target,type Prediction,type Match} from './contracts-v1';
import {metrics} from '../football-poisson-v2-draw-research/evaluator-v1';
export type Pregame={target:Target;v1:Prediction;h2:Prediction};
export function population(rows:Pregame[]){for(const r of rows)validateTarget(r.target);requireRule(new Set(rows.map(r=>r.target.fixtureId)).size===rows.length,'DUPLICATE_COMPARATOR');return {ids:rows.filter(r=>r.v1.status==='PREDICTED'&&r.h2.status==='PREDICTED').map(r=>r.target.fixtureId),comparatorHash:digest(rows)};}
export function compare(rows:Pregame[],predictions:Prediction[],labels:Match[]){
  const u=population(rows);requireRule(rows.length===predictions.length&&rows.length===labels.length,'FULL_DENOMINATOR_MISMATCH');rows.forEach((r,i)=>{validateTarget(r.target);requireRule(digest(r.target)===digest(targetOf(labels[i])),'LABEL_IDENTITY');});
  const full={targets:rows.length,predicted:predictions.filter(r=>r.status==='PREDICTED').length,pass:predictions.filter(r=>r.status==='PASS').length,fail:predictions.filter(r=>r.status==='FAIL').length,invalid:predictions.filter(r=>r.status==='INVALID').length,reasons:Object.fromEntries([...new Set(predictions.flatMap(r=>r.reasons))].map(reason=>[reason,predictions.filter(r=>r.reasons.includes(reason)).length]))};
  const indices=rows.map((r,i)=>u.ids.includes(r.target.fixtureId)?i:-1).filter(i=>i>=0);const scored=(source:Prediction[])=>indices.map(i=>({fixtureId:rows[i].target.fixtureId,homeGoals:labels[i].homeGoals,awayGoals:labels[i].awayGoals,prediction:source[i]}));
  const v1=metrics(scored(rows.map(r=>r.v1))),h2=metrics(scored(rows.map(r=>r.h2))),complete=indices.every(i=>predictions[i].status==='PREDICTED');
  const candidate=complete&&indices.length?metrics(scored(predictions)):null;
  const delta=candidate?{v1:{logLoss:candidate.logLoss!-v1.logLoss!,brier:candidate.brier!-v1.brier!},h2:{logLoss:candidate.logLoss!-h2.logLoss!,brier:candidate.brier!-h2.brier!}}:null;
  const differences=delta?Object.values(delta).flatMap(x=>[x.logLoss,x.brier]):[];
  return {full:{...full,coverage:full.targets?full.predicted/full.targets:null},pairedCount:indices.length,pairedIdsHash:digest(u.ids),pairedComplete:complete,primaryStatus:complete?'COMPLETE':'INCOMPLETE_PRIMARY_COVERAGE',v1,h2,candidate,delta,descriptive:!candidate?'INSUFFICIENT':differences.every(n=>n< -1e-12)?'BETTER_THAN_BOTH_DESCRIPTIVELY':differences.every(n=>n>1e-12)?'WORSE':'MIXED'};
}
