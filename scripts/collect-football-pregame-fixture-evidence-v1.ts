import {collectFixtureEvidence} from '../src/lib/football/foundation/pregame-fixture-evidence';
const args=process.argv.slice(2);
if(args.length!==8||args[0]!=='--date'||args[2]!=='--league'||args[4]!=='--season'||args[6]!=='--output')throw Error('Usage: --date YYYY-MM-DD --league ID --season YEAR --output NEW_LOCAL_PATH');
if(!process.env.FOOTBALL_API_KEY)throw Error('FOOTBALL_API_KEY_REQUIRED');
collectFixtureEvidence(args[1],Number(args[3]),Number(args[5]),args[7]).then(e=>console.log(JSON.stringify({sha256:e.sha256,fixtures:e.payload.fixtures.length,observedAt:e.payload.observedAt}))).catch(e=>{console.error(e.message);process.exitCode=1;});
