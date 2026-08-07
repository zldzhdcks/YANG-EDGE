/**
 * Partial lineup intake: kbo-181922 + kbo-181924.
 * Corrects 한화 starter 짐맨 → 짐머맨. Leaves kbo-181923 lineup null.
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

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

type BatterDraft = {
  slot: number;
  playerName: string;
  position: string;
  bats: "L" | "R" | "S";
};

function batters(
  rows: Array<[number, string, string, "L" | "R" | "S"]>,
): BatterDraft[] {
  return rows.map(([slot, playerName, position, bats]) => ({
    slot,
    playerName,
    position,
    bats,
  }));
}

const LINEUPS: Record<
  string,
  {
    homeStarter: { playerName: string; throwingHand: "L" | "R" | "S" };
    awayStarter: {
      playerName: string;
      throwingHand: "L" | "R" | "S";
      correctionReason?: string;
      previousName?: string;
    };
    homeLineup: BatterDraft[];
    awayLineup: BatterDraft[];
  }
> = {
  "kbo-181922": {
    awayStarter: { playerName: "카라스코", throwingHand: "R" },
    homeStarter: { playerName: "곽빈", throwingHand: "R" },
    awayLineup: batters([
      [1, "홍창기", "우익수", "L"],
      [2, "박해민", "중견수", "L"],
      [3, "오스틴", "1루수", "R"],
      [4, "문정빈", "지명타자", "R"],
      [5, "송찬의", "좌익수", "R"],
      [6, "오지환", "유격수", "L"],
      [7, "구본혁", "3루수", "R"],
      [8, "이주헌", "포수", "R"],
      [9, "신민재", "2루수", "L"],
    ]),
    homeLineup: batters([
      [1, "박찬호", "유격수", "R"],
      [2, "세베리노", "1루수", "S"],
      [3, "박준순", "2루수", "R"],
      [4, "양의지", "지명타자", "R"],
      [5, "김민석", "좌익수", "L"],
      [6, "안재석", "3루수", "L"],
      [7, "김대한", "우익수", "R"],
      [8, "조수행", "중견수", "L"],
      [9, "윤준호", "포수", "R"],
    ]),
  },
  "kbo-181924": {
    awayStarter: {
      playerName: "짐머맨",
      throwingHand: "L",
      previousName: "짐맨",
      correctionReason: "SCREEN_TEXT_CLARIFIED_BY_LINEUP_IMAGE",
    },
    homeStarter: { playerName: "배제성", throwingHand: "R" },
    awayLineup: batters([
      [1, "이원석", "중견수", "R"],
      [2, "페라자", "우익수", "S"],
      [3, "문현빈", "좌익수", "L"],
      [4, "강백호", "지명타자", "L"],
      [5, "노시환", "3루수", "R"],
      [6, "채은성", "1루수", "R"],
      [7, "허인서", "포수", "R"],
      [8, "이도윤", "2루수", "L"],
      [9, "심우준", "유격수", "R"],
    ]),
    homeLineup: batters([
      [1, "최원준", "중견수", "L"],
      [2, "김현수", "지명타자", "L"],
      [3, "안현민", "우익수", "R"],
      [4, "헬리어드", "좌익수", "L"],
      [5, "김상수", "2루수", "R"],
      [6, "허경민", "3루수", "R"],
      [7, "오윤석", "1루수", "R"],
      [8, "한승택", "포수", "R"],
      [9, "장준원", "유격수", "R"],
    ]),
  },
};

const EXPECTED: Record<string, { home: string; away: string }> = {
  "kbo-181922": { home: "두산", away: "LG" },
  "kbo-181923": { home: "키움", away: "SSG" },
  "kbo-181924": { home: "KT", away: "한화" },
  "kbo-181925": { home: "롯데", away: "삼성" },
  "kbo-181926": { home: "NC", away: "KIA" },
};

function toLineupInput(team: string, drafts: BatterDraft[]) {
  return drafts.map((b) => {
    const temporaryPlayerKey = tempPlayerKey(team, b.playerName);
    return {
      slot: b.slot,
      playerId: null as string | null,
      temporaryPlayerKey,
      playerName: b.playerName,
      position: b.position,
      bats: b.bats,
      designatedHitter: b.position === "지명타자",
    };
  });
}

function validateLineupDraft(
  gameId: string,
  side: string,
  drafts: BatterDraft[],
): string[] {
  const errors: string[] = [];
  if (drafts.length !== 9) errors.push(`${gameId}_${side}_COUNT_${drafts.length}`);
  const slots = drafts.map((d) => d.slot).sort((a, b) => a - b);
  if (slots.join(",") !== "1,2,3,4,5,6,7,8,9") {
    errors.push(`${gameId}_${side}_SLOTS`);
  }
  const names = drafts.map((d) => d.playerName.normalize("NFKC").toLowerCase());
  if (new Set(names).size !== names.length) {
    errors.push(`${gameId}_${side}_DUP_PLAYER`);
  }
  for (const d of drafts) {
    if (!d.playerName.trim()) errors.push(`${gameId}_${side}_EMPTY_NAME_${d.slot}`);
    if (!d.position.trim()) errors.push(`${gameId}_${side}_EMPTY_POS_${d.slot}`);
    if (!["L", "R", "S"].includes(d.bats)) {
      errors.push(`${gameId}_${side}_BATS_${d.slot}`);
    }
  }
  return errors;
}

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

  for (const [id, exp] of Object.entries(EXPECTED)) {
    const sg = scheduleById.get(id);
    const pg = input.games.find((g) => g.gameId === id);
    if (!sg || !pg) {
      errors.push(`MISSING_${id}`);
      continue;
    }
    if (sg.home !== exp.home || pg.homeTeam !== exp.home) {
      errors.push(`HOME_MISMATCH_${id}`);
    }
    if (sg.away !== exp.away || pg.awayTeam !== exp.away) {
      errors.push(`AWAY_MISMATCH_${id}`);
    }
  }

  for (const id of ["kbo-181922", "kbo-181924"] as const) {
    const draft = LINEUPS[id]!;
    errors.push(...validateLineupDraft(id, "home", draft.homeLineup));
    errors.push(...validateLineupDraft(id, "away", draft.awayLineup));
  }

  if (existsSync(path.join("data/predictions/kbo", `${DATE}.json`))) {
    errors.push("PREDICTION_EXISTS");
  }

  if (errors.length) {
    console.error("PRE_SAVE_FAILED", errors);
    process.exit(1);
  }

  const enteredAt = new Date().toISOString();
  const observedAt = "2026-08-01T17:15:00+09:00";
  const sourceReference =
    "USER_PROVIDED_KBO_LINEUP_SCREENSHOT_PARTIAL_2026-08-01";
  const firstPitch = Date.parse("2026-08-01T18:00:00+09:00");
  const beforeCutoff = Date.now() < firstPitch;

  const corrections: Array<Record<string, unknown>> = [];
  const lineupSides: Array<Record<string, unknown>> = [];
  let batterCount = 0;

  for (const g of input.games) {
    const id = String(g.gameId);
    const home = g.home as {
      starter: Record<string, unknown> | null;
      lineup: unknown;
    };
    const away = g.away as {
      starter: Record<string, unknown> | null;
      lineup: unknown;
    };

    // Preserve cancelled
    if (id === "kbo-181925" || id === "kbo-181926") {
      if (home.lineup != null || away.lineup != null) {
        errors.push(`CANCELLED_LINEUP_TOUCH_${id}`);
      }
      continue;
    }

    // Keep 181923 starters exactly; lineup stays null
    if (id === "kbo-181923") {
      home.lineup = null;
      away.lineup = null;
      continue;
    }

    const draft = LINEUPS[id];
    if (!draft) {
      errors.push(`UNEXPECTED_ACTIVE_${id}`);
      continue;
    }

    const homeTeam = String(g.homeTeam);
    const awayTeam = String(g.awayTeam);

    // Starters (+ correction)
    const prevAwayName = away.starter?.playerName;
    away.starter = {
      playerId: null,
      temporaryPlayerKey: tempPlayerKey(awayTeam, draft.awayStarter.playerName),
      playerName: draft.awayStarter.playerName,
      throwingHand: draft.awayStarter.throwingHand,
    };
    home.starter = {
      playerId: null,
      temporaryPlayerKey: tempPlayerKey(homeTeam, draft.homeStarter.playerName),
      playerName: draft.homeStarter.playerName,
      throwingHand: draft.homeStarter.throwingHand,
    };

    if (
      draft.awayStarter.previousName &&
      prevAwayName === draft.awayStarter.previousName
    ) {
      corrections.push({
        gameId: id,
        side: "away",
        team: awayTeam,
        from: draft.awayStarter.previousName,
        to: draft.awayStarter.playerName,
        reason: draft.awayStarter.correctionReason,
        previousTemporaryPlayerKey: tempPlayerKey(
          awayTeam,
          draft.awayStarter.previousName,
        ),
        temporaryPlayerKey: tempPlayerKey(
          awayTeam,
          draft.awayStarter.playerName,
        ),
      });
    }

    home.lineup = toLineupInput(homeTeam, draft.homeLineup);
    away.lineup = toLineupInput(awayTeam, draft.awayLineup);
    batterCount += 18;

    lineupSides.push({
      gameId: id,
      homeTeam,
      awayTeam,
      homeBatters: (home.lineup as unknown[]).length,
      awayBatters: (away.lineup as unknown[]).length,
    });

    if (!g.domesticProto) errors.push(`PROTO_LOST_${id}`);

    g.observedAt = observedAt;
    g.sourceType = "ADMIN_MANUAL_SCREENSHOT";
    g.sourceReference = sourceReference;
  }

  // Post checks
  const g923 = input.games.find((g) => g.gameId === "kbo-181923")!;
  const h923 = g923.home as { lineup: unknown; starter: { playerName: string } };
  const a923 = g923.away as { lineup: unknown; starter: { playerName: string } };
  if (h923.lineup != null || a923.lineup != null) {
    errors.push("KBO181923_LINEUP_NOT_NULL");
  }
  if (h923.starter?.playerName !== "김윤하" || a923.starter?.playerName !== "타케다") {
    errors.push("KBO181923_STARTER_CHANGED");
  }

  const g924 = input.games.find((g) => g.gameId === "kbo-181924")!;
  const a924 = g924.away as { starter: { playerName: string } };
  if (a924.starter.playerName !== "짐머맨") errors.push("ZIMMERMAN_NOT_CORRECTED");

  for (const id of ["kbo-181925", "kbo-181926"]) {
    const g = input.games.find((x) => x.gameId === id)!;
    const home = g.home as { starter: unknown; lineup: unknown };
    const away = g.away as { starter: unknown; lineup: unknown };
    if (home.starter != null || away.starter != null || home.lineup != null || away.lineup != null) {
      errors.push(`CANCELLED_MUTATED_${id}`);
    }
    if (g.cancellationStatus !== "CANCELLED") errors.push(`CANCEL_FLAG_${id}`);
  }

  // Proto count
  let proto = 0;
  for (const id of ["kbo-181922", "kbo-181923", "kbo-181924"]) {
    const g = input.games.find((x) => x.gameId === id)!;
    if (g.domesticProto) proto++;
  }
  if (proto !== 3) errors.push(`PROTO_COUNT_${proto}`);
  if (batterCount !== 36) errors.push(`BATTER_COUNT_${batterCount}`);

  if (errors.length) {
    console.error("POST_MERGE_FAILED", errors);
    process.exit(1);
  }

  const priorVersion = Number(input.version) || 2;
  input.version = priorVersion + 1;
  input.updatedAt = enteredAt;
  input.updatedBy = "admin-partial-lineup-intake";
  input.sourceType = "ADMIN_MANUAL_SCREENSHOT";
  input.sourceReference = sourceReference;
  input.commercialUseStatus = "INTERNAL_ONLY";
  input.extractionMethod = "MANUAL_VISUAL_CONFIRMATION";
  input.confirmationNote =
    "부분 라인업 intake: kbo-181922·kbo-181924 ADMIN_VERIFIED. kbo-181923 lineup NOT_ENTERED(발표 대기). 한화 선발 짐맨→짐머맨 정정. Proto·취소 유지.";
  input.partialLineupIntakeMeta = {
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
    lineupGamesEntered: 2,
    lineupGamesPending: ["kbo-181923"],
    batterCount: 36,
    starterCorrection: corrections,
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

  const auditPath = path.join(
    "data/audits",
    `${DATE}-kbo-partial-lineup-intake-v1.json`,
  );
  mkdirSync(path.dirname(auditPath), { recursive: true });
  writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        schemaVersion: "kbo-partial-lineup-intake-audit-v1",
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
        lineupSides,
        batterCount: 36,
        starterCorrections: corrections,
        pendingLineupGames: ["kbo-181923"],
        cancelledUntouched: ["kbo-181925", "kbo-181926"],
        validation: {
          activeGames: 3,
          starterEntered: 3,
          lineupEnteredGames: 2,
          lineupEnteredSides: 4,
          protoEntered: 3,
          cancelledNotApplicable: 2,
          cutoffBeforeFirstPitch: beforeCutoff,
          t30Unlocked: true,
        },
      },
      null,
      2,
    )}\n`,
  );

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
        batterCount: 36,
        corrections,
        pending: ["kbo-181923"],
      },
      null,
      2,
    ),
  );
}

main();
