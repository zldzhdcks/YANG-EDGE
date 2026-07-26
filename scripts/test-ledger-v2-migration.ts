/**
 * 가계부 v1 → v2 마이그레이션 스모크 테스트
 * 실행: npx tsx scripts/test-ledger-v2-migration.ts
 */
import {
  LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY,
  LEDGER_STORAGE_KEY,
  type LedgerBet,
  type LedgerStoreV1,
} from "../src/types/ledger";
import {
  adaptStoreV2ToV1,
  loadLedgerStoreV2FromRaw,
  readLedgerStore,
  readLedgerStoreV2,
  resetLedgerSnapshotCacheForTests,
} from "../src/lib/ledger/storage";
import {
  ledgerBetToTicket,
  mapSelection,
  migrateLedgerStoreV1ToV2,
  splitMatchName,
} from "../src/lib/ledger/migrate-v1-to-v2";
import {
  combinePickOdds,
  deriveTicketStatus,
  expectedTicketReturn,
} from "../src/lib/ledger/calc";
import type { LedgerPick, LedgerTicket } from "../src/types/ledger";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  get length(): number {
    return this.data.size;
  }
}

function installLocalStorage(): MemoryStorage {
  const mem = new MemoryStorage();
  // Node 테스트용 최소 stub — DOM Window 전체는 불필요
  const stub = {
    localStorage: mem,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
  Object.assign(globalThis, { localStorage: mem, window: stub });
  return mem;
}

function sampleBet(overrides: Partial<LedgerBet> = {}): LedgerBet {
  return {
    id: "bet-1",
    betDate: "2026-07-26",
    sport: "baseball",
    league: "KBO",
    matchName: "LG vs 두산",
    selection: "홈승",
    odds: 1.85,
    stake: 10000,
    status: "win",
    settledReturn: 18500,
    source: "manual",
    memo: "테스트",
    createdAt: "2026-07-26T01:00:00.000Z",
    updatedAt: "2026-07-26T02:00:00.000Z",
    ...overrides,
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function main() {
  let failed = 0;
  const check = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`OK  ${name}`);
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${name}`);
      console.log(`     ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  console.log("=== ledger v1 → v2 migration ===\n");

  check("빈 저장소", () => {
    const r = loadLedgerStoreV2FromRaw(null);
    assert(r.ok === true, "ok");
    if (!r.ok) return;
    assert(r.store.version === 2, "version 2");
    assert(r.store.tickets.length === 0, "empty tickets");
    assert(r.needsPersist === false, "no persist");
  });

  check("정상 v1 단일 기록", () => {
    const v1: LedgerStoreV1 = {
      version: 1,
      bets: [sampleBet()],
      budget: {
        monthlyBudget: 100000,
        unitStakeLimit: null,
        dailyLossLimit: null,
        monthlyLossLimit: null,
      },
    };
    const ticket = ledgerBetToTicket(v1.bets[0]);
    assert(ticket.id === "bet-1", "id 유지");
    assert(ticket.picks.length === 1, "picks 1");
    assert(ticket.picks[0].gameId === null, "gameId null");
    assert(ticket.combinedOdds === 1.85, "combinedOdds");
    assert(ticket.expectedReturn === 18500, "expectedReturn");
    assert(ticket.actualReturn === 18500, "actualReturn=settledReturn");
    assert(ticket.picks[0].homeTeam === "LG", "home");
    assert(ticket.picks[0].awayTeam === "두산", "away");
    assert(ticket.picks[0].selectionType === "home", "selection home");
    assert(ticket.stake === 10000, "stake");
    assert(ticket.resultStatus === "win", "status");

    const loaded = loadLedgerStoreV2FromRaw(JSON.stringify(v1));
    assert(loaded.ok && loaded.needsPersist, "needs migrate");
    if (!loaded.ok) return;
    assert(loaded.store.tickets.length === 1, "1 ticket");
    assert(loaded.store.budget.monthlyBudget === 100000, "budget");
  });

  check("v1 여러 기록", () => {
    const v1: LedgerStoreV1 = {
      version: 1,
      bets: [
        sampleBet({ id: "a" }),
        sampleBet({ id: "b", matchName: "한화 vs SSG", selection: "원정승" }),
      ],
      budget: {
        monthlyBudget: null,
        unitStakeLimit: null,
        dailyLossLimit: null,
        monthlyLossLimit: null,
      },
    };
    const v2 = migrateLedgerStoreV1ToV2(v1);
    assert(v2.tickets.length === 2, "2 tickets");
    assert(v2.tickets[0].id === "a" && v2.tickets[1].id === "b", "ids");
  });

  check("matchName 분리 성공/실패", () => {
    assert(splitMatchName("LG vs 두산").homeTeam === "LG", "ok home");
    assert(splitMatchName("LG vs 두산").awayTeam === "두산", "ok away");
    assert(splitMatchName("한화 VS SSG").awayTeam === "SSG", "case");
    const fail = splitMatchName("LG-두산");
    assert(fail.homeTeam === "LG-두산", "fail home");
    assert(fail.awayTeam === "", "fail away");
  });

  check("selectionType 매핑", () => {
    assert(mapSelection("홈승").selectionType === "home", "홈승");
    assert(mapSelection("홈 승").selectionType === "home", "홈 승");
    assert(mapSelection("무").selectionType === "draw", "무");
    assert(mapSelection("원정승").selectionType === "away", "원정승");
    assert(mapSelection("오버 8.5").selectionType === "other", "other");
    assert(
      mapSelection("오버 8.5").selectionLabel === "오버 8.5",
      "label 유지",
    );
  });

  check("settledReturn → actualReturn 유지", () => {
    const t = ledgerBetToTicket(
      sampleBet({ settledReturn: 12345, status: "win", odds: 2, stake: 10000 }),
    );
    assert(t.actualReturn === 12345, "actualReturn");
    assert(t.expectedReturn === 20000, "expected still stake×odds");
  });

  check("localStorage 마이그레이션·재읽기·중복 방지·백업", () => {
    const mem = installLocalStorage();
    resetLedgerSnapshotCacheForTests();

    const v1: LedgerStoreV1 = {
      version: 1,
      bets: [sampleBet()],
      budget: {
        monthlyBudget: null,
        unitStakeLimit: 5000,
        dailyLossLimit: null,
        monthlyLossLimit: null,
      },
    };
    const v1Raw = JSON.stringify(v1);
    mem.setItem(LEDGER_STORAGE_KEY, v1Raw);

    const first = readLedgerStoreV2();
    assert(first.version === 2, "v2 after read");
    assert(first.tickets.length === 1, "ticket count");

    const stored = mem.getItem(LEDGER_STORAGE_KEY);
    assert(stored != null, "stored");
    const storedObj = JSON.parse(stored as string) as { version: number };
    assert(storedObj.version === 2, "persisted v2");

    const backup = mem.getItem(LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY);
    assert(backup === v1Raw, "backup equals previous raw");

    // 2회 실행 — 중복 마이그레이션 없음 (needsPersist false)
    resetLedgerSnapshotCacheForTests();
    const secondRawBefore = mem.getItem(LEDGER_STORAGE_KEY);
    const second = readLedgerStoreV2();
    assert(second.tickets[0].id === "bet-1", "id still");
    assert(mem.getItem(LEDGER_STORAGE_KEY) === secondRawBefore, "raw unchanged");

    const loadedAgain = loadLedgerStoreV2FromRaw(
      mem.getItem(LEDGER_STORAGE_KEY),
    );
    assert(loadedAgain.ok === true && loadedAgain.needsPersist === false, "no re-migrate");

    // 백업 키 덮어쓰지 않음
    mem.setItem(LEDGER_STORAGE_KEY, v1Raw);
    resetLedgerSnapshotCacheForTests();
    // 이미 백업 있음 — 내용 유지
    const backupBefore = mem.getItem(LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY);
    readLedgerStoreV2();
    assert(
      mem.getItem(LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY) === backupBefore,
      "backup not overwritten",
    );
  });

  check("잘못된 JSON에서 원본 미삭제", () => {
    const mem = installLocalStorage();
    resetLedgerSnapshotCacheForTests();
    const bad = "{not-json";
    mem.setItem(LEDGER_STORAGE_KEY, bad);
    const loaded = loadLedgerStoreV2FromRaw(bad);
    assert(loaded.ok === false, "load fails");
    readLedgerStoreV2();
    assert(mem.getItem(LEDGER_STORAGE_KEY) === bad, "raw kept");
  });

  check("동일 raw snapshot 참조", () => {
    const mem = installLocalStorage();
    resetLedgerSnapshotCacheForTests();
    const v2 = migrateLedgerStoreV1ToV2({
      version: 1,
      bets: [sampleBet()],
      budget: {
        monthlyBudget: null,
        unitStakeLimit: null,
        dailyLossLimit: null,
        monthlyLossLimit: null,
      },
    });
    mem.setItem(LEDGER_STORAGE_KEY, JSON.stringify(v2));

    const a = readLedgerStore();
    const b = readLedgerStore();
    assert(a === b, "same V1 snapshot ref");
    const c = readLedgerStoreV2();
    const d = readLedgerStoreV2();
    assert(c === d, "same V2 snapshot ref");
  });

  check("v2 재읽기 어댑터", () => {
    const v2 = migrateLedgerStoreV1ToV2({
      version: 1,
      bets: [sampleBet()],
      budget: {
        monthlyBudget: null,
        unitStakeLimit: null,
        dailyLossLimit: null,
        monthlyLossLimit: null,
      },
    });
    const v1view = adaptStoreV2ToV1(v2);
    assert(v1view.version === 1, "v1 view");
    assert(v1view.bets[0].matchName === "LG vs 두산", "matchName");
    assert(v1view.bets[0].settledReturn === 18500, "settledReturn");
    assert(v1view.bets[0].selection === "홈승", "selection");
  });

  check("민감정보 없음 (구조 필드만)", () => {
    const ticket = ledgerBetToTicket(sampleBet());
    const json = JSON.stringify(ticket);
    assert(!/"password"/i.test(json), "no password");
    assert(!/"token"/i.test(json), "no token");
    assert(!/"apiKey"/i.test(json), "no apiKey");
    assert(!/"secret"/i.test(json), "no secret");
  });

  check("혼합 종목 티켓 (야구+축구)", () => {
    const picks: LedgerPick[] = [
      {
        id: "p1",
        gameId: null,
        sport: "baseball",
        league: "KBO",
        homeTeam: "LG",
        awayTeam: "두산",
        selectionType: "home",
        selectionLabel: "홈승",
        odds: 1.8,
        resultStatus: "pending",
      },
      {
        id: "p2",
        gameId: null,
        sport: "football",
        league: "K리그",
        homeTeam: "울산",
        awayTeam: "전북",
        selectionType: "away",
        selectionLabel: "원정승",
        odds: 2.0,
        resultStatus: "pending",
      },
    ];

    const combinedOdds = combinePickOdds(picks);
    assert(Math.abs(combinedOdds - 3.6) < 1e-9, `combinedOdds=${combinedOdds}`);
    assert(expectedTicketReturn(10000, combinedOdds) === 36000, "expectedReturn");

    const ticket: LedgerTicket = {
      id: "mixed-1",
      betDate: "2026-07-26",
      picks,
      stake: 10000,
      combinedOdds,
      expectedReturn: expectedTicketReturn(10000, combinedOdds),
      resultStatus: deriveTicketStatus(picks),
      actualReturn: null,
      source: "manual",
      memo: "",
      createdAt: "2026-07-26T01:00:00.000Z",
      updatedAt: "2026-07-26T01:00:00.000Z",
    };

    assert(!("sport" in ticket), "ticket has no sport field");
    assert(ticket.picks[0].sport === "baseball", "pick0 baseball");
    assert(ticket.picks[1].sport === "football", "pick1 football");
    assert(ticket.resultStatus === "pending", "pending");

    // 상태 규칙 (종목 무관)
    assert(
      deriveTicketStatus([
        { resultStatus: "win" },
        { resultStatus: "loss" },
      ]) === "loss",
      "any loss",
    );
    assert(
      deriveTicketStatus([
        { resultStatus: "win" },
        { resultStatus: "win" },
      ]) === "win",
      "all win",
    );
    assert(
      deriveTicketStatus([
        { resultStatus: "win" },
        { resultStatus: "pending" },
      ]) === "pending",
      "partial pending",
    );
  });

  check("마이그레이션 시 pick.sport 보존", () => {
    const t = ledgerBetToTicket(sampleBet({ sport: "basketball" }));
    assert(t.picks[0].sport === "basketball", "sport on pick");
    assert(!("sport" in t), "no ticket.sport");
  });

  console.log("");
  if (failed > 0) {
    console.log(`결과: ${failed} failed`);
    process.exit(1);
  }
  console.log("결과: all passed");
}

main();
