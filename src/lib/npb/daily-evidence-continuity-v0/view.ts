import {
  assessNpbDailyEvidenceDay,
  assessRecentNpbDailyEvidenceDays,
} from "./assess-day";
import { discoverNpbOpsDates, shortDateLabel } from "./discover-dates";
import type { NpbDailyOpsViewV0 } from "./types";

export async function loadNpbDailyOpsView(input: {
  dateKst: string;
  cwd?: string;
  asOf?: string;
}): Promise<NpbDailyOpsViewV0> {
  const dates = await discoverNpbOpsDates({
    focusDateKst: input.dateKst,
    cwd: input.cwd,
    neighborSpan: 1,
  });
  const recent = await assessRecentNpbDailyEvidenceDays({
    dates,
    cwd: input.cwd,
    asOf: input.asOf,
  });
  const day =
    recent.find((d) => d.dateKst === input.dateKst) ??
    (await assessNpbDailyEvidenceDay(input));

  const operatorLines = [
    `NPB DAILY OPS · ${day.dateKst}`,
    `Schedule      ${day.schedule.display}`,
    `Starter       ${day.starter.display}`,
    `Odds          ${day.odds.display}`,
    `Lineup        ${day.lineup.display}`,
    `Evidence      ${day.evidence.display}`,
    `Results       ${day.results.display}`,
    `Status:       ${day.lifecycle}`,
    `Prediction Engine  ${day.prediction.engine}`,
    `Prediction Accuracy  ${day.prediction.accuracy}`,
    `Good Picks  ${day.prediction.goodPicks}`,
  ];
  if (day.marketBaseline) {
    operatorLines.splice(
      7,
      0,
      `Market Baseline  ${day.marketBaseline.display}`,
    );
  }
  if (day.continuity.alert) {
    operatorLines.push(`ALERT: ${day.continuity.alert}`);
  }
  if (day.evidence.hashShort) {
    operatorLines.push(`Hash: ${day.evidence.hashShort}`);
  }

  return {
    dateKst: input.dateKst,
    day,
    recentDays: recent.map((d) => ({
      dateKst: d.dateKst,
      shortDate: shortDateLabel(d.dateKst),
      lifecycle: d.lifecycle,
    })),
    operatorLines,
  };
}
