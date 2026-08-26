/**
 * Public match analysis loader.
 * Read-only wiring of sealed daily C artifacts. No provider/network calls.
 */

import { isValidKstDateString } from "@/lib/datetime/games-date";
import { getKstToday } from "@/lib/datetime/kst";
import { loadDailyCArtifact } from "./load-daily-c-artifact";
import { loadKboRecentFormForOperatorGame } from "./load-kbo-recent-form";
import { resolveDailyCRowByPublicGameId } from "./game-id-resolver";
import { projectDailyCRowToPublicView } from "./project-daily-c-row";
import {
  projectLegacyResearchToPublicView,
  unresolvedPublicView,
  type PublicAnalysisResolution,
} from "./project-fallbacks";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

export type LoadPublicGameAnalysisResult = {
  view: PublicGameAnalysisViewV1;
  resolution: PublicAnalysisResolution;
};

function preferredDateKst(fromDate: string | null | undefined): string {
  if (fromDate && isValidKstDateString(fromDate)) return fromDate;
  return getKstToday();
}

function normalizePublicGameId(raw: string): string {
  let value = raw.trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value.normalize("NFC");
}

export async function loadPublicGameAnalysis(input: {
  publicGameId: string;
  fromDate?: string | null;
  cwd?: string;
}): Promise<LoadPublicGameAnalysisResult> {
  const publicGameId = normalizePublicGameId(input.publicGameId);
  const dateKst = preferredDateKst(input.fromDate);
  const cwd = input.cwd ?? process.cwd();

  const artifact = await loadDailyCArtifact({ dateKst, cwd });
  if (artifact) {
    const match = resolveDailyCRowByPublicGameId(publicGameId, artifact.games);
    if (!match) {
      return {
        view: unresolvedPublicView(publicGameId, dateKst),
        resolution: {
          matched: false,
          source: "unresolved",
          dateKst,
          operatorGameId: null,
          reason: "NO_DETERMINISTIC_DAILY_C_MATCH",
        },
      };
    }

    const homeTeam = match.row.canonicalHome ?? match.row.rawHome;
    const awayTeam = match.row.canonicalAway ?? match.row.rawAway;
    const recentForm =
      match.row.sport === "KBO"
        ? await loadKboRecentFormForOperatorGame({
            dateKst,
            operatorGameId: match.row.operatorGameId,
            homeTeam,
            awayTeam,
            cwd,
          })
        : null;

    return {
      view: projectDailyCRowToPublicView({
        publicGameId,
        dateKst,
        row: match.row,
        recentForm,
        updatedAt: match.row.marketBenchmark.observedAt,
      }),
      resolution: {
        matched: true,
        source: "daily-c",
        dateKst,
        operatorGameId: match.row.operatorGameId,
        reason: "EXACT_PUBLIC_GAME_ID",
      },
    };
  }

  try {
    const { loadResearchAnalysisView } = await import(
      "@/lib/research/load-research-analysis-view"
    );
    const research = await loadResearchAnalysisView(publicGameId);
    return {
      view: projectLegacyResearchToPublicView({
        publicGameId,
        dateKst,
        research,
      }),
      resolution: {
        matched: research.gameInfo.availability === "COLLECTED",
        source: "legacy-research",
        dateKst: research.gameInfo.dateKst,
        operatorGameId: null,
        reason: "NO_DAILY_C_ARTIFACT_LEGACY_PROJECTION",
      },
    };
  } catch {
    return {
      view: unresolvedPublicView(publicGameId, dateKst),
      resolution: {
        matched: false,
        source: "unresolved",
        dateKst,
        operatorGameId: null,
        reason: "LEGACY_PROJECTION_FAILED",
      },
    };
  }
}
