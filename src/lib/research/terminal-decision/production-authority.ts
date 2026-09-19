import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {researchTargetScopeLockRel} from '../daily-scope-lock';
import {loadScope,sha} from './evidence';
/** Operational collection requires the lock itself, not only its source, at HEAD. */
export function loadCommittedProductionScope(cwd:string,date:string){
  const scope=loadScope(cwd,date);
  const bytes=execFileSync('git',['-c',`safe.directory=${cwd.replaceAll('\\','/')}`,'show',`HEAD:${researchTargetScopeLockRel(date)}`],{cwd,stdio:['ignore','pipe','pipe']});
  assert.equal(sha(bytes),scope.hash,'SCOPE_LOCK_NOT_COMMITTED_AT_HEAD');return scope;
}
