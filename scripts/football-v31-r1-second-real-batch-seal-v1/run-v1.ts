import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {DEFAULT_ROOT,executeBatch,keyFromEnv,publicAudit} from './batch-v1';

async function main(){
 requireRule(process.argv[2]==='--seal','EXPLICIT_SEAL_ONLY');
 const root=process.env.FOOTBALL_V31_PRIVATE_ROOT||DEFAULT_ROOT;
 const report=await executeBatch({root,key:keyFromEnv()});
 console.log(JSON.stringify(publicAudit(report,{status:'SECOND_REAL_BATCH_SEAL_V1'})));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e));process.exitCode=1;});
}
