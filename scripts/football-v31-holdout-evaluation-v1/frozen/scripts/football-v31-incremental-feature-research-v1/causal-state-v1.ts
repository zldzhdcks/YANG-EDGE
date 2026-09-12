import {digest,validateTarget,validateHistory,requireRule,predictSafely,type Target,type Match,type Prediction} from './contracts-v1';
import {featureState,validateFeatureHistory,type FeatureRecord} from '../football-v3-feature-research-v1/feature-state-v1';
import {causalOffset,baseline} from '../football-v3-feature-research-v1/h2-causal-offset-v1';
export type Pair=[number,number];
export type Condition=[number,number,number];
export type Anchor={target:Target;status:Prediction['status'];reasons:string[];q:[Pair,Pair]|null;h:[Condition,Condition]|null;offset:Pair|null;provenance:{historyIds:number[];baseInputHash:string;featureInputHash:string;stateHash:string|null;h2ParameterHash:string|null}};
const trusted=new WeakMap<Anchor,string>();
export function project(z:number[]):Pair{requireRule(z.length===6&&z.every(Number.isFinite),'INVALID_PROJECTION_INPUT');const q:Pair=[((z[0]+z[2])+z[4])/3,((z[1]+z[3])+z[5])/3];requireRule(q.every(Number.isFinite),'FAIL_NUMERICAL','FAIL');return q;}
export function condition(rates:Pair):[Condition,Condition]{requireRule(rates.length===2&&rates.every(x=>Number.isFinite(x)&&x>0),'INVALID_H2_RATE');return [[1,Math.log(rates[0]),Math.log(rates[1])],[1,Math.log(rates[1]),Math.log(rates[0])]];}
/** Only this constructor attests an anchor, after validating BOTH histories at the anchor's own cutoff. */
export function buildAnchor(t:Target,base:Match[],features:FeatureRecord[]){
  validateTarget(t);validateHistory(t,base);validateFeatureHistory('F3',t,features);
  requireRule(digest(base.map(r=>({fixtureId:r.fixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId})))===digest(features.map(f=>f.target)),'BASE_FEATURE_IDENTITY');
  const v1=baseline(t,base),h2=causalOffset(t,base);let state:ReturnType<typeof featureState>|null=null,q:[Pair,Pair]|null=null,h:[Condition,Condition]|null=null;
  const ready=h2.status!=='PREDICTED'?h2:predictSafely(()=>{state=featureState('F3',t,features);q=[project(state.home),project(state.away)];h=condition(h2.rates!);return {p:h2.p,rates:h2.rates,details:{}};});
  const anchor:Anchor={target:{...t},status:ready.status,reasons:[...ready.reasons],q,h,offset:ready.status==='PREDICTED'?[...h2.rates!]:null,provenance:{historyIds:base.map(r=>r.fixtureId),baseInputHash:digest(base),featureInputHash:digest(features),stateHash:state?digest(state):null,h2ParameterHash:typeof h2.details.parameterHash==='string'?h2.details.parameterHash:null}};
  trusted.set(anchor,digest(anchor));return {anchor,v1,h2,state};
}
export function assertAnchor(a:Anchor){validateTarget(a.target);requireRule(trusted.get(a)===digest(a),'UNTRUSTED_OR_MUTATED_ANCHOR');}
export function anchorPrediction(a:Anchor):Prediction{assertAnchor(a);requireRule(a.status!=='PREDICTED','EXPECTED_UNAVAILABLE_ANCHOR');return {status:a.status,reasons:a.reasons,p:null,rates:null,details:{anchorHash:digest(a)}};}
