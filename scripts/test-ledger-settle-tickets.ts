/**
 * 가계부 티켓 자동 정산 스모크 테스트
 * 실행: npx tsx scripts/test-ledger-settle-tickets.ts
 */
import type { LedgerPick, LedgerStoreV2, LedgerTicket } from "../src/types/ledger";
import {
  actualReturnForTicketStatus,
  settleLedgerTickets,
  settleLedgerTicketsIdempotent,
  type LedgerGameResult,
} from "../src/lib/ledger/settle-tickets-from-results";
import { expectedTicketReturn, combinePickOdds } from "../src/lib/ledger/calc";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function pick(
  overrides: Partial<LedgerPick> & Pick<LedgerPick, "id" | "gameId" | "selectionType" | "odds">,
): LedgerPick {
  return {
    sport: "baseball",
    league: "KBO",
    homeTeam: "Home",
    awayTeam: "Away",
    selectionLabel: overrides.selectionType,
    resultStatus: "pending",
    ...overrides,
  };
}

function ticket(
  id: string,
  picks: LedgerPick[],
  stake = 10000,
): LedgerTicket {
  const combinedOdds = combinePickOdds(picks);
  const expectedReturn = expectedTicketReturn(stake, combinedOdds);
  return {
    id,
    betDate: "2026-07-25",
    picks,
    stake,
    combinedOdds,
    expectedReturn,
    resultStatus: "pending",
    actualReturn: null,
    source: "manual",
    memo: "",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
}

function store(tickets: LedgerTicket[]): LedgerStoreV2 {
  return {
    version: 2,
    tickets,
    budget: {
      monthlyBudget: null,
      unitStakeLimit: null,
      dailyLossLimit: null,
      monthlyLossLimit: null,
    },
  };
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

  console.log("=== ledger ticket auto-settle ===\n");

  const NOW = "2026-07-26T12:00:00.000Z";

  check("단폴 적중", () => {
    const t = ticket("t1", [
      pick({
        id: "p1",
        gameId: "kbo-a-b",
        selectionType: "home",
        odds: 1.8,
      }),
    ]);
    const results: LedgerGameResult[] = [
      { gameId: "kbo-a-b", status: "finished", homeScore: 5, awayScore: 2 },
    ];
    const r = settleLedgerTickets(store([t]), results, { now: NOW });
    assert(r.changed, "changed");
    assert(r.store.tickets[0].picks[0].resultStatus === "win", "pick win");
    assert(r.store.tickets[0].resultStatus === "win", "ticket win");
    assert(
      r.store.tickets[0].actualReturn === t.expectedReturn,
      "actualReturn=expected",
    );
    assert(r.store.tickets[0].stake === 10000, "stake immutable");
    assert(r.store.tickets[0].combinedOdds === 1.8, "odds immutable");
  });

  check("단폴 낙첨", () => {
    const t = ticket("t2", [
      pick({
        id: "p1",
        gameId: "kbo-a-b",
        selectionType: "home",
        odds: 1.8,
      }),
    ]);
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "kbo-a-b", status: "finished", winner: "away" }],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "loss", "pick loss");
    assert(r.store.tickets[0].resultStatus === "loss", "ticket loss");
    assert(r.store.tickets[0].actualReturn === 0, "actualReturn 0");
  });

  check("2폴더 모두 적중", () => {
    const picks = [
      pick({
        id: "p1",
        gameId: "g1",
        selectionType: "home",
        odds: 1.8,
        sport: "baseball",
      }),
      pick({
        id: "p2",
        gameId: "g2",
        selectionType: "away",
        odds: 2.0,
        sport: "football",
      }),
    ];
    const t = ticket("t3", picks);
    const r = settleLedgerTickets(
      store([t]),
      [
        { gameId: "g1", status: "finished", winner: "home" },
        { gameId: "g2", status: "finished", winner: "away" },
      ],
      { now: NOW },
    );
    assert(r.store.tickets[0].resultStatus === "win", "ticket win");
    assert(
      Math.abs(r.store.tickets[0].combinedOdds - 3.6) < 1e-9,
      "combinedOdds unchanged",
    );
    assert(
      r.store.tickets[0].actualReturn === t.expectedReturn,
      "actual=expected",
    );
  });

  check("2폴더 하나 낙첨", () => {
    const picks = [
      pick({ id: "p1", gameId: "g1", selectionType: "home", odds: 1.8 }),
      pick({ id: "p2", gameId: "g2", selectionType: "away", odds: 2.0 }),
    ];
    const t = ticket("t4", picks);
    const r = settleLedgerTickets(
      store([t]),
      [
        { gameId: "g1", status: "finished", winner: "home" },
        { gameId: "g2", status: "finished", winner: "home" },
      ],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "win", "p1 win");
    assert(r.store.tickets[0].picks[1].resultStatus === "loss", "p2 loss");
    assert(r.store.tickets[0].resultStatus === "loss", "ticket loss");
    assert(r.store.tickets[0].actualReturn === 0, "actual 0");
  });

  check("일부 경기 pending", () => {
    const picks = [
      pick({ id: "p1", gameId: "g1", selectionType: "home", odds: 1.8 }),
      pick({ id: "p2", gameId: "g2", selectionType: "away", odds: 2.0 }),
    ];
    const t = ticket("t5", picks);
    const r = settleLedgerTickets(
      store([t]),
      [
        { gameId: "g1", status: "finished", winner: "home" },
        { gameId: "g2", status: "pending" },
      ],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "win", "p1 win");
    assert(r.store.tickets[0].picks[1].resultStatus === "pending", "p2 pending");
    assert(r.store.tickets[0].resultStatus === "pending", "ticket pending");
    assert(r.store.tickets[0].actualReturn === null, "actual null");
  });

  check("gameId null 수기 기록 미변경", () => {
    const t = ticket("t6", [
      pick({
        id: "p1",
        gameId: null,
        selectionType: "home",
        odds: 1.9,
      }),
    ]);
    const before = JSON.stringify(t);
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "anything", status: "finished", winner: "home" }],
      { now: NOW },
    );
    assert(!r.changed, "no change");
    assert(JSON.stringify(r.store.tickets[0]) === before, "ticket identical");
    assert(
      r.skipped.some((s) => s.reason === "no-gameId"),
      "skip no-gameId",
    );
  });

  check("draw 선택", () => {
    const t = ticket("t7", [
      pick({
        id: "p1",
        gameId: "g-draw",
        selectionType: "draw",
        odds: 3.2,
        sport: "football",
      }),
    ]);
    const win = settleLedgerTickets(
      store([t]),
      [{ gameId: "g-draw", status: "finished", homeScore: 1, awayScore: 1 }],
      { now: NOW },
    );
    assert(win.store.tickets[0].picks[0].resultStatus === "win", "draw win");

    const loss = settleLedgerTickets(
      store([t]),
      [{ gameId: "g-draw", status: "finished", winner: "home" }],
      { now: NOW },
    );
    assert(loss.store.tickets[0].picks[0].resultStatus === "loss", "draw loss");
  });

  check("other 선택 미변경", () => {
    const t = ticket("t8", [
      pick({
        id: "p1",
        gameId: "g1",
        selectionType: "other",
        selectionLabel: "오버 8.5",
        odds: 1.9,
      }),
    ]);
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "g1", status: "finished", winner: "home" }],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "pending", "still pending");
    assert(
      r.skipped.some((s) => s.reason === "selection-other"),
      "skip other",
    );
  });

  check("이미 win/loss 픽 덮어쓰지 않음", () => {
    const t = ticket("t9", [
      pick({
        id: "p1",
        gameId: "g1",
        selectionType: "home",
        odds: 1.5,
        resultStatus: "win",
      }),
    ]);
    t.resultStatus = "win";
    t.actualReturn = t.expectedReturn;
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "g1", status: "finished", winner: "away" }],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "win", "kept win");
    assert(
      r.skipped.some((s) => s.reason === "not-pending"),
      "skip not-pending",
    );
  });

  check("한화-LG 연결 티켓 정산 예시", () => {
    // 실제 2026-07-25: Hanwha 11 - LG 15 → away 승
    // 홈승 픽이면 loss
    const linked = ticket(
      "hanwha-lg-ticket",
      [
        pick({
          id: "pick-hanwha",
          gameId: "kbo-hanwha-eagles-lg-twins",
          selectionType: "home",
          selectionLabel: "홈승",
          odds: 1.81,
          homeTeam: "Hanwha Eagles",
          awayTeam: "LG Twins",
          league: "KBO",
        }),
      ],
      10000,
    );
    const r = settleLedgerTickets(
      store([linked]),
      [
        {
          gameId: "kbo-hanwha-eagles-lg-twins",
          status: "finished",
          homeScore: 11,
          awayScore: 15,
        },
      ],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "loss", "home pick loss");
    assert(r.store.tickets[0].resultStatus === "loss", "ticket loss");
    assert(r.store.tickets[0].actualReturn === 0, "actual 0");
    assert(r.store.tickets[0].stake === 10000, "stake");
    assert(r.store.tickets[0].expectedReturn === linked.expectedReturn, "expected unchanged");
  });

  check("취소는 자동 void 하지 않음", () => {
    const t = ticket("t10", [
      pick({ id: "p1", gameId: "g1", selectionType: "home", odds: 1.5 }),
    ]);
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "g1", status: "cancelled" }],
      { now: NOW },
    );
    assert(r.store.tickets[0].picks[0].resultStatus === "pending", "pending");
    assert(
      r.skipped.some((s) => s.reason === "game-cancelled-no-auto-void"),
      "cancelled skip",
    );
  });

  check("재실행 시 중복 변경 없음", () => {
    const t = ticket("t11", [
      pick({ id: "p1", gameId: "g1", selectionType: "away", odds: 2.1 }),
    ]);
    const results: LedgerGameResult[] = [
      { gameId: "g1", status: "finished", winner: "away" },
    ];
    assert(
      settleLedgerTicketsIdempotent(store([t]), results),
      "idempotent",
    );
  });

  check("금액·배당 불변", () => {
    const t = ticket("t12", [
      pick({ id: "p1", gameId: "g1", selectionType: "home", odds: 2.25 }),
    ], 15000);
    const odds = t.combinedOdds;
    const expected = t.expectedReturn;
    const stake = t.stake;
    const r = settleLedgerTickets(
      store([t]),
      [{ gameId: "g1", status: "finished", winner: "home" }],
      { now: NOW },
    );
    assert(r.store.tickets[0].stake === stake, "stake");
    assert(r.store.tickets[0].combinedOdds === odds, "combinedOdds");
    assert(r.store.tickets[0].expectedReturn === expected, "expectedReturn");
    assert(r.store.tickets[0].picks[0].odds === 2.25, "pick odds");
  });

  check("actualReturnForTicketStatus", () => {
    assert(actualReturnForTicketStatus("loss", 36000) === 0, "loss");
    assert(actualReturnForTicketStatus("win", 36000) === 36000, "win");
    assert(actualReturnForTicketStatus("pending", 36000) === null, "pending");
  });

  console.log("");
  if (failed > 0) {
    console.log(`결과: ${failed} failed`);
    process.exit(1);
  }
  console.log("결과: all passed");
}

main();
