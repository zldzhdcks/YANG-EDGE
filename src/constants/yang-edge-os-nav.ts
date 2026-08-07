/**
 * YANG EDGE OS — internal top navigation (UX only).
 * Does not change research/engine pipelines.
 */

export type OsNavId =
  | "dashboard"
  | "mission"
  | "cto"
  | "data"
  | "research"
  | "engine"
  | "developer"
  | "settings";

export type OsNavItem = {
  id: OsNavId;
  label: string;
  href: string;
  audience: "owner" | "shared" | "developer";
  description: string;
};

export const YANG_EDGE_OS_NAV: OsNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/internal/dashboard",
    audience: "owner",
    description: "오늘 운영 상태를 30초 안에 파악",
  },
  {
    id: "mission",
    label: "Mission Control",
    href: "/internal/mission",
    audience: "owner",
    description: "오늘 해야 할 작업만",
  },
  {
    id: "cto",
    label: "CTO Room",
    href: "/internal/cto",
    audience: "owner",
    description: "주간 운영 보고",
  },
  {
    id: "data",
    label: "Data Center",
    href: "/internal/data",
    audience: "shared",
    description: "종목별 데이터 누적",
  },
  {
    id: "research",
    label: "Research Lab",
    href: "/internal/research",
    audience: "shared",
    description: "연구 파이프라인·복기",
  },
  {
    id: "engine",
    label: "Engine Center",
    href: "/internal/engine",
    audience: "shared",
    description: "엔진 변수 상태 (읽기 전용)",
  },
  {
    id: "developer",
    label: "Developer Console",
    href: "/internal/developer",
    audience: "developer",
    description: "Hash·Artifact·Runtime·로그",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/internal/settings",
    audience: "owner",
    description: "대표 모드·표시 설정",
  },
];

export function osHref(path: string, dateKst: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}date=${encodeURIComponent(dateKst)}`;
}
