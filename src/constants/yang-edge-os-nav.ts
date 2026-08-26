/**
 * YANG EDGE OS — internal navigation (presentation / IA only).
 * Does not change research/engine pipelines.
 *
 * Primary nav is Korean-first (4 items). Legacy English department
 * routes remain as secondary tools and must not be deleted.
 */

export type OsPrimaryNavId = "dashboard" | "daily" | "research" | "admin";

export type OsNavId =
  | OsPrimaryNavId
  | "mission"
  | "cto"
  | "data"
  | "engine"
  | "developer"
  | "settings";

export type OsNavGroup = "ops" | "data" | "system";

export type OsNavItem = {
  id: OsNavId;
  label: string;
  href: string;
  audience: "owner" | "shared" | "developer";
  description: string;
  /** Optional technical subtitle — never the main visible label. */
  technicalSubtitle?: string;
  group?: OsNavGroup;
};

export const YANG_EDGE_OS_PRIMARY_NAV: OsNavItem[] = [
  {
    id: "dashboard",
    label: "대시보드",
    href: "/internal/dashboard",
    audience: "owner",
    description: "오늘 운영을 5초 안에 파악",
  },
  {
    id: "daily",
    label: "오늘 운영",
    href: "/internal/daily",
    audience: "owner",
    description: "오늘 추천·운영 브리핑",
  },
  {
    id: "research",
    label: "연구실",
    href: "/internal/research",
    audience: "shared",
    description: "연구 파이프라인·복기",
  },
  {
    id: "admin",
    label: "관리자 도구",
    href: "/internal/admin",
    audience: "owner",
    description: "작업·데이터·개발 도구",
  },
];

export const YANG_EDGE_OS_SECONDARY_NAV: OsNavItem[] = [
  {
    id: "mission",
    label: "작업 관리",
    href: "/internal/mission",
    audience: "owner",
    description: "오늘 해야 할 작업만",
    technicalSubtitle: "Mission",
    group: "ops",
  },
  {
    id: "cto",
    label: "운영 보고",
    href: "/internal/cto",
    audience: "owner",
    description: "주간 운영 보고",
    technicalSubtitle: "주간 보고",
    group: "ops",
  },
  {
    id: "data",
    label: "데이터 현황",
    href: "/internal/data",
    audience: "shared",
    description: "종목별 데이터 누적",
    technicalSubtitle: "Data",
    group: "data",
  },
  {
    id: "engine",
    label: "엔진 상태",
    href: "/internal/engine",
    audience: "shared",
    description: "엔진 변수 상태 (읽기 전용)",
    technicalSubtitle: "Engine",
    group: "data",
  },
  {
    id: "developer",
    label: "개발자 진단",
    href: "/internal/developer",
    audience: "developer",
    description: "Hash·Artifact·Runtime·로그",
    technicalSubtitle: "Artifact · Hash · Runtime",
    group: "system",
  },
  {
    id: "settings",
    label: "설정",
    href: "/internal/settings",
    audience: "owner",
    description: "대표 모드·표시 설정",
    group: "system",
  },
];

/** All OS destinations (primary + secondary). Not the visible primary menu. */
export const YANG_EDGE_OS_NAV: OsNavItem[] = [
  ...YANG_EDGE_OS_PRIMARY_NAV,
  ...YANG_EDGE_OS_SECONDARY_NAV,
];

export const YANG_EDGE_OS_PRESERVED_ROUTES = [
  "/internal/dashboard",
  "/internal/daily",
  "/internal/research",
  "/internal/admin",
  "/internal/mission",
  "/internal/cto",
  "/internal/data",
  "/internal/engine",
  "/internal/developer",
  "/internal/settings",
] as const;

export const FORBIDDEN_PRIMARY_NAV_LABELS = [
  "Dashboard",
  "Mission Control",
  "CTO Room",
  "Data Center",
  "Research Lab",
  "Engine Center",
  "Developer Console",
  "Settings",
] as const;

export function findOsNavItem(id: OsNavId): OsNavItem | undefined {
  return YANG_EDGE_OS_NAV.find((item) => item.id === id);
}

export function primaryNavIdForActive(active: OsNavId): OsPrimaryNavId {
  if (
    active === "dashboard" ||
    active === "daily" ||
    active === "research" ||
    active === "admin"
  ) {
    return active;
  }
  return "admin";
}

export function osHref(path: string, dateKst: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}date=${encodeURIComponent(dateKst)}`;
}
