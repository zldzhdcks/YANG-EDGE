import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { admitResearchTargetScopeSource, assertExplicitDateKst, isResearchTargetScopeLockDocument, operatorBetmanDailySlateRel, researchTargetScopeLockRel, sortTargetsDeterministic } from "../daily-scope-lock";

export const canonical = (v: unknown): string => JSON.stringify(v, function (_key, value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value;
});
export const sha = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
export const time = (v: string) => { assert.equal(typeof v, "string"); assert.match(v, /(?:Z|[+-]\d{2}:\d{2})$/); const n = Date.parse(v); assert.ok(Number.isFinite(n), "INVALID_TIME"); return n; };
export function envelope<T>(payload: T) { return { payload, sha256: sha(canonical(payload)) }; }
export function readEnvelope(file: string) {
  const e = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(e.sha256, sha(canonical(e.payload)), "ENVELOPE_HASH_MISMATCH");
  return e;
}

/** Read-only authority chain. Never creates or repairs human verification. */
export function loadScope(cwd: string, dateKst: string) {
  assertExplicitDateKst(dateKst);
  const raw = readFileSync(join(cwd, researchTargetScopeLockRel(dateKst)), "utf8");
  const doc = JSON.parse(raw);
  assert.ok(isResearchTargetScopeLockDocument(doc), "INVALID_SCOPE_SCHEMA");
  assert.equal(doc.dateKst, dateKst); assert.equal(doc.lockStatus, "LOCKED");
  assert.equal(doc.officialDenominator, doc.targets.length); assert.equal(doc.targetCount, doc.targets.length);
  assert.equal(new Set(doc.targets.map(t => t.targetId)).size, doc.targets.length, "DUPLICATE_LOCKED_TARGET");
  const admitted = admitResearchTargetScopeSource({ cwd, dateKst });
  assert.equal(admitted.kind, "OK", "NO_FROZEN_SOURCE");
  if (admitted.kind !== "OK") throw Error("NO_FROZEN_SOURCE");
  assert.equal(doc.source.sha256, admitted.payload.sha256); assert.equal(doc.source.rel, admitted.payload.rel);
  // The existing admission contract calls this a committed source; enforce that here.
  // Local Git object read only: no fetch, index mutation or commit.
  const committedSource = execFileSync("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, "show", `HEAD:${admitted.payload.rel}`], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(sha(committedSource), admitted.payload.sha256, "FROZEN_SOURCE_NOT_COMMITTED_AT_HEAD");
  assert.equal(canonical(doc.targets), canonical(sortTargetsDeterministic(admitted.payload.targets)));
  const freeze = JSON.parse(admitted.payload.rawText);
  const operatorRaw = readFileSync(join(cwd, operatorBetmanDailySlateRel(dateKst)), "utf8");
  const operator = JSON.parse(operatorRaw);
  assert.equal(freeze.source.rel, operatorBetmanDailySlateRel(dateKst));
  assert.equal(freeze.source.sha256, sha(operatorRaw));
  assert.equal(operator.schemaVersion, "betman-daily-slate-v1"); assert.equal(operator.targetDateKst, dateKst);
  assert.equal(operator.sourceType, "OPERATOR_MANUAL"); assert.equal(operator.reviewStatus, "VERIFIED");
  assert.equal(operator.scopeCompletenessStatus, "COMPLETE");
  assert.equal(freeze.source.reviewedAt, operator.reviewedAt);
  assert.ok(time(operator.reviewedAt) <= time(freeze.frozenAt));
  assert.ok(time(freeze.frozenAt) <= time(doc.scopeLockedAt));
  assert.equal(doc.createdAt, doc.scopeLockedAt);
  assert.equal(freeze.sourceGameCount, operator.games.length); assert.equal(freeze.games.length, operator.games.length);
  assert.equal(new Set(operator.games.map((g: any) => g.operatorSlateGameId)).size, operator.games.length);
  for (const g of operator.games) {
    assert.equal(g.reviewStatus, "VERIFIED"); assert.equal(g.operatorHomeAwayStatus, "VERIFIED");
    assert.ok(g.operatorSlateGameId?.trim() && g.homeTeamRaw?.trim() && g.awayTeamRaw?.trim());
    assert.notEqual(g.homeTeamRaw, g.awayTeamRaw);
    assert.equal(new Date(time(g.scheduledStartTimeKst) + 9 * 3600000).toISOString().slice(0, 10), dateKst);
    const f = freeze.games.find((x: any) => x.operatorSlateGameId === g.operatorSlateGameId);
    assert.ok(f);
    for (const key of Object.keys(f)) assert.equal(f[key], g[key] ?? null, `SOURCE_PROJECTION_MISMATCH:${key}`);
  }
  assert.equal(doc.scopeLockStatus, doc.targets.length ? "COMPLETE" : "EMPTY_ADMISSIBLE");
  return { doc, hash: sha(raw) };
}
