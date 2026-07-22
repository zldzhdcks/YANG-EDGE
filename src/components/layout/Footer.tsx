import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm font-semibold text-white">YANG EDGE</p>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} YANG EDGE. All rights reserved.
        </p>
        <div className="flex gap-4">
          <Link href="#terms" className="text-xs text-zinc-500 hover:text-zinc-300">
            이용약관
          </Link>
          <Link href="#privacy" className="text-xs text-zinc-500 hover:text-zinc-300">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </footer>
  );
}
