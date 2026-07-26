/**
 * LedgerTicketDraft 검산·변환 스모크 테스트
 * 실행: npx tsx scripts/test-ledger-ticket-draft.ts
 */
import {
  emptyRecognitionField,
  recognitionField,
  type LedgerPickDraft,
  type LedgerTicketDraft,
} from "../src/types/ledger-draft";
import { validateTicketDraft } from "../src/lib/ledger/validate-ticket-draft";
import { ticketFromConfirmedDraft } from "../src/lib/ledger/ticket-from-confirmed-draft";
import {
  appendImageHashIfNew,
  isDuplicateImageHash,
} from "../src/lib/ledger/image-hash";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function confirmed<T>(
  value: T,
  confidence = 0.95,
): ReturnType<typeof recognitionField<T>> {
  return recognitionField({
    value,
    confidence,
    sourceText: String(value),
    status: "confirmed",
    issues: [],
  });
}

function basePick(
  clientKey: string,
  overrides: Partial<LedgerPickDraft> = {},
): LedgerPickDraft {
  return {
    clientKey,
    gameId: emptyRecognitionField<string>(),
    sport: confirmed("baseball"),
    league: confirmed("KBO"),
    homeTeam: confirmed("Doosan Bears"),
    awayTeam: confirmed("Samsung Lions"),
    startTime: emptyRecognitionField<string>(),
    selectionType: confirmed("home" as const),
    selectionLabel: confirmed("홈승"),
    odds: confirmed(1.8),
    ...overrides,
  };
}

function baseDraft(
  overrides: Partial<LedgerTicketDraft> = {},
): LedgerTicketDraft {
  return {
    id: "draft-1",
    imageHash: "hash-abc",
    betDate: confirmed("2026-07-25"),
    stake: confirmed(10000),
    recognizedCombinedOdds: confirmed(1.8),
    calculatedCombinedOdds: null,
    expectedReturn: confirmed(18000),
    calculatedExpectedReturn: null,
    source: confirmed("manual"),
    memo: recognitionField({
      value: "",
      confidence: 1,
      sourceText: "",
      status: "confirmed",
      issues: [],
    }),
    picks: [basePick("pick-0")],
    validationIssues: [],
    readyToSave: false,
    ...overrides,
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

  console.log("=== ledger ticket draft validation ===\n");

  check("정상 단폴 Draft", () => {
    const v = validateTicketDraft(baseDraft());
    assert(v.readyToSave === true, "readyToSave");
    assert(v.calculatedCombinedOdds === 1.8, "combined");
    assert(v.calculatedExpectedReturn === 18000, "expected");
    assert(v.validationIssues.length === 0, "no issues");
  });

  check("야구+축구+농구 혼합 3폴더", () => {
    const draft = baseDraft({
      picks: [
        basePick("p0", {
          sport: confirmed("baseball"),
          odds: confirmed(1.8),
          selectionType: confirmed("home" as const),
        }),
        basePick("p1", {
          sport: confirmed("football"),
          league: confirmed("K리그"),
          homeTeam: confirmed("Ulsan"),
          awayTeam: confirmed("Jeonbuk"),
          selectionType: confirmed("away" as const),
          selectionLabel: confirmed("원정승"),
          odds: confirmed(2.0),
        }),
        basePick("p2", {
          sport: confirmed("basketball"),
          league: confirmed("KBL"),
          homeTeam: confirmed("A"),
          awayTeam: confirmed("B"),
          selectionType: confirmed("home" as const),
          odds: confirmed(1.5),
        }),
      ],
      recognizedCombinedOdds: confirmed(1.8 * 2.0 * 1.5),
      expectedReturn: confirmed(Math.round(10000 * 1.8 * 2.0 * 1.5)),
    });
    const v = validateTicketDraft(draft);
    assert(v.readyToSave, "ready");
    assert(Math.abs((v.calculatedCombinedOdds ?? 0) - 5.4) < 1e-9, "5.4");
    assert(v.calculatedExpectedReturn === 54000, "54000");
  });

  check("배당 누락", () => {
    const v = validateTicketDraft(
      baseDraft({
        picks: [
          basePick("p0", {
            odds: emptyRecognitionField<number>(),
          }),
        ],
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(
      v.validationIssues.some((i) => i.code === "REQUIRED_MISSING"),
      "missing",
    );
  });

  check("배당 1 미만", () => {
    const v = validateTicketDraft(
      baseDraft({
        picks: [basePick("p0", { odds: confirmed(0.95) })],
        recognizedCombinedOdds: emptyRecognitionField<number>(),
        expectedReturn: emptyRecognitionField<number>(),
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(v.validationIssues.some((i) => i.code === "INVALID_ODDS"), "odds");
  });

  check("베팅금 0", () => {
    const v = validateTicketDraft(
      baseDraft({
        stake: confirmed(0),
        recognizedCombinedOdds: emptyRecognitionField<number>(),
        expectedReturn: emptyRecognitionField<number>(),
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(v.validationIssues.some((i) => i.code === "INVALID_STAKE"), "stake");
  });

  check("confidence 낮음", () => {
    const v = validateTicketDraft(
      baseDraft({
        stake: recognitionField({
          value: 10000,
          confidence: 0.5,
          sourceText: "10000",
          status: "confirmed",
          issues: [],
        }),
      }),
    );
    assert(v.stake.status === "needs-review", "needs-review");
    assert(!v.readyToSave, "not ready");
  });

  check("confidence 범위 오류", () => {
    const v = validateTicketDraft(
      baseDraft({
        stake: recognitionField({
          value: 10000,
          confidence: 1.5,
          sourceText: "10000",
          status: "confirmed",
          issues: [],
        }),
      }),
    );
    assert(v.stake.confidence === null, "confidence null");
    assert(v.stake.status === "needs-review", "needs-review");
    assert(v.stake.issues.includes("INVALID_CONFIDENCE"), "issue");
    assert(!v.readyToSave, "not ready");
  });

  check("조합배당 일치", () => {
    const v = validateTicketDraft(
      baseDraft({
        recognizedCombinedOdds: confirmed(1.8),
      }),
    );
    assert(v.readyToSave, "ready");
    assert(
      !v.recognizedCombinedOdds.issues.includes("COMBINED_ODDS_MISMATCH"),
      "no mismatch",
    );
  });

  check("조합배당 1% 초과 불일치", () => {
    const v = validateTicketDraft(
      baseDraft({
        recognizedCombinedOdds: confirmed(2.0),
        expectedReturn: emptyRecognitionField<number>(),
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(
      v.recognizedCombinedOdds.issues.includes("COMBINED_ODDS_MISMATCH"),
      "mismatch",
    );
    assert(
      v.validationIssues.some((i) => i.code === "COMBINED_ODDS_MISMATCH"),
      "issue",
    );
  });

  check("예상 환급 일치", () => {
    const v = validateTicketDraft(
      baseDraft({
        expectedReturn: confirmed(18000),
      }),
    );
    assert(v.readyToSave, "ready");
  });

  check("예상 환급 불일치", () => {
    const v = validateTicketDraft(
      baseDraft({
        expectedReturn: confirmed(20000),
        recognizedCombinedOdds: emptyRecognitionField<number>(),
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(
      v.expectedReturn.issues.includes("EXPECTED_RETURN_MISMATCH"),
      "mismatch",
    );
  });

  check("needs-review가 있으면 저장 불가", () => {
    const v = validateTicketDraft(
      baseDraft({
        picks: [
          basePick("p0", {
            homeTeam: recognitionField({
              value: "Doosan",
              confidence: 0.9,
              sourceText: "Doosan",
              status: "needs-review",
              issues: [],
            }),
          }),
        ],
        recognizedCombinedOdds: emptyRecognitionField<number>(),
        expectedReturn: emptyRecognitionField<number>(),
      }),
    );
    assert(!v.readyToSave, "not ready");
    assert(v.validationIssues.some((i) => i.code === "NEEDS_REVIEW"), "nr");
  });

  check("confirmed 완료 후 LedgerTicket 변환", () => {
    const v = validateTicketDraft(baseDraft());
    const result = ticketFromConfirmedDraft(v, {
      id: "ticket-fixed",
      now: "2026-07-26T00:00:00.000Z",
    });
    assert(result.ok === true, "ok");
    if (!result.ok) return;
    assert(result.ticket.id === "ticket-fixed", "id");
    assert(result.ticket.resultStatus === "pending", "pending");
    assert(result.ticket.actualReturn === null, "actual null");
    assert(result.ticket.stake === 10000, "stake");
    assert(result.ticket.combinedOdds === 1.8, "odds");
    assert(result.ticket.picks.length === 1, "1 pick");
    assert(result.ticket.picks[0].resultStatus === "pending", "pick pending");
  });

  check("인식 원문·confidence가 저장 타입에 들어가지 않음", () => {
    const v = validateTicketDraft(baseDraft());
    const result = ticketFromConfirmedDraft(v, {
      id: "t-meta",
      now: "2026-07-26T00:00:00.000Z",
    });
    assert(result.ok, "ok");
    if (!result.ok) return;
    const json = JSON.stringify(result.ticket);
    assert(!json.includes("sourceText"), "no sourceText");
    assert(!json.includes("confidence"), "no confidence");
    assert(!json.includes("imageHash"), "no imageHash");
    assert(!/"needs-review"/.test(json), "no status enum");
  });

  check("중복 hash 감지", () => {
    assert(isDuplicateImageHash("aaa", ["aaa", "bbb"]) === true, "dup");
    assert(isDuplicateImageHash("ccc", ["aaa"]) === false, "new");
    assert(isDuplicateImageHash(null, ["aaa"]) === false, "null");
    assert(isDuplicateImageHash("", ["aaa"]) === false, "empty");
    const next = appendImageHashIfNew("aaa", ["aaa"]);
    assert(next.length === 1, "no append");
    const next2 = appendImageHashIfNew("zzz", ["aaa"]);
    assert(next2.length === 2 && next2[1] === "zzz", "append");
  });

  check("동일 입력 결정성", () => {
    const d = baseDraft();
    const a = validateTicketDraft(d);
    const b = validateTicketDraft(d);
    assert(JSON.stringify(a) === JSON.stringify(b), "validate deterministic");
    const t1 = ticketFromConfirmedDraft(a, {
      id: "same",
      now: "2026-07-26T00:00:00.000Z",
    });
    const t2 = ticketFromConfirmedDraft(a, {
      id: "same",
      now: "2026-07-26T00:00:00.000Z",
    });
    assert(JSON.stringify(t1) === JSON.stringify(t2), "convert deterministic");
  });

  check("readyToSave false 이면 변환 오류", () => {
    const v = validateTicketDraft(
      baseDraft({
        picks: [basePick("p0", { odds: emptyRecognitionField<number>() })],
      }),
    );
    const r = ticketFromConfirmedDraft(v);
    assert(r.ok === false, "not ok");
  });

  console.log("");
  if (failed > 0) {
    console.log(`결과: ${failed} failed`);
    process.exit(1);
  }
  console.log("결과: all passed");
}

main();
