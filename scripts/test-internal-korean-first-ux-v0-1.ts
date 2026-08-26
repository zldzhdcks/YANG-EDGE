/**
 * Internal OS Korean-first UX / IA v0.1A.
 * Presentation only — no provider, engine, prediction, or artifact writes.
 * Run: npm run test:internal-korean-first-ux-v0-1
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FORBIDDEN_PRIMARY_NAV_LABELS,
  YANG_EDGE_OS_NAV,
  YANG_EDGE_OS_PRESERVED_ROUTES,
  YANG_EDGE_OS_PRIMARY_NAV,
  YANG_EDGE_OS_SECONDARY_NAV,
  primaryNavIdForActive,
} from "../src/constants/yang-edge-os-nav";
import {
  KOREAN_STATUS_DISPLAY,
  koreanStatusLabel,
} from "../src/lib/internal/korean-status-display";

const ROOT = process.cwd();

function readSrc(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function main() {
  assert.equal(YANG_EDGE_OS_PRIMARY_NAV.length, 4);
  assert.deepEqual(
    YANG_EDGE_OS_PRIMARY_NAV.map((n) => n.label),
    ["대시보드", "오늘 운영", "연구실", "관리자 도구"],
  );
  assert.deepEqual(
    YANG_EDGE_OS_PRIMARY_NAV.map((n) => n.href),
    [
      "/internal/dashboard",
      "/internal/daily",
      "/internal/research",
      "/internal/admin",
    ],
  );

  const primaryLabels = YANG_EDGE_OS_PRIMARY_NAV.map((n) => n.label);
  for (const forbidden of FORBIDDEN_PRIMARY_NAV_LABELS) {
    assert.equal(
      primaryLabels.includes(forbidden),
      false,
      `primary nav must not show ${forbidden}`,
    );
  }

  for (const href of YANG_EDGE_OS_PRESERVED_ROUTES) {
    assert.ok(
      YANG_EDGE_OS_NAV.some((n) => n.href === href),
      `preserved route missing from catalog: ${href}`,
    );
  }

  const secondaryHrefs = YANG_EDGE_OS_SECONDARY_NAV.map((n) => n.href);
  for (const href of [
    "/internal/mission",
    "/internal/cto",
    "/internal/data",
    "/internal/engine",
    "/internal/developer",
    "/internal/settings",
  ]) {
    assert.ok(secondaryHrefs.includes(href), `secondary route missing: ${href}`);
  }

  assert.equal(primaryNavIdForActive("mission"), "admin");
  assert.equal(primaryNavIdForActive("developer"), "admin");
  assert.equal(primaryNavIdForActive("daily"), "daily");

  const rawEnum = "IN_PROGRESS";
  assert.equal(koreanStatusLabel(rawEnum), "진행 중");
  assert.equal(rawEnum, "IN_PROGRESS");
  assert.equal(KOREAN_STATUS_DISPLAY.NOT_STARTED, "시작 전");
  assert.equal(KOREAN_STATUS_DISPLAY.READY, "준비 완료");
  assert.equal(KOREAN_STATUS_DISPLAY.DONE, "완료");
  assert.equal(KOREAN_STATUS_DISPLAY.BLOCKED, "차단됨");
  assert.equal(KOREAN_STATUS_DISPLAY.WARNING, "확인 필요");
  assert.equal(KOREAN_STATUS_DISPLAY.OPEN, "확인 필요");
  assert.equal(KOREAN_STATUS_DISPLAY.APPROVED, "승인됨");
  assert.equal(KOREAN_STATUS_DISPLAY.PARTIAL, "일부 완료");
  assert.equal(KOREAN_STATUS_DISPLAY.WAITING, "대기 중");
  assert.equal(KOREAN_STATUS_DISPLAY.NOT_AVAILABLE, "현재 사용 불가");
  assert.equal(KOREAN_STATUS_DISPLAY.NOT_COLLECTED, "미수집");
  assert.equal(KOREAN_STATUS_DISPLAY.AWAITING_RESULT, "결과 대기");
  assert.equal(KOREAN_STATUS_DISPLAY.OPS_FAILURE, "운영 오류");
  assert.equal(KOREAN_STATUS_DISPLAY.NO_PREGAME_SNAPSHOT, "사전 스냅샷 없음");
  assert.equal(koreanStatusLabel("오늘 확인이 필요한 항목이 있습니다"), "오늘 확인이 필요한 항목이 있습니다");

  const dashboard = readSrc("src/components/internal/os/DashboardView.tsx");
  assert.match(dashboard, /오늘 운영 현황/);
  assert.match(dashboard, /지금 해야 할 일/);
  assert.match(dashboard, /주의가 필요한 항목/);
  assert.match(dashboard, /대표 승인 필요/);
  assert.match(dashboard, /오늘 기억 · 결정 기록/);
  assert.match(dashboard, /MLB 오늘 운영/);
  assert.match(dashboard, /연구 데이터 준비도/);
  assert.match(dashboard, /예측 신뢰도가 아닙니다/);
  assert.equal(dashboard.includes("ReleaseStatusCard"), false);
  assert.equal(dashboard.includes("TODAY MLB OPS"), false);
  assert.match(dashboard, /필수 운영 완료율\(60%\)과 다름/);
  assert.match(dashboard, /개발자 진단/);
  assert.match(dashboard, /AdvancedDisclosure/);

  const dashboardPage = readSrc("src/app/internal/dashboard/page.tsx");
  assert.match(
    dashboardPage,
    /일부 운영 정보를 불러오지 못했습니다[\s\S]*관리자 도구의 개발자 진단/,
  );
  assert.equal(dashboardPage.includes("Developer Console"), false);
  assert.equal(dashboardPage.includes("loadReleaseChecklistV0"), false);

  const adminPage = readSrc("src/app/internal/admin/page.tsx");
  assert.match(adminPage, /관리자 도구/);
  assert.ok(existsSync(path.join(ROOT, "src/app/internal/admin/page.tsx")));
  const adminView = readSrc("src/components/internal/os/AdminToolsView.tsx");
  assert.match(adminView, /운영 관리/);
  assert.match(adminView, /데이터·연구 관리/);
  assert.match(adminView, /개발·시스템/);
  assert.deepEqual(
    YANG_EDGE_OS_SECONDARY_NAV.filter((n) => n.group === "ops").map((n) => n.label),
    ["작업 관리", "운영 보고"],
  );
  assert.deepEqual(
    YANG_EDGE_OS_SECONDARY_NAV.filter((n) => n.group === "data").map((n) => n.label),
    ["데이터 현황", "엔진 상태"],
  );
  assert.equal(
    YANG_EDGE_OS_SECONDARY_NAV.find((n) => n.id === "developer")?.label,
    "개발자 진단",
  );
  assert.equal(
    YANG_EDGE_OS_SECONDARY_NAV.find((n) => n.id === "developer")?.technicalSubtitle,
    "Artifact · Hash · Runtime",
  );
  assert.match(adminView, /제품 준비 현황/);
  assert.match(adminView, /ReleaseStatusCard/);
  assert.match(adminView, /당일 필수 운영 완료율\(60%\)이 아닙니다/);
  assert.equal(adminView.includes("Developer Console"), false);

  const shell = readSrc("src/components/internal/os/OsShell.tsx");
  assert.match(shell, /YANG_EDGE_OS_PRIMARY_NAV/);
  assert.equal(shell.includes("YANG_EDGE_OS_NAV.map"), false);
  assert.match(shell, /관리자/);
  assert.equal(shell.includes("INTERNAL"), false);
  assert.match(shell, /YANG EDGE 운영·연구 관리/);
  assert.match(shell, /한국시간/);
  assert.match(shell, /grid-cols-2/);

  for (const rel of [
    "src/app/internal/mission/page.tsx",
    "src/app/internal/cto/page.tsx",
    "src/app/internal/data/page.tsx",
    "src/app/internal/engine/page.tsx",
    "src/app/internal/developer/page.tsx",
    "src/app/internal/settings/page.tsx",
  ]) {
    assert.ok(existsSync(path.join(ROOT, rel)), `route page missing: ${rel}`);
  }

  const analysis = readSrc("src/app/analysis/[gameId]/page.tsx");
  assert.match(analysis, /PublicAnalysisViewer/);
  assert.equal(analysis.includes("ResearchAnalysisViewer"), false);
  assert.equal(analysis.includes("SampleAnalysisNotice"), false);

  const internalGame = readSrc("src/app/internal/research/game/[gameId]/page.tsx");
  assert.match(internalGame, /ResearchAnalysisViewer/);
  assert.match(internalGame, /OsShell/);

  const forbiddenResearchTouch = [
    "data/audits/2026-08-26-daily-scope-lock-v1.json",
    "data/audits/2026-08-26-pregame-prediction-snapshot-v1.json",
    "data/audits/2026-08-26-prediction-pass-reconciliation-v1.json",
  ];
  for (const rel of forbiddenResearchTouch) {
    assert.ok(existsSync(path.join(ROOT, rel)));
  }

  console.log("test:internal-korean-first-ux-v0-1 OK", {
    primary: YANG_EDGE_OS_PRIMARY_NAV.map((n) => n.label),
    secondary: YANG_EDGE_OS_SECONDARY_NAV.length,
    providerCalls: 0,
  });
}

main();
