import {REQUIRED,predictSafely,rateGate,requireRule,validateTarget,type Candidate,type Prediction,type Target} from './contracts-v1';
import {featureState,validateFeatureHistory,type FeatureRecord} from './feature-state-v1';
import {joint} from '../football-poisson-v2-draw-research/evaluation-v1/numerics-v1';
export function prepare(candidate:Candidate,target:Target,history:FeatureRecord[],offset:Prediction):{prediction:Prediction;state:ReturnType<typeof featureState>|null}{
  validateTarget(target);validateFeatureHistory(candidate,target,history);if(offset.status!=='PREDICTED')return {prediction:offset,state:null};
  let state:ReturnType<typeof featureState>|null=null;const prediction=predictSafely(()=>{state=featureState(candidate,target,history);return {p:offset.p,rates:offset.rates,details:{}};});return {prediction,state};
}
export function predict(candidate:Candidate,target:Target,history:FeatureRecord[],offset:Prediction,beta:number[]):Prediction{
  validateTarget(target);requireRule(REQUIRED[candidate]&&beta.length===2*REQUIRED[candidate].length&&beta.every(Number.isFinite),'INVALID_BETA');
  validateFeatureHistory(candidate,target,history);if(offset.status!=='PREDICTED')return offset;
  return predictSafely(()=>{const state=featureState(candidate,target,history),x=[state.home,state.away],contribution=x.map(v=>v.reduce((s,n,j)=>s+n*beta[j],0)),rates=contribution.map((v,i)=>Math.exp(Math.log(offset.rates![i])+v)) as [number,number];rateGate(...rates);return {p:joint(...rates).p,rates,details:{state,contribution,offsetHash:offset.details.parameterHash}};});
}
