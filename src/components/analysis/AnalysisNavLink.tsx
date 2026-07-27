"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { buildAnalysisPath } from "@/lib/datetime/games-date";
import EdgeEngineLoader from "@/components/ui/EdgeEngineLoader";
import { cn } from "@/utils/cn";

const MIN_MS = 500;
const MAX_MS = 1000;

function getAnalysisDelayMs(): number {
  return MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));
}

type AnalysisNavLinkProps = {
  gameId: string;
  /** /games 목록 날짜 (YYYY-MM-DD) — 복귀 UX용 */
  fromDate?: string;
  children: ReactNode;
  className?: string;
};

export default function AnalysisNavLink({
  gameId,
  fromDate,
  children,
  className,
}: AnalysisNavLinkProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (isLoading) return;

      setIsLoading(true);
      const path = buildAnalysisPath(gameId, fromDate ?? undefined);
      const delay = getAnalysisDelayMs();

      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        router.push(path);
      }, delay);
    },
    [isLoading, gameId, fromDate, router],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "cursor-pointer text-left disabled:cursor-wait",
          className,
        )}
      >
        {children}
      </button>
      <EdgeEngineLoader open={isLoading} />
    </>
  );
}
