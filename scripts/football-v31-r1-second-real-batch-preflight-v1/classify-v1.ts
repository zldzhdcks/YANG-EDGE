import {targetCensus} from '../football-v31-r1-comparator-v1/preflight-v1';
import type {Observation} from '../football-v31-r1-prospective-v1/store-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';
import {leadTimeMs,withinWindow} from './window-v1';

export const READY='READY',PASS_PRECHECK='PASS_PRECHECK',IDENTITY_BLOCKED='IDENTITY_BLOCKED',OUTSIDE_WINDOW='OUTSIDE_WINDOW',ALREADY_SEALED='ALREADY_SEALED',NOT_NS_OR_DEADLINE='NOT_NS_OR_DEADLINE';
export type ClassName=typeof READY|typeof PASS_PRECHECK|typeof IDENTITY_BLOCKED|typeof OUTSIDE_WINDOW|typeof ALREADY_SEALED|typeof NOT_NS_OR_DEADLINE;

export type Classified={
 fixtureId:number;league:number;season:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number;
 discoveryAt:string;windowEnd:string;cutoffEligible:boolean;apiStatus:'VERIFIED'|'NOT_VERIFIED';providerStatus:string|null;
 className:ClassName;FUTURE:boolean;NS:boolean;deadlineSatisfied:boolean;historyPotentiallySatisfiable:boolean;
 V1_READY:boolean;H2_READY:boolean;R1_READY:boolean;leadTimeMs:number;alreadySealed:boolean;
};

export function classify(input:{
 stored:Target;verified:Target|null;apiStatus:'VERIFIED'|'NOT_VERIFIED';providerStatus:string|null;
 discoveryAt:string;windowEnd:string;alreadySealed:boolean;observations:Observation[];
}):Classified{
 const kickoff=input.verified?.kickoffUtc??input.stored.kickoffUtc;
 const identity=input.stored;
 const row={fixtureId:identity.fixtureId,league:identity.leagueId,season:identity.season,kickoffUtc:kickoff,homeTeamId:identity.homeTeamId,awayTeamId:identity.awayTeamId,discoveryAt:input.discoveryAt,windowEnd:input.windowEnd,cutoffEligible:false,apiStatus:input.apiStatus,providerStatus:input.providerStatus,className:OUTSIDE_WINDOW as ClassName,FUTURE:false,NS:false,deadlineSatisfied:false,historyPotentiallySatisfiable:false,V1_READY:false,H2_READY:false,R1_READY:false,leadTimeMs:leadTimeMs(kickoff,input.discoveryAt),alreadySealed:input.alreadySealed};
 if(!withinWindow(kickoff,input.windowEnd))return {...row,className:OUTSIDE_WINDOW};
 if(input.apiStatus!=='VERIFIED'||!input.verified)return {...row,className:IDENTITY_BLOCKED};
 const census=targetCensus(input.verified,input.providerStatus??'',input.discoveryAt,input.observations);
 row.FUTURE=census.FUTURE;row.NS=census.NS;row.deadlineSatisfied=census.deadlineSatisfied;row.historyPotentiallySatisfiable=census.historyPotentiallySatisfiable;row.cutoffEligible=census.FUTURE&&census.NS&&census.deadlineSatisfied;
 if(input.alreadySealed)return {...row,className:ALREADY_SEALED};
 if(!row.cutoffEligible)return {...row,className:NOT_NS_OR_DEADLINE};
 if(!census.historyPotentiallySatisfiable)return {...row,className:PASS_PRECHECK};
 return {...row,className:READY,V1_READY:true,H2_READY:true,R1_READY:true};
}
