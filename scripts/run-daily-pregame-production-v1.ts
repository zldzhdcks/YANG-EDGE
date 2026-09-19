import {readFileSync} from 'node:fs';
import {runDailyPregame,type ProductionPlan} from './daily-pregame-production-v1';
const a=process.argv.slice(2);
if(!((a.length===2||a.length===4)&&a[0]==='--date'&&(a.length===2||a[2]==='--plan')))throw Error('Usage: --date YYYY-MM-DD [--plan EXPLICIT_LOCAL_JSON]');
const plan=a[3]?JSON.parse(readFileSync(a[3],'utf8')) as ProductionPlan:undefined;
runDailyPregame(process.cwd(),a[1],plan).then(r=>{console.log(JSON.stringify(r,null,2));if(!['COVERAGE_COMPLETE','COVERAGE_INCOMPLETE'].includes(r.coverage.status))process.exitCode=2;}).catch(()=>{console.error('PRODUCTION_GATE_FAILED: inspect committed scope and pinned local evidence');process.exitCode=2;});
