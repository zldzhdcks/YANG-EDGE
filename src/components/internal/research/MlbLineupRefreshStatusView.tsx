import type { LineupRefreshManifestV1 } from "@/lib/mlb/lineup-refresh-v1";

function phaseLabel(
  phase: "PRE_GAME" | "POST_GAME_OR_LATE" | "UNKNOWN" | null,
): string {
  if (phase === "POST_GAME_OR_LATE") return "POST_CUTOFF / LATE";
  return phase ?? "—";
}

export default function MlbLineupRefreshStatusView(props: {
  dateKst: string;
  manifest: LineupRefreshManifestV1 | null;
}) {
  const m = props.manifest;
  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-400">
        Normal path:{" "}
        <code className="text-zinc-200">
          npm run ops:mlb-lineup-refresh -- {props.dateKst}
        </code>
        . Read-only here. Does not call Provider. Does not run Prediction.
      </p>
      {!m ? (
        <p className="text-sm text-amber-200">
          No lineup refresh manifest yet for {props.dateKst}.
        </p>
      ) : (
        <>
          <div className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
            <p>Games total: {m.summary.scheduleGames}</p>
            <p>Pregame eligible: {m.summary.gamesBeforeCutoff}</p>
            <p>Cutoff passed: {m.summary.gamesAfterCutoff}</p>
            <p>Confirmed: {m.summary.confirmedGames}</p>
            <p>Partial: {m.summary.partialGames}</p>
            <p>Not released: {m.summary.notReleasedGames}</p>
            <p>Unknown temporal: {m.summary.unknownTemporalStates}</p>
            <p>Provider calls: {m.summary.providerCalls}</p>
            <p>Observations written: {m.summary.observationsWritten}</p>
            <p>Identical-payload observations: {m.summary.identicalPayloadObservations}</p>
            <p>Unique payloads: {m.summary.uniquePayloadCount}</p>
            <p>Exact observation retries skipped: {m.summary.idempotentExactDuplicateSkips}</p>
            <p>Batter captures written: {m.summary.batterCapturesWritten}</p>
            <p>Batter capture existing skips: {m.summary.batterCaptureExistingSkips}</p>
            <p>Batter capture complete: {m.summary.gamesWithBatterCaptureComplete}</p>
            <p>Skipped sealed: {m.summary.skippedAlreadySealedGames}</p>
            <p>Latest refresh: {m.generatedAt}</p>
            <p>Blocked: {m.summary.blockedGames}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-zinc-300">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">gamePk</th>
                  <th className="py-2 pr-3">Phase</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Player IDs</th>
                  <th className="py-2 pr-3">Capture</th>
                  <th className="py-2 pr-3">Why / blocker</th>
                </tr>
              </thead>
              <tbody>
                {m.games.map((g) => (
                  <tr key={g.gamePk} className="border-t border-zinc-800">
                    <td className="py-2 pr-3 font-mono">{g.gamePk}</td>
                    <td className="py-2 pr-3">
                      {phaseLabel(g.selected.collectionPhase)}
                    </td>
                    <td className="py-2 pr-3">
                      {g.selected.collectionStatus ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{g.selected.playerIdCount}</td>
                    <td className="py-2 pr-3">{g.batterCapture}</td>
                    <td className="py-2 pr-3">
                      {g.selected.blocker ?? g.selected.why}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
