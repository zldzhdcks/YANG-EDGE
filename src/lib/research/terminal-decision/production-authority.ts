import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {researchTargetScopeLockRel,operatorBetmanDailySlateRel} from '../daily-scope-lock';
import {loadScope,sha} from './evidence';
import {committedBytes} from './batch-selection';
/** Operational collection requires the lock itself, not only its source, at HEAD. */
export function loadCommittedProductionScope(cwd:string,date:string){
  const scope=loadScope(cwd,date);
  const operator=operatorBetmanDailySlateRel(date);assert.equal(sha(committedBytes(cwd,operator)),sha(readFileSync(join(cwd,operator))),'OPERATOR_NOT_COMMITTED_AT_HEAD');
  const bytes=committedBytes(cwd,researchTargetScopeLockRel(date));
  assert.equal(sha(bytes),scope.hash,'SCOPE_LOCK_NOT_COMMITTED_AT_HEAD');return scope;
}
