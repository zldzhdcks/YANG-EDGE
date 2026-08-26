import {
  YANG_EDGE_OS_PRIMARY_NAV,
  findOsNavItem,
  osHref,
  primaryNavIdForActive,
  type OsNavId,
} from "@/constants/yang-edge-os-nav";
import { OwnerModeControls } from "./OwnerMode";

type Props = {
  active: OsNavId;
  dateKst: string;
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export default function OsShell({
  active,
  dateKst,
  children,
  title,
  subtitle,
}: Props) {
  const primaryActive = primaryNavIdForActive(active);
  const secondary = primaryActive === "admin" ? findOsNavItem(active) : undefined;
  const showAdminCrumb = Boolean(secondary && secondary.id !== "admin");

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-white">
                YANG EDGE OS
              </span>
              <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                관리자
              </span>
            </div>
            <p className="text-xs text-zinc-500">YANG EDGE 운영·연구 관리</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-zinc-200">{dateKst}</div>
              <div className="text-[10px] text-zinc-600">
                한국시간
                <span className="ml-1 text-zinc-700">KST</span>
              </div>
            </div>
            <OwnerModeControls />
          </div>
        </div>
        <nav
          className="mx-auto max-w-6xl px-4 sm:px-6"
          aria-label="주요 메뉴"
        >
          <ul className="grid grid-cols-2 gap-1 pb-2 sm:grid-cols-4">
            {YANG_EDGE_OS_PRIMARY_NAV.map((item) => {
              const isActive = item.id === primaryActive;
              return (
                <li key={item.id}>
                  <a
                    href={osHref(item.href, dateKst)}
                    className={`block rounded-md px-3 py-2 text-center text-sm font-medium transition-colors sm:py-1.5 ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                    title={item.description}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          {showAdminCrumb && secondary ? (
            <p className="mb-1 text-xs text-zinc-500">
              <a
                href={osHref("/internal/admin", dateKst)}
                className="text-sky-400 hover:underline"
              >
                관리자 도구
              </a>
              <span className="mx-1 text-zinc-600">/</span>
              <span>{secondary.label}</span>
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
