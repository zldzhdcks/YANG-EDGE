import Link from "next/link";
import {
  LEGAL_NOTICE_ITEMS,
  LEGAL_NOTICE_TITLE,
} from "@/constants/prototype";
import { FOOTER_NAV_ITEMS } from "@/constants/navigation";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 sm:px-5 sm:py-6">
          <h2 className="text-xs font-medium tracking-wide text-zinc-500">
            {LEGAL_NOTICE_TITLE}
          </h2>
          <ul className="mt-3 space-y-1.5 sm:space-y-1">
            {LEGAL_NOTICE_ITEMS.map((item) => (
              <li
                key={item}
                className="text-[11px] leading-relaxed text-zinc-600 sm:text-xs"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm font-semibold text-white">YANG EDGE</p>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} YANG EDGE. All rights reserved.
        </p>
        <nav
          aria-label="부가 메뉴"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-zinc-600"
        >
          {FOOTER_NAV_ITEMS.map((item, index) => (
            <span key={item.href} className="inline-flex items-center gap-3">
              {index > 0 ? (
                <span aria-hidden className="text-zinc-700">
                  ·
                </span>
              ) : null}
              <Link
                href={item.href}
                className="hover:text-zinc-400 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                {item.label}
              </Link>
            </span>
          ))}
          <span aria-hidden className="text-zinc-700">
            ·
          </span>
          <span title="페이지 준비 중">이용약관 (준비 중)</span>
          <span aria-hidden className="text-zinc-700">
            ·
          </span>
          <span title="페이지 준비 중">개인정보처리방침 (준비 중)</span>
        </nav>
      </div>
    </footer>
  );
}
