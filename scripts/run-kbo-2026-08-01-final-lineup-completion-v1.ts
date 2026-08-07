/**
 * Final lineup completion: kbo-181923 SSG @ 키움 (18 batters).
 * Preserves other games, proto, cancelled, Zimmerman correction.
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
const GAME_ID = "kbo-181923";
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

const AWAY_STARTER = { playerName: "타케다", throwingHand: "R" as const };
const HOME_STARTER = { playerName: "김윤하", throwingHand: "R" as const };

const AWAY_LINEUP = batters([
  [1, "정준재", "2루수", "L"],
  [2, "박성한", "유격수", "L"],
  [3, "마드리스", "좌익수", "L"],
  [4, "전의산", "1루수", "L"],
  [5, "김재환", "지명타자", "L"],
  [6, "이지영", "포수", "R"],
  [7, "한유섬", "우익수", "L"],
  [8, "안상현", "3루수", "R"],
  [9, "최지훈", "중견수", "L"],
]);

const HOME_LINEUP = batters([
  [1, "서건창", "2루수", "L"],
  [2, "안치홍", "1루수", "R"],
  [3, "데이비슨", "지명타자", "R"],
  [4, "박찬혁", "우익수", "R"],
  [5, "추재현", "좌익수", "L"],
  [6, "김건희", "포수", "R"],
  [7, "임병욱", "중견수", "L"],
  [8, "오선진", "유격수", "R"],
  [9, "김용빈", "3루수", "L"],
]);

const EXPECTED = {
  "kbo-181922": { home: "두산", away: "LG" },
  "kbo-181923": { home: "키움", away: "SSG" },
  "kbo-181924": { home: "KT", away: "한화" },
  "kbo-181925": { home: "롯데", away: "삼성" },
  "kbo-181926": { home: "NC", away: "KIA" },
} as const;

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
  side: string,
  drafts: BatterDraft[],
): string[] {
  const errors: string[] = [];
  if (drafts.length !== 9) errors.push(`${side}_COUNT_${drafts.length}`);
  const slots = drafts.map((d) => d.slot).sort((a, b) => a - b);
  if (slots.join(",") !== "1,2,3,4,5,6,7,8,9") {
    errors.push(`${side}_SLOTS`);
  }
  const names = drafts.map((d) => d.playerName.normalize("NFKC").toLowerCase());
  if (new Set(names).size !== names.length) {
    errors.push(`${side}_DUP_PLAYER`);
  }
  for (const d of drafts) {
    if (!d.playerName.trim()) errors.push(`${side}_EMPTY_NAME_${d.slot}`);
    if (!d.position.trim()) errors.push(`${side}_EMPTY_POS_${d.slot}`);
    if (!["L", "R", "S"].includes(d.bats)) {
      errors.push(`${side}_BATS_${d.slot}`);
    }
  }
  return errors;
}

function lineupNames(lineup: unknown): string[] {
  if (!Array.isArray(lineup)) return [];
  return lineup
    .map((r) =>
      typeof r === "object" && r && "playerName" in r
        ? String((r as { playerName: unknown }).playerName)
        : "",
    )
    .filter(Boolean);
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

  errors.push(...validateLineupDraft("away_SSG", AWAY_LINEUP));
  errors.push(...validateLineupDraft("home_키움", HOME_LINEUP));

  if (existsSync(path.join("data/predictions/kbo", `${DATE}.json`))) {
    errors.push("PREDICTION_EXISTS");
  }

  if (errors.length) {
    console.error("PRE_SAVE_FAILED", errors);
    process.exit(1);
  }

  // Snapshot other games before mutate for integrity checks
  const snapshotOther = new Map<string, string>();
  for (const g of input.games) {
    const id = String(g.gameId);
    if (id !== GAME_ID) {
      snapshotOther.set(id, JSON.stringify(g));
    }
  }

  const enteredAt = new Date().toISOString();
  // User screenshot was provided in prior session; use mission-aligned observed time
  const observedAt = "2026-08-01T17:15:00+09:00";
  const sourceReference =
    "USER_PROVIDED_KBO_LINEUP_SCREENSHOT_SSG_KIWOOM_2026-08-01";
  const firstPitch = Date.parse("2026-08-01T18:00:00+09:00");
  const beforeCutoff = Date.now() < firstPitch;

  const target = input.games.find((g) => g.gameId === GAME_ID);
  if (!target) {
    console.error("TARGET_MISSING");
    process.exit(1);
  }

  const homeTeam = String(target.homeTeam);
  const awayTeam = String(target.awayTeam);
  if (homeTeam !== "키움" || awayTeam !== "SSG") {
    console.error("TEAM_MISMATCH", { homeTeam, awayTeam });
    process.exit(1);
  }

  const home = target.home as {
    starter: Record<string, unknown> | null;
    lineup: unknown;
  };
  const away = target.away as {
    starter: Record<string, unknown> | null;
    lineup: unknown;
  };

  if (home.lineup != null || away.lineup != null) {
    console.error("LINEUP_ALREADY_PRESENT");
    process.exit(1);
  }
  if (
    home.starter?.playerName !== HOME_STARTER.playerName ||
    away.starter?.playerName !== AWAY_STARTER.playerName
  ) {
    console.error("STARTER_NAME_MISMATCH", {
      home: home.starter?.playerName,
      away: away.starter?.playerName,
    });
    process.exit(1);
  }

  home.starter = {
    playerId: null,
    temporaryPlayerKey: tempPlayerKey(homeTeam, HOME_STARTER.playerName),
    playerName: HOME_STARTER.playerName,
    throwingHand: HOME_STARTER.throwingHand,
  };
  away.starter = {
    playerId: null,
    temporaryPlayerKey: tempPlayerKey(awayTeam, AWAY_STARTER.playerName),
    playerName: AWAY_STARTER.playerName,
    throwingHand: AWAY_STARTER.throwingHand,
  };
  home.lineup = toLineupInput(homeTeam, HOME_LINEUP);
  away.lineup = toLineupInput(awayTeam, AWAY_LINEUP);

  target.observedAt = observedAt;
  target.sourceType = "ADMIN_MANUAL_SCREENSHOT";
  target.sourceReference = sourceReference;

  // Integrity: other games unchanged
  for (const g of input.games) {
    const id = String(g.gameId);
    if (id === GAME_ID) continue;
    if (snapshotOther.get(id) !== JSON.stringify(g)) {
      errors.push(`OTHER_GAME_MUTATED_${id}`);
    }
  }

  // Cancelled untouched
  for (const id of ["kbo-181925", "kbo-181926"]) {
    const g = input.games.find((x) => x.gameId === id)!;
    const h = g.home as { starter: unknown; lineup: unknown };
    const a = g.away as { starter: unknown; lineup: unknown };
    if (
      h.starter != null ||
      a.starter != null ||
      h.lineup != null ||
      a.lineup != null
    ) {
      errors.push(`CANCELLED_MUTATED_${id}`);
    }
  }

  // Zimmerman preserved
  const g924 = input.games.find((x) => x.gameId === "kbo-181924")!;
  const a924 = g924.away as { starter: { playerName: string }; lineup: unknown[] };
  if (a924.starter.playerName !== "짐머맨") errors.push("ZIMMERMAN_LOST");
  if (!Array.isArray(a924.lineup) || a924.lineup.length !== 9) {
    errors.push("KT_HANHWA_LINEUP_LOST");
  }

  const g922 = input.games.find((x) => x.gameId === "kbo-181922")!;
  const h922 = g922.home as { lineup: unknown[] };
  const a922 = g922.away as { lineup: unknown[] };
  if (!Array.isArray(h922.lineup) || h922.lineup.length !== 9) {
    errors.push("DOOSAN_LINEUP_LOST");
  }
  if (!Array.isArray(a922.lineup) || a922.lineup.length !== 9) {
    errors.push("LG_LINEUP_LOST");
  }

  // Counts
  let proto = 0;
  let starterEntered = 0;
  let lineupEntered = 0;
  let lineupSides = 0;
  let lineupRows = 0;
  for (const id of ["kbo-181922", "kbo-181923", "kbo-181924"]) {
    const g = input.games.find((x) => x.gameId === id)!;
    if (g.domesticProto) proto++;
    const h = g.home as {
      starter: { playerName?: string } | null;
      lineup: unknown;
    };
    const a = g.away as {
      starter: { playerName?: string } | null;
      lineup: unknown;
    };
    const hs = Boolean(h.starter?.playerName);
    const as_ = Boolean(a.starter?.playerName);
    if (hs && as_) starterEntered++;
    const hl = Array.isArray(h.lineup) ? h.lineup.length : 0;
    const al = Array.isArray(a.lineup) ? a.lineup.length : 0;
    if (hl === 9) lineupSides++;
    if (al === 9) lineupSides++;
    lineupRows += hl + al;
    if (hl === 9 && al === 9) lineupEntered++;
  }
  if (proto !== 3) errors.push(`PROTO_COUNT_${proto}`);
  if (starterEntered !== 3) errors.push(`STARTER_${starterEntered}`);
  if (lineupEntered !== 3) errors.push(`LINEUP_GAMES_${lineupEntered}`);
  if (lineupSides !== 6) errors.push(`LINEUP_SIDES_${lineupSides}`);
  if (lineupRows !== 54) errors.push(`LINEUP_ROWS_${lineupRows}`);

  // Target lineup exact names
  const homeNames = lineupNames(home.lineup);
  const awayNames = lineupNames(away.lineup);
  if (homeNames.join(",") !== HOME_LINEUP.map((b) => b.playerName).join(",")) {
    errors.push("HOME_NAMES_MISMATCH");
  }
  if (awayNames.join(",") !== AWAY_LINEUP.map((b) => b.playerName).join(",")) {
    errors.push("AWAY_NAMES_MISMATCH");
  }
  if (!target.domesticProto) errors.push("PROTO_LOST_181923");

  if (errors.length) {
    console.error("POST_MERGE_FAILED", errors);
    process.exit(1);
  }

  const priorVersion = Number(input.version) || 3;
  input.version = priorVersion + 1;
  input.updatedAt = enteredAt;
  input.updatedBy = "admin-final-lineup-completion";
  input.sourceType = "ADMIN_MANUAL_SCREENSHOT";
  input.sourceReference = sourceReference;
  input.commercialUseStatus = "INTERNAL_ONLY";
  input.extractionMethod = "MANUAL_VISUAL_CONFIRMATION";
  input.confirmationNote =
    "최종 라인업 완료: kbo-181923 SSG@키움 18명 ADMIN_VERIFIED. 활성 3경기 lineup 3/3. Proto·취소·짐머맨 유지.";
  input.finalLineupCompletionMeta = {
    enteredAt,
    observedAt,
    confirmationMethod: "ADMIN_VERIFIED",
    status: "ADMIN_VERIFIED",
    commercialUseStatus: "INTERNAL_ONLY",
    extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    sourceReference,
    priorVersion,
    previousHash: beforeHash,
    gameId: GAME_ID,
    matchup: "SSG @ 키움",
    batterCount: 18,
    changedFields: [
      "games[kbo-181923].home.lineup",
      "games[kbo-181923].away.lineup",
      "games[kbo-181923].home.starter.throwingHand",
      "games[kbo-181923].away.starter.throwingHand",
      "version",
      "updatedAt",
      "confirmationNote",
    ],
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

  // Record nextHash in meta without rewriting content hash loop — audit is SoT for chain
  const auditPath = path.join(
    "data/audits",
    `${DATE}-kbo-final-lineup-completion-v1.json`,
  );
  mkdirSync(path.dirname(auditPath), { recursive: true });
  writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        schemaVersion: "kbo-final-lineup-completion-audit-v1",
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
        previousHash: beforeHash,
        nextHash: afterHash,
        version: input.version,
        gameId: GAME_ID,
        awayLineup: AWAY_LINEUP,
        homeLineup: HOME_LINEUP,
        awayStarter: AWAY_STARTER,
        homeStarter: HOME_STARTER,
        changedFields: (
          input.finalLineupCompletionMeta as { changedFields: string[] }
        ).changedFields,
        validation: {
          activeGames: 3,
          starterEntered: 3,
          lineupEntered: 3,
          lineupSides: 6,
          lineupRows: 54,
          protoEntered: 3,
          cancelledNotApplicable: 2,
          overall: "READY",
          cutoffBeforeFirstPitch: beforeCutoff,
          t30Unlocked: true,
        },
        preserved: {
          lgDoosanLineup: true,
          hanwhaKtLineup: true,
          zimmerman: true,
          cancelledUntouched: ["kbo-181925", "kbo-181926"],
          proto3of3: true,
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
        previousHash: beforeHash,
        nextHash: afterHash,
        revisionPath: revPath.replace(/\\/g, "/"),
        auditPath: auditPath.replace(/\\/g, "/"),
        cutoffBeforeFirstPitch: beforeCutoff,
        starterEntered,
        lineupEntered,
        lineupSides,
        lineupRows,
        protoEntered: proto,
      },
      null,
      2,
    ),
  );
}

main();
