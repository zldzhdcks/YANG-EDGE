import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ResearchTargetGame } from "../daily-scope-lock";
import { canonical, readEnvelope, time, sha } from "./evidence";
import { resolveExactPregameIdentity, assertOneToOneBindings } from "../../betman/daily-slate/exact-pregame-identity";

export type PredictionReference = { kind: "FOOTBALL_FORWARD_V1"; fixtureId: number; snapshotHash: string; scopeSha256: string; identityEvidenceHash?: string };
/** Only the existing immutable Forward v1 format is admitted. No engine import. */
export function validatePredictionReference(cwd: string, target: ResearchTargetGame, scopeHash: string, ref: PredictionReference, createdAt: string) {
  const keys = ["kind", "fixtureId", "snapshotHash", "scopeSha256", ...(ref.identityEvidenceHash === undefined ? [] : ["identityEvidenceHash"])];
  assert.equal(canonical(Object.keys(ref).sort()), canonical(keys.sort()), "UNSUPPORTED_REFERENCE_FIELDS");
  assert.equal(ref.kind, "FOOTBALL_FORWARD_V1"); assert.equal(ref.scopeSha256, scopeHash);
  assert.ok(Number.isSafeInteger(ref.fixtureId) && ref.fixtureId > 0);
  assert.equal(target.sport, "SOCCER");
  if (ref.identityEvidenceHash === undefined) assert.equal(target.providerFixtureId, String(ref.fixtureId));
  const dir = join(cwd, "data/cache/research/football/forward-shadow-v1/MODEL_FORWARD/fixtures", String(ref.fixtureId));
  for (const name of ["invalid.json", "miss.json", "first-seen-after-kickoff.json"]) assert.ok(!existsSync(join(dir, name)), "INVALID_FORWARD_SEAL");
  const s = readEnvelope(join(dir, "snapshot.json"));
  const r = readEnvelope(join(dir, "seal-receipt.json")).payload;
  const input = readEnvelope(join(dir, "input.json"));
  const p = s.payload;
  assert.equal(s.sha256, ref.snapshotHash); assert.equal(r.snapshotHash, s.sha256);
  assert.equal(input.sha256, p.inputSnapshotHash); assert.equal(r.validPregame, true);
  assert.equal(p.layer, "MODEL_FORWARD"); assert.equal(p.fixtureId, ref.fixtureId); assert.equal(r.fixtureId, ref.fixtureId);
  assert.equal(p.status, "PREDICTED"); assert.equal(p.modelVersion, "football-poisson-research-v1");
  assert.equal(p.modelSourceHash, "6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf");
  // Exact identity only. Korean aliases require a separately reviewed bridge; never fuzzy match.
  if (ref.identityEvidenceHash !== undefined) {
    const bridgeDir = join(cwd,"data/research/football/operator-identity-bridges",scopeHash);
    const e=readEnvelope(join(bridgeDir,`${sha(target.targetId)}.json`));
    assert.equal(e.sha256,ref.identityEvidenceHash);
    assert.deepEqual(Object.keys(e.payload).sort(),["binding","sourceUtf8"].sort());
    const bindings=readdirSync(bridgeDir).filter(n=>n.endsWith('.json')).map(n=>readEnvelope(join(bridgeDir,n)).payload.binding);
    assertOneToOneBindings(bindings);
    const identity=resolveExactPregameIdentity(target,scopeHash,e.payload.binding,Buffer.from(e.payload.sourceUtf8,'utf8'),p.predictionCreatedAt);
    assert.ok(time(identity.observedAt)<=time(p.cutoffAt),"IDENTITY_AFTER_INPUT_CUTOFF");
    assert.equal(identity.fixtureId,ref.fixtureId);assert.equal(identity.leagueId,p.leagueId);
    assert.equal(identity.homeTeamId,p.homeTeam.id);assert.equal(identity.awayTeamId,p.awayTeam.id);
    assert.equal(identity.homeTeamName,p.homeTeam.name);assert.equal(identity.awayTeamName,p.awayTeam.name);
  } else {
    assert.equal(p.homeTeam.name, target.homeTeamRaw); assert.equal(p.awayTeam.name, target.awayTeamRaw);
    const leagues: Record<string, number> = { EPL: 39, "La Liga": 140, "Serie A": 135, Bundesliga: 78 };
    assert.equal(leagues[target.competitionNameRaw ?? ""], p.leagueId); assert.ok(p.leagueId);
  }
  const start = time(target.scheduledStartTimeKst!);
  assert.equal(time(p.kickoffUtc), start);
  assert.ok(time(p.cutoffAt) <= time(p.predictionCreatedAt));
  assert.ok(time(p.predictionCreatedAt) <= time(r.sealedAt) && time(r.sealedAt) <= time(createdAt));
  assert.ok(time(createdAt) < start && time(r.sealedAt) < start, "PREGAME_WINDOW_MISSED");
  assert.equal(input.payload.target.matchId, `API_FOOTBALL:${ref.fixtureId}`);
  assert.equal(input.payload.target.homeTeamId, String(p.homeTeam.id)); assert.equal(input.payload.target.awayTeamId, String(p.awayTeam.id));
  assert.equal(input.payload.target.competitionId, String(p.leagueId)); assert.equal(time(input.payload.target.kickoffAt), start);
  for (const key of ["TARGET_RESULT_DATA_USED", "ODDS_USED", "MARKET_USED", "PROVIDER_PREDICTION_USED", "OWNER_SHADOW_USED", "EXTERNAL_SHADOW_USED"]) assert.equal(p[key], false);
  for (const key of ["actualScore", "actualClass", "result"]) assert.ok(!(key in p));
  const probabilities = [p.pHome, p.pDraw, p.pAway];
  assert.ok(probabilities.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1));
  assert.ok(Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(p.predictedClass, ["HOME", "DRAW", "AWAY"][probabilities.indexOf(Math.max(...probabilities))]);
}
