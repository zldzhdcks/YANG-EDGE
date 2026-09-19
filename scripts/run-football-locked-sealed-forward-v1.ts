import {readFileSync} from 'node:fs';
import {runLockedSealedForward} from './football-locked-sealed-forward-v1';
const args=process.argv.slice(2);
if(args.length!==6||args[0]!=='--date'||args[2]!=='--target'||args[4]!=='--inputs')throw Error('Usage: --date DATE --target OPERATOR_ID --inputs LOCAL_INPUT_REFERENCES_JSON');
// References contain pinned artifact hashes and a previously reviewed exact binding.
const result=runLockedSealedForward(process.cwd(),args[1],args[3],JSON.parse(readFileSync(args[5],'utf8')));
console.log(JSON.stringify({readiness:result.readiness,forwardStatus:result.result.kind,terminal:result.terminal?.write??null,providerCalls:0},null,2));
