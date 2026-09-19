import {loadScope,readDecisionCoverage} from '../src/lib/research/terminal-decision';
import {advancePregame} from '../src/lib/research/terminal-decision/lifecycle';
import {assertExplicitDateKst} from '../src/lib/research/daily-scope-lock';
const args=process.argv.slice(2);
if(args.length!==2 || args[0]!=='--date')throw Error('Usage: --date YYYY-MM-DD (read-only; no collection or prediction)');
const date=assertExplicitDateKst(args[1]),cwd=process.cwd();
const scope=loadScope(cwd,date);
const rows=scope.doc.targets.map(t=>advancePregame(cwd,date,t.targetId,'PENDING',{auditOnly:true}).audit);
const coverage=readDecisionCoverage(cwd,date);
console.log(JSON.stringify({dateKst:date,readinessAssessed:false,rows,coverage,networkCalls:0,providerCalls:0,terminalWrites:0},null,2));
// Operational monitoring permits incomplete coverage while unresolved windows remain open.
const unresolvedOpen=rows.some(r=>!r.terminalDecisionExists && r.windowStatus==='WINDOW_OPEN');
const unresolvedOverdue=rows.some(r=>!r.terminalDecisionExists && r.windowStatus==='PREGAME_WINDOW_MISSED');
process.exitCode=coverage.status==='COVERAGE_COMPLETE' || (coverage.status==='COVERAGE_INCOMPLETE' && unresolvedOpen && !unresolvedOverdue)?0:2;
