/**
 * 이미지 업로드 검증 · 샘플 Draft · 검수 흐름 스모크 테스트
 * 실행: npx tsx scripts/test-ledger-image-import.ts
 *
 * UI 컴포넌트는 렌더링하지 않고, 컴포넌트가 사용하는 순수 규칙만 검증한다.
 */
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  buildSampleTicketDraft,
  buildSessionFileKey,
  formatFileSize,
  validateImageFile,
} from "../src/lib/ledger/image-import";
import { validateTicketDraft } from "../src/lib/ledger/validate-ticket-draft";
import { ticketFromConfirmedDraft } from "../src/lib/ledger/ticket-from-confirmed-draft";
import {
  appendImageHashIfNew,
  isDuplicateImageHash,
} from "../src/lib/ledger/image-hash";
import type { LedgerTicketDraft, RecognitionField } from "../src/types/ledger-draft";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

/** LedgerDraftReview 의 editedField 와 같은 규칙 (사용자 수정값 확정) */
function editedField<T>(
  field: RecognitionField<T>,
  value: T | null,
  allowEmpty = false,
): RecognitionField<T> {
  const empty =
    value == null || (typeof value === "string" && value.trim() === "");
  return {
    ...field,
    value,
    confidence: null,
    status: empty && !allowEmpty ? "missing" : "confirmed",
    issues: [],
  };
}

const results: string[] = [];
function ok(name: string) {
  results.push(`  PASS  ${name}`);
}

// 1. 허용 형식
for (const type of ALLOWED_IMAGE_TYPES) {
  assert(
    validateImageFile({ type, size: 1024 }).ok,
    `${type} 은 허용되어야 함`,
  );
}
ok("허용 형식(jpeg/png/webp) 통과");

// 2. 형식 거부
for (const type of ["application/pdf", "image/gif", "text/plain", ""]) {
  const r = validateImageFile({ type, size: 1024 });
  assert(!r.ok && r.reason === "type", `${type || "(빈 타입)"} 은 거부되어야 함`);
}
ok("허용되지 않은 형식 거부");

// 3. 크기 제한
assert(
  validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES }).ok,
  "정확히 10MB 는 허용",
);
const tooBig = validateImageFile({
  type: "image/png",
  size: MAX_IMAGE_BYTES + 1,
});
assert(!tooBig.ok && tooBig.reason === "size", "10MB 초과는 거부");
const empty = validateImageFile({ type: "image/png", size: 0 });
assert(!empty.ok && empty.reason === "empty", "0바이트는 거부");
ok("10MB 초과 · 빈 파일 거부");

// 4. 세션 중복 키
const fileA = { name: "slip.png", size: 12345, lastModified: 1700000000000 };
const fileACopy = { ...fileA };
const fileB = { ...fileA, size: 12346 };
assert(
  buildSessionFileKey(fileA) === buildSessionFileKey(fileACopy),
  "같은 파일명+크기+수정시각은 같은 키",
);
assert(
  buildSessionFileKey(fileA) !== buildSessionFileKey(fileB),
  "크기가 다르면 다른 키",
);

let seen: string[] = [];
assert(!isDuplicateImageHash(buildSessionFileKey(fileA), seen), "첫 업로드는 중복 아님");
seen = appendImageHashIfNew(buildSessionFileKey(fileA), seen);
assert(
  isDuplicateImageHash(buildSessionFileKey(fileACopy), seen),
  "같은 세션 재업로드는 중복 경고 대상",
);
seen = appendImageHashIfNew(buildSessionFileKey(fileACopy), seen);
assert(seen.length === 1, "중복은 세션 목록에 중복 추가되지 않음");
assert(
  !isDuplicateImageHash(buildSessionFileKey(fileB), seen),
  "다른 파일은 중복 아님",
);
ok("중복 경고 키(파일명+크기+수정시각)");

// 5. 파일 크기 표기
assert(formatFileSize(512) === "512 B", "512 B");
assert(formatFileSize(2048) === "2.0 KB", "2.0 KB");
assert(formatFileSize(3 * 1024 * 1024) === "3.0 MB", "3.0 MB");
ok("파일 크기 표기");

// 6. 샘플 Draft 는 결정적이고 이미지 원본을 담지 않는다
const s1 = buildSampleTicketDraft({ id: "d1", imageHash: "k1" });
const s2 = buildSampleTicketDraft({ id: "d1", imageHash: "k1" });
assert(JSON.stringify(s1) === JSON.stringify(s2), "샘플 Draft 는 결정적");
assert(s1.imageHash === "k1", "imageHash 는 세션 키만 보관");
assert(
  !JSON.stringify(s1).includes("data:image"),
  "Draft 에 이미지 바이너리가 없어야 함",
);
ok("샘플 Draft 결정성 · 이미지 미보관");

// 7. 샘플 인식 → 검산 결과
const validated = validateTicketDraft(s1);
assert(validated.picks.length === 2, "픽 2개");
assert(validated.betDate.value === "2026-07-25", "베팅일 2026-07-25");
assert(validated.stake.value === 10000, "베팅금 10000");
assert(
  validated.calculatedCombinedOdds === 3.6,
  `계산 조합배당 3.6 (실제 ${validated.calculatedCombinedOdds})`,
);
assert(
  validated.calculatedExpectedReturn === 36000,
  `계산 예상환급 36000 (실제 ${validated.calculatedExpectedReturn})`,
);
assert(
  validated.picks[1].league.status === "needs-review",
  "낮은 confidence 리그는 확인 필요",
);
assert(!validated.readyToSave, "검토 항목이 남으면 저장 불가");
ok("샘플 Draft 검산 (계산값 3.6 / 36,000, readyToSave=false)");

// 8. readyToSave=false 면 저장 차단
const blocked = ticketFromConfirmedDraft(validated);
assert(!blocked.ok, "readyToSave=false 는 티켓으로 변환되지 않음");
ok("확정 전 저장 불가");

// 9. needs-review 수정 → 재검산 → 저장 가능
const edited: LedgerTicketDraft = {
  ...validated,
  picks: validated.picks.map((p, i) =>
    i === 1 ? { ...p, league: editedField(p.league, "K리그1") } : p,
  ),
};
const revalidated = validateTicketDraft(edited);
assert(revalidated.picks[1].league.status === "confirmed", "수정 후 확인됨");
assert(
  revalidated.validationIssues.length === 0,
  `남은 검토 항목 0 (실제 ${revalidated.validationIssues.length})`,
);
assert(revalidated.readyToSave, "수정 후 저장 가능");
ok("needs-review 수정 후 재검산 → readyToSave=true");

// 10. 확정 저장 변환
const saved = ticketFromConfirmedDraft(revalidated, {
  id: "ticket-1",
  now: "2026-07-26T09:00:00.000Z",
});
assert(saved.ok, "확정 Draft 는 변환 성공");
if (saved.ok) {
  assert(saved.ticket.stake === 10000, "베팅금 유지");
  assert(saved.ticket.combinedOdds === 3.6, "조합배당 3.6");
  assert(saved.ticket.expectedReturn === 36000, "예상환급 36000");
  assert(saved.ticket.resultStatus === "pending", "저장 직후 pending");
  assert(saved.ticket.actualReturn === null, "실환급 null");
  assert(saved.ticket.picks.length === 2, "픽 2개 저장");
  assert(
    saved.ticket.picks.every((p) => p.resultStatus === "pending"),
    "픽 pending",
  );
  const json = JSON.stringify(saved.ticket);
  assert(!json.includes("confidence"), "저장 티켓에 confidence 없음");
  assert(!json.includes("sourceText"), "저장 티켓에 sourceText 없음");
  assert(!json.includes("imageHash"), "저장 티켓에 imageHash 없음");
}
ok("확정 후 저장 변환 (인식 메타 제외)");

// 11. 원본 Draft 불변
assert(
  JSON.stringify(s1) === JSON.stringify(buildSampleTicketDraft({ id: "d1", imageHash: "k1" })),
  "검산/변환이 원본 Draft 를 변경하지 않음",
);
ok("원본 Draft 불변");

console.log("이미지 업로드 · Draft 검수 스모크 테스트");
console.log(results.join("\n"));
console.log(`\n총 ${results.length}개 항목 통과`);
