import {requireRule,validateTarget,type Target,type Prediction,type Fit} from '../football-v3-feature-research-v1/contracts-v1';
export * from '../football-v3-feature-research-v1/contracts-v1';
export const CANDIDATES=['V31-R1','V31-R3'] as const;
export type V31Candidate=typeof CANDIDATES[number];
export const V31_SCHEMA={version:1,target:['fixtureId','leagueId','season','kickoffUtc','homeTeamId','awayTeamId'],seasons:[2023,2024],anchor:['target','status','reasons','q','h','offset','provenance'],mapKinds:['PREFIX','INITIAL','FINAL'],representationDimension:2,betaDimension:2,representationFitSeasons:[2023],noTargetStats:true,no2025FileAccess:true};
export function beforeInputRead<T>(t:Target,read:()=>T):T{validateTarget(t);return read();}
export function blocked<T>(f:Fit<T>):Prediction{requireRule(f.status!=='FITTED','INVALID_BLOCKED_FIT');return {status:f.status,reasons:f.reasons,p:null,rates:null,details:{}};}
export function hashEqual(actual:string,expected:string){requireRule(actual===expected,'SOURCE_OR_INPUT_HASH_MISMATCH');}
