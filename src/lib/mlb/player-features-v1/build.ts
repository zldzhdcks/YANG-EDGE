import {
  DEFERRED_FEATURES_V1,
  FEATURE_CATALOG_V1,
} from "./catalog";
import { hashPlayerFeatureDataset } from "./hash";
import {
  loadGameIdentity,
  loadScheduleGames,
  loadStarterIdentityRows,
  type PlayerFeatureSources,
} from "./identity";
import {
  batsFromPersonPayload,
  buildHittingWindow,
  buildStarterSeason,
  emptyStarterSeason,
  emptyWindow,
  parsePlatoonSplits,
  selectedPlatoonSplit,
  throwsFromPerson,
} from "./parse";
import { mlbPlayerFeaturesDatasetRel } from "./paths";
import { createPlayerFeatureProvider } from "./provider";
import { mlbScheduleRel, mlbStarterRel } from "../research-scorecard-v1/paths";
import {
  isPostCutoff,
  preGameSafeAllowed,
  statsThroughDateForGame,
} from "./temporal";
import {
  PLAYER_FEATURES_BUILDER_VERSION,
  PLAYER_FEATURES_DATASET_ID,
  PLAYER_FEATURES_SCHEMA_VERSION,
  PLAYER_FEATURES_TEMPORAL_POLICY,
  type BatterFeatureRow,
  type FeatureGameStatus,
  type FeatureWindow,
  type GameIdentity,
  type HandCode,
  type IdentityBatter,
  type IdentityPitcher,
  type PlayerFeatureDatasetDocument,
  type PlayerFeatureGame,
  type PlayerFeatureStatLookup,
  type ProvenanceClass,
  type RowProvenance,
  type ScheduleGameLite,
  type SideFeatureBlock,
  type StarterFeatureRow,
  type TeamSide,
} from "./types";

export type BuildPlayerFeaturesInput = {
  dateKst: string;
  cwd?: string;
  nowMs?: number;
  generatedAt?: string;
  dryRun?: boolean;
  cacheOnly?: boolean;
  gamePk?: number;
  sources?: PlayerFeatureSources;
  lookup?: PlayerFeatureStatLookup;
};

export type BuildPlayerFeaturesResult = {
  document: PlayerFeatureDatasetDocument;
  featureFetchAttempts: number;
  networkCalls: number;
};

function emptyProvenance(input: {
  queryFamily: string;
  statsWindowEndDate: string;
  gameCutoff: string;
  suppliedBy: RowProvenance["suppliedBy"];
  provenanceClass: ProvenanceClass;
  preGameSafe: boolean;
}): RowProvenance {
  return {
    provider: "mlb-stats-api",
    queryFamily: input.queryFamily,
    statsWindowEndDate: input.statsWindowEndDate,
    gameCutoff: input.gameCutoff,
    capturedAt: null,
    cacheRel: null,
    evidenceHash: null,
    suppliedBy: input.suppliedBy,
    provenanceClass: input.provenanceClass,
    preGameSafe: input.preGameSafe,
  };
}

function classifyProvenance(input: {
  cutoffStatus: "BEFORE_CUTOFF" | "POST_CUTOFF";
  collectionPhase: GameIdentity["collectionPhase"];
  suppliedBy: RowProvenance["suppliedBy"];
  statsWindowEndDate: string;
  officialDate: string | null;
}): { provenanceClass: ProvenanceClass; preGameSafe: boolean } {
  if (input.cutoffStatus === "POST_CUTOFF" || input.suppliedBy === "NONE") {
    return { provenanceClass: "UNKNOWN", preGameSafe: false };
  }
  const collectionPhase =
    input.collectionPhase === "PRE_GAME"
      ? "PRE_GAME"
      : input.collectionPhase === "POST_GAME_OR_LATE"
        ? "POST_GAME_OR_LATE"
        : "UNKNOWN";
  const provenanceClass: ProvenanceClass =
    input.cutoffStatus === "BEFORE_CUTOFF" && collectionPhase === "PRE_GAME"
      ? "TRUE_LIVE_PREGAME_CAPTURE"
      : "UNKNOWN";
  const preGameSafe = preGameSafeAllowed({
    cutoffStatus: input.cutoffStatus,
    collectionPhase,
    provenanceClass,
    statsWindowEndDate: input.statsWindowEndDate,
    officialDate: input.officialDate,
  });
  return { provenanceClass, preGameSafe };
}

function blockedWindows(statsThroughDate: string): {
  season: FeatureWindow;
  last14: FeatureWindow;
  last30: FeatureWindow;
} {
  return {
    season: emptyWindow("SEASON_TO_DATE", statsThroughDate, null),
    last14: emptyWindow("LAST_14_DAYS", statsThroughDate, null),
    last30: emptyWindow("LAST_30_DAYS", statsThroughDate, null),
  };
}

function batterRow(input: {
  dateKst: string;
  game: ScheduleGameLite;
  side: TeamSide;
  batter: IdentityBatter;
  opponentThrows: HandCode;
  windows: { season: FeatureWindow; last14: FeatureWindow; last30: FeatureWindow };
  platoon: ReturnType<typeof parsePlatoonSplits>;
  provenance: RowProvenance;
  warnings: string[];
}): BatterFeatureRow {
  return {
    dateKst: input.dateKst,
    gamePk: input.game.gamePk,
    officialDate: input.game.officialDate,
    homeTeam: input.game.homeTeam,
    awayTeam: input.game.awayTeam,
    teamSide: input.side,
    commenceTimeUtc: input.game.commenceTimeUtc,
    cutoffTime: input.game.commenceTimeUtc,
    playerId: input.batter.playerId,
    playerName: input.batter.playerName,
    role: "BATTER",
    battingOrder: input.batter.battingOrder,
    bats: input.batter.bats,
    defensivePosition: input.batter.defensivePosition,
    seasonToDate: input.windows.season,
    last14Days: input.windows.last14,
    last30Days: input.windows.last30,
    platoon: {
      vsLhp: input.platoon.vsLhp,
      vsRhp: input.platoon.vsRhp,
      opponentStarterThrows: input.opponentThrows,
      selectedPlatoonSplit: selectedPlatoonSplit(input.opponentThrows),
      numericMatchupAdjustment: null,
    },
    advanced: {
      woba: { value: null, availability: "NOT_COLLECTED" },
      wrcPlus: { value: null, availability: "NOT_COLLECTED" },
    },
    provenance: input.provenance,
    warnings: input.warnings,
  };
}

function starterRow(input: {
  dateKst: string;
  game: ScheduleGameLite;
  side: TeamSide;
  starter: IdentityPitcher;
  season: StarterFeatureRow["seasonToDate"];
  provenance: RowProvenance;
  warnings: string[];
}): StarterFeatureRow {
  return {
    dateKst: input.dateKst,
    gamePk: input.game.gamePk,
    officialDate: input.game.officialDate,
    homeTeam: input.game.homeTeam,
    awayTeam: input.game.awayTeam,
    teamSide: input.side,
    commenceTimeUtc: input.game.commenceTimeUtc,
    cutoffTime: input.game.commenceTimeUtc,
    playerId: input.starter.playerId,
    playerName: input.starter.playerName,
    role: "STARTER",
    throws: input.starter.throws,
    starterStatus: input.starter.starterStatus,
    seasonToDate: input.season,
    advanced: {
      fip: { value: null, availability: "NOT_COLLECTED" },
      xfip: { value: null, availability: "NOT_COLLECTED" },
    },
    pitchArsenal: {
      pitches: [],
      availability: "NOT_PROVABLE",
      provenanceClass: "NOT_PROVABLE",
      reason: "PITCH_ARSENAL_NOT_DATE_BOUNDED_IN_V1",
    },
    provenance: input.provenance,
    warnings: input.warnings,
  };
}

export async function buildPlayerFeatureDataset(
  input: BuildPlayerFeaturesInput,
): Promise<BuildPlayerFeaturesResult> {
  const cwd = input.cwd ?? process.cwd();
  const nowMs = input.nowMs ?? Date.now();
  const generatedAt = input.generatedAt ?? new Date(nowMs).toISOString();
  const dryRun = input.dryRun === true;
  const cacheOnly = input.cacheOnly === true;
  const season = Number(input.dateKst.slice(0, 4));
  const scheduleRel = mlbScheduleRel(input.dateKst);
  const starterRel = mlbStarterRel(input.dateKst);

  const scheduleGames =
    input.sources?.scheduleGames ??
    (await loadScheduleGames({ dateKst: input.dateKst, cwd })).games;
  const starterRows =
    input.sources?.starterRows ??
    (await loadStarterIdentityRows({ dateKst: input.dateKst, cwd })).rows;

  const games =
    input.gamePk == null
      ? scheduleGames
      : scheduleGames.filter((g) => g.gamePk === input.gamePk);

  const provider = createPlayerFeatureProvider({
    cwd,
    cacheOnly,
    allowFetch: !dryRun,
    lookup: input.lookup,
  });

  const personCache = new Map<number, unknown | null>();
  const hittingCache = new Map<number, unknown | null>();
  const pitchingCache = new Map<number, unknown | null>();
  const splitsCache = new Map<number, unknown | null>();

  async function loadPerson(playerId: number): Promise<unknown | null> {
    if (personCache.has(playerId)) return personCache.get(playerId) ?? null;
    const got = await provider.get("person", playerId, season);
    personCache.set(playerId, got.body);
    return got.body;
  }
  async function loadHitting(playerId: number): Promise<unknown | null> {
    if (hittingCache.has(playerId)) return hittingCache.get(playerId) ?? null;
    const got = await provider.get("hittingGameLog", playerId, season);
    hittingCache.set(playerId, got.body);
    return got.body;
  }
  async function loadPitching(playerId: number): Promise<unknown | null> {
    if (pitchingCache.has(playerId)) return pitchingCache.get(playerId) ?? null;
    const got = await provider.get("pitchingGameLog", playerId, season);
    pitchingCache.set(playerId, got.body);
    return got.body;
  }
  async function loadSplits(playerId: number): Promise<unknown | null> {
    if (splitsCache.has(playerId)) return splitsCache.get(playerId) ?? null;
    const got = await provider.get("hittingSplits", playerId, season);
    splitsCache.set(playerId, got.body);
    return got.body;
  }

  const outGames: PlayerFeatureGame[] = [];

  for (const game of games) {
    const postCutoff = isPostCutoff(game.commenceTimeUtc, nowMs);
    const cutoffStatus = postCutoff ? "POST_CUTOFF" : "BEFORE_CUTOFF";
    const statsThroughDate = statsThroughDateForGame({
      dateKst: input.dateKst,
      officialDate: game.officialDate,
    });
    const identity =
      input.sources?.identityByGamePk?.[game.gamePk] ??
      (await loadGameIdentity({
        dateKst: input.dateKst,
        cwd,
        game,
        starterRows,
      }));

    const blockers: string[] = [];
    if (postCutoff) blockers.push("POST_CUTOFF");
    if (identity.lineupStatus === "UNAVAILABLE") blockers.push("NO_CONFIRMED_LINEUP");
    if (identity.lineupStatus === "PARTIAL") blockers.push("PARTIAL_LINEUP");

    let featureStatus: FeatureGameStatus = "READY";
    if (dryRun) featureStatus = "SKIPPED_DRY_RUN";
    else if (postCutoff) featureStatus = "BLOCKED_POST_CUTOFF";
    else if (identity.lineupStatus === "UNAVAILABLE") {
      featureStatus = "BLOCKED_NO_CONFIRMED_LINEUP";
    } else if (identity.lineupStatus === "PARTIAL") featureStatus = "PARTIAL";

    const fetchStats =
      !dryRun && !postCutoff && identity.lineupStatus !== "UNAVAILABLE";
    const suppliedBy: RowProvenance["suppliedBy"] = dryRun
      ? "NONE"
      : fetchStats
        ? input.lookup
          ? "INJECTED"
          : cacheOnly
            ? "CACHE"
            : "NETWORK"
        : "NONE";

    const fillSide = async (
      side: TeamSide,
      batters: IdentityBatter[],
      starter: IdentityPitcher,
      opponentStarter: IdentityPitcher,
      teamName: string,
    ): Promise<SideFeatureBlock> => {
      const batterRows: BatterFeatureRow[] = [];
      for (const batter of batters) {
        const warnings: string[] = [];
        let bats = batter.bats;
        let playerName = batter.playerName;
        let windows = blockedWindows(statsThroughDate);
        let platoon = parsePlatoonSplits({ payload: null, dateBounded: false });
        if (fetchStats) {
          const person = await loadPerson(batter.playerId);
          const hitting = await loadHitting(batter.playerId);
          const splits = await loadSplits(batter.playerId);
          if (person) {
            const parsed = batsFromPersonPayload(person);
            if (bats === "UNKNOWN") bats = parsed.bats;
            if (!playerName) playerName = parsed.fullName;
          }
          windows = {
            season: buildHittingWindow({
              payload: hitting,
              targetGamePk: game.gamePk,
              officialDate: game.officialDate,
              statsThroughDate,
              windowId: "SEASON_TO_DATE",
            }),
            last14: buildHittingWindow({
              payload: hitting,
              targetGamePk: game.gamePk,
              officialDate: game.officialDate,
              statsThroughDate,
              windowId: "LAST_14_DAYS",
              inclusiveDays: 14,
            }),
            last30: buildHittingWindow({
              payload: hitting,
              targetGamePk: game.gamePk,
              officialDate: game.officialDate,
              statsThroughDate,
              windowId: "LAST_30_DAYS",
              inclusiveDays: 30,
            }),
          };
          const dateBounded =
            input.lookup?.hittingSplitsDateBounded?.(batter.playerId) === true;
          platoon = parsePlatoonSplits({ payload: splits, dateBounded });
          if (!dateBounded && splits) {
            warnings.push("PLATOON_SPLITS_NOT_DATE_BOUNDED");
          }
        }
        const { provenanceClass, preGameSafe } = classifyProvenance({
          cutoffStatus,
          collectionPhase: identity.collectionPhase,
          suppliedBy,
          statsWindowEndDate: statsThroughDate,
          officialDate: game.officialDate,
        });
        batterRows.push(
          batterRow({
            dateKst: input.dateKst,
            game,
            side,
            batter: { ...batter, bats, playerName },
            opponentThrows: opponentStarter.throws,
            windows,
            platoon,
            provenance: emptyProvenance({
              queryFamily: "people.stats.gameLog.hitting+statSplits",
              statsWindowEndDate: statsThroughDate,
              gameCutoff: game.commenceTimeUtc,
              suppliedBy,
              provenanceClass,
              preGameSafe,
            }),
            warnings,
          }),
        );
      }

      const starterWarnings: string[] = [];
      let throws = starter.throws;
      let starterName = starter.playerName;
      let seasonStats = emptyStarterSeason();
      if (fetchStats && starter.playerId != null) {
        const person = await loadPerson(starter.playerId);
        const pitching = await loadPitching(starter.playerId);
        if (person) {
          if (throws === "UNKNOWN") throws = throwsFromPerson(person);
          if (!starterName) starterName = batsFromPersonPayload(person).fullName;
        }
        seasonStats = buildStarterSeason({
          payload: pitching,
          targetGamePk: game.gamePk,
          officialDate: game.officialDate,
          statsThroughDate,
        });
      } else if (starter.playerId == null) {
        starterWarnings.push("STARTER_IDENTITY_MISSING");
      }
      const starterProv = classifyProvenance({
        cutoffStatus,
        collectionPhase: identity.collectionPhase,
        suppliedBy,
        statsWindowEndDate: statsThroughDate,
        officialDate: game.officialDate,
      });
      return {
        teamName,
        lineupStatus: identity.lineupStatus,
        batters: batterRows,
        starter: starterRow({
          dateKst: input.dateKst,
          game,
          side,
          starter: { ...starter, throws, playerName: starterName },
          season: seasonStats,
          provenance: emptyProvenance({
            queryFamily: "people.stats.gameLog.pitching",
            statsWindowEndDate: statsThroughDate,
            gameCutoff: game.commenceTimeUtc,
            suppliedBy,
            provenanceClass: starterProv.provenanceClass,
            preGameSafe: starterProv.preGameSafe,
          }),
          warnings: starterWarnings,
        }),
      };
    };

    const away = await fillSide(
      "away",
      identity.away.batters,
      identity.awayStarter,
      identity.homeStarter,
      identity.away.teamName,
    );
    const home = await fillSide(
      "home",
      identity.home.batters,
      identity.homeStarter,
      identity.awayStarter,
      identity.home.teamName,
    );

    outGames.push({
      gamePk: game.gamePk,
      officialDate: game.officialDate,
      commenceTimeUtc: game.commenceTimeUtc,
      cutoffStatus,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      away,
      home,
      featureStatus,
      blockers,
      lineupReference: identity.lineupRel,
      lineupObservationId: identity.lineupObservationId,
      lineupPayloadHash: identity.lineupPayloadHash,
    });
  }

  const document: PlayerFeatureDatasetDocument = {
    schemaVersion: PLAYER_FEATURES_SCHEMA_VERSION,
    datasetId: PLAYER_FEATURES_DATASET_ID,
    builderVersion: PLAYER_FEATURES_BUILDER_VERSION,
    dateKst: input.dateKst,
    generatedAt,
    researchOnly: true,
    marketDataAllowed: false,
    predictionInputAllowed: false,
    engineUseAllowed: false,
    engineAdmission: "PROHIBITED",
    independentModelSample: 0,
    playerStrengthGenerated: false,
    winProbabilityGenerated: false,
    bullpenImplemented: false,
    temporalPolicy: PLAYER_FEATURES_TEMPORAL_POLICY,
    providerSummary: {
      provider: "mlb-stats-api",
      featureFetchAttempts: dryRun ? 0 : provider.featureFetchAttempts,
      networkCalls: dryRun ? 0 : provider.usage.networkCalls,
      cacheHits: provider.usage.rawHit,
      cacheMisses: provider.usage.rawMiss,
      injectedLookups: provider.injectedLookups,
    },
    scheduleReference: scheduleRel,
    lineupReference: `data/research/mlb/lineup-refresh/${input.dateKst}`,
    starterReference: starterRel,
    games: outGames,
    featureCatalog: FEATURE_CATALOG_V1,
    deferredFeatures: DEFERRED_FEATURES_V1,
    provenance: {
      liveVsHistorical: "LIVE_SAFE_INFRASTRUCTURE_ONLY",
      historicalBackfill: false,
      unknownNeverPromotedToPreGameSafe: true,
    },
    datasetHash: "",
  };
  document.datasetHash = hashPlayerFeatureDataset(document);

  return {
    document,
    featureFetchAttempts: document.providerSummary.featureFetchAttempts,
    networkCalls: document.providerSummary.networkCalls,
  };
}

export function formatPlayerFeaturesSummary(
  document: PlayerFeatureDatasetDocument,
  extra?: { written?: boolean; skippedExisting?: boolean; dryRun?: boolean },
): string {
  const blockedPost = document.games.filter(
    (g) => g.featureStatus === "BLOCKED_POST_CUTOFF",
  ).length;
  const blockedLineup = document.games.filter(
    (g) => g.featureStatus === "BLOCKED_NO_CONFIRMED_LINEUP",
  ).length;
  return [
    "MLB PREGAME PLAYER FEATURES v1",
    "",
    `Date: ${document.dateKst}`,
    `Games: ${document.games.length}`,
    `Blocked post-cutoff: ${blockedPost}`,
    `Blocked no confirmed lineup: ${blockedLineup}`,
    `Feature fetch attempts: ${document.providerSummary.featureFetchAttempts}`,
    `Network calls: ${document.providerSummary.networkCalls}`,
    `Dataset hash: ${document.datasetHash.slice(0, 16)}`,
    `Written: ${extra?.written ? "YES" : "NO"}${extra?.skippedExisting ? " (write-once skip)" : ""}`,
    `Dry-run: ${extra?.dryRun ? "YES" : "NO"}`,
    "",
    "Independent model sample: 0",
    "Engine admission: PROHIBITED",
    "Player strength generated: NO",
    "Win probability generated: NO",
    "Bullpen implemented: NO",
    "Market data allowed: NO",
    "",
  ].join("\n");
}

export { mlbPlayerFeaturesDatasetRel };
