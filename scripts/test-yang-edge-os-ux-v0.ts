/**
 * UX-only: YANG EDGE OS natural-language status helpers.
 * Run: npx tsx scripts/test-yang-edge-os-ux-v0.ts
 */
import assert from "node:assert/strict";
import { YANG_EDGE_OS_NAV } from "../src/constants/yang-edge-os-nav";
import { plainLanguageForCode } from "../src/lib/internal/operation-memory-v0/build-operation-memory-view";
import { naturalizePipelineMessage } from "../src/lib/internal/yang-edge-os-presenter";

function main() {
  assert.equal(YANG_EDGE_OS_NAV.length, 8);
  assert.deepEqual(
    YANG_EDGE_OS_NAV.map((n) => n.id),
    [
      "dashboard",
      "mission",
      "cto",
      "data",
      "research",
      "engine",
      "developer",
      "settings",
    ],
  );
  // Decision Center stays inside CTO — no 9th top-nav item
  assert.equal(YANG_EDGE_OS_NAV.length, 8);
  assert.equal(
    YANG_EDGE_OS_NAV.map((n) => n.id as string).includes("decisions"),
    false,
  );

  const starter = naturalizePipelineMessage(
    "Starter",
    "PARTIAL",
    "15 games / 30 probable complete [builder exit 1] hash mismatch",
  );
  assert.match(starter, /Starter 정보는 모두 수집/);
  assert.match(starter, /Prediction에는 사용하지 않습니다/);

  const odds = naturalizePipelineMessage(
    "Odds",
    "PARTIAL",
    "0/15 collected (notCollected≈15)",
  );
  assert.match(odds, /해외 배당을 가져오지 못했습니다/);
  assert.match(odds, /Prediction은 생성하지 않습니다/);

  assert.equal(
    plainLanguageForCode("MULTIPLE_PREGAME_GATES_FAILED").includes(
      "MULTIPLE_PREGAME_GATES_FAILED",
    ),
    false,
  );

  console.log("test:yang-edge-os-ux-v0 OK");
}

main();
