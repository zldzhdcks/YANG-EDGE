import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from "node:fs";

export const REQUIRED_PREGAME_INPUTS = ["Schedule", "HomeStarter", "AwayStarter", "Lineup", "Odds"] as const;
export type InputKind = typeof REQUIRED_PREGAME_INPUTS[number];
export type TargetIdentity = { provider: string; targetId: string; homeTeamId: string; awayTeamId: string; scheduledStart: string };
type Observation = { kind: InputKind; sourceIdentity: string; asOf: string; targetExcludedFromHistory: true; bytes: Buffer };
export type Receipt = { schemaVersion: "mlb-pregame-observation-v1"; target: TargetIdentity; kind: InputKind; sourceIdentity: string; asOf: string; targetExcludedFromHistory: true; collectedAt: string; observedAt: string; sha256: string };
const ms=(s:string)=>{ assert.ok(typeof s === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(s));const n=Date.parse(s);assert.ok(Number.isFinite(n),"INVALID_TIME");return n; };
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
function targetValid(t:TargetIdentity){for(const s of [t.provider,t.targetId,t.homeTeamId,t.awayTeamId])assert.ok(typeof s==='string' && s.trim());assert.notEqual(t.homeTeamId,t.awayTeamId);ms(t.scheduledStart);}

export function validatePregameObservation(receipt: Receipt, bytes: Buffer, target: TargetIdentity, executionAt: string) {
  targetValid(target); assert.equal(receipt.schemaVersion,"mlb-pregame-observation-v1");
  assert.deepEqual(receipt.target,target,"TARGET_IDENTITY_MISMATCH");
  assert.ok(REQUIRED_PREGAME_INPUTS.includes(receipt.kind));assert.ok(receipt.sourceIdentity.trim());
  assert.equal(receipt.targetExcludedFromHistory,true,"TARGET_HISTORY_NOT_EXCLUDED");
  assert.equal(hash(bytes),receipt.sha256,"SOURCE_BYTES_CHANGED");
  const collected=ms(receipt.collectedAt),observed=ms(receipt.observedAt),asOf=ms(receipt.asOf),execution=ms(executionAt),start=ms(target.scheduledStart);
  assert.ok(collected<=observed && asOf<=observed && observed<=execution && execution<start,"UNSAFE_AS_OF");
  return true;
}

/** Acquisition boundary only: no timestamp arguments and no legacy-file receipt backfill.
 * A provider-specific adapter must fetch AND validate target/row identity and history exclusion.
 * This primitive records observation evidence; it does not approve the legacy MLB engine.
 */
export async function collectPregameObservation(target: TargetIdentity, kind: InputKind, destination: string, acquire: () => Promise<Observation>) {
  targetValid(target);const collectedAt=new Date().toISOString();assert.ok(ms(collectedAt)<ms(target.scheduledStart));
  const observation=await acquire();const observedAt=new Date().toISOString();
  assert.equal(observation.kind,kind);assert.ok(Buffer.isBuffer(observation.bytes));
  const bytes=Buffer.from(observation.bytes);
  const receipt:Receipt={schemaVersion:"mlb-pregame-observation-v1",target:{...target},kind,sourceIdentity:observation.sourceIdentity,asOf:observation.asOf,targetExcludedFromHistory:observation.targetExcludedFromHistory,collectedAt,observedAt,sha256:hash(bytes)};
  validatePregameObservation(receipt,bytes,target,new Date().toISOString());
  // Exclusive bundle: partial or late writes remain unusable; never repaired in place.
  const fd=openSync(destination,"wx");
  try{writeFileSync(fd,JSON.stringify({receipt,bytesBase64:bytes.toString('base64')})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  validatePregameObservation(receipt,bytes,target,new Date().toISOString());
  return receipt;
}

/** Read each source exactly once; prediction integration must consume these same buffers. */
export function loadPregameInputBundle(paths: string[], target: TargetIdentity) {
  const executionAt=new Date().toISOString();const inputs=paths.map(path=>{
    const bundle=JSON.parse(readFileSync(path,'utf8'));
    const bytes=Buffer.from(bundle.bytesBase64,'base64');const receipt=bundle.receipt as Receipt;
    validatePregameObservation(receipt,bytes,target,executionAt);return {receipt,bytes};
  });
  assert.deepEqual(inputs.map(i=>i.receipt.kind).sort(),[...REQUIRED_PREGAME_INPUTS].sort(),"REQUIRED_INPUTS_MISSING_OR_DUPLICATED");
  for(const i of inputs)validatePregameObservation(i.receipt,i.bytes,target,new Date().toISOString());
  return {executionAt,inputs};
}
