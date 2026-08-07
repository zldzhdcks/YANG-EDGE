"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "yang-edge-owner-mode";
const ADVANCED_KEY = "yang-edge-show-advanced";

export function useOwnerMode() {
  const [ownerMode, setOwnerMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const o = localStorage.getItem(STORAGE_KEY);
      const a = localStorage.getItem(ADVANCED_KEY);
      if (o === "0") setOwnerMode(false);
      if (a === "1") setShowAdvanced(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggleOwner(next: boolean) {
    setOwnerMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleAdvanced(next: boolean) {
    setShowAdvanced(next);
    try {
      localStorage.setItem(ADVANCED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return { ownerMode, showAdvanced, ready, toggleOwner, toggleAdvanced };
}

/** Hides hash/artifact/runtime jargon unless advanced is on (owner mode). */
export function AdvancedDisclosure({
  children,
  title = "고급 정보",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { ownerMode, showAdvanced, ready, toggleAdvanced } = useOwnerMode();

  if (!ready) return null;

  if (!ownerMode) {
    return <div className="space-y-3">{children}</div>;
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => toggleAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-400 hover:text-zinc-200"
      >
        <span>{title}</span>
        <span className="text-xs text-zinc-600">
          {showAdvanced ? "숨기기" : "개발자용 · 펼치기"}
        </span>
      </button>
      {showAdvanced ? (
        <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function OwnerModeControls() {
  const { ownerMode, ready, toggleOwner } = useOwnerMode();
  if (!ready) return null;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
      <input
        type="checkbox"
        checked={ownerMode}
        onChange={(e) => toggleOwner(e.target.checked)}
        className="rounded border-zinc-600"
      />
      대표 모드 (기술 용어 숨김)
    </label>
  );
}
