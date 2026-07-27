"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  LedgerBetSource,
  LedgerSelectionType,
  LedgerSportKnown,
  LedgerTicket,
} from "@/types/ledger";
import {
  LEDGER_SOURCE_OPTIONS,
  LEDGER_SPORT_OPTIONS,
  ledgerSportSelectOptionsForValue,
} from "@/types/ledger";
import { getKstToday } from "@/lib/datetime/kst";
import {
  combinePickOdds,
  expectedTicketReturn,
  formatKrw,
  isValidPickOdds,
  parseOptionalNumber,
  parseWonAmount,
  selectionOptionsForSport,
  defaultSelectionForSport,
  selectionOptionValue,
  parseSelectionOptionValue,
  type BudgetWarnings,
  type LedgerTicketInput,
} from "@/lib/ledger";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type LedgerTicketFormProps = {
  initial: LedgerTicket | null;
  warnings: BudgetWarnings;
  onDraftStakeChange: (stake: number | null) => void;
  onSubmit: (input: LedgerTicketInput) => void;
  onCancel?: () => void;
};

/**
 * 폼 내부 UI 키 — LedgerPick.id 와 별개.
 * SSR/hydration 동안 동일해야 하므로 렌더 중 난수 생성 금지.
 */
type PickDraft = {
  clientKey: string;
  sport: LedgerSportKnown;
  league: string;
  matchName: string;
  selectionType: LedgerSelectionType;
  selectionLabel: string;
  oddsRaw: string;
};

type FieldErrors = {
  betDate?: string;
  stake?: string;
  picks?: string;
  pickErrors?: Record<
    string,
    Partial<Record<"matchName" | "selection" | "odds", string>>
  >;
};

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClass = "mb-1.5 block text-xs font-medium text-zinc-400";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-400">{message}</p>;
}

function createEmptyPick(
  clientKey: string,
  sport: LedgerSportKnown = "baseball",
): PickDraft {
  const sel = defaultSelectionForSport(sport);
  return {
    clientKey,
    sport,
    league: "",
    matchName: "",
    selectionType: sel.selectionType,
    selectionLabel: sel.selectionLabel,
    oddsRaw: "",
  };
}

/** 편집 시: 저장된 pick.id 는 쓰지 않고 안정적인 pick-0, pick-1… 사용 */
function ticketToDrafts(ticket: LedgerTicket): PickDraft[] {
  return ticket.picks.map((p, index) => {
    const matchName =
      p.awayTeam.trim() !== ""
        ? `${p.homeTeam} vs ${p.awayTeam}`
        : p.homeTeam;
    const sport = (LEDGER_SPORT_OPTIONS.some((o) => o.id === p.sport)
      ? p.sport
      : "other") as LedgerSportKnown;
    return {
      clientKey: `pick-${index}`,
      sport,
      league: p.league,
      matchName,
      selectionType: p.selectionType,
      selectionLabel: p.selectionLabel,
      oddsRaw: String(p.odds),
    };
  });
}

/** 표시용 조합배당 — 소수 둘째 자리. 내부 값은 그대로 유지 */
function formatCombinedOddsDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function LedgerTicketForm({
  initial,
  warnings,
  onDraftStakeChange,
  onSubmit,
  onCancel,
}: LedgerTicketFormProps) {
  const formId = useId();
  const isEdit = initial != null;

  /** 다음 추가 픽용 카운터. 초기 pick-0 다음부터 사용 */
  const nextPickIdRef = useRef(
    initial && initial.picks.length > 0 ? initial.picks.length : 1,
  );

  const [betDate, setBetDate] = useState(initial?.betDate ?? getKstToday());
  const [stakeRaw, setStakeRaw] = useState(
    initial ? String(initial.stake) : "",
  );
  const [source, setSource] = useState<LedgerBetSource>(
    initial?.source ?? "manual",
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [picks, setPicks] = useState<PickDraft[]>(() =>
    initial && initial.picks.length > 0
      ? ticketToDrafts(initial)
      : [createEmptyPick("pick-0")],
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const liveOddsList = useMemo(
    () =>
      picks.map((p) => {
        const n = parseOptionalNumber(p.oddsRaw);
        return n != null && isValidPickOdds(n) ? { odds: n } : null;
      }),
    [picks],
  );

  const combinedOdds = useMemo(() => {
    const valid = liveOddsList.filter(
      (x): x is { odds: number } => x != null,
    );
    if (valid.length === 0) return null;
    // 모든 픽이 유효할 때만 조합배당 표시 (부분 입력 중 오해 방지)
    if (valid.length !== picks.length) return null;
    return combinePickOdds(valid);
  }, [liveOddsList, picks.length]);

  const draftStake = useMemo(() => parseWonAmount(stakeRaw), [stakeRaw]);

  const expectedReturn = useMemo(() => {
    if (combinedOdds == null || draftStake == null || draftStake <= 0) {
      return null;
    }
    return expectedTicketReturn(draftStake, combinedOdds);
  }, [combinedOdds, draftStake]);

  function updatePick(clientKey: string, patch: Partial<PickDraft>) {
    setPicks((prev) =>
      prev.map((p) => (p.clientKey === clientKey ? { ...p, ...patch } : p)),
    );
  }

  function handleSportChange(clientKey: string, sport: LedgerSportKnown) {
    const sel = defaultSelectionForSport(sport);
    updatePick(clientKey, {
      sport,
      selectionType: sel.selectionType,
      selectionLabel: sel.selectionLabel,
    });
  }

  function handleAddPick() {
    const clientKey = `pick-${nextPickIdRef.current}`;
    nextPickIdRef.current += 1;
    setPicks((prev) => [...prev, createEmptyPick(clientKey)]);
  }

  function handleRemovePick(clientKey: string) {
    setPicks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((p) => p.clientKey !== clientKey);
    });
  }

  function validate(): LedgerTicketInput | null {
    const next: FieldErrors = { pickErrors: {} };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(betDate)) {
      next.betDate = "날짜 형식을 확인해 주세요.";
    }

    const stake = parseWonAmount(stakeRaw);
    if (stake == null || stake <= 0) {
      next.stake = "베팅금은 0보다 큰 원 단위로 입력해 주세요.";
    }

    if (picks.length < 1) {
      next.picks = "픽을 최소 1개 등록해 주세요.";
    }

    const pickInputs: LedgerTicketInput["picks"] = [];

    for (const pick of picks) {
      const pe: NonNullable<FieldErrors["pickErrors"]>[string] = {};

      if (pick.matchName.trim() === "") {
        pe.matchName = "경기명을 입력해 주세요.";
      }

      if (pick.selectionLabel.trim() === "") {
        pe.selection = "선택을 입력해 주세요.";
      }

      const odds = parseOptionalNumber(pick.oddsRaw);
      if (odds == null || !isValidPickOdds(odds)) {
        pe.odds = "배당은 1 이상이어야 합니다.";
      }

      if (Object.keys(pe).length > 0) {
        next.pickErrors![pick.clientKey] = pe;
      }

      if (
        pick.matchName.trim() !== "" &&
        pick.selectionLabel.trim() !== "" &&
        odds != null &&
        isValidPickOdds(odds)
      ) {
        pickInputs.push({
          sport: pick.sport,
          league: pick.league,
          matchName: pick.matchName.trim(),
          selectionType: pick.selectionType,
          selectionLabel: pick.selectionLabel.trim(),
          odds,
        });
      }
    }

    const hasPickFieldErrors =
      next.pickErrors != null && Object.keys(next.pickErrors).length > 0;

    setErrors(next);

    if (
      next.betDate ||
      next.stake ||
      next.picks ||
      hasPickFieldErrors ||
      stake == null ||
      stake <= 0 ||
      pickInputs.length !== picks.length
    ) {
      return null;
    }

    return {
      betDate,
      stake,
      source,
      memo: memo.trim(),
      picks: pickInputs,
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = validate();
    if (!input) return;
    onSubmit(input);
  }

  return (
    <section id="ledger-form" aria-labelledby={`${formId}-title`}>
      <h2
        id={`${formId}-title`}
        className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase"
      >
        {isEdit ? "티켓 수정" : "티켓 등록"}
      </h2>

      <Card padding="md" className="rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* 티켓 공통 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-date`} className={labelClass}>
                베팅일 <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-date`}
                type="date"
                value={betDate}
                onChange={(e) => setBetDate(e.target.value)}
                className={inputClass}
                required
              />
              <FieldError message={errors.betDate} />
            </div>

            <div>
              <label htmlFor={`${formId}-stake`} className={labelClass}>
                베팅금 (원) <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-stake`}
                type="text"
                inputMode="numeric"
                value={stakeRaw}
                onChange={(e) => {
                  setStakeRaw(e.target.value);
                  onDraftStakeChange(parseWonAmount(e.target.value));
                }}
                placeholder="예: 10000"
                className={inputClass}
                required
              />
              <FieldError message={errors.stake} />
            </div>

            <div>
              <label htmlFor={`${formId}-source`} className={labelClass}>
                판단 출처
              </label>
              <select
                id={`${formId}-source`}
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as LedgerBetSource)
                }
                className={inputClass}
              >
                {LEDGER_SOURCE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-memo`} className={labelClass}>
                메모
              </label>
              <textarea
                id={`${formId}-memo`}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="선택 사항"
              />
            </div>
          </div>

          {/* 픽 목록 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                픽 ({picks.length})
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPick}
              >
                + 픽 추가
              </Button>
            </div>

            {picks.length >= 10 ? (
              <p className="text-xs text-amber-200/90">
                픽이 {picks.length}개입니다. 티켓이 길어지면 관리가 어려울 수
                있습니다.
              </p>
            ) : null}

            <FieldError message={errors.picks} />

            {picks.map((pick, index) => {
              const options = selectionOptionsForSport(pick.sport);
              const selectValue = selectionOptionValue({
                selectionType: pick.selectionType,
                label: options.some(
                  (o) =>
                    o.selectionType === pick.selectionType &&
                    o.label === pick.selectionLabel,
                )
                  ? pick.selectionLabel
                  : pick.selectionType === "other"
                    ? "기타"
                    : pick.selectionLabel,
              });
              // 현재 값이 옵션에 없으면 other:기타 로 맞춤 + 커스텀 라벨 필드
              const matched = options.find(
                (o) => selectionOptionValue(o) === selectValue,
              );
              const showCustomLabel =
                pick.selectionType === "other" || !matched;

              const pe = errors.pickErrors?.[pick.clientKey];
              const fieldId = (suffix: string) =>
                `${formId}-${pick.clientKey}-${suffix}`;

              return (
                <div
                  key={pick.clientKey}
                  className="space-y-3 rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-400">
                      픽 {index + 1}
                      <span className="ml-2 text-zinc-600">
                        (
                        {
                          LEDGER_SPORT_OPTIONS.find((s) => s.id === pick.sport)
                            ?.label
                        }
                        )
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={picks.length <= 1}
                      onClick={() => handleRemovePick(pick.clientKey)}
                    >
                      삭제
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={fieldId("sport")}
                        className={labelClass}
                      >
                        종목 (개인 기록 분류)
                      </label>
                      <select
                        id={fieldId("sport")}
                        value={pick.sport}
                        onChange={(e) =>
                          handleSportChange(
                            pick.clientKey,
                            e.target.value as LedgerSportKnown,
                          )
                        }
                        className={inputClass}
                      >
                        {(() => {
                          const groups = ledgerSportSelectOptionsForValue(
                            pick.sport,
                          );
                          return (
                            <>
                              <optgroup label="EDGE 지원 종목">
                                {groups.edge.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="기타 개인 기록">
                                {groups.personal.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </optgroup>
                              {groups.legacy.length > 0 ? (
                                <optgroup label="이전 기록 (신규 선택 불가)">
                                  {groups.legacy.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                            </>
                          );
                        })()}
                      </select>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                        가계부 종목은 개인 베팅 기록용입니다. 기타·이전 기록
                        종목은 YANG EDGE AI 분석 대상이 아닙니다.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor={fieldId("league")}
                        className={labelClass}
                      >
                        리그
                      </label>
                      <input
                        id={fieldId("league")}
                        type="text"
                        value={pick.league}
                        onChange={(e) =>
                          updatePick(pick.clientKey, {
                            league: e.target.value,
                          })
                        }
                        placeholder="예: KBO, K리그"
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor={fieldId("match")}
                        className={labelClass}
                      >
                        경기명 <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id={fieldId("match")}
                        type="text"
                        value={pick.matchName}
                        onChange={(e) =>
                          updatePick(pick.clientKey, {
                            matchName: e.target.value,
                          })
                        }
                        placeholder="예: LG vs 두산"
                        className={inputClass}
                        required
                      />
                      <FieldError message={pe?.matchName} />
                    </div>

                    <div>
                      <label htmlFor={fieldId("sel")} className={labelClass}>
                        선택 <span className="text-rose-400">*</span>
                      </label>
                      <select
                        id={fieldId("sel")}
                        value={
                          matched
                            ? selectionOptionValue(matched)
                            : selectionOptionValue({
                                selectionType: "other",
                                label: "기타",
                              })
                        }
                        onChange={(e) => {
                          const parsed = parseSelectionOptionValue(
                            e.target.value,
                          );
                          if (!parsed) return;
                          updatePick(pick.clientKey, {
                            selectionType: parsed.selectionType,
                            selectionLabel: parsed.selectionLabel,
                          });
                        }}
                        className={inputClass}
                      >
                        {options.map((o) => (
                          <option
                            key={selectionOptionValue(o)}
                            value={selectionOptionValue(o)}
                          >
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {showCustomLabel ? (
                        <input
                          type="text"
                          value={pick.selectionLabel}
                          onChange={(e) =>
                            updatePick(pick.clientKey, {
                              selectionType: "other",
                              selectionLabel: e.target.value,
                            })
                          }
                          placeholder="선택 내용 직접 입력"
                          className={`${inputClass} mt-2`}
                          aria-label={`픽 ${index + 1} 선택 상세`}
                        />
                      ) : null}
                      <FieldError message={pe?.selection} />
                    </div>

                    <div>
                      <label
                        htmlFor={fieldId("odds")}
                        className={labelClass}
                      >
                        배당 <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id={fieldId("odds")}
                        type="text"
                        inputMode="decimal"
                        value={pick.oddsRaw}
                        onChange={(e) =>
                          updatePick(pick.clientKey, {
                            oddsRaw: e.target.value,
                          })
                        }
                        placeholder="예: 1.85"
                        className={inputClass}
                        required
                      />
                      <FieldError message={pe?.odds} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 자동 계산 요약 */}
          <div className="grid gap-3 rounded-lg border border-white/[0.06] bg-zinc-950/40 px-3 py-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-500">조합배당</p>
              <p className="mt-0.5 tabular-nums text-sm text-zinc-200">
                {combinedOdds == null
                  ? "—"
                  : formatCombinedOddsDisplay(combinedOdds)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">예상 환급액</p>
              <p className="mt-0.5 tabular-nums text-sm text-zinc-200">
                {expectedReturn == null ? "—" : formatKrw(expectedReturn)}
              </p>
            </div>
          </div>

          {(warnings.unitStakeExceeded ||
            warnings.dailyLossReached ||
            warnings.monthlyLossReached) && (
            <ul className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
              {warnings.unitStakeExceeded ? (
                <li>설정한 1회 기록금액 기준을 초과했습니다.</li>
              ) : null}
              {warnings.dailyLossReached ? (
                <li>
                  오늘 정산된 손실이 설정한 하루 손실 한도에 도달했습니다.
                </li>
              ) : null}
              {warnings.monthlyLossReached ? (
                <li>
                  이번 달 정산된 손실이 설정한 월 손실 한도에 도달했습니다.
                </li>
              ) : null}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" variant="primary" size="md">
              {isEdit ? "수정 저장" : "티켓 추가"}
            </Button>
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onCancel}
              >
                수정 취소
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </section>
  );
}
