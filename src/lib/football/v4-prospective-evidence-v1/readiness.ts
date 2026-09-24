/** Operational readiness, never feature admission or a model decision. */
import {bind,pollPlan,type Scope,type Bridge} from './collector';
import {resolvePlayer,type Registry} from './registry';import {requireProof,time} from './contracts';
export function registryGate(scope:Scope,bridge:Bridge,registry:Registry,now:string){
 bind(scope,bridge,now);const byTeam:Record<string,number>={};
 for(const teamId of [bridge.homeTeamId,bridge.awayTeamId]){
  const rows=registry.filter(r=>r.provider==='api-football'&&r.teamProviderId===teamId&&r.competitionProviderId===bridge.competitionProviderId&&r.season===bridge.season);
  requireProof(rows.length>0,'VERIFIED_PLAYER_MEMBERSHIP_REGISTRY_REQUIRED');
  for(const r of rows)requireProof(time(r.recordedAt)<=time(now)&&resolvePlayer(registry,{provider:'api-football',playerId:r.providerPlayerId,teamId,competitionId:bridge.competitionProviderId,season:bridge.season,at:now,knownAt:now}).status==='EXACT','MEMBERSHIP_NOT_EXACT_AS_OF');
  byTeam[teamId]=rows.length;
 }
 return {status:'READY',byTeam,polls:pollPlan(bridge),xiConfirmed:false,featuresAdmitted:0};
}

/** Full CLI gate: registry readiness alone never proves serialization isolation. */
export async function collectionReadiness(scope:Scope,bridge:Bridge,registry:Registry,now:string){
 const identity=registryGate(scope,bridge,registry,now);
 const {provePregameIsolation}=await import('./isolation-proof');
 const isolation=await provePregameIsolation();
 requireProof(isolation.PREGAME_RESULT_FIELD_ISOLATION==='PASS'&&isolation.CANARY_MATCH_COUNT===0,'PREGAME_RESULT_FIELD_ISOLATION_REQUIRED');
 return {...identity,...isolation};
}
