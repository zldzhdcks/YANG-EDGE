/**
 * One-shot: merge admin-verified starters into 2026-08-01 personnel-input.
 * Allowed mutations: personnel-input primary, revision, starter intake audit.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tempPlayerKey } from "../src/lib/kbo/t45-personnel/validate-personnel-input";

const DATE = "2026-08-01";
const PRIMARY = path.join(
  "data/operator-input/kbo",
  `${DATE}-personnel-input-v1.json`,
);
const SCHEDULE = path.join("data/research/kbo", `${DATE}-schedule-v1.json`);
const AUDIT_DIR = "data/audits";

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

type DraftSide = { playerName: string; warnings?: string[] };

const STARTERS: Record<string, { home: DraftSide; away: DraftSide }> = {
  "kbo-181922": {
    home: { playerName: "곽빈" },
    away: { playerName: "카라스코" },
  },
  "kbo-181923": {
    home: { playerName: "김윤하" },
    away: { playerName: "타케다" },
  },
  "kbo-181924": {
    home: { playerName: "배제성" },
    away: {
      playerName: "짐맨",
      warnings: ["SCREEN_TEXT_ADMIN_CONFIRMATION_REQUIRED"],
    },
  },
};

const ACTIVE = new Set(["kbo-181922", "kbo-181923", "kbo-181924"]);
const CANCELLED = new Set(["kbo-181925", "kbo-181926"]);

const expectedMap: Record<string, { home: string; away: string }> = {
  "kbo-181922": { home: "두산", away: "LG" },
  "kbo-181923": { home: "키움", away: "SSG" },
  "kbo-181924": { home: "KT", away: "한화" },
  "kbo-181925": { home: "롯데", away: "삼성" },
  "kbo-181926": { home: "NC", away: "KIA" },
};

function main() {
  const sch = JSON.parse(readFileSync(SCHEDULE, "utf8")) as {
    games: Array<Record<string, unknown>>;
  };
  const beforeRaw = readFileSync(PRIMARY);
  const beforeHash = sha256(beforeRaw);
  const input = JSON.parse(beforeRaw.toString("utf8")) as Record<
    string,
    unknown
  > & {
    version?: number;
    games: Array<Record<string, unknown>>;
  };

  const scheduleById = new Map(
    sch.games.map((g) => [String(g.gameId), g] as const),
  );

  const errors: string[] = [];
  const auditSides: Array<Record<string, unknown>> = [];

  for (const gameId of ACTIVE) {
    const sg = scheduleById.get(gameId);
    if (!sg) errors.push(`SCHEDULE_MISSING_${gameId}`);
    else if (
      sg.cancellationStatus === "CANCELLED" ||
      /cancel/i.test(String(sg.statusAbstract ?? ""))
    ) {
      errors.push(`ACTIVE_MARKED_CANCELLED_${gameId}`);
    }
  }
  for (const gameId of CANCELLED) {
    if (!scheduleById.get(gameId)) errors.push(`CANCEL_SCHEDULE_MISSING_${gameId}`);
    if (STARTERS[gameId]) errors.push(`STARTER_DRAFT_FOR_CANCELLED_${gameId}`);
  }

  for (const g of input.games) {
    const id = String(g.gameId);
    const exp = expectedMap[id];
    const sg = scheduleById.get(id);
    if (!exp || !sg) {
      errors.push(`UNKNOWN_GAME_${id}`);
      continue;
    }
    if (g.homeTeam !== exp.home || sg.home !== exp.home) {
      errors.push(`HOME_MISMATCH_${id}:${String(g.homeTeam)}/${String(sg.home)}`);
    }
    if (g.awayTeam !== exp.away || sg.away !== exp.away) {
      errors.push(`AWAY_MISMATCH_${id}:${String(g.awayTeam)}/${String(sg.away)}`);
    }
  }

  if (existsSync(path.join("data/predictions/kbo", `${DATE}.json`))) {
    errors.push("PREDICTION_EXISTS_ABORT");
  }

  if (errors.length) {
    console.error("PRE_SAVE_VALIDATION_FAILED", errors);
    process.exit(1);
  }

  const enteredAt = new Date().toISOString();
  const observedAt = "2026-08-01T17:00:00+09:00";
  const sourceReference = "USER_PROVIDED_KBO_STARTER_SCREENSHOT_2026-08-01";
  const firstPitch = Date.parse("2026-08-01T18:00:00+09:00");
  const beforeCutoff = Date.now() < firstPitch;

  let starterSides = 0;

  for (const g of input.games) {
    const id = String(g.gameId);
    const home = g.home as {
      starter: unknown;
      lineup: unknown;
    };
    const away = g.away as {
      starter: unknown;
      lineup: unknown;
    };

    if (CANCELLED.has(id) || g.cancellationStatus === "CANCELLED") {
      home.starter = null;
      away.starter = null;
      home.lineup = null;
      away.lineup = null;
      continue;
    }

    const draft = STARTERS[id];
    if (!draft) {
      errors.push(`NO_DRAFT_${id}`);
      continue;
    }

    const makeStarter = (
      side: "home" | "away",
      team: string,
      draftSide: DraftSide,
    ) => {
      const playerName = draftSide.playerName.trim();
      if (!playerName) errors.push(`EMPTY_NAME_${id}_${side}`);
      const temporaryPlayerKey = tempPlayerKey(team, playerName);
      const warnings = [
        "PLAYER_ID_UNRESOLVED",
        ...(draftSide.warnings ?? []),
      ];
      starterSides++;
      auditSides.push({
        gameId: id,
        side,
        team,
        playerName,
        temporaryPlayerKey,
        playerId: null,
        mappingStatus: "NAME_ONLY",
        warnings,
        throwingHand: null,
      });
      return {
        playerId: null,
        temporaryPlayerKey,
        playerName,
        throwingHand: null,
      };
    };

    home.starter = makeStarter("home", String(g.homeTeam), draft.home);
    away.starter = makeStarter("away", String(g.awayTeam), draft.away);
    home.lineup = null;
    away.lineup = null;
    g.observedAt = observedAt;
    g.sourceType = "ADMIN_MANUAL_SCREENSHOT";
    g.sourceReference = sourceReference;
  }

  for (const g of input.games) {
    const id = String(g.gameId);
    if (!ACTIVE.has(id)) continue;
    const home = g.home as { starter: { playerName?: string } | null; lineup: unknown };
    const away = g.away as { starter: { playerName?: string } | null; lineup: unknown };
    if (
      home.starter?.playerName &&
      away.starter?.playerName &&
      home.starter.playerName === away.starter.playerName
    ) {
      errors.push(`DUPLICATE_STARTER_SAME_GAME_${id}`);
    }
    if (!g.domesticProto) errors.push(`PROTO_LOST_${id}`);
    if (home.lineup != null || away.lineup != null) {
      errors.push(`LINEUP_NOT_NULL_${id}`);
    }
  }

  for (const g of input.games) {
    const id = String(g.gameId);
    if (!CANCELLED.has(id)) continue;
    const home = g.home as { starter: unknown };
    const away = g.away as { starter: unknown };
    if (home.starter != null || away.starter != null) {
      errors.push(`CANCELLED_STARTER_${id}`);
    }
  }

  if (starterSides !== 6) errors.push(`STARTER_SIDE_COUNT_${starterSides}`);

  if (errors.length) {
    console.error("MERGE_VALIDATION_FAILED", errors);
    process.exit(1);
  }

  const priorVersion = Number(input.version) || 1;
  input.version = priorVersion + 1;
  input.updatedAt = enteredAt;
  input.updatedBy = "admin-starter-intake";
  input.sourceType = "ADMIN_MANUAL_SCREENSHOT";
  input.sourceReference = sourceReference;
  input.commercialUseStatus = "INTERNAL_ONLY";
  input.extractionMethod = "MANUAL_VISUAL_CONFIRMATION";
  input.confirmationNote =
    "사용자가 제공한 선발 스크린샷을 관리자가 확인함. Domestic Proto·취소 메타 유지. Lineup 미입력. PLAYER_ID_UNRESOLVED(NAME_ONLY). 짐맨 SCREEN_TEXT_ADMIN_CONFIRMATION_REQUIRED.";
  input.starterIntakeMeta = {
    enteredAt,
    observedAt,
    confirmationMethod: "ADMIN_VERIFIED",
    status: "ADMIN_VERIFIED",
    commercialUseStatus: "INTERNAL_ONLY",
    extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    sourceReference,
    priorVersion,
    priorHash: beforeHash,
    activeGames: 3,
    cancelledGames: 2,
    starterSidesEntered: 6,
    lineupEntered: 0,
  };

  const revStamp = enteredAt.replace(/[:.]/g, "-");
  const revPath = path.join(
    "data/operator-input/kbo",
    `${DATE}-personnel-input-v1.rev-${revStamp}.json`,
  );
  writeFileSync(revPath, beforeRaw);

  const out = `${JSON.stringify(input, null, 2)}\n`;
  writeFileSync(PRIMARY, out);
  const afterHash = sha256(out);

  const audit = {
    schemaVersion: "kbo-starter-intake-audit-v1",
    dateKst: DATE,
    enteredAt,
    observedAt,
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    confirmationMethod: "ADMIN_VERIFIED",
    commercialUseStatus: "INTERNAL_ONLY",
    extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
    sourceReference,
    primaryPath: PRIMARY.replace(/\\/g, "/"),
    revisionPath: revPath.replace(/\\/g, "/"),
    priorHash: beforeHash,
    afterHash,
    revisionHash: beforeHash,
    scheduleSource: SCHEDULE.replace(/\\/g, "/"),
    gameIdentityAudit: [...ACTIVE, ...CANCELLED].map((id) => {
      const sg = scheduleById.get(id)!;
      const pg = input.games.find((x) => x.gameId === id)!;
      const home = pg.home as {
        starter: { playerName?: string } | null;
      };
      const away = pg.away as {
        starter: { playerName?: string } | null;
      };
      return {
        gameId: id,
        scheduleHome: sg.home,
        scheduleAway: sg.away,
        personnelHome: pg.homeTeam,
        personnelAway: pg.awayTeam,
        cancellationStatus: sg.cancellationStatus ?? null,
        statusAbstract: sg.statusAbstract,
        starterHome: home.starter?.playerName ?? null,
        starterAway: away.starter?.playerName ?? null,
        protoPreserved: !!pg.domesticProto,
        lineup: null,
      };
    }),
    starters: auditSides,
    validation: {
      activeGames: 3,
      starterEnteredGames: 3,
      starterEnteredSides: 6,
      lineupEntered: 0,
      protoEntered: 3,
      cancelledNotApplicable: 2,
      duplicateStarters: 0,
      emptyNames: 0,
      t30Unlocked: true,
      predictionExists: false,
      cutoffBeforeFirstPitch: beforeCutoff,
    },
    mutationsAllowed: [
      PRIMARY.replace(/\\/g, "/"),
      revPath.replace(/\\/g, "/"),
      path.join(AUDIT_DIR, `${DATE}-kbo-starter-intake-v1.json`).replace(/\\/g, "/"),
    ],
  };

  mkdirSync(AUDIT_DIR, { recursive: true });
  const auditPath = path.join(AUDIT_DIR, `${DATE}-kbo-starter-intake-v1.json`);
  writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        enteredAt,
        observedAt,
        version: input.version,
        priorHash: beforeHash.slice(0, 16),
        afterHash: afterHash.slice(0, 16),
        revisionPath: revPath.replace(/\\/g, "/"),
        auditPath: auditPath.replace(/\\/g, "/"),
        cutoffBeforeFirstPitch: beforeCutoff,
        starters: auditSides.map(
          (s) =>
            `${s.gameId} ${s.side} ${s.team}=${s.playerName} (${s.temporaryPlayerKey})`,
        ),
      },
      null,
      2,
    ),
  );
}

main();
