/** Input integrity dry-run. Does not graduate MLB or create a terminal reference. */
import assert from 'node:assert/strict';
import {loadScope} from '../src/lib/research/terminal-decision';
import {readEnvelope,time} from '../src/lib/research/terminal-decision/evidence';
import {loadAndPredictMlbV0} from '../src/lib/mlb/prediction-v0/load-and-predict';
import {loadSealedMlbInput} from '../src/lib/mlb/prediction-v0/sealed-input-manifest';
const args=process.argv.slice(2);
if(args.length!==9||args[0]!=='--date'||args[2]!=='--target'||args[4]!=='--manifest'||args[6]!=='--hash'||args[8]!=='--dry-run')throw Error('Usage: --date DATE --target OPERATOR_ID --manifest REL_PATH --hash SHA256 --dry-run');
async function main(){
 const cwd=process.cwd(),scope=loadScope(cwd,args[1]);const target=scope.doc.targets.find(t=>t.targetId===args[3]);assert.ok(target);assert.equal(target.sport,'BASEBALL');
 const e=readEnvelope(args[5]);assert.equal(e.sha256,args[7]);assert.equal(e.payload.scopeSha256,scope.hash);assert.equal(e.payload.target.targetId,target.targetId);assert.equal(String(e.payload.target.gamePk),target.providerGameId,'VERIFIED_PROVIDER_GAME_ID_REQUIRED');assert.equal(time(e.payload.target.scheduledStart),time(target.scheduledStartTimeKst!));
 const checked=loadSealedMlbInput(cwd,args[5],args[7],e.payload.target,scope.hash);
 const schedule=await checked.readJson(checked.manifest.inputs.find(i=>i.artifactType==='Schedule')!.artifactPath);
 assert.equal(schedule.games[0].homeTeam,target.homeTeamRaw);assert.equal(schedule.games[0].awayTeam,target.awayTeamRaw);
 const r=await loadAndPredictMlbV0({cwd,dateKst:args[1],sealedInput:{path:args[5],sha256:args[7],scopeSha256:scope.hash,target:e.payload.target}});
 if(r.kind==='ready'){assert.equal(r.games[0].homeTeam,target.homeTeamRaw);assert.equal(r.games[0].awayTeam,target.awayTeamRaw);}
 console.log(JSON.stringify({kind:r.kind,inputManifestHash:r.kind==='ready'?r.inputManifestHash:null,predictionCount:r.kind==='ready'?r.games.length:0,providerCalls:0,terminalWrites:0,officialPromotion:false},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
