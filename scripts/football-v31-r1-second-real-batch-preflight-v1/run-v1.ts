import {mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {DEFAULT_ROOT,keyFromEnv,preflight,writeLocalDiscovery} from './preflight-v1';

async function main(){
 requireRule(process.argv[2]==='--preflight','EXPLICIT_PREFLIGHT_ONLY');
 const root=process.env.FOOTBALL_V31_PRIVATE_ROOT||DEFAULT_ROOT;
 const report=await preflight({root,key:keyFromEnv()});
 const localDir=join(resolve(root,'..'),'football-v31-r1-second-real-batch-preflight-v1');
 mkdirSync(localDir,{recursive:true});
 const local=writeLocalDiscovery(join(localDir,'discovery-'+report.discoveryAt.replace(/[:.]/g,'-')+'.json'),report);
 console.log(JSON.stringify({
  status:'PREFLIGHT_ONLY',
  discoveryAt:report.discoveryAt,
  windowEnd:report.windowEnd,
  TOTAL_DISCOVERED:report.TOTAL_DISCOVERED,
  WITHIN_WINDOW:report.WITHIN_WINDOW,
  READY_FOR_TRIPLE_SEAL:report.READY_FOR_TRIPLE_SEAL,
  PASS_PRECHECK:report.PASS_PRECHECK,
  IDENTITY_BLOCKED:report.IDENTITY_BLOCKED,
  OUTSIDE_WINDOW:report.OUTSIDE_WINDOW,
  ALREADY_SEALED:report.ALREADY_SEALED,
  NOT_NS_OR_DEADLINE:report.NOT_NS_OR_DEADLINE,
  V1_READY:report.V1_READY,H2_READY:report.H2_READY,R1_READY:report.R1_READY,
  earliestKickoff:report.earliestKickoff,
  latestKickoff:report.latestKickoff,
  minimumLeadTimeMs:report.minimumLeadTimeMs,
  PREDICTION_SEAL_EXECUTED:report.PREDICTION_SEAL_EXECUTED,
  FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING:report.FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING,
  localDiscoveryHash:local.sha256,
  LOCAL_ONLY:true,
 }));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e));process.exitCode=1;});
}
