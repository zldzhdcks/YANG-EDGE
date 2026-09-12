import {createHash} from 'node:crypto';
export const PROTOCOL_HASH='0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f';
export const DESIGN_HASH='03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945';
export const MODEL_HASH='6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf';
export const BOUNDARY=Date.parse('2024-01-01T00:00:00.000Z');
export const DAY=86400000;
export const CLASSES=['HOME','DRAW','AWAY'] as const;
export type Prob=[number,number,number];
export type Kind='PASS'|'FAIL'|'INVALID';
export class ResearchError extends Error {constructor(public kind:Kind,public reason:string){super(reason);}}
export function requireRule(ok:unknown,reason:string,kind:Kind='INVALID'):asserts ok {if(!ok)throw new ResearchError(kind,reason);}
export function exactKeys(o:object,keys:string[]){requireRule(Object.keys(o).sort().join('|')===[...keys].sort().join('|'),'FORBIDDEN_OR_MISSING_INPUT_FIELD');}
export function canonical(v:unknown):string {if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v!==null&&typeof v==='object'){const o=v as Record<string,unknown>;return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';}return JSON.stringify(v);}
export const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export const digest=(v:unknown)=>sha(canonical(v));
export type Target={fixtureId:number;leagueId:number;season:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number};
export type Match=Target & {homeGoals:number;awayGoals:number};
const targetKeys=['fixtureId','leagueId','season','kickoffUtc','homeTeamId','awayTeamId'];
export function validateTarget(t:Target){exactKeys(t,targetKeys);requireRule([39,140,135,78].includes(t.leagueId),'LEAGUE_IDENTITY');requireRule([2023,2024].includes(t.season),'SEASON_FIREWALL');for(const id of [t.fixtureId,t.homeTeamId,t.awayTeamId])requireRule(Number.isSafeInteger(id)&&id>0,'INVALID_IDENTITY');requireRule(t.homeTeamId!==t.awayTeamId,'SAME_TEAM');requireRule(Number.isFinite(Date.parse(t.kickoffUtc))&&new Date(t.kickoffUtc).toISOString()===t.kickoffUtc,'INVALID_KICKOFF');}
export const targetOf=(r:Match):Target=>({fixtureId:r.fixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId});
export function validateMatch(r:Match){exactKeys(r,[...targetKeys,'homeGoals','awayGoals']);validateTarget(targetOf(r));for(const n of [r.homeGoals,r.awayGoals])requireRule(Number.isSafeInteger(n)&&n>=0&&n<=100,'INVALID_SCORE');}
export const order=<T extends {kickoffUtc:string;fixtureId:number}>(rows:T[])=>[...rows].sort((a,b)=>a.kickoffUtc.localeCompare(b.kickoffUtc)||a.fixtureId-b.fixtureId);
export function validatePool(rows:Match[]){const ids=new Set<number>();for(const r of rows){validateMatch(r);requireRule(!ids.has(r.fixtureId),'DUPLICATE_FIXTURE');ids.add(r.fixtureId);}if(rows.length)requireRule(rows.every(r=>r.leagueId===rows[0].leagueId),'CROSS_LEAGUE_INPUT');}
export function eligible(rows:Match[],t:Target){validateTarget(t);const cutoff=Date.parse(t.kickoffUtc)-1;const selected=order(rows.filter(r=>r.leagueId===t.leagueId&&r.season<=t.season&&r.fixtureId!==t.fixtureId&&Date.parse(r.kickoffUtc)+2*DAY<cutoff&&Date.parse(r.kickoffUtc)>=cutoff-365*DAY));validatePool(selected);return selected;}
export function validateHistory(t:Target,rows:Match[]){validateTarget(t);validatePool(rows);const cutoff=Date.parse(t.kickoffUtc)-1;for(const r of rows)requireRule(r.leagueId===t.leagueId&&r.season<=t.season&&r.fixtureId!==t.fixtureId&&Date.parse(r.kickoffUtc)+2*DAY<cutoff&&Date.parse(r.kickoffUtc)>=cutoff-365*DAY,'TEMPORAL_OR_LEAGUE_LEAKAGE');}
export function historyReasons(t:Target,rows:Match[]){validateHistory(t,rows);const reasons=[];if(rows.length<30)reasons.push('PASS_INSUFFICIENT_COMPETITION_HISTORY');if(rows.filter(r=>r.homeTeamId===t.homeTeamId).length<5)reasons.push('PASS_INSUFFICIENT_HOME_HISTORY');if(rows.filter(r=>r.awayTeamId===t.awayTeamId).length<5)reasons.push('PASS_INSUFFICIENT_AWAY_HISTORY');if(!reasons.length&&(rows.reduce((n,r)=>n+r.homeGoals,0)===0||rows.reduce((n,r)=>n+r.awayGoals,0)===0))reasons.push('PASS_ZERO_COMPETITION_GOAL_RATE');return reasons;}
export function validProb(p:Prob){requireRule(Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<=1e-10,'INVALID_PROBABILITY_MASS');}
export function argmax(p:Prob){validProb(p);return p.indexOf(Math.max(...p));}
export const actual=(h:number,a:number)=>h>a?0:h===a?1:2;
export function rateGate(h:number,a:number){requireRule([h,a].every(n=>Number.isFinite(n)&&n>0),'FAIL_NUMERICAL','FAIL');requireRule(h<=10&&a<=10,'PASS_GOAL_RATE_OUT_OF_RANGE','PASS');}
export type Fit<T>={status:'FITTED';parameters:T;diagnostics:Record<string,unknown>}|{status:Kind;reasons:string[];parameters:null;diagnostics:Record<string,unknown>};
export function attempt<T>(fn:()=>{parameters:T;diagnostics:Record<string,unknown>}):Fit<T>{try{return {status:'FITTED',...fn()};}catch(e){if(e instanceof ResearchError)return {status:e.kind,reasons:[e.reason],parameters:null,diagnostics:{}};throw e;}}
export type Prediction={status:'PREDICTED'|Kind;reasons:string[];p:Prob|null;rates:[number,number]|null;details:Record<string,unknown>};
export function predictSafely(fn:()=>Omit<Prediction,'status'|'reasons'>):Prediction {try{const value=fn();requireRule(value.p!==null,'MISSING_PROBABILITY');validProb(value.p);return {status:'PREDICTED',reasons:[],...value};}catch(e){if(e instanceof ResearchError)return {status:e.kind,reasons:[e.reason],p:null,rates:null,details:{}};throw e;}}

export function validateEvaluationTarget(t:Target){validateTarget(t);requireRule(t.season===2024,'EVALUATION_TARGET_SEASON');}
export function validateDevelopmentPool(rows:Match[]){validatePool(rows);requireRule(rows.every(r=>r.season===2023),'DEVELOPMENT_FIT_SEASON');}
