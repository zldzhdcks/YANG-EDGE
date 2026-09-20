/** Exact literal alias admission only; outcome-blind and no model execution. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {join} from 'node:path';
import {TEAM_ALIASES} from '../src/lib/teams/team-aliases';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import {collectFixtureEvidence} from '../src/lib/football/foundation/pregame-fixture-evidence';
import {selectExactFixture} from '../src/lib/betman/daily-slate/exact-pregame-identity';
import {countOfficialPredictions} from '../src/lib/research/terminal-decision/prediction-counter';
async function main(){const repo=process.cwd(),root=join(repo,'data/research/slate-batches/round-111-odds-new-v1'),out=join(root,'priority-readiness-v1');const counts=countOfficialPredictions([{label:'OFFICIAL_FORWARD',modelRoot:join(repo,'data/cache/research/football/forward-shadow-v1/MODEL_FORWARD')},{label:'ROUND_111',modelRoot:join(root,'data/cache/research/football/forward-shadow-v1/MODEL_FORWARD')}]);
 const aliases=(raw:string)=>[...new Set(TEAM_ALIASES.filter(t=>t.displayName===raw||t.originalNames.includes(raw)).flatMap(t=>(t.externalIds??[]).filter(i=>i.provider==='api-football').map(i=>Number(i.id))))];
 const leagues:Record<string,number>={EPL:39,'라리가':140,'세리에A':135,'분데스리':78};const rows:any[]=[];let providerCalls=0;
 for(const date of ['2026-09-20','2026-09-21']){const scope=loadCommittedProductionScope(root,date);for(const t of scope.doc.targets.filter(t=>t.sport.toUpperCase()==='SOCCER')){
 const row:any={targetId:t.targetId,date,home:t.homeTeamRaw,away:t.awayTeamRaw,competition:t.competitionNameRaw,kickoff:t.scheduledStartTimeKst,leagueId:leagues[t.competitionNameRaw??''],homeIds:aliases(t.homeTeamRaw),awayIds:aliases(t.awayTeamRaw),status:'PENDING_EXACT_IDENTITY',fuzzyMatching:false};rows.push(row);
 if(['BETMAN-20260920-86','BETMAN-20260920-91'].includes(t.targetId)){row.status='ALREADY_SEALED_BATCH_DUPLICATE_GLOBAL_CONFLICT';continue;}
 if(!row.leagueId){row.status='PENDING_UNSUPPORTED_LEAGUE';continue;}if(Date.now()+60000>=Date.parse(t.scheduledStartTimeKst!)){row.status='WINDOW_CLOSED_NOT_EXECUTED_BY_READINESS_AUDIT';continue;}
 if(row.homeIds.length!==1||row.awayIds.length!==1)continue;
 process.env.FOOTBALL_API_KEY ||= process.env.API_FOOTBALL_KEY;
 const local=join(repo,'data/cache/research/round-111-priority-identity',new Date().toISOString().replaceAll(':','-'));mkdirSync(local,{recursive:true});const dest=join(local,'remaining-ns.json');
 providerCalls++;const evidence=await collectFixtureEvidence(date,row.leagueId,2026,dest,fetch,true);const match=selectExactFixture({verified:true,leagueId:row.leagueId,homeTeamId:row.homeIds[0],awayTeamId:row.awayIds[0],kickoff:t.scheduledStartTimeKst!},evidence.payload.fixtures,new Date().toISOString());row.identity=match;row.evidencePath=dest;row.evidenceHash=evidence.sha256;
 if(match.status==='EXACT_MATCH'){row.fixtureId=match.fixture!.fixtureId;const prior=counts.rows.filter(p=>p.fixtureId===row.fixtureId);row.existingSeals=prior;row.status=prior.length?'PENDING_EXISTING_GLOBAL_SEAL_BINDING_REVIEW':'EXACT_IDENTITY_READY_FOR_PINNED_INPUT';}else row.status='PENDING_PROVIDER_IDENTITY_MISMATCH';
 }}const audit={createdAt:new Date().toISOString(),providerCalls,endpoint:'/fixtures',statusFilter:'NS',targetResultsAccessed:false,liveDataAccessed:false,modelExecuted:false,rows};writeFileSync(join(out,'remaining-football-readiness.json'),JSON.stringify(audit,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({providerCalls,statusCounts:rows.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),exact:rows.filter(r=>r.fixtureId)},null,2));}
main().catch(e=>{console.error(e instanceof Error?e.message:'READINESS_BLOCKED');process.exitCode=1;});
