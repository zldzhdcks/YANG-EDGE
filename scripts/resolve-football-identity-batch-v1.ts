import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {digest} from '../src/lib/football/official-canonical-v1';
import {loadResearchExplorer} from '../src/lib/public-analysis/load-research-explorer';
import {findCompetitionByOperatorLabel} from '../src/lib/football/foundation/competition-registry';
import {resolveProviderTeam} from '../src/lib/football/core/team-catalog';
import {TEAM_ALIASES} from '../src/lib/teams/team-aliases';
import {resolveIdentity,resolveTeamAlias,type VerifiedAlias,type ScheduleIdentity} from '../src/lib/public-analysis/provider-identity-batch';
assert(!existsSync('data/audits/2026-09-20-football-provider-identity-resolution-v1.json')&&!existsSync('data/research/football/provider-identity-batch-v1/alias-registry.json'),'IMMUTABLE_BATCH_EXISTS');
process.env.YANG_EDGE_OWNER_PREVIEW='1';
const data=loadResearchExplorer('round-111-odds-new-v1','2026-09-20');
const file='../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20/schedule.json';
const bytes=readFileSync(file),schedule=JSON.parse(bytes.toString()),fixtures:ScheduleIdentity[]=schedule.fixtures,hash=digest(bytes),now=new Date().toISOString();
assert.equal(hash,'5773d935671804feee1571d916dc4cf8c831323a0138ff16648a5dadb1f6267f');
// Explicit editorial alias review, not fuzzy scoring or a fixture-position-based name assignment.
// Competition-scoped spelling/transliteration equivalents; no team ID or target ID hardcoded here.
const reviewed:[number,string,string][]=[
 [88,'페예노르','Feyenoord'],[88,'위트레흐','Utrecht'],[88,'알크마르','AZ Alkmaar'],[88,'텔스타','Telstar'],[88,'트벤테','Twente'],[88,'PSV','PSV Eindhoven'],[88,'네이메헌','NEC Nijmegen'],[88,'고어헤드','GO Ahead Eagles'],
 [135,'피오렌티','Fiorentina'],[135,'나폴리','Napoli'],[135,'프로시노','Frosinone'],[135,'코모1907','Como'],[135,'파르마','Parma'],[135,'제노아','Genoa'],
 [40,'울버햄튼','Wolves'],[40,'웨스브로','West Brom'],[40,'노리치C','Norwich'],[40,'볼턴W','Bolton'],
 [140,'헤타페','Getafe'],[140,'말라가','Malaga'],[39,'본머스','Bournemouth'],[39,'리즈U','Leeds'],[78,'레버쿠젠','Bayer Leverkusen'],[78,'라이프치','RB Leipzig'],[61,'AJ오세르','Auxerre'],[61,'브레스트','Stade Brestois 29'],
 [98,'마치다Z','Machida Zelvia'],[98,'가시와R','Kashiwa Reysol'],[98,'G오사카','Gamba Osaka'],[98,'비셀고베','Vissel Kobe'],[99,'도치기시','Tochigi City'],[99,'V센다이','Vegalta Sendai'],
 [293,'안산그리','Ansan Greeners'],[293,'충북청주','Cheongju'],[293,'성남FC','Seongnam FC'],[293,'화성FC','Hwaseong']
];
const registry:VerifiedAlias[]=[],conflicts:any[]=[],teamObservations=fixtures.flatMap(f=>[{competitionId:f.leagueId,id:f.homeId,name:f.homeName},{competitionId:f.leagueId,id:f.awayId,name:f.awayName}]);
let reused=0,newTeams=0;
for(const [league,name,canonical]of reviewed){
 const observations=teamObservations.filter(t=>t.competitionId===league&&t.name===canonical),ids=[...new Set(observations.map(t=>t.id))];
 if(ids.length!==1){conflicts.push({sourceName:name,competitionId:league,reason:'PROVIDER_NAME_COLLISION_OR_ABSENT'});continue;}
 const check=resolveProviderTeam('api-football',String(ids[0]),canonical);
 if(check.reasons.some(r=>r.includes('CONFLICT'))){conflicts.push({sourceName:name,competitionId:league,providerTeamId:ids[0],reason:check.reasons.join('|')});continue;}
 if(check.status==='MATCHED')reused++;else newTeams++;
 registry.push({sourceName:name,canonicalName:canonical,teamId:ids[0],competitionId:league,evidence:`PROVIDER_ID_NAME_OBSERVATION_SHA256:${hash};ASTRA_EXPLICIT_CROSS_LANGUAGE_ALIAS_REVIEW;NOT_HUMAN_ALIAS_CONFIRMATION`,verifiedAt:now,status:'VERIFIED'});
}
// Reuse literal operator aliases only after ID/name compatibility, scoped by observed competition.
for(const d of data.details.filter(d=>d.line.sport==='SOCCER')){
 const c=findCompetitionByOperatorLabel(d.line.competition);if(!c)continue;
 for(const name of [d.line.home,d.line.away])for(const a of TEAM_ALIASES.filter(a=>a.displayName===name||a.originalNames.includes(name))){
  for(const id of a.externalIds??[]){if(id.provider!=='api-football')continue;const ts=teamObservations.filter(t=>t.competitionId===Number(c.providerCompetitionId)&&t.id===Number(id.id));if(!ts.length)continue;
   const checked=resolveProviderTeam('api-football',id.id,ts[0].name);if(checked.status!=='MATCHED'){conflicts.push({sourceName:name,competitionId:Number(c.providerCompetitionId),reason:checked.reasons.join('|')});continue;}
   if(!registry.some(r=>r.sourceName===name&&r.competitionId===Number(c.providerCompetitionId))){registry.push({sourceName:name,canonicalName:ts[0].name,teamId:Number(id.id),competitionId:Number(c.providerCompetitionId),evidence:`src/lib/teams/team-aliases.ts;PROVIDER_SHA256:${hash}`,verifiedAt:now,status:'VERIFIED'});reused++;}
  }
 }
}
const extraCompetitions=[{sourceName:'K리그2',providerName:'K League 2',providerId:293},{sourceName:'J2리그',providerName:'J2 League',providerId:99}];
for(const c of extraCompetitions)assert(fixtures.some(f=>f.leagueId===c.providerId&&f.leagueName===c.providerName),'COMPETITION_EVIDENCE');
const root='data/research/football/provider-identity-batch-v1';mkdirSync(root,{recursive:true});
writeFileSync(join(root,'alias-registry.json'),JSON.stringify({version:'PROVIDER_ID_FIRST_REUSABLE_ALIASES_V1',verifiedBy:'ASTRA_EDITORIAL_REVIEW',humanAliasConfirmation:false,scheduleHash:hash,aliases:registry,conflicts,extraCompetitions},null,2)+'\n');
const rows=data.details.filter(d=>d.line.sport==='SOCCER').map(d=>{
 const l=d.line,existing=d.preview;
 const c=findCompetitionByOperatorLabel(l.competition),league=c?Number(c.providerCompetitionId):extraCompetitions.find(x=>x.sourceName===l.competition)?.providerId??null;
 let result=resolveIdentity({competitionId:league,home:l.home,away:l.away,kickoff:l.kickoff},registry,fixtures);
 if(l.competition==='AG남축')result={status:'AMBIGUOUS',reason:'SOURCE_MENS_LABEL_DOES_NOT_VERIFY_U23_AGE_CLASS',fixture:null};
 if(l.competition==='K리그1')result={status:'CONFLICT',reason:'CURRENT_PROVIDER_TEAM_ID_NAME_CONFLICT_WITH_FROZEN_K_LEAGUE_CATALOG',fixture:null};
 if(conflicts.some(x=>x.competitionId===league&&[l.home,l.away].includes(x.sourceName)))result={status:'CONFLICT',reason:'PROVIDER_TEAM_ID_NAME_CONFLICT_WITH_EXISTING_REGISTRY',fixture:null};
 if(existing){const matched=fixtures.filter(f=>f.fixtureId===existing.fixtureId);assert.equal(matched.length,1);const f=matched[0];assert(f.homeId===existing.teams[0].id&&f.awayId===existing.teams[1].id&&f.leagueId===existing.leagueId&&Date.parse(f.kickoff)===Date.parse(l.kickoff));result={status:'EXACT',reason:null,fixture:f};}
 const f=result.fixture;
 return{targetId:l.targetId,competition:l.competition,sourceHome:l.home,sourceAway:l.away,kickoff:l.kickoff,providerCompetitionId:league,providerHomeTeamId:f?.homeId??resolveTeamAlias(l.home,league??0,registry).id,providerAwayTeamId:f?.awayId??resolveTeamAlias(l.away,league??0,registry).id,providerFixtureId:f?.fixtureId??null,identityStatus:result.status,identityConfidence:result.status==='EXACT'?'EXACT_ID_AND_SCHEDULE_CROSSCHECK':'NOT_ADMITTED',competitionStatus:league?'EXACT':l.competition==='AG남축'?'AMBIGUOUS':'NOT_FOUND',homeTeamStatus:existing?'EXACT_PROVIDER_ID':resolveTeamAlias(l.home,league??0,registry).status,awayTeamStatus:existing?'EXACT_PROVIDER_ID':resolveTeamAlias(l.away,league??0,registry).status,evidence:[`SCHEDULE_SHA256:${hash}`,'HUMAN_VERIFIED_OPERATOR_SOURCE_FREEZE','COMPETITION_REGISTRY','REUSABLE_ALIAS_REGISTRY'],failureReason:result.reason,researchTierBefore:l.tier,researchTierAfter:l.tier,regressionOnly:!!existing,identity:f};
});
const counts:Record<string,number>={};for(const r of rows.filter(r=>!r.regressionOnly))counts[r.identityStatus]=(counts[r.identityStatus]??0)+1;
writeFileSync('data/audits/2026-09-20-football-provider-identity-resolution-v1.json',JSON.stringify({createdAt:now,batch:data.batch,date:data.date,scopeHash:data.scopeHash,scheduleObservedAt:schedule.observedAt,scheduleSha256:hash,unresolvedBefore:29,counts,newTeamIdentities:newTeams,newAliases:registry.filter(r=>r.evidence.includes('ASTRA_EXPLICIT')).length,reusedIdentities:reused,oneOffHardcodeCount:0,registryFile:join(root,'alias-registry.json'),providerCalls:1,v4ReservedBudgetUsed:0,targetResultAccessed:false,liveDataAccessed:false,targetPostgameAccessed:false,newPredictions:0,rows},null,2)+'\n');
console.log(JSON.stringify({counts,newTeams,reused,newAliases:registry.length,exact:rows.filter(r=>!r.regressionOnly&&r.identityStatus==='EXACT').map(r=>({id:r.targetId,home:r.sourceHome,away:r.sourceAway,fixture:r.providerFixtureId})),conflicts},null,2));
