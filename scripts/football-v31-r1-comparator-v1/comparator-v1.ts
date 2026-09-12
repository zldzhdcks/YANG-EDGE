import {readFileSync} from 'node:fs';
import {predictFootball} from '../../src/lib/football/poisson-research-v1/index';
import {select,predict,MAP_HASH,BETA_HASH,targetGate} from '../football-v31-r1-prospective-v1/adapter-v1';
import {digest,sha,requireRule,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {bindObservedCutoff,historyReasons,order,predictSafely,argmax,type Target,type Prediction} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';
import {fitRates,predictRates} from '../football-v31-r1-prospective-v1/frozen/scripts/football-poisson-v2-draw-research/evaluation-v1/h2-ridge-rates-v1';
import {joint} from '../football-v31-r1-prospective-v1/frozen/scripts/football-poisson-v2-draw-research/evaluation-v1/numerics-v1';

export const CONTRACT='V31_R1_SAME_CUTOFF_COMPARATOR_V1';
export const V1_HASH='6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf';
export const ADAPTER_HASH='125f715c85a5199b7f5725949c4b1ff6f12b1e5d6ef65095c5af0d0673682b6b';
export const H2_HASH='fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea';
export const roles=['V1_SAME_CUTOFF_RESEARCH_COMPARATOR','H2_SAME_CUTOFF_RESEARCH_COMPARATOR','V31_R1_PROSPECTIVE_SHADOW'] as const;
export function sourceHash(relative:string){return sha(readFileSync(new URL('../../'+relative,import.meta.url),'utf8').replace(/\r\n/g,'\n'));}
export function verifyModel(){requireRule(sourceHash('src/lib/football/poisson-research-v1/index.ts')===V1_HASH,'V1_SOURCE_CHANGED');requireRule(sourceHash('src/lib/football/odds-1x2-v1/instant.ts')==='c848e4f64438a76bb39531a0f702c01c0aa3c3076f33ef5d39f56c480e97c784','V1_HELPER_CHANGED');requireRule(sourceHash('scripts/football-v31-r1-prospective-v1/adapter-v1.ts')===ADAPTER_HASH,'ADAPTER_CHANGED');requireRule(sourceHash('scripts/football-v31-r1-prospective-v1/frozen/scripts/football-poisson-v2-draw-research/evaluation-v1/h2-ridge-rates-v1.ts')===H2_HASH,'H2_CHANGED');}
export type Context={targetIdentity:Target;cutoffAt:string;predictionCreatedAt:string;baseHistoryIds:number[];baseHistoryHash:string};
export type Result=Context & {role:typeof roles[number];status:Prediction['status'];passReason:string[];probabilities:Prediction['p'];class:string|null;rates:Prediction['rates'];modelHash:string;parameterHash:string|null;mapHash:string|null;betaHash:string|null;adapterHash:string|null;details:Record<string,unknown>};
export type HashedResult={payload:Result;sha256:string};
export type Bundle=Context & {contract:typeof CONTRACT;featureObservationIds:string[];featureObservationHashes:string[];featureCounts:ReturnType<typeof select>['counts'];inputSnapshotHash:string;sameCutoffV1:HashedResult;sameCutoffH2:HashedResult;r1:HashedResult;officialForwardReference:{role:'OFFICIAL_FORWARD_REFERENCE_ONLY';fixtureId:number;snapshotHash:string}|null};
export function freezeDeep<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeDeep(child);Object.freeze(value);}return value;}
/** No IO, provider queries, or official artifact writes. Only frozen mathematics use the common selected history. */
export function compare(t:Target,cutoffAt:string,predictionCreatedAt:string,observations:Observation[]):Bundle{
 verifyModel();targetGate(t,cutoffAt,predictionCreatedAt);
 const census=select(t,cutoffAt,predictionCreatedAt,observations),selected=census.selected;
 const base=order(selected.map(o=>({...o.fixture,homeGoals:o.completion.homeGoals,awayGoals:o.completion.awayGoals})));
 const context:Context={targetIdentity:structuredClone(t),cutoffAt,predictionCreatedAt,baseHistoryIds:base.map(r=>r.fixtureId),baseHistoryHash:digest(base)};
 // Frozen V1 uses observed < cutoff. Never fabricate a timestamp or silently use a different cohort.
 requireRule(selected.every(o=>Date.parse(o.completion.providerFetchedAt)<Date.parse(cutoffAt)),'SAME_CUTOFF_OBSERVATION_BOUNDARY');
 const identity=(f:Target)=>({matchId:'API_FOOTBALL:'+f.fixtureId,competitionId:String(f.leagueId),homeTeamId:String(f.homeTeamId),awayTeamId:String(f.awayTeamId),kickoffAt:f.kickoffUtc});
 const v=predictFootball({target:identity(t),cutoffAt,history:selected.map(o=>({...identity(o.fixture),resultObservedAt:o.completion.providerFetchedAt,regulationHomeGoals:o.completion.homeGoals,regulationAwayGoals:o.completion.awayGoals}))});
 requireRule(digest([...v.evidence.sourceMatchIds].sort())===digest(base.map(r=>'API_FOOTBALL:'+r.fixtureId).sort()),'V1_BASE_HISTORY_MISMATCH');
 const v1:Prediction={status:v.status==='RESEARCH_PREDICTED'?'PREDICTED':'PASS',reasons:v.reasons,p:v.probabilities?[v.probabilities.home,v.probabilities.draw,v.probabilities.away]:null,rates:v.expectedGoals?[v.expectedGoals.home,v.expectedGoals.away]:null,details:{evidence:v.evidence}};
 bindObservedCutoff(t,Date.parse(cutoffAt));
 const h2=predictSafely(()=>{const reasons=historyReasons(t,base);requireRule(!reasons.length,reasons.join('|'),'PASS');const fit=fitRates(base);if(fit.status!=='FITTED')requireRule(false,fit.reasons.join('|'),fit.status);const rates=predictRates(fit.parameters,t,base);return {p:joint(...rates).p,rates,details:{parameterHash:digest(fit.parameters),inputHash:digest(base)}};});
 const r=predict(t,cutoffAt,predictionCreatedAt,observations);
 requireRule(digest(r.census.selected.map(o=>o.fixture.fixtureId))===digest(context.baseHistoryIds),'R1_BASE_HISTORY_MISMATCH');
 if(r.prediction.status==='PREDICTED'){requireRule(h2.status==='PREDICTED'&&digest(h2.rates)===digest(r.prediction.details.offset),'H2_OFFSET_MISMATCH');requireRule(h2.details.parameterHash===r.prediction.details.h2ParameterHash&&context.baseHistoryHash===r.prediction.details.h2InputHash,'H2_PROVENANCE_MISMATCH');}
 const wrap=(p:Prediction,role:Result['role'],modelHash:string,extra:Partial<Result>={}):HashedResult=>{const payload:Result={...structuredClone(context),role,status:p.status,passReason:p.reasons,probabilities:p.p,class:p.p?['HOME','DRAW','AWAY'][argmax(p.p)]:null,rates:p.rates,modelHash,parameterHash:null,mapHash:null,betaHash:null,adapterHash:null,details:p.details,...extra};return {payload,sha256:digest(payload)};};
 return freezeDeep({...context,contract:CONTRACT,featureObservationIds:selected.map(o=>o.observationId),featureObservationHashes:selected.map(digest),featureCounts:census.counts,inputSnapshotHash:digest(selected),sameCutoffV1:wrap(v1,roles[0],V1_HASH),sameCutoffH2:wrap(h2,roles[1],sourceHash('scripts/football-v31-r1-prospective-v1/frozen/scripts/football-poisson-v2-draw-research/evaluation-v1/h2-ridge-rates-v1.ts'),{parameterHash:h2.details.parameterHash as string??null}),r1:wrap(r.prediction,roles[2],sourceHash('scripts/football-v31-r1-prospective-v1/adapter-v1.ts'),{mapHash:MAP_HASH,betaHash:BETA_HASH,adapterHash:sourceHash('scripts/football-v31-r1-prospective-v1/adapter-v1.ts')}),officialForwardReference:null});
}
