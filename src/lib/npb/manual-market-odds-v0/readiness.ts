/**
 * NPB Pregame Research Readiness — human-readable status (presentation only).
 */
import { loadNpbScheduleGames } from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import { loadNpbStarterResearchOverlay } from "@/lib/npb/manual-starter-intake-v0";
import { loadNpbPregameEvidenceView } from "@/lib/npb/pregame-evidence-snapshot-v0";
import { loadNpbMarketOddsConfirmation } from "./save-intake";
import type { NpbPregameResearchReadiness } from "./types";

export async function loadNpbPregameResearchReadiness(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbPregameResearchReadiness> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;

  const schedule = await loadNpbScheduleGames({ dateKst, cwd });
  const matched = schedule.games.filter((g) => g.joinStatus === "MATCHED");
  const scheduleReady = matched.length;
  const scheduleTotal = Math.max(scheduleReady, 6);

  const starter = await loadNpbStarterResearchOverlay({ dateKst, cwd });
  const oddsDoc = await loadNpbMarketOddsConfirmation({ dateKst, cwd });
  const oddsVerified =
    oddsDoc?.summary.preGameVerifiedGames ??
    oddsDoc?.summary.moneylineVerified ??
    0;
  const oddsTotal = Math.max(matched.length || 6, 6);

  const evidence = await loadNpbPregameEvidenceView({ dateKst, cwd });

  return {
    dateKst,
    schedule: {
      ready: scheduleReady,
      total: scheduleTotal,
      line:
        scheduleReady > 0
          ? `Schedule ${scheduleReady}/${scheduleTotal}`
          : "Schedule MISSING",
    },
    starter: {
      ready: starter.availableStarters,
      total: starter.totalStarterSlots || 12,
      line:
        starter.availableStarters > 0
          ? `Starter ${starter.availableStarters}/${starter.totalStarterSlots || 12} MANUAL VERIFIED`
          : "Starter MISSING",
    },
    marketOdds: {
      ready: oddsVerified,
      total: oddsTotal,
      line:
        oddsVerified > 0
          ? `Market Odds ${oddsVerified}/${oddsTotal} MANUAL VERIFIED`
          : "Market Odds MISSING",
    },
    lineup: {
      ready: 0,
      total: scheduleTotal,
      line: "Lineup NOT RELEASED / MISSING",
    },
    prediction: {
      status: "NOT_AVAILABLE",
      line: "Prediction Engine Not Available",
    },
    evidenceSnapshot: {
      frozen: evidence.frozen,
      status: evidence.snapshotStatus,
      line: evidence.frozen
        ? `Snapshot: FROZEN BEFORE GAME (${evidence.snapshotStatus})`
        : "Snapshot: NOT FROZEN",
      hashShort: evidence.hashShort,
    },
  };
}
