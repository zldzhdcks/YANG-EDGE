/** Readiness is scoped to historical roster observations, not canonical or future membership. */
import {bind,pollPlan,type Scope,type Bridge} from './collector';
import {interpret,resolveProviderPlayerIdentity,resolveObservedMembership,type EvidenceRegistry} from './identity-membership-v2';
import {requireProof,time} from './contracts';
export function registryGate(scope:Scope,bridge:Bridge,registry:EvidenceRegistry,now:string){
 bind(scope,bridge,now);const byTeam:Record<string,number>={};
 for(const teamId of [bridge.homeTeamId,bridge.awayTeamId]){
 const rows=registry.map(interpret).filter(r=>r.providerIdentity.provider==='api-football'&&r.observedMembership.teamProviderId===teamId&&r.context.leagueId===bridge.competitionProviderId&&r.context.season===bridge.season);
 requireProof(rows.length>0,'OBSERVED_PLAYER_REGISTRY_REQUIRED');
 for(const r of rows){const q={provider:'api-football',playerId:r.providerIdentity.providerPlayerId,knownAt:now};requireProof(time(r.recordedAt)<=time(now)&&resolveProviderPlayerIdentity(registry,q).status==='EXACT'&&resolveObservedMembership(registry,{...q,teamId}).status==='OBSERVED','OBSERVATION_NOT_EXACT_AS_OF');}
 byTeam[teamId]=new Set(rows.map(r=>r.providerIdentity.providerPlayerKey)).size;
 }
 return {status:'PROVIDER_ROSTER_OBSERVATION_READY',identityContractVersion:'football-v4-player-identity-membership-v2',providerIdentityReady:true,observedRosterEvidenceReady:true,canonicalMappingReady:false,effectiveMembershipReady:false,competitionRegistrationVerified:false,byTeam,polls:pollPlan(bridge),xiConfirmed:false,featuresAdmitted:0};
}
export async function collectionReadiness(scope:Scope,bridge:Bridge,registry:EvidenceRegistry,now:string){
 const identity=registryGate(scope,bridge,registry,now);const {provePregameIsolation}=await import('./isolation-proof');const isolation=await provePregameIsolation();
 requireProof(isolation.PREGAME_RESULT_FIELD_ISOLATION==='PASS'&&isolation.CANARY_MATCH_COUNT===0,'PREGAME_RESULT_FIELD_ISOLATION_REQUIRED');return {...identity,...isolation};
}
