/**
 * Load KBO operational day state — single source of truth for Lab + Analysis.
 */
import path from "node:path";
import { resolveKboGameOperatingStatus } from "@/lib/kbo/t45-personnel/resolve-game-operating-status";
import { kboT45Paths } from "@/lib/kbo/t45-personnel/paths";
import {
  arr,
  gameHasBothLineups,
  gameHasBothStarters,
  gameHasProto,
  extractStarterNames,
  listScheduleV1Dates,
  num,
  readJsonFile,
  rec,
  rel,
  str,
  type ReadResult,
} from "./resolve-artifact-status";
import {
  component,
  isReadyStatus,
  type KboArtifactSourceType,
  type KboOperationalDayState,
  type KboOperationalErrorCode,
  type KboOperationalGameState,
  type KboOperationalStatus,
} from "./types";

function isCancelledGame(g: Record<string, unknown>): boolean {
  const op = resolveKboGameOperatingStatus({
    statusAbstract: str(g.statusAbstract),
    statusDetailed: str(g.statusDetailed),
    clockState: str(g.clockState),
    cancellationStatus: str(g.cancellationStatus),
  });
  return op === "CANCELLED" || op === "POSTPONED";
}

function operatingOf(g: Record<string, unknown>) {
  return resolveKboGameOperatingStatus({
    statusAbstract: str(g.statusAbstract),
    statusDetailed: str(g.statusDetailed),
    clockState: str(g.clockState),
    cancellationStatus: str(g.cancellationStatus),
  });
}

function track(
  list: KboOperationalDayState["sourceArtifacts"],
  name: string,
  result: ReadResult<unknown>,
  waitingLabel: string,
  cwd: string,
) {
  if (result.ok) {
    list.push({
      name,
      path: rel(cwd, result.path),
      status: "OK",
      displayStatus: "사용 가능",
    });
    return;
  }
  list.push({
    name,
    path: rel(cwd, result.path),
    status: result.error === "FILE_NOT_FOUND" ? waitingLabel : result.error,
    displayStatus:
      result.error === "FILE_NOT_FOUND" ? "아직 생성되지 않음" : result.error,
  });
}

function readinessOf(game: {
  schedule: { applicable: boolean; score: number; maxScore: number };
  domesticOdds: { applicable: boolean; score: number; maxScore: number };
  overseasOdds: { applicable: boolean; score: number; maxScore: number };
  starter: { applicable: boolean; score: number; maxScore: number };
  lineup: { applicable: boolean; score: number; maxScore: number };
  prediction: { applicable: boolean; score: number; maxScore: number };
}): number {
  const parts = [
    game.schedule,
    game.domesticOdds,
    game.overseasOdds,
    game.starter,
    game.lineup,
    game.prediction,
  ].filter((c) => c.applicable && c.maxScore > 0);
  if (parts.length === 0) return 0;
  const got = parts.reduce((a, c) => a + c.score, 0);
  const max = parts.reduce((a, c) => a + c.maxScore, 0);
  return max > 0 ? Math.round((got / max) * 100) : 0;
}

export async function loadKboOperationalDayState(
  dateKst: string,
  cwd = process.cwd(),
): Promise<KboOperationalDayState> {
  const paths = kboT45Paths(dateKst, cwd);
  const identityPath = path.join(
    cwd,
    "data",
    "research",
    "kbo",
    `${dateKst}-schedule-result-identity-v1-api-baseball.json`,
  );
  const oddsHistoryPath = path.join(
    cwd,
    "data",
    "research",
    "kbo",
    `${dateKst}-odds-history-dataset-v1.json`,
  );
  const oddsComparisonPath = path.join(
    cwd,
    "data",
    "research",
    "kbo",
    `${dateKst}-odds-comparison-v1.json`,
  );
  const reviewPath = path.join(
    cwd,
    "data",
    "predictions",
    "kbo",
    `${dateKst}-review.json`,
  );

  const hardErrors: KboOperationalDayState["hardErrors"] = [];
  const sourceArtifacts: KboOperationalDayState["sourceArtifacts"] = [];

  const schedulePrimary = await readJsonFile<Record<string, unknown>>(
    paths.schedule,
  );
  const scheduleIdentity = await readJsonFile<Record<string, unknown>>(
    identityPath,
  );
  track(sourceArtifacts, "KBO Schedule v1", schedulePrimary, "SCHEDULE_NOT_FOUND", cwd);
  track(
    sourceArtifacts,
    "KBO Schedule Identity",
    scheduleIdentity,
    "IDENTITY_OPTIONAL",
    cwd,
  );

  let scheduleGames: Record<string, unknown>[] = [];
  let scheduleSourcePath: string | null = null;
  let scheduleSourceType: KboArtifactSourceType = "NONE";
  let scheduleStatus: KboOperationalStatus = "BLOCKED";
  let scheduleReason = "SCHEDULE_MISSING";

  if (schedulePrimary.ok) {
    const games = arr(schedulePrimary.data.games).map((g) => rec(g) ?? {});
    if (games.length === 0) {
      scheduleStatus = "BLOCKED";
      scheduleReason = "Schedule games[] empty";
      hardErrors.push({
        code: "SCHEMA_INVALID",
        message: "KBO schedule games[] empty",
        path: rel(cwd, schedulePrimary.path),
      });
    } else {
      scheduleGames = games;
      scheduleSourcePath = rel(cwd, schedulePrimary.path);
      scheduleSourceType = "SCHEDULE_V1";
      scheduleStatus = "READY";
      scheduleReason = "SCHEDULE_READY";
    }
  } else if (schedulePrimary.error !== "FILE_NOT_FOUND") {
    scheduleStatus = "ERROR";
    scheduleReason = schedulePrimary.error;
    hardErrors.push({
      code: schedulePrimary.error as KboOperationalErrorCode,
      message: `Schedule: ${schedulePrimary.error}`,
      path: rel(cwd, schedulePrimary.path),
    });
  } else if (scheduleIdentity.ok) {
    const rows = arr(scheduleIdentity.data.rows).map((g) => rec(g) ?? {});
    if (rows.length > 0) {
      scheduleGames = rows.map((r) => ({
        gameId: str(r.gameId) ?? str(r.yangEdgeGameId) ?? str(r.internalGameId),
        statusAbstract: str(r.statusAbstract) ?? str(r.status),
        statusDetailed: str(r.statusDetailed),
        cancellationStatus: str(r.cancellationStatus),
        clockState: str(r.clockState),
        home: str(r.homeTeam) ?? str(r.home),
        away: str(r.awayTeam) ?? str(r.away),
        scheduledStartTime:
          str(r.scheduledStartTime) ??
          str(rec(r.time)?.startTimeKst) ??
          str(r.scheduledStartTimeKst),
      }));
      scheduleSourcePath = rel(cwd, scheduleIdentity.path);
      scheduleSourceType = "SCHEDULE_IDENTITY_LEGACY";
      scheduleStatus = "READY";
      scheduleReason = "SCHEDULE_READY (legacy identity)";
    } else {
      scheduleStatus = "BLOCKED";
      scheduleReason = "SCHEDULE_MISSING";
    }
  } else {
    scheduleStatus = "BLOCKED";
    scheduleReason = "SCHEDULE_MISSING";
  }

  const cancelledGames = scheduleGames.filter(isCancelledGame);
  const activeGames = scheduleGames.filter((g) => !isCancelledGame(g));
  const postponedGames = scheduleGames.filter(
    (g) => operatingOf(g) === "POSTPONED",
  );
  const cancelledOnly = Math.max(
    0,
    cancelledGames.length - postponedGames.length,
  );

  const personnelInput = await readJsonFile<Record<string, unknown>>(
    paths.personnelInput,
  );
  const personnelSnapshot = await readJsonFile<Record<string, unknown>>(
    paths.personnelSnapshot,
  );
  const protoSnapshot = await readJsonFile<Record<string, unknown>>(
    paths.domesticProtoSnapshot,
  );
  const starterConfirmation = await readJsonFile<Record<string, unknown>>(
    paths.starterConfirmation,
  );
  const lineupConfirmation = await readJsonFile<Record<string, unknown>>(
    paths.lineupConfirmation,
  );
  const prediction = await readJsonFile<Record<string, unknown>>(
    paths.prediction,
  );
  const review = await readJsonFile<Record<string, unknown>>(reviewPath);
  const oddsHistory = await readJsonFile<Record<string, unknown>>(
    oddsHistoryPath,
  );
  const oddsComparison = await readJsonFile<Record<string, unknown>>(
    oddsComparisonPath,
  );

  for (const [name, result, wait] of [
    ["KBO Personnel Input", personnelInput, "OPERATOR_INPUT_OPTIONAL"],
    ["KBO Personnel Snapshot", personnelSnapshot, "T45_NOT_RUN"],
    ["KBO Domestic Proto Snapshot", protoSnapshot, "DOMESTIC_PROTO_SNAPSHOT_NOT_GENERATED"],
    ["KBO Starter Confirmation", starterConfirmation, "STARTER_CONFIRMATION_NOT_CREATED"],
    ["KBO Lineup Confirmation", lineupConfirmation, "LINEUP_CONFIRMATION_NOT_CREATED"],
    ["KBO Prediction", prediction, "PREDICTION_NOT_CREATED"],
    ["KBO Review", review, "REVIEW_NOT_READY"],
    ["KBO Odds History", oddsHistory, "OVERSEAS_ODDS_NOT_COLLECTED"],
    ["KBO Odds Comparison", oddsComparison, "ODDS_COMPARISON_NOT_CREATED"],
  ] as const) {
    track(sourceArtifacts, name, result, wait, cwd);
    if (!result.ok && result.error !== "FILE_NOT_FOUND") {
      hardErrors.push({
        code: result.error as KboOperationalErrorCode,
        message: `${name}: ${result.error}`,
        path: rel(cwd, result.path),
      });
    }
  }

  const personnelById = new Map<string, Record<string, unknown>>();
  if (personnelInput.ok) {
    for (const raw of arr(personnelInput.data.games)) {
      const g = rec(raw);
      const id = g ? str(g.gameId) : null;
      if (g && id) personnelById.set(id, g);
    }
  }
  const snapshotById = new Map<string, Record<string, unknown>>();
  if (personnelSnapshot.ok) {
    for (const raw of arr(personnelSnapshot.data.games)) {
      const g = rec(raw);
      const id = g ? str(g.gameId) : null;
      if (g && id) snapshotById.set(id, g);
    }
  }

  const confStarterById = new Map<string, Record<string, unknown>>();
  if (starterConfirmation.ok) {
    for (const raw of arr(starterConfirmation.data.games)) {
      const g = rec(raw);
      if (!g) continue;
      const id =
        str(g.gameId) ?? str(g.internalGameId) ?? str(g.yangEdgeGameId);
      if (id) confStarterById.set(id, g);
    }
  }
  const confLineupById = new Map<string, Record<string, unknown>>();
  if (lineupConfirmation.ok) {
    for (const raw of arr(lineupConfirmation.data.games)) {
      const g = rec(raw);
      if (!g) continue;
      const id =
        str(g.gameId) ?? str(g.internalGameId) ?? str(g.yangEdgeGameId);
      if (id) confLineupById.set(id, g);
    }
  }

  const protoSnapById = new Map<string, Record<string, unknown>>();
  if (protoSnapshot.ok) {
    for (const raw of arr(protoSnapshot.data.games)) {
      const g = rec(raw);
      const id = g ? str(g.gameId) : null;
      if (g && id) protoSnapById.set(id, g);
    }
  }

  const overseasById = new Map<string, boolean>();
  if (oddsHistory.ok) {
    for (const raw of arr(oddsHistory.data.games)) {
      const g = rec(raw);
      const id = g ? str(g.gameId) : null;
      if (g && id && str(g.status) === "COLLECTED") overseasById.set(id, true);
    }
  }

  const predictionById = new Map<string, Record<string, unknown>>();
  if (prediction.ok) {
    for (const raw of arr(prediction.data.predictions).length
      ? arr(prediction.data.predictions)
      : arr(prediction.data.games)) {
      const g = rec(raw);
      const id = g ? str(g.gameId) : null;
      if (g && id) predictionById.set(id, g);
    }
  }

  const games: KboOperationalGameState[] = [];

  for (const sg of scheduleGames) {
    const gameId = str(sg.gameId) ?? "";
    if (!gameId) continue;
    const homeTeam =
      str(sg.home) ??
      str(sg.homeTeam) ??
      str(personnelById.get(gameId)?.homeTeam) ??
      null;
    const awayTeam =
      str(sg.away) ??
      str(sg.awayTeam) ??
      str(personnelById.get(gameId)?.awayTeam) ??
      null;
    const scheduledStartTime =
      str(sg.scheduledStartTime) ??
      str(personnelById.get(gameId)?.scheduledStartTime) ??
      null;
    const operatingStatus = operatingOf(sg);
    const cancelled =
      operatingStatus === "CANCELLED" || operatingStatus === "POSTPONED";
    const activeRequirement = !cancelled;

    const scheduleComp = component({
      status: scheduleStatus === "READY" ? "READY" : scheduleStatus,
      reason: scheduleReason,
      applicable: true,
      sourceType: scheduleSourceType,
      sourcePath: scheduleSourcePath,
      values: { homeTeam, awayTeam, scheduledStartTime },
    });

    // Domestic proto
    let domestic = component({
      status: cancelled ? "NOT_APPLICABLE" : "NOT_ENTERED",
      reason: cancelled ? "CANCELLED_NOT_APPLICABLE" : "DOMESTIC_PROTO_NOT_ENTERED",
      applicable: activeRequirement,
      sourceType: "NONE",
      sourcePath: null,
    });
    const snapProto = protoSnapById.get(gameId);
    const opGame = personnelById.get(gameId);
    if (!cancelled && snapProto && (gameHasProto(snapProto) || str(snapProto.status))) {
      domestic = component({
        status: "READY",
        reason: "DOMESTIC_PROTO_SNAPSHOT_READY",
        applicable: true,
        sourceType: "DOMESTIC_PROTO_SNAPSHOT",
        sourcePath: protoSnapshot.ok ? rel(cwd, protoSnapshot.path) : null,
        values: {
          homePrice: num(rec(snapProto.domesticProto)?.homePrice) ?? num(snapProto.homePrice),
          awayPrice: num(rec(snapProto.domesticProto)?.awayPrice) ?? num(snapProto.awayPrice),
        },
      });
    } else if (!cancelled && opGame && gameHasProto(opGame)) {
      const proto = rec(opGame.domesticProto)!;
      domestic = component({
        status: "READY_ADMIN_VERIFIED",
        reason:
          "OPERATOR_PROTO_AVAILABLE · ADMIN_VERIFIED · INTERNAL_ONLY · T45_SNAPSHOT_NOT_GENERATED",
        applicable: true,
        sourceType: "PERSONNEL_INPUT",
        sourcePath: personnelInput.ok ? rel(cwd, personnelInput.path) : null,
        values: {
          homePrice: num(proto.homePrice),
          awayPrice: num(proto.awayPrice),
        },
      });
    }

    // Overseas
    let overseas = component({
      status: cancelled
        ? "NOT_APPLICABLE"
        : overseasById.has(gameId)
          ? "READY"
          : oddsHistory.ok || oddsComparison.ok
            ? "NOT_COLLECTED"
            : "NOT_AVAILABLE",
      reason: cancelled
        ? "CANCELLED_NOT_APPLICABLE"
        : overseasById.has(gameId)
          ? "OVERSEAS_READY"
          : "OVERSEAS_ODDS_NOT_COLLECTED",
      applicable: activeRequirement,
      sourceType: overseasById.has(gameId)
        ? "ODDS_HISTORY"
        : oddsComparison.ok
          ? "ODDS_COMPARISON_LEGACY"
          : "NONE",
      sourcePath: oddsHistory.ok
        ? rel(cwd, oddsHistory.path)
        : oddsComparison.ok
          ? rel(cwd, oddsComparison.path)
          : null,
      maxScore: 20,
      score: overseasById.has(gameId) ? 20 : 0,
    });

    // Starter
    let starter = component({
      status: cancelled ? "NOT_APPLICABLE" : "NOT_ENTERED",
      reason: cancelled ? "CANCELLED_NOT_APPLICABLE" : "STARTER_NOT_ENTERED",
      applicable: activeRequirement,
      sourceType: "NONE",
      sourcePath: null,
    });
    const snapG = snapshotById.get(gameId);
    const confS = confStarterById.get(gameId);
    if (!cancelled && snapG && gameHasBothStarters(snapG)) {
      const names = extractStarterNames(snapG);
      starter = component({
        status: "READY",
        reason: "STARTER_ENTERED",
        applicable: true,
        sourceType: "PERSONNEL_SNAPSHOT",
        sourcePath: personnelSnapshot.ok
          ? rel(cwd, personnelSnapshot.path)
          : null,
        values: names,
      });
    } else if (!cancelled && confS) {
      const hs = rec(confS.homeStarter);
      const as_ = rec(confS.awayStarter);
      const has =
        (hs && str(hs.playerName) && as_ && str(as_.playerName)) ||
        gameHasBothStarters(confS);
      if (has) {
        starter = component({
          status: "READY",
          reason: "STARTER_ENTERED_LEGACY_CONFIRMATION",
          applicable: true,
          sourceType: "STARTER_CONFIRMATION_LEGACY",
          sourcePath: starterConfirmation.ok
            ? rel(cwd, starterConfirmation.path)
            : null,
          values: {
            home: hs ? str(hs.playerName) : extractStarterNames(confS).home,
            away: as_ ? str(as_.playerName) : extractStarterNames(confS).away,
          },
        });
      }
    }
    if (
      !cancelled &&
      starter.status === "NOT_ENTERED" &&
      opGame &&
      gameHasBothStarters(opGame)
    ) {
      starter = component({
        status: "READY_ADMIN_VERIFIED",
        reason: "STARTER_ENTERED_OPERATOR_INPUT",
        applicable: true,
        sourceType: "PERSONNEL_INPUT",
        sourcePath: personnelInput.ok ? rel(cwd, personnelInput.path) : null,
        values: extractStarterNames(opGame),
      });
    }

    // Lineup
    let lineup = component({
      status: cancelled ? "NOT_APPLICABLE" : "NOT_ENTERED",
      reason: cancelled ? "CANCELLED_NOT_APPLICABLE" : "LINEUP_NOT_ENTERED",
      applicable: activeRequirement,
      sourceType: "NONE",
      sourcePath: null,
    });
    const confL = confLineupById.get(gameId);
    if (!cancelled && snapG && gameHasBothLineups(snapG)) {
      lineup = component({
        status: "READY",
        reason: "LINEUP_ENTERED",
        applicable: true,
        sourceType: "PERSONNEL_SNAPSHOT",
        sourcePath: personnelSnapshot.ok
          ? rel(cwd, personnelSnapshot.path)
          : null,
      });
    } else if (!cancelled && confL) {
      const homeL = rec(confL.homeLineup);
      const awayL = rec(confL.awayLineup);
      const ok =
        (homeL && (arr(homeL.battingOrder).length >= 9 || arr(homeL.batters).length >= 9)) &&
        (awayL && (arr(awayL.battingOrder).length >= 9 || arr(awayL.batters).length >= 9));
      if (ok || gameHasBothLineups(confL)) {
        lineup = component({
          status: "READY",
          reason: "LINEUP_ENTERED_LEGACY_CONFIRMATION",
          applicable: true,
          sourceType: "LINEUP_CONFIRMATION_LEGACY",
          sourcePath: lineupConfirmation.ok
            ? rel(cwd, lineupConfirmation.path)
            : null,
        });
      }
    }
    if (
      !cancelled &&
      lineup.status === "NOT_ENTERED" &&
      opGame &&
      gameHasBothLineups(opGame)
    ) {
      lineup = component({
        status: "READY_ADMIN_VERIFIED",
        reason: "LINEUP_ENTERED_OPERATOR_INPUT",
        applicable: true,
        sourceType: "PERSONNEL_INPUT",
        sourcePath: personnelInput.ok ? rel(cwd, personnelInput.path) : null,
      });
    }

    // Prediction / Review
    const predRow = predictionById.get(gameId);
    const predictionComp = component({
      status: cancelled
        ? "NOT_APPLICABLE"
        : predRow
          ? "READY"
          : "NOT_CREATED",
      reason: cancelled
        ? "CANCELLED_NOT_APPLICABLE"
        : predRow
          ? "PREDICTION_PRESENT"
          : "PREDICTION_NOT_CREATED",
      applicable: activeRequirement,
      sourceType: predRow && prediction.ok ? "PREDICTION" : "NONE",
      sourcePath:
        predRow && prediction.ok ? rel(cwd, prediction.path) : null,
    });

    const reviewComp = component({
      status: cancelled
        ? "NOT_APPLICABLE"
        : review.ok
          ? "READY"
          : "NOT_READY",
      reason: cancelled
        ? "CANCELLED_NOT_APPLICABLE"
        : review.ok
          ? "REVIEW_PRESENT"
          : "WAITING_FOR_POSTGAME",
      applicable: activeRequirement,
      sourceType: review.ok ? "REVIEW" : "NONE",
      sourcePath: review.ok ? rel(cwd, review.path) : null,
      maxScore: 0,
      score: 0,
    });

    const waitingReasons: string[] = [];
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    if (scheduleStatus === "BLOCKED" || scheduleStatus === "ERROR") {
      blockingReasons.push("Schedule Missing");
    }
    if (activeRequirement && domestic.status === "NOT_ENTERED") {
      waitingReasons.push("Domestic Proto Not Entered");
    } else if (domestic.sourceType === "PERSONNEL_INPUT") {
      waitingReasons.push("Domestic Proto Snapshot Not Generated");
      warnings.push("T45_SNAPSHOT_NOT_GENERATED");
    }
    if (activeRequirement && starter.status === "NOT_ENTERED") {
      waitingReasons.push("Starter Not Entered");
    }
    if (activeRequirement && lineup.status === "NOT_ENTERED") {
      waitingReasons.push("Lineup Not Entered");
    }
    if (activeRequirement && predictionComp.status === "NOT_CREATED") {
      waitingReasons.push("Prediction Not Created");
      waitingReasons.push("KBO Prediction Pipeline Not Implemented");
    }
    if (activeRequirement && overseas.status === "NOT_AVAILABLE") {
      waitingReasons.push("Overseas Odds Not Available");
    }

    let overallStatus: KboOperationalStatus = "UNKNOWN";
    if (cancelled) {
      overallStatus = "NOT_APPLICABLE";
    } else if (scheduleStatus === "BLOCKED" || scheduleStatus === "ERROR") {
      overallStatus = "BLOCKED";
    } else if (
      isReadyStatus(domestic.status) &&
      isReadyStatus(starter.status) &&
      isReadyStatus(lineup.status) &&
      isReadyStatus(predictionComp.status)
    ) {
      overallStatus = "READY";
    } else if (
      isReadyStatus(domestic.status) &&
      isReadyStatus(starter.status) &&
      isReadyStatus(lineup.status) &&
      predictionComp.status === "NOT_CREATED"
    ) {
      overallStatus = "WAITING_FOR_PREDICTION";
    } else if (
      isReadyStatus(domestic.status) &&
      isReadyStatus(starter.status) &&
      lineup.status === "NOT_ENTERED"
    ) {
      overallStatus = "WAITING_FOR_LINEUP";
    } else {
      overallStatus = "PARTIAL_READY";
    }

    const gameState: KboOperationalGameState = {
      dateKst,
      gameId,
      homeTeam: homeTeam ? String(homeTeam) : null,
      awayTeam: awayTeam ? String(awayTeam) : null,
      scheduledStartTime,
      operatingStatus,
      activeRequirement,
      schedule: scheduleComp,
      domesticOdds: domestic,
      overseasOdds: overseas,
      starter,
      lineup,
      prediction: predictionComp,
      review: reviewComp,
      readinessPercent: cancelled
        ? 0
        : readinessOf({
            schedule: scheduleComp,
            domesticOdds: domestic,
            overseasOdds: overseas,
            starter,
            lineup,
            prediction: predictionComp,
          }),
      overallStatus,
      blockingReasons,
      waitingReasons,
      warnings,
      hardErrors: [],
      sources: [
        {
          name: "Schedule",
          path: scheduleSourcePath ?? "",
          sourceType: scheduleSourceType,
          status: scheduleComp.status,
        },
        {
          name: "Domestic Odds",
          path: domestic.sourcePath ?? "",
          sourceType: domestic.sourceType,
          status: domestic.status,
        },
        {
          name: "Starter",
          path: starter.sourcePath ?? "",
          sourceType: starter.sourceType,
          status: starter.status,
        },
        {
          name: "Lineup",
          path: lineup.sourcePath ?? "",
          sourceType: lineup.sourceType,
          status: lineup.status,
        },
        {
          name: "Prediction",
          path: predictionComp.sourcePath ?? "",
          sourceType: predictionComp.sourceType,
          status: predictionComp.status,
        },
      ].filter((s) => s.path || s.status !== "NOT_APPLICABLE"),
    };
    games.push(gameState);
  }

  // Aggregates over active
  const active = games.filter((g) => g.activeRequirement);
  const aggregates = {
    protoEntered: active.filter((g) => isReadyStatus(g.domesticOdds.status))
      .length,
    protoRequired: active.length,
    starterEntered: active.filter((g) => isReadyStatus(g.starter.status))
      .length,
    starterRequired: active.length,
    lineupEntered: active.filter((g) => isReadyStatus(g.lineup.status)).length,
    lineupRequired: active.length,
    predictionCreated: prediction.ok,
  };

  let overallStatus: KboOperationalStatus =
    scheduleStatus === "BLOCKED" || scheduleStatus === "ERROR"
      ? "BLOCKED"
      : "PARTIAL_READY";
  if (
    scheduleStatus === "READY" &&
    aggregates.protoEntered === aggregates.protoRequired &&
    aggregates.starterEntered === aggregates.starterRequired &&
    aggregates.lineupEntered === aggregates.lineupRequired
  ) {
    overallStatus = aggregates.predictionCreated
      ? "READY"
      : "WAITING_FOR_PREDICTION";
  } else if (
    scheduleStatus === "READY" &&
    aggregates.protoEntered === aggregates.protoRequired &&
    aggregates.starterEntered === aggregates.starterRequired &&
    aggregates.lineupEntered < aggregates.lineupRequired
  ) {
    overallStatus = "WAITING_FOR_LINEUP";
  }

  const waitingReasons = [
    ...new Set(games.flatMap((g) => g.waitingReasons)),
  ];

  const tasks: KboOperationalDayState["tasks"] = [];
  if (scheduleStatus === "READY") {
    tasks.push({
      taskId: "kbo-schedule-ready",
      title: "Schedule 확인 완료",
      description: `KBO Schedule ${scheduleGames.length}경기 (활성 ${active.length}, 취소 ${cancelledOnly})`,
      priority: "LOW",
      category: "DONE",
      source: scheduleSourcePath ?? "",
      recommendedCommand: null,
    });
  }
  if (cancelledOnly > 0) {
    tasks.push({
      taskId: "kbo-cancelled-reflected",
      title: `취소 경기 ${cancelledOnly}경기 반영`,
      description: "취소 경기는 Starter/Lineup 입력 대상이 아닙니다.",
      priority: "LOW",
      category: "DONE",
      source: scheduleSourcePath ?? "",
      recommendedCommand: null,
    });
  }
  if (
    aggregates.protoEntered === aggregates.protoRequired &&
    aggregates.protoRequired > 0
  ) {
    tasks.push({
      taskId: "kbo-proto-ready",
      title: `Domestic Proto ${aggregates.protoEntered}/${aggregates.protoRequired} 입력`,
      description: "ADMIN_VERIFIED operator proto",
      priority: "LOW",
      category: "DONE",
      source: personnelInput.ok ? rel(cwd, personnelInput.path) : "",
      recommendedCommand: null,
    });
  }
  if (aggregates.starterEntered === aggregates.starterRequired && aggregates.starterRequired > 0) {
    tasks.push({
      taskId: "kbo-starter-ready",
      title: `Starter ${aggregates.starterEntered}/${aggregates.starterRequired} 입력`,
      description: "활성 경기 선발 완료",
      priority: "LOW",
      category: "DONE",
      source: personnelInput.ok ? rel(cwd, personnelInput.path) : "",
      recommendedCommand: null,
    });
  } else if (aggregates.starterRequired > 0) {
    tasks.push({
      taskId: "kbo-starter-intake",
      title: `활성 ${aggregates.starterRequired}경기 Starter 확인`,
      description: `현재 ${aggregates.starterEntered}/${aggregates.starterRequired}`,
      priority: "HIGH",
      category: "TODO",
      source: paths.personnelInput,
      recommendedCommand: null,
    });
  }
  if (aggregates.lineupEntered < aggregates.lineupRequired) {
    tasks.push({
      taskId: "kbo-lineup-intake",
      title: `활성 경기 Lineup 입력 (${aggregates.lineupEntered}/${aggregates.lineupRequired})`,
      description: active
        .filter((g) => g.lineup.status === "NOT_ENTERED")
        .map((g) => g.gameId)
        .join(", "),
      priority: "HIGH",
      category: "TODO",
      source: paths.personnelInput,
      recommendedCommand: null,
    });
  } else if (aggregates.lineupRequired > 0) {
    tasks.push({
      taskId: "kbo-lineup-ready",
      title: `Lineup ${aggregates.lineupEntered}/${aggregates.lineupRequired} 입력`,
      description: "활성 경기 라인업 완료",
      priority: "LOW",
      category: "DONE",
      source: personnelInput.ok ? rel(cwd, personnelInput.path) : "",
      recommendedCommand: null,
    });
  }
  if (!aggregates.predictionCreated && scheduleStatus === "READY") {
    tasks.push({
      taskId: "kbo-prediction-pending",
      title: "Prediction 미생성",
      description: "KBO Prediction Pipeline Not Implemented / NOT_CREATED",
      priority: "NORMAL",
      category: "TODO",
      source: paths.prediction,
      recommendedCommand: null,
    });
  }
  if (scheduleStatus === "BLOCKED") {
    tasks.push({
      taskId: "kbo-schedule-missing",
      title: "KBO Schedule 수집 필요",
      description: scheduleReason,
      priority: "CRITICAL",
      category: "TODO",
      source: rel(cwd, paths.schedule),
      recommendedCommand: null,
    });
  }

  const summaryLines = [
    `KBO Schedule ${scheduleGames.length}경기 (활성 ${active.length}, 취소 ${cancelledOnly})`,
    `Domestic Proto ${aggregates.protoEntered}/${aggregates.protoRequired}`,
    `Starter ${aggregates.starterEntered}/${aggregates.starterRequired}`,
    `Lineup ${aggregates.lineupEntered}/${aggregates.lineupRequired}`,
    `Prediction ${aggregates.predictionCreated ? "CREATED" : "NOT_CREATED"} · Overall ${overallStatus}`,
  ];

  const assistantBrief =
    scheduleStatus === "READY" &&
    aggregates.protoEntered === aggregates.protoRequired
      ? `오늘 KBO Schedule과 국내 프로토 입력은 완료되었습니다. 선발 ${aggregates.starterEntered}/${aggregates.starterRequired}, 라인업 ${aggregates.lineupEntered}/${aggregates.lineupRequired}. 취소된 ${cancelledOnly}경기는 추가 입력 대상이 아닙니다.`
      : scheduleStatus === "BLOCKED"
        ? "오늘 KBO Schedule이 없어 운영을 시작할 수 없습니다."
        : `오늘 KBO 운영 상태: ${overallStatus}.`;

  return {
    dateKst,
    games,
    schedule: {
      status: scheduleStatus,
      totalGames: scheduleGames.length,
      activeGames: active.length,
      cancelledGames: cancelledOnly,
      postponedGames: postponedGames.length,
      sourcePath: scheduleSourcePath,
      reason: scheduleReason,
    },
    aggregates,
    overallStatus,
    hardErrors,
    waitingReasons,
    tasks,
    assistantBrief,
    summaryLines,
    sourceArtifacts,
  };
}

export async function resolveDateKstForGameId(
  gameId: string,
  cwd = process.cwd(),
): Promise<string | null> {
  const dates = await listScheduleV1Dates(cwd);
  for (const dateKst of dates) {
    const p = path.join(
      cwd,
      "data",
      "research",
      "kbo",
      `${dateKst}-schedule-v1.json`,
    );
    const doc = await readJsonFile<Record<string, unknown>>(p);
    if (!doc.ok) continue;
    for (const raw of arr(doc.data.games)) {
      const g = rec(raw);
      if (g && str(g.gameId) === gameId) return dateKst;
    }
  }
  return null;
}
