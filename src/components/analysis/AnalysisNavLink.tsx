"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { getAnalysisPath } from "@/types/game";
import EdgeEngineLoader from "@/components/ui/EdgeEngineLoader";
import { cn } from "@/utils/cn";

const MIN_MS = 500;
const MAX_MS = 1000;

function getAnalysisDelayMs(): number {
  return MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));
}

type AnalysisNavLinkProps = {
  gameId: string;
  children: ReactNode;
  className?: string;
};

export default function AnalysisNavLink({
  gameId,
  children,
  className,
}: AnalysisNavLinkProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    const path = getAnalysisPath(gameId);
    const delay = getAnalysisDelayMs();
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      router.push(path);
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoading, gameId, router]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (isLoading) return;
      setIsLoading(true);
    },
    [isLoading],
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
