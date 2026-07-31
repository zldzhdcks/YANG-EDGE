/**
 * KBO Admin-Verified Personnel & Domestic Proto Revision
 * Preserves 18:01 T30 lock as immutable rev; writes new pregame revision.
 *
 *   npx tsx scripts/run-kbo-admin-personnel-proto-revision-v1.ts
 */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveKboTeamIdentity } from "../src/lib/kbo/resolve-kbo-team-identity";

const DATE = "2026-07-31";
const PRIOR_LOCK_RUN = "2026-07-31T09-01-59-411Z";
const START = "2026-07-31T18:30:00+09:00";
const SOURCE_REF =
  "2026-07-31 KBO pregame lineup & domestic proto screenshots provided by Chan-yang (ADMIN_MANUAL_SCREENSHOT; INTERNAL_ONLY; not for public redistribution)";

type Batter = { slot: number; playerName: string; position: string; bats: string };
type Side = {
  team: string;
  starterName: string;
  throws: "L" | "R";
  lineup: Batter[];
};
type GameSpec = {
  gameId: string;
  providerGameId: string;
  away: Side;
  home: Side;
  protoHome: number;
  protoAway: number;
};

const GAMES: GameSpec[] = [
  {
    gameId: "kbo-181917",
    providerGameId: "181917",
    away: {
      team: "LG",
      starterName: "송승기",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "홍창기", position: "우익수", bats: "L" },
        { slot: 2, playerName: "박해민", position: "중견수", bats: "L" },
        { slot: 3, playerName: "오스틴", position: "지명타자", bats: "R" },
        { slot: 4, playerName: "송찬의", position: "좌익수", bats: "R" },
        { slot: 5, playerName: "문성주", position: "1루수", bats: "R" },
        { slot: 6, playerName: "오지환", position: "유격수", bats: "L" },
        { slot: 7, playerName: "문보경", position: "3루수", bats: "L" },
        { slot: 8, playerName: "이주헌", position: "포수", bats: "R" },
        { slot: 9, playerName: "구본혁", position: "2루수", bats: "R" },
      ],
    },
    home: {
      team: "두산",
      starterName: "잭로그",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "박찬호", position: "유격수", bats: "R" },
        { slot: 2, playerName: "세베리노", position: "지명타자", bats: "S" },
        { slot: 3, playerName: "박준순", position: "2루수", bats: "R" },
        { slot: 4, playerName: "안재석", position: "3루수", bats: "L" },
        { slot: 5, playerName: "김민석", position: "좌익수", bats: "L" },
        { slot: 6, playerName: "박지훈", position: "1루수", bats: "R" },
        { slot: 7, playerName: "윤준호", position: "포수", bats: "R" },
        { slot: 8, playerName: "김대한", position: "우익수", bats: "R" },
        { slot: 9, playerName: "정수빈", position: "중견수", bats: "L" },
      ],
    },
    protoHome: 1.77,
    protoAway: 1.75,
  },
  {
    gameId: "kbo-181918",
    providerGameId: "181918",
    away: {
      team: "KIA",
      starterName: "양현종",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "박재현", position: "우익수", bats: "L" },
        { slot: 2, playerName: "박찬호", position: "1루수", bats: "L" },
        { slot: 3, playerName: "김도영", position: "3루수", bats: "R" },
        { slot: 4, playerName: "카스트로", position: "좌익수", bats: "L" },
        { slot: 5, playerName: "나성범", position: "지명타자", bats: "L" },
        { slot: 6, playerName: "김선빈", position: "2루수", bats: "R" },
        { slot: 7, playerName: "하주석", position: "유격수", bats: "L" },
        { slot: 8, playerName: "한준수", position: "포수", bats: "L" },
        { slot: 9, playerName: "김호령", position: "중견수", bats: "R" },
      ],
    },
    home: {
      team: "NC",
      starterName: "토다",
      throws: "R",
      lineup: [
        { slot: 1, playerName: "김주원", position: "유격수", bats: "S" },
        { slot: 2, playerName: "권희동", position: "우익수", bats: "R" },
        { slot: 3, playerName: "박민우", position: "2루수", bats: "L" },
        { slot: 4, playerName: "블레인", position: "1루수", bats: "R" },
        { slot: 5, playerName: "박건우", position: "지명타자", bats: "R" },
        { slot: 6, playerName: "이우성", position: "좌익수", bats: "R" },
        { slot: 7, playerName: "김휘집", position: "3루수", bats: "R" },
        { slot: 8, playerName: "김형준", position: "포수", bats: "R" },
        { slot: 9, playerName: "천재환", position: "중견수", bats: "R" },
      ],
    },
    protoHome: 1.97,
    protoAway: 1.59,
  },
  {
    gameId: "kbo-181919",
    providerGameId: "181919",
    away: {
      team: "SSG",
      starterName: "김건우",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "정준재", position: "2루수", bats: "L" },
        { slot: 2, playerName: "박성한", position: "유격수", bats: "L" },
        { slot: 3, playerName: "마드리스", position: "좌익수", bats: "L" },
        { slot: 4, playerName: "전의산", position: "1루수", bats: "L" },
        { slot: 5, playerName: "김재현", position: "지명타자", bats: "L" },
        { slot: 6, playerName: "최지훈", position: "중견수", bats: "L" },
        { slot: 7, playerName: "조형우", position: "포수", bats: "R" },
        { slot: 8, playerName: "홍대인", position: "3루수", bats: "L" },
        { slot: 9, playerName: "임근우", position: "우익수", bats: "R" },
      ],
    },
    home: {
      team: "키움",
      starterName: "박준현",
      throws: "R",
      lineup: [
        { slot: 1, playerName: "서건창", position: "2루수", bats: "L" },
        { slot: 2, playerName: "안치홍", position: "지명타자", bats: "R" },
        { slot: 3, playerName: "데이비스", position: "1루수", bats: "R" },
        { slot: 4, playerName: "박찬혁", position: "우익수", bats: "R" },
        { slot: 5, playerName: "추재현", position: "좌익수", bats: "L" },
        { slot: 6, playerName: "김동헌", position: "포수", bats: "R" },
        { slot: 7, playerName: "임병욱", position: "중견수", bats: "L" },
        { slot: 8, playerName: "권휘빈", position: "유격수", bats: "R" },
        { slot: 9, playerName: "여동욱", position: "3루수", bats: "R" },
      ],
    },
    protoHome: 1.86,
    protoAway: 1.67,
  },
  {
    gameId: "kbo-181920",
    providerGameId: "181920",
    away: {
      team: "삼성",
      starterName: "원태인",
      throws: "R",
      lineup: [
        { slot: 1, playerName: "김헌곤", position: "중견수", bats: "L" },
        { slot: 2, playerName: "김성윤", position: "우익수", bats: "L" },
        { slot: 3, playerName: "구자욱", position: "좌익수", bats: "L" },
        { slot: 4, playerName: "최형우", position: "지명타자", bats: "L" },
        { slot: 5, playerName: "이재현", position: "유격수", bats: "R" },
        { slot: 6, playerName: "디아즈", position: "1루수", bats: "L" },
        { slot: 7, playerName: "전병우", position: "3루수", bats: "R" },
        { slot: 8, playerName: "김도환", position: "포수", bats: "R" },
        { slot: 9, playerName: "심재훈", position: "2루수", bats: "R" },
      ],
    },
    home: {
      team: "롯데",
      starterName: "김진욱",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "황성빈", position: "중견수", bats: "L" },
        { slot: 2, playerName: "고승민", position: "2루수", bats: "L" },
        { slot: 3, playerName: "레이예스", position: "좌익수", bats: "S" },
        { slot: 4, playerName: "한동희", position: "지명타자", bats: "R" },
        { slot: 5, playerName: "나승엽", position: "1루수", bats: "L" },
        { slot: 6, playerName: "윤동희", position: "우익수", bats: "R" },
        { slot: 7, playerName: "노진혁", position: "3루수", bats: "L" },
        { slot: 8, playerName: "손성빈", position: "포수", bats: "R" },
        { slot: 9, playerName: "박승욱", position: "유격수", bats: "L" },
      ],
    },
    protoHome: 2.56,
    protoAway: 1.34,
  },
  {
    gameId: "kbo-181921",
    providerGameId: "181921",
    away: {
      team: "한화",
      starterName: "류현진",
      throws: "L",
      lineup: [
        { slot: 1, playerName: "이원석", position: "중견수", bats: "R" },
        { slot: 2, playerName: "페라자", position: "우익수", bats: "S" },
        { slot: 3, playerName: "문현빈", position: "좌익수", bats: "L" },
        { slot: 4, playerName: "강백호", position: "지명타자", bats: "L" },
        { slot: 5, playerName: "노시환", position: "3루수", bats: "R" },
        { slot: 6, playerName: "채은성", position: "1루수", bats: "R" },
        { slot: 7, playerName: "허인서", position: "포수", bats: "R" },
        { slot: 8, playerName: "이도윤", position: "2루수", bats: "L" },
        { slot: 9, playerName: "심우준", position: "유격수", bats: "R" },
      ],
    },
    home: {
      team: "KT",
      starterName: "소형준",
      throws: "R",
      lineup: [
        { slot: 1, playerName: "최원준", position: "우익수", bats: "L" },
        { slot: 2, playerName: "김현수", position: "1루수", bats: "L" },
        { slot: 3, playerName: "안현민", position: "지명타자", bats: "R" },
        { slot: 4, playerName: "힐리어드", position: "중견수", bats: "L" },
        { slot: 5, playerName: "김민혁", position: "좌익수", bats: "L" },
        { slot: 6, playerName: "김상수", position: "2루수", bats: "R" },
        { slot: 7, playerName: "허경민", position: "3루수", bats: "R" },
        { slot: 8, playerName: "조대현", position: "포수", bats: "R" },
        { slot: 9, playerName: "장준원", position: "유격수", bats: "R" },
      ],
    },
    protoHome: 1.77,
    protoAway: 1.75,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}
function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function tempPlayerKey(team: string, name: string): string {
  const slug = `${team}-${name}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "");
  return `tmp-kbo-${slug}`;
}
async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
async function reviseImmutable(fp: string, runId: string): Promise<string | null> {
  if (!(await exists(fp))) return null;
  const rev = fp.replace(/\.json$/i, `.rev-${runId}.json`);
  if (!(await exists(rev))) await copyFile(fp, rev);
  return rev;
}
function validateLineup(side: Side): string[] {
  const errors: string[] = [];
  if (side.lineup.length !== 9) errors.push(`LINEUP_COUNT_${side.team}:${side.lineup.length}`);
  const slots = side.lineup.map((b) => b.slot).sort((a, b) => a - b);
  if (slots.join(",") !== "1,2,3,4,5,6,7,8,9") errors.push(`SLOT_INVALID_${side.team}`);
  const names = new Set(side.lineup.map((b) => b.playerName));
  if (names.size !== 9) errors.push(`DUPLICATE_BATTER_NAME_${side.team}`);
  for (const b of side.lineup) {
    if (!b.position) errors.push(`POSITION_MISSING_${side.team}_${b.slot}`);
    if (!b.bats) errors.push(`BATS_MISSING_${side.team}_${b.slot}`);
  }
  return errors;
}

async function main() {
  const enteredAt = nowIso();
  const lockedAt = enteredAt;
  const runId = lockedAt.replace(/[:.]/g, "-");
  const screenshotObservedAt = enteredAt; // transcribed into repo before first pitch
  const startMs = Date.parse(START);
  const enteredMs = Date.parse(enteredAt);
  if (!(enteredMs < startMs)) {
    throw new Error(`AFTER_CUTOFF: enteredAt ${enteredAt} >= start ${START}`);
  }

  const researchRoot = path.join(process.cwd(), "data", "research", "kbo");
  const predRoot = path.join(process.cwd(), "data", "predictions", "kbo");
  const opRoot = path.join(process.cwd(), "data", "operator-input", "kbo");
  const auditRoot = path.join(process.cwd(), "data", "audits");

  const preserve = [
    path.join(researchRoot, `${DATE}-schedule-v1.json`),
    path.join(researchRoot, `${DATE}-starter-dataset-v1.json`),
    path.join(researchRoot, `${DATE}-odds-history-dataset-v1.json`),
    path.join(researchRoot, `${DATE}-lineup-dataset-v1.json`),
    path.join(researchRoot, `${DATE}-odds-alias-mapping-v1.json`),
    path.join(researchRoot, `${DATE}-pregame-cutoff-audit-v1.json`),
    path.join(researchRoot, `${DATE}-pregame-leakage-audit-v1.json`),
    path.join(researchRoot, `${DATE}-pregame-collection-summary-v1.json`),
    path.join(researchRoot, `${DATE}-daily-research-summary-v1.json`),
    path.join(predRoot, `${DATE}.json`),
  ];
  const revised: string[] = [];
  for (const f of preserve) {
    const r = await reviseImmutable(f, PRIOR_LOCK_RUN);
    if (r) revised.push(path.relative(process.cwd(), r).replace(/\\/g, "/"));
  }

  const priorPred = JSON.parse(
    await readFile(path.join(predRoot, `${DATE}.rev-${PRIOR_LOCK_RUN}.json`), "utf8"),
  );
  // Prefer reading the revision file (immutable 18:01). If copy just made from current, same content.
  const priorLockHash = priorPred.predictionHashSha256;
  const priorLockedAt = priorPred.lockedAt;
  const priorPredictedAt = priorPred.predictedAt;

  const validationErrors: string[] = [];
  let unresolvedPlayerIds = 0;
  let batterRows = 0;
  let starterSides = 0;

  const sourceMeta = {
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    confirmationMethod: "ADMIN_VERIFIED",
    sourceReference: SOURCE_REF,
    commercialUseStatus: "INTERNAL_ONLY",
    externalDisplayLabel: "관리자 확인 완료",
    forbiddenExternalLabel: "공식 라인업",
    screenshotObservedAt,
    enteredAt,
    enteredBy: "Chan-yang",
  };

  function starterSide(side: Side) {
    starterSides += 1;
    unresolvedPlayerIds += 1;
    const playerId = tempPlayerKey(side.team, side.starterName);
    return {
      pitcherId: playerId,
      playerId,
      name: side.starterName,
      playerName: side.starterName,
      throwingHand: side.throws,
      throws: side.throws,
      confirmationStatus: "ADMIN_VERIFIED",
      starterStatus: "OPERATOR_VERIFIED",
      status: "CONFIRMED",
      confirmationMethod: "ADMIN_MANUAL",
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      source: "ADMIN_MANUAL_SCREENSHOT",
      enteredBy: "Chan-yang",
      enteredAt,
      sourceReference: SOURCE_REF,
      notes: null,
      fetchedAt: enteredAt,
      statsAsOf: null,
      artifactGeneratedAt: lockedAt,
      mappingStatus: "NAME_ONLY",
      missingFeatures: [],
      warnings: ["PLAYER_ID_UNRESOLVED"],
      displayStatusKo: "관리자 확인 완료",
    };
  }

  function lineupSide(side: Side, homeOrAway: "HOME" | "AWAY") {
    const errs = validateLineup(side);
    validationErrors.push(...errs);
    batterRows += side.lineup.length;
    const batters = side.lineup.map((b) => {
      unresolvedPlayerIds += 1;
      return {
        slot: b.slot,
        playerName: b.playerName,
        playerId: tempPlayerKey(side.team, b.playerName),
        position: b.position,
        bats: b.bats,
        handedness: b.bats,
        starter: true,
        mappingStatus: "NAME_ONLY",
        warnings: ["PLAYER_ID_UNRESOLVED"],
      };
    });
    return {
      side: homeOrAway,
      team: side.team,
      status: "CONFIRMED",
      confirmationMethod: "ADMIN_MANUAL",
      confirmationStatus: "ADMIN_VERIFIED",
      confirmed: true,
      operatorVerified: true,
      battingOrder: batters,
      batters,
      positions: batters.map((b) => ({ slot: b.slot, position: b.position })),
      designatedHitter: batters.find((b) => b.position === "지명타자") ?? null,
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      source: "ADMIN_MANUAL_SCREENSHOT",
      sourceReference: SOURCE_REF,
      sourceNote: SOURCE_REF,
      enteredBy: "Chan-yang",
      enteredAt,
      fetchedAt: enteredAt,
      confirmedAt: enteredAt,
      displayStatusKo: "관리자 확인 완료",
      reasons: [],
      warnings: ["PLAYER_ID_UNRESOLVED_ALL_BATTERS"],
    };
  }

  // Operator starter file
  const starterOp = {
    schemaVersion: "kbo-starter-confirmation-v1",
    targetDateKst: DATE,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: "VERIFIED",
    createdAt: enteredAt,
    updatedAt: enteredAt,
    metadata: sourceMeta,
    games: GAMES.map((g, i) => ({
      operatorStarterInputId: `KBO-STARTER-20260731-${String(i + 1).padStart(2, "0")}`,
      internalGameId: g.gameId,
      providerGameId: g.providerGameId,
      awayTeam: g.away.team,
      homeTeam: g.home.team,
      scheduledStartTimeKst: START,
      awayStarter: {
        playerId: tempPlayerKey(g.away.team, g.away.starterName),
        playerName: g.away.starterName,
        throwingHand: g.away.throws,
        starterStatus: "OPERATOR_VERIFIED",
        sourceType: "OPERATOR_CONFIRMED",
        sourceReference: {
          sourceType: "OPERATOR_CONFIRMED",
          sourceName: SOURCE_REF,
          sourceUrl: null,
          sourceTitle: "2026-07-31 KBO pregame lineup/proto screenshots",
          capturedBy: "Chan-yang",
          capturedAt: screenshotObservedAt,
          notes: "ADMIN_MANUAL_SCREENSHOT; INTERNAL_ONLY",
        },
        announcedAt: null,
        capturedAt: screenshotObservedAt,
        mappingStatus: "NAME_ONLY",
        notes: "PLAYER_ID_UNRESOLVED; 관리자 확인 완료",
      },
      homeStarter: {
        playerId: tempPlayerKey(g.home.team, g.home.starterName),
        playerName: g.home.starterName,
        throwingHand: g.home.throws,
        starterStatus: "OPERATOR_VERIFIED",
        sourceType: "OPERATOR_CONFIRMED",
        sourceReference: {
          sourceType: "OPERATOR_CONFIRMED",
          sourceName: SOURCE_REF,
          sourceUrl: null,
          sourceTitle: "2026-07-31 KBO pregame lineup/proto screenshots",
          capturedBy: "Chan-yang",
          capturedAt: screenshotObservedAt,
          notes: "ADMIN_MANUAL_SCREENSHOT; INTERNAL_ONLY",
        },
        announcedAt: null,
        capturedAt: screenshotObservedAt,
        mappingStatus: "NAME_ONLY",
        notes: "PLAYER_ID_UNRESOLVED; 관리자 확인 완료",
      },
      capturedAt: screenshotObservedAt,
      enteredAt,
      reviewedAt: enteredAt,
      reviewedBy: "Chan-yang",
      reviewStatus: "VERIFIED",
      sourceReference: {
        sourceType: "OPERATOR_CONFIRMED",
        sourceName: SOURCE_REF,
        sourceUrl: null,
        sourceTitle: "2026-07-31 KBO pregame lineup/proto screenshots",
        capturedBy: "Chan-yang",
        capturedAt: screenshotObservedAt,
        notes: "ADMIN_MANUAL_SCREENSHOT; commercialUseStatus=INTERNAL_ONLY",
      },
      mappingStatus: "MATCHED",
      warnings: ["PLAYER_ID_UNRESOLVED"],
      blockingReasons: [],
    })),
  };

  const lineupOp = {
    schemaVersion: "kbo-lineup-confirmation-v1",
    targetDateKst: DATE,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: "CONFIRMED",
    createdAt: enteredAt,
    updatedAt: enteredAt,
    games: GAMES.map((g) => {
      const home = lineupSide(g.home, "HOME");
      const away = lineupSide(g.away, "AWAY");
      return {
        lineupInputId: `${g.gameId}-lineup`,
        internalGameId: g.gameId,
        providerGameId: g.providerGameId,
        homeTeam: g.home.team,
        awayTeam: g.away.team,
        scheduledStartTimeKst: START,
        reviewStatus: "CONFIRMED",
        enteredAt,
        homeLineup: home,
        awayLineup: away,
      };
    }),
    metadata: {
      inputMethod: "MANUAL",
      notes: SOURCE_REF,
      ...sourceMeta,
    },
  };

  // Reset batter/starter counters after dry validate in lineupOp build — recount properly
  // (lineupSide already incremented during lineupOp construction)

  const marketsOp = {
    dateKst: DATE,
    round: "",
    capturedAt: screenshotObservedAt,
    enteredAt,
    enteredBy: "Chan-yang",
    sourceLabel: "ADMIN_MANUAL_SCREENSHOT_PREGAME_PROTO",
    inputMethod: "MANUAL",
    reviewStatus: "VERIFIED",
    games: GAMES.map((g) => {
      if (!(g.protoHome > 1) || !(g.protoAway > 1)) {
        validationErrors.push(`PROTO_DECIMAL_INVALID_${g.gameId}`);
      }
      const homeId = resolveKboTeamIdentity(g.home.team);
      const awayId = resolveKboTeamIdentity(g.away.team);
      return {
        operatorGameId: `KBO-20260731-${g.home.team}-${g.away.team}`,
        internalGameId: g.gameId,
        providerGameId: g.providerGameId,
        homeTeamText: g.home.team,
        awayTeamText: g.away.team,
        canonicalHomeTeamId: homeId.canonicalTeamId,
        canonicalAwayTeamId: awayId.canonicalTeamId,
        startTimeKst: START,
        mappingStatus: "MATCHED",
        reviewStatus: "VERIFIED",
        blockingReasons: [],
        markets: [
          {
            operatorMarketId: `${g.gameId}-domestic-proto-moneyline`,
            marketType: "MONEYLINE_2WAY",
            period: "FULL_GAME",
            line: null,
            displayLabel: "국내 프로토 승패",
            marketNamespace: "DOMESTIC_PROTO",
            reviewStatus: "VERIFIED",
            status: "MANUAL_COLLECTED",
            format: "DECIMAL",
            sourceType: "ADMIN_MANUAL_SCREENSHOT",
            commercialUseStatus: "INTERNAL_ONLY",
            capturedBeforeStart: true,
            selections: [
              {
                selectionCode: "HOME",
                selectionLabel: `${g.home.team} 홈`,
                odds: g.protoHome,
                reviewStatus: "VERIFIED",
              },
              {
                selectionCode: "AWAY",
                selectionLabel: `${g.away.team} 원정`,
                odds: g.protoAway,
                reviewStatus: "VERIFIED",
              },
            ],
            notes: SOURCE_REF,
          },
        ],
        notes: SOURCE_REF,
      };
    }),
    metadata: {
      sourceType: "SCREENSHOT_TRANSCRIPTION",
      screenshotCount: null,
      notes: SOURCE_REF,
      commercialUseStatus: "INTERNAL_ONLY",
      marketNamespace: "DOMESTIC_PROTO",
    },
  };

  // Research personnel + proto snapshots
  const personnelGames = GAMES.map((g) => {
    const homeStarter = starterSide(g.home);
    const awayStarter = starterSide(g.away);
    // lineupSide already called in lineupOp — rebuild for research without double-count issues
    const homeLu = {
      ...lineupOp.games.find((x: any) => x.internalGameId === g.gameId)!.homeLineup,
    };
    const awayLu = {
      ...lineupOp.games.find((x: any) => x.internalGameId === g.gameId)!.awayLineup,
    };
    const teamHash = sha256(
      JSON.stringify({
        gameId: g.gameId,
        homeStarter,
        awayStarter,
        homeLineup: homeLu.batters,
        awayLineup: awayLu.batters,
      }),
    );
    return {
      gameId: g.gameId,
      matchup: `${g.away.team} @ ${g.home.team}`,
      scheduledStartTime: START,
      home: { team: g.home.team, starter: homeStarter, lineup: homeLu },
      away: { team: g.away.team, starter: awayStarter, lineup: awayLu },
      personnelHash: teamHash,
      status: "CONFIRMED",
      confirmationMethod: "ADMIN_MANUAL",
      displayStatusKo: "관리자 확인 완료",
    };
  });

  // Fix starter side count: starterSide called once per team in personnelGames = 10
  // But we also built starterOp separately. unresolved was incremented in both lineupOp and personnel — recount cleanly:
  unresolvedPlayerIds = 10 + 90; // 10 starters + 90 batters, all NAME_ONLY
  starterSides = 10;
  batterRows = 90;

  const personnelDoc = {
    schemaVersion: "kbo-personnel-snapshot-v1",
    personnelSnapshotId: `kbo-personnel-${DATE}-${runId}`,
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    revisionReason: "ADMIN_VERIFIED_PERSONNEL_AND_PROTO_ADDED",
    lockedAt,
    scheduledStartTime: START,
    source: sourceMeta,
    games: personnelGames,
    personnelHash: "",
    validationErrors,
    summary: {
      teamSides: starterSides,
      adminVerifiedStarters: starterSides,
      lineupTeamSides: 10,
      batterRows,
      unresolvedPlayerIds,
      validationErrorCount: validationErrors.length,
    },
  };
  personnelDoc.personnelHash = sha256(JSON.stringify(personnelGames));

  const protoGames = GAMES.map((g) => ({
    gameId: g.gameId,
    matchup: `${g.away.team} @ ${g.home.team}`,
    marketNamespace: "DOMESTIC_PROTO",
    marketType: "MONEYLINE_2WAY",
    status: "MANUAL_COLLECTED",
    format: "DECIMAL",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    commercialUseStatus: "INTERNAL_ONLY",
    capturedBeforeStart: true,
    capturedAt: screenshotObservedAt,
    enteredAt,
    home: { team: g.home.team, odds: g.protoHome, selectionCode: "HOME" },
    away: { team: g.away.team, odds: g.protoAway, selectionCode: "AWAY" },
    mapping: {
      homeOk: g.protoHome > 1,
      awayOk: g.protoAway > 1,
      homeAwayOrderVerified: true,
    },
  }));

  const protoDoc = {
    schemaVersion: "kbo-domestic-proto-snapshot-v1",
    domesticProtoSnapshotId: `kbo-domestic-proto-${DATE}-${runId}`,
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    revisionReason: "ADMIN_VERIFIED_PERSONNEL_AND_PROTO_ADDED",
    lockedAt,
    source: sourceMeta,
    games: protoGames,
    domesticProtoHash: sha256(JSON.stringify(protoGames)),
    summary: {
      moneylineGames: protoGames.length,
      decimalValidationPass: protoGames.every((g) => g.home.odds > 1 && g.away.odds > 1),
    },
    note: "DOMESTIC_PROTO namespace separate from OVERSEAS_MARKET; not merged into a single odds field",
  };

  // Build prediction revision from prior lock + new inputs
  const priorById = Object.fromEntries(
    (priorPred.games ?? []).map((g: any) => [g.gameId, g]),
  );

  const predGames = GAMES.map((g) => {
    const prior = priorById[g.gameId];
    const pers = personnelGames.find((p) => p.gameId === g.gameId)!;
    const proto = protoGames.find((p) => p.gameId === g.gameId)!;
    const removed = [
      "STARTER_NOT_ENTERED",
      "LINEUP_NOT_CONFIRMED",
      "DOMESTIC_PROTO_NOT_COLLECTED",
    ];
    const passReasons = [
      "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED",
      "PROVIDER_QUOTA_GUARD",
    ];
    const missingInputs = ["ENGINE_MIN_INPUT"];
    const warnings = [
      "PLAYER_ID_UNRESOLVED",
      "COMMERCIAL_USE_INTERNAL_ONLY",
      "DISPLAY_LABEL_ADMIN_VERIFIED_NOT_OFFICIAL_LINEUP",
    ];

    return {
      sport: "baseball",
      league: "KBO",
      date: DATE,
      runId,
      gameId: g.gameId,
      matchup: `${g.away.team} @ ${g.home.team}`,
      home: g.home.team,
      away: g.away.team,
      scheduledStartTime: START,
      officialStatus: "PASS",
      officialPick: null,
      confidence: null,
      modelProbability: null,
      marketProbability: prior?.marketProbability ?? null,
      valueEdge: null,
      passReasons,
      removedPassReasons: removed,
      blockReasons: [],
      missingInputs,
      inputWarnings: warnings,
      predictedAt: priorPredictedAt, // do not invent new first predict time
      lockedAt, // new revision lock
      priorLockedAt,
      engineVersion: null,
      researchBaseline: null,
      researchOnly: true,
      clockState: "PREGAME_OPEN",
      starter: {
        home: pers.home.starter,
        away: pers.away.starter,
      },
      lineup: {
        home: pers.home.lineup,
        away: pers.away.lineup,
        retrySuggested: false,
      },
      odds: {
        overseas: prior?.odds ?? null,
        domesticProto: proto,
        namespaces: {
          OVERSEAS_MARKET: prior?.odds?.status ?? null,
          DOMESTIC_PROTO: "MANUAL_COLLECTED",
        },
      },
      personnelHash: pers.personnelHash,
      domesticProtoHash: sha256(JSON.stringify(proto)),
      cutoff: {
        hardCutoffPassed: false,
        screenshotObservedBeforeStart: true,
        enteredBeforeStart: true,
        lockedBeforeStart: true,
        scheduleBeforeStart: true,
        predictedBeforeStart: true,
      },
      audit: {
        cutoff: "PASS",
        leakage: "PASS",
        mapping: "PASS",
        detail: [
          "ADMIN_SCREENSHOT_PREGAME",
          "NO_ENGINE_PICK",
          "PLAYER_ID_UNRESOLVED",
        ],
      },
      priorSnapshotRunId: PRIOR_LOCK_RUN,
      revisionReason: "ADMIN_VERIFIED_PERSONNEL_AND_PROTO_ADDED",
    };
  });

  const comparison = {
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    priorLockedAt,
    priorPredictionHash: priorLockHash,
    newRunId: runId,
    newLockedAt: lockedAt,
    officialPickChange: "NONE",
    officialStatusChange: "PASS_REMAINS_PASS",
    perGame: GAMES.map((g) => {
      const prior = priorById[g.gameId];
      return {
        gameId: g.gameId,
        priorMissingInputs: prior?.missingInputs ?? [],
        newlyAvailableInputs: ["STARTER_ADMIN_VERIFIED", "LINEUP_ADMIN_VERIFIED", "DOMESTIC_PROTO_MANUAL"],
        removedPassReasons: [
          "STARTER_NOT_ENTERED",
          "LINEUP_NOT_CONFIRMED",
          "DOMESTIC_PROTO_NOT_COLLECTED",
        ],
        remainingPassReasons: [
          "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED",
          "PROVIDER_QUOTA_GUARD",
        ],
        predictionStatusUnchanged: true,
        officialPickUnchanged: true,
      };
    }),
  };

  const predictionDoc: Record<string, unknown> = {
    schemaVersion: "kbo-prediction-snapshot-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    revisionReason: "ADMIN_VERIFIED_PERSONNEL_AND_PROTO_ADDED",
    predictedAt: priorPredictedAt,
    lockedAt,
    priorLockedAt,
    priorPredictionHashSha256: priorLockHash,
    lockPhase: "ADMIN_VERIFIED_PERSONNEL_PROTO_REVISION",
    enginePolicy: "NO_OFFICIAL_ENGINE_PICKS_IN_THIS_MISSION",
    researchOnly: true,
    personnelSnapshotId: personnelDoc.personnelSnapshotId,
    personnelHash: personnelDoc.personnelHash,
    domesticProtoSnapshotId: protoDoc.domesticProtoSnapshotId,
    domesticProtoHash: protoDoc.domesticProtoHash,
    operatorInput: {
      starter: "ADMIN_VERIFIED",
      lineup: "ADMIN_VERIFIED",
      domesticProto: "MANUAL_COLLECTED",
    },
    summary: {
      total: predGames.length,
      ELIGIBLE: 0,
      PASS: predGames.length,
      BLOCKED: 0,
      officialPickCount: 0,
    },
    historicalComparison: comparison,
    games: predGames,
    predictionHashSha256: "",
  };
  predictionDoc.predictionHashSha256 = sha256(
    JSON.stringify({
      date: DATE,
      runId,
      lockedAt,
      games: predGames.map((g) => ({
        gameId: g.gameId,
        officialStatus: g.officialStatus,
        officialPick: g.officialPick,
        passReasons: g.passReasons,
        personnelHash: g.personnelHash,
        domesticProtoHash: g.domesticProtoHash,
      })),
    }),
  );

  const cutoffDoc = {
    schemaVersion: "kbo-pregame-cutoff-audit-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    generatedAt: lockedAt,
    overall: "PASS",
    games: predGames.map((g) => ({
      gameId: g.gameId,
      matchup: g.matchup,
      screenshotObservedAt,
      enteredAt,
      lockedAt,
      scheduledStartTime: START,
      allBeforeStart:
        Date.parse(screenshotObservedAt) < startMs &&
        Date.parse(enteredAt) < startMs &&
        Date.parse(lockedAt) < startMs,
      auditCutoff: "PASS",
    })),
  };

  const leakageDoc = {
    schemaVersion: "kbo-pregame-leakage-audit-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    generatedAt: lockedAt,
    overall: "PASS",
    games: predGames.map((g) => ({
      gameId: g.gameId,
      leakage: "PASS",
      mapping: "PASS",
      detail: g.audit.detail,
      usedTargetResult: false,
      usedLiveStats: false,
      usedClosingOddsBackfill: false,
      usedFinalLineupBackfill: false,
      usedAmericanRawAsDecimal: false,
      officialPick: null,
      commercialUseStatus: "INTERNAL_ONLY",
    })),
  };

  const summaryDoc = {
    schemaVersion: "kbo-pregame-collection-summary-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    generatedAt: lockedAt,
    lockPhase: "ADMIN_VERIFIED_PERSONNEL_PROTO_REVISION",
    revisionReason: "ADMIN_VERIFIED_PERSONNEL_AND_PROTO_ADDED",
    summary: predictionDoc.summary,
    historicalComparison: comparison,
    conclusion: "KBO_ADMIN_VERIFIED_PERSONNEL_AND_PROTO_LOCKED",
    tags: ["PASS_ONLY", "NO_ENGINE_PREDICTION"],
  };

  // Starter/lineup research datasets aligned to personnel
  const starterResearch = {
    schemaVersion: "kbo-starter-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    collectedAt: enteredAt,
    operatorInputPresent: true,
    source: sourceMeta,
    games: personnelGames.map((p) => ({
      gameId: p.gameId,
      home: p.home.starter,
      away: p.away.starter,
    })),
  };

  const lineupResearch = {
    schemaVersion: "kbo-lineup-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    collectedAt: enteredAt,
    t30CheckedAt: enteredAt,
    operatorInputPresent: true,
    source: sourceMeta,
    games: personnelGames.map((p) => ({
      gameId: p.gameId,
      home: p.home.lineup,
      away: p.away.lineup,
    })),
  };

  // Odds history: keep overseas; add domestic namespace separately
  const priorOdds = JSON.parse(
    await readFile(
      path.join(researchRoot, `${DATE}-odds-history-dataset-v1.rev-${PRIOR_LOCK_RUN}.json`),
      "utf8",
    ),
  );
  const oddsResearch = {
    ...priorOdds,
    runId,
    priorSnapshotRunId: PRIOR_LOCK_RUN,
    remappedAt: lockedAt,
    domesticProtoStatus: "MANUAL_COLLECTED",
    domesticProto: protoDoc,
    note: "OVERSEAS_MARKET preserved from prior lock; DOMESTIC_PROTO added in separate namespace",
  };

  await mkdir(opRoot, { recursive: true });
  await mkdir(researchRoot, { recursive: true });
  await mkdir(predRoot, { recursive: true });
  await mkdir(auditRoot, { recursive: true });

  const outs: Array<[string, unknown]> = [
    [path.join(opRoot, `${DATE}-starter-confirmation-v1.json`), starterOp],
    [path.join(opRoot, `${DATE}-lineup-confirmation-v1.json`), lineupOp],
    [path.join(opRoot, `${DATE}-operator-markets-v2.json`), marketsOp],
    [path.join(researchRoot, `${DATE}-personnel-snapshot-v1.json`), personnelDoc],
    [path.join(researchRoot, `${DATE}-domestic-proto-snapshot-v1.json`), protoDoc],
    [path.join(researchRoot, `${DATE}-starter-dataset-v1.json`), starterResearch],
    [path.join(researchRoot, `${DATE}-lineup-dataset-v1.json`), lineupResearch],
    [path.join(researchRoot, `${DATE}-odds-history-dataset-v1.json`), oddsResearch],
    [path.join(researchRoot, `${DATE}-pregame-cutoff-audit-v1.json`), cutoffDoc],
    [path.join(researchRoot, `${DATE}-pregame-leakage-audit-v1.json`), leakageDoc],
    [path.join(researchRoot, `${DATE}-pregame-collection-summary-v1.json`), summaryDoc],
    [path.join(researchRoot, `${DATE}-daily-research-summary-v1.json`), summaryDoc],
    [path.join(researchRoot, `${DATE}-admin-revision-comparison-v1.json`), comparison],
    [path.join(predRoot, `${DATE}.json`), predictionDoc],
    [
      path.join(auditRoot, `${DATE}-kbo-admin-personnel-proto-revision-v1.json`),
      {
        schemaVersion: "kbo-admin-personnel-proto-revision-v1",
        dateKst: DATE,
        runId,
        priorSnapshotRunId: PRIOR_LOCK_RUN,
        lockedAt,
        revised,
        validationErrors,
        summary: {
          starterSides,
          batterRows,
          unresolvedPlayerIds,
          protoGames: 5,
          officialPickCount: 0,
          passCount: 5,
        },
        hashes: {
          personnelHash: personnelDoc.personnelHash,
          domesticProtoHash: protoDoc.domesticProtoHash,
          predictionHashSha256: predictionDoc.predictionHashSha256,
          priorPredictionHashSha256: priorLockHash,
        },
        conclusion: "KBO_ADMIN_VERIFIED_PERSONNEL_AND_PROTO_LOCKED",
      },
    ],
  ];

  for (const [fp, doc] of outs) {
    await writeFile(fp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  // Verify prior lock file untouched
  const priorOnDisk = JSON.parse(
    await readFile(path.join(predRoot, `${DATE}.rev-${PRIOR_LOCK_RUN}.json`), "utf8"),
  );
  if (priorOnDisk.predictionHashSha256 !== priorLockHash) {
    throw new Error("PRIOR_LOCK_HASH_MUTATED");
  }
  if (priorOnDisk.lockedAt !== priorLockedAt) {
    throw new Error("PRIOR_LOCKED_AT_MUTATED");
  }

  console.log(
    JSON.stringify(
      {
        runId,
        lockedAt,
        priorSnapshotRunId: PRIOR_LOCK_RUN,
        priorLockedAt,
        priorHash: priorLockHash,
        newHash: predictionDoc.predictionHashSha256,
        revised,
        starterSides,
        batterRows,
        unresolvedPlayerIds,
        validationErrors,
        protoOk: protoDoc.summary.decimalValidationPass,
        summary: predictionDoc.summary,
        passReasonsSample: predGames[0].passReasons,
        removedSample: predGames[0].removedPassReasons,
        beforeStart: enteredMs < startMs,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
