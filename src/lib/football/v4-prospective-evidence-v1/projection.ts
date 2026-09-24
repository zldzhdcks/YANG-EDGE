/** Storage boundary: construct new source-specific objects; never copy provider objects. */
import {requireProof,sha,stable,time,type Context,type Envelope,type SourceType} from './contracts';
import type {XI,Injury} from './validate';

export const PREGAME_SCHEMA = 'football-v4-prospective-evidence-v2' as const;
export type SafeXI = Omit<XI,'teams'> & {sourceType:'XI';teams:(XI['teams'][number]&{formation:string|null})[]};
export type SafePregame = SafeXI | {sourceType:'INJURY';rows:Injury[]} | {sourceType:'PLAYER_STATS';status:'UNRESOLVED'};
const object=(v:unknown):Record<string,unknown> => v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown):unknown[] => {requireProof(Array.isArray(v),'PREGAME_ARRAY_REQUIRED');return v;};
// API-Football numeric IDs only. Invalid identifiers remain invalid, never arbitrary text.
const providerId=(v:unknown):string => typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&Number.isSafeInteger(Number(v))?v:'';
const position=(v:unknown):string|undefined => typeof v==='string'&&['G','D','M','F'].includes(v)?v:undefined;
const formation=(v:unknown):string|null => typeof v==='string'&&/^[1-9](?:-[1-9]){1,5}$/.test(v)&&v.split('-').reduce((n,x)=>n+Number(x),0)===10?v:null;
const absenceType=(v:unknown):string => typeof v==='string'&&['Injury','Missing Fixture','Suspension'].includes(v)?v:'UNKNOWN';
// Only this reason token has semantics in the existing absence classifier.
const absenceReason=(v:unknown):string => v==='Suspended'?'Suspended':'UNKNOWN';
export function projectPregame(source:SourceType,raw:unknown,c:Pick<Context,'providerFixtureId'|'homeTeamId'>):SafePregame {
 requireProof(['XI','INJURY','PLAYER_STATS'].includes(source),'SOURCE_NOT_ALLOWED');
 const rows=list(raw);
 if(source==='XI')return {sourceType:'XI',fixtureId:c.providerFixtureId,teams:rows.map(value=>{
  const t=object(value),teamId=providerId(object(t.team).id);
  const players=(value:unknown)=>list(value??[]).map(value=>{const p=object(object(value).player),pos=position(p.pos);return {playerId:providerId(p.id),teamId,...(pos?{position:pos}:{})};});
  return {teamId,side:teamId===c.homeTeamId?'HOME':'AWAY',formation:formation(t.formation),starters:players(t.startXI),substitutes:players(t.substitutes)};
 })};
 if(source==='INJURY')return {sourceType:'INJURY',rows:rows.map(value=>{const r=object(value),p=object(r.player);return {fixtureId:providerId(object(r.fixture).id),teamId:providerId(object(r.team).id),playerId:providerId(p.id),type:absenceType(p.type),reason:absenceReason(p.reason)};})};
 // No player-stat fields have an admitted pregame/data-through contract.
 return {sourceType:'PLAYER_STATS',status:'UNRESOLVED'};
}
function keys(v:unknown,allowed:string[]){requireProof(v!==null&&typeof v==='object'&&!Array.isArray(v),'PREGAME_OBJECT_REQUIRED');requireProof(Object.keys(v).length===allowed.length&&allowed.every(k=>Object.prototype.hasOwnProperty.call(v,k)),'PREGAME_UNAPPROVED_FIELD');}
function numericId(v:unknown){requireProof(typeof v==='string'&&(v===''||providerId(v)===v),'PREGAME_ID_SCHEMA');}
export function assertSafePregame(value:unknown):asserts value is SafePregame {
 const v=object(value);
 if(v.sourceType==='XI'){
  keys(v,['sourceType','fixtureId','teams']);numericId(v.fixtureId);
  for(const item of list(v.teams)){keys(item,['teamId','side','formation','starters','substitutes']);const t=object(item);numericId(t.teamId);requireProof(t.side==='HOME'||t.side==='AWAY','PREGAME_SIDE_SCHEMA');requireProof(t.formation===null||(typeof t.formation==='string'&&formation(t.formation)===t.formation),'PREGAME_FORMATION_SCHEMA');
   for(const p of [...list(t.starters),...list(t.substitutes)]){const row=object(p);keys(p,['playerId','teamId',...(row.position!==undefined?['position']:[])]);numericId(row.playerId);numericId(row.teamId);if(row.position!==undefined)requireProof(position(row.position)===row.position,'PREGAME_POSITION_SCHEMA');}
  }
 }else if(v.sourceType==='INJURY'){
  keys(v,['sourceType','rows']);for(const item of list(v.rows)){keys(item,['fixtureId','teamId','playerId','type','reason']);const r=object(item);numericId(r.fixtureId);numericId(r.teamId);numericId(r.playerId);requireProof(typeof r.type==='string'&&absenceType(r.type)===r.type,'PREGAME_ABSENCE_TYPE_SCHEMA');requireProof(typeof r.reason==='string'&&absenceReason(r.reason)===r.reason,'PREGAME_ABSENCE_REASON_SCHEMA');}
 }else {keys(v,['sourceType','status']);requireProof(v.sourceType==='PLAYER_STATS'&&v.status==='UNRESOLVED','PREGAME_SOURCE_SCHEMA');}
}
export function safeTimestamp(value:unknown):string|null {try{return new Date(time(value as string)).toISOString();}catch{return null;}}
export function safePaging(value:unknown):{current:number;total:number}|null {const v=object(value);return Number.isSafeInteger(v.current)&&Number(v.current)>0&&Number.isSafeInteger(v.total)&&Number(v.total)>0?{current:Number(v.current),total:Number(v.total)}:null;}
/** New envelopes use the projected-object hash. Legacy hashes remain over legacy bytes. */
export function readPregame(e:Envelope,c:Pick<Context,'providerFixtureId'|'homeTeamId'>):SafePregame {
 const p=object(e.payload);
 if(e.schemaVersion===PREGAME_SCHEMA){
  assertIsolatedEnvelope(e);
  return p.pregame as SafePregame;
 }
 requireProof(e.schemaVersion==='football-v4-prospective-evidence-v1','ENVELOPE_IDENTITY');
 requireProof(sha(stable(p.raw))===e.sourceArtifactSha256,'SOURCE_HASH_MISMATCH');
 const safe=projectPregame(e.sourceType,p.raw,c);assertSafePregame(safe);return safe;
}

/** Reject extra fields on the complete serialized envelope, including diagnostics. */
export function assertIsolatedEnvelope(e:Envelope):void {
 keys(e,['schemaVersion','evidenceId','targetId','scopeIdentity','providerName','providerFixtureId','competitionProviderId','teamProviderId','sourceType','observedAt','collectedAt','asOf','predictionCutoff','scheduledStart','providerUpdatedAt','sourceArtifactSha256','collectorVersion','identityStatus','temporalStatus','validationStatus','featureAdmitted','payload']);
 requireProof(e.schemaVersion===PREGAME_SCHEMA&&e.providerName==='api-football'&&e.collectorVersion==='football-v4-pregame-isolation-v2'&&e.featureAdmitted===false,'PREGAME_ENVELOPE_SCHEMA');
 for(const field of ['evidenceId','scopeIdentity','sourceArtifactSha256'] as const)requireProof(typeof e[field]==='string'&&/^[a-f0-9]{64}$/.test(e[field]),'PREGAME_HASH_SCHEMA');
 for(const field of ['providerFixtureId','competitionProviderId','teamProviderId'] as const){numericId(e[field]);requireProof(e[field]!=='','PREGAME_ID_SCHEMA');}
 requireProof(typeof e.targetId==='string'&&e.targetId.length>0,'PREGAME_TARGET_SCHEMA');
 for(const field of ['observedAt','collectedAt','asOf','predictionCutoff','scheduledStart'] as const)requireProof(safeTimestamp(e[field])===e[field],'PREGAME_CLOCK_SCHEMA');
 requireProof(e.providerUpdatedAt===null||safeTimestamp(e.providerUpdatedAt)===e.providerUpdatedAt,'PREGAME_CLOCK_SCHEMA');
 requireProof(['EXACT','UNRESOLVED','CONFLICT'].includes(e.identityStatus)&&e.temporalStatus==='SAFE','PREGAME_STATE_SCHEMA');
 const p=object(e.payload);keys(p,['pregame','validation','rightsEvidenceHash','registryHash','season','paging']);assertSafePregame(p.pregame);
 requireProof(p.pregame.sourceType===e.sourceType,'PREGAME_SOURCE_MISMATCH');
 for(const field of ['rightsEvidenceHash','registryHash'])requireProof(typeof p[field]==='string'&&/^[a-f0-9]{64}$/.test(p[field] as string),'PREGAME_HASH_SCHEMA');
 requireProof(typeof p.season==='string'&&/^\d{4}$/.test(p.season),'PREGAME_SEASON_SCHEMA');
 if(p.paging!==null){keys(p.paging,['current','total']);requireProof(safePaging(p.paging)!==null,'PREGAME_PAGING_SCHEMA');}
 const v=object(p.validation);requireProof(v.status===e.validationStatus,'PREGAME_VALIDATION_STATUS');
 const reasons=['SCHEMA_INVALID','FIXTURE_MISMATCH','IMPOSSIBLE_STRUCTURE','WRONG_TEAM','TEAM_SIDE_MISMATCH','TOO_MANY_STARTERS','PLAYER_TEAM_MISMATCH','MISSING_PLAYER_ID','DUPLICATE_PLAYER','PROVIDER_IDENTITY_CONFLICT','EMPTY_LINEUP','UNKNOWN_AVAILABILITY','NOT_ELEVEN','REGISTRY_UNRESOLVED','FIXTURE_TEAM_OR_ID_INVALID'];
 if(e.sourceType==='PLAYER_STATS'){
  keys(v,['status','reason']);requireProof(v.status==='UNRESOLVED'&&v.reason==='CUMULATIVE_STATS_DATA_THROUGH_AND_REGISTRY_REVIEW_REQUIRED','PREGAME_STATS_SCHEMA');
 }else {
  const injury=e.sourceType==='INJURY';keys(v,injury?['status','reasons','duplicateRows','normalized','suspensionCompleteness']:['status','reasons']);
  requireProof((injury?['INVALID','CONFLICT','UNRESOLVED','DUPLICATE_OBSERVATION','VALID']:['UNKNOWN','INCOMPLETE','CONFIRMED_COMPLETE','INVALID']).includes(String(v.status)),'PREGAME_VALIDATION_SCHEMA');
  for(const reason of list(v.reasons))requireProof(typeof reason==='string'&&reasons.includes(reason),'PREGAME_REASON_SCHEMA');
  if(injury){requireProof(Number.isSafeInteger(v.duplicateRows)&&Number(v.duplicateRows)>=0&&v.suspensionCompleteness==='UNVERIFIED','PREGAME_INJURY_SCHEMA');assertSafePregame({sourceType:'INJURY',rows:v.normalized});}
 }
 requireProof(sha(stable(p.pregame))===e.sourceArtifactSha256,'SOURCE_HASH_MISMATCH');
}
export function serializePregame(e:Envelope):Buffer {assertIsolatedEnvelope(e);return Buffer.from(stable(e));}
