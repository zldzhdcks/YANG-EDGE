import {
  YANG_EDGE_OS_NAV,
  osHref,
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
                INTERNAL
              </span>
            </div>
            <p className="text-xs text-zinc-500">운영 플랫폼 · 연구 엔진은 변경하지 않음</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-zinc-200">{dateKst}</div>
              <div className="text-[10px] text-zinc-600">KST</div>
            </div>
            <OwnerModeControls />
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex min-w-max gap-1 pb-2">
            {YANG_EDGE_OS_NAV.map((item) => {
              const isActive = item.id === active;
              return (
                <li key={item.id}>
                  <a
                    href={osHref(item.href, dateKst)}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : item.audience === "developer"
                          ? "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
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
