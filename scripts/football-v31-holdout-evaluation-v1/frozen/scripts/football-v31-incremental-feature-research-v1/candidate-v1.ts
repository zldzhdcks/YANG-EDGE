import {predictSafely,requireRule,rateGate,digest,type V31Candidate,type Prediction} from './contracts-v1';
import {anchorPrediction,assertAnchor,type Anchor,type Pair} from './causal-state-v1';
import {transform,type MapRecord} from './residual-map-v1';
import {joint} from '../football-poisson-v2-draw-research/evaluation-v1/numerics-v1';
import {fitBeta,type Example} from '../football-v3-feature-research-v1/ridge-offset-poisson-v1';
export function representation(candidate:V31Candidate,a:Anchor,map:MapRecord|null,mode:'TRAIN'|'CHECK'):[Pair,Pair]{
  assertAnchor(a);requireRule(candidate==='V31-R1'||candidate==='V31-R3','INVALID_CANDIDATE');requireRule(a.status==='PREDICTED','UNAVAILABLE_ANCHOR');
  if(candidate==='V31-R1'){requireRule(map,'MAP_REQUIRED');return transform(a,map,mode);}requireRule(map===null,'R3_MAP_FORBIDDEN');return a.q!;
}
export function predict(candidate:V31Candidate,a:Anchor,map:MapRecord|null,beta:number[]):Prediction{
  assertAnchor(a);requireRule(beta.length===2&&beta.every(Number.isFinite),'INVALID_BETA_DIMENSION');if(a.status!=='PREDICTED')return anchorPrediction(a);
  return predictSafely(()=>{const x=representation(candidate,a,map,'CHECK'),contribution=x.map(v=>beta[0]*v[0]+beta[1]*v[1]),rates=contribution.map((v,s)=>Math.exp(Math.log(a.offset![s])+v)) as Pair;rateGate(...rates);return {p:joint(...rates).p,rates,details:{q:a.q,h:a.h,x,offset:a.offset,contribution,anchorHash:digest(a),mapHash:map?digest(map):null,mapParameterHash:map?.parameterHash??null,betaHash:digest(beta)}};});
}
export function fitCandidate(input:Example[]){return fitBeta(input,2);}
