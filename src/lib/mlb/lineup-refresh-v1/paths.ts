import path from "node:path";

export function mlbLineupRefreshDayDir(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, "data", "research", "mlb", "lineup-refresh", dateKst);
}

export function mlbLineupGameRawDir(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return path.join(mlbLineupRefreshDayDir(dateKst, cwd), "raw", String(gamePk));
}

/** Observation directory. Compat name used by tests / builders. */
export function mlbLineupSnapshotDir(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return path.join(mlbLineupGameRawDir(dateKst, gamePk, cwd), "observations");
}

export function mlbLineupPayloadDir(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return path.join(mlbLineupGameRawDir(dateKst, gamePk, cwd), "payloads");
}

export function mlbLineupObservationDir(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return mlbLineupSnapshotDir(dateKst, gamePk, cwd);
}

export function mlbLineupPayloadRel(
  dateKst: string,
  gamePk: number,
  payloadHash: string,
): string {
  return path.posix.join(
    "data/research/mlb/lineup-refresh",
    dateKst,
    "raw",
    String(gamePk),
    "payloads",
    `${payloadHash}.json`,
  );
}

export function mlbLineupObservationRel(
  dateKst: string,
  gamePk: number,
  observationId: string,
): string {
  return path.posix.join(
    "data/research/mlb/lineup-refresh",
    dateKst,
    "raw",
    String(gamePk),
    "observations",
    `${observationId}.json`,
  );
}

export function mlbLineupSnapshotRel(
  dateKst: string,
  gamePk: number,
  observationId: string,
): string {
  return mlbLineupObservationRel(dateKst, gamePk, observationId);
}

export function mlbLineupRefreshManifestRel(dateKst: string): string {
  return path.posix.join(
    "data/research/mlb/lineup-refresh",
    dateKst,
    "manifest-v1.json",
  );
}

export function mlbLineupRefreshManifestAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(mlbLineupRefreshDayDir(dateKst, cwd), "manifest-v1.json");
}

export function mlbBatterPregameDayDir(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, "data", "research", "mlb", "batter-pregame", dateKst);
}

export function mlbBatterPregameGameRel(
  dateKst: string,
  gamePk: number,
): string {
  return path.posix.join(
    "data/research/mlb/batter-pregame",
    dateKst,
    "games",
    `${gamePk}.json`,
  );
}

export function mlbBatterPregameGameAbs(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return path.join(
    mlbBatterPregameDayDir(dateKst, cwd),
    "games",
    `${gamePk}.json`,
  );
}

export function mlbBatterPregameManifestRel(dateKst: string): string {
  return path.posix.join(
    "data/research/mlb/batter-pregame",
    dateKst,
    "manifest-v1.json",
  );
}

export function mlbBatterPregameManifestAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(mlbBatterPregameDayDir(dateKst, cwd), "manifest-v1.json");
}

export function mlbBatterCaptureRel(dateKst: string, gamePk: number): string {
  return mlbBatterPregameGameRel(dateKst, gamePk);
}

export function mlbBatterCaptureAbs(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): string {
  return mlbBatterPregameGameAbs(dateKst, gamePk, cwd);
}

export const mlbBatterCaptureManifestRel = mlbBatterPregameManifestRel;
export const mlbBatterCaptureManifestAbs = mlbBatterPregameManifestAbs;
