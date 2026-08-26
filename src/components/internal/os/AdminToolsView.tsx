import {
  YANG_EDGE_OS_SECONDARY_NAV,
  osHref,
  type OsNavGroup,
  type OsNavItem,
} from "@/constants/yang-edge-os-nav";
import type { ReleaseChecklistView } from "@/lib/internal/release-checklist-v0";
import ReleaseStatusCard from "./ReleaseStatusCard";

const GROUPS: { id: OsNavGroup; title: string }[] = [
  { id: "ops", title: "운영 관리" },
  { id: "data", title: "데이터·연구 관리" },
  { id: "system", title: "개발·시스템" },
];

function ToolCard({ item, dateKst }: { item: OsNavItem; dateKst: string }) {
  return (
    <a
      href={osHref(item.href, dateKst)}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
    >
      <h3 className="text-base font-semibold text-white">{item.label}</h3>
      {item.technicalSubtitle ? (
        <p className="mt-0.5 text-[11px] text-zinc-600">{item.technicalSubtitle}</p>
      ) : null}
      <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
    </a>
  );
}

export default function AdminToolsView({
  dateKst,
  release,
}: {
  dateKst: string;
  release: ReleaseChecklistView;
}) {
  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const items = YANG_EDGE_OS_SECONDARY_NAV.filter((n) => n.group === group.id);
        return (
          <section key={group.id}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-400">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <ToolCard key={item.id} item={item} dateKst={dateKst} />
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-400">
          제품 준비 현황
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          출시 준비도와 오늘 운영 완료율은 다른 개념입니다. 아래 수치는 Private
          Beta 체크리스트 기준이며, 당일 필수 운영 완료율(60%)이 아닙니다.
        </p>
        <ReleaseStatusCard release={release} />
      </section>
    </div>
  );
}
