/** Frozen V3 uses the read-only V2 evaluation contracts, which reject season 2025. */
import {observedCutoff,validateTarget,validateHistory,order,DAY,requireRule,type Target,type Match} from '../football-poisson-v2-draw-research/evaluation-v1/contracts-evaluation-v1';
export * from '../football-poisson-v2-draw-research/evaluation-v1/contracts-evaluation-v1';
export const FEATURES=['xG','shots','sot'] as const;
export type Feature=typeof FEATURES[number];
export type Candidate='F1'|'F2'|'F3';
export const REQUIRED:Record<Candidate,readonly Feature[]>={F1:['xG'],F2:['shots','sot'],F3:FEATURES};
export const INPUT_SCHEMA={target:['fixtureId','leagueId','season','kickoffUtc','homeTeamId','awayTeamId'],feature:['target','values','sourceHash','providerFetchedAt'],seasons:[2023,2024],featureTypes:FEATURES,rawRootRole:'SEALED_2023_2024_CENSUS_ONLY'};
export function selectTargets(target:Target,rows:Target[]){
  validateTarget(target);for(const row of rows)validateTarget(row);
  requireRule(new Set(rows.map(r=>r.fixtureId)).size===rows.length,'DUPLICATE_FIXTURE');
  const cutoff=observedCutoff(target);
  return order(rows.filter(r=>r.leagueId===target.leagueId&&r.season<=target.season&&r.fixtureId!==target.fixtureId&&Date.parse(r.kickoffUtc)>=cutoff-365*DAY&&Date.parse(r.kickoffUtc)<cutoff));
}
export function causalHistory(target:Target,rows:Target[],lookup:(t:Target)=>Match){const selected=selectTargets(target,rows).map(lookup);validateHistory(target,selected);return selected;}
