/** Offline full-path canary proof. Historical FAIL evidence is never overwritten. */
import {provePregameIsolation} from '../src/lib/football/v4-prospective-evidence-v1/isolation-proof';
provePregameIsolation().then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('PREGAME_RESULT_FIELD_ISOLATION_FAILED');process.exitCode=1;});
