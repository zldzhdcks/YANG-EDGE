"use client";

import { useId, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatKrw, formatOdds } from "@/lib/ledger";
import type {
  LedgerPickDraft,
  LedgerTicketDraft,
  RecognitionField,
  RecognitionStatus,
} from "@/types/ledger-draft";
import type { LedgerSelectionType } from "@/types/ledger";

type FieldKind = "text" | "date" | "number" | "select";

type SelectOption = { value: string; label: string };

const SELECTION_OPTIONS: SelectOption[] = [
  { value: "home", label: "홈 승" },
  { value: "draw", label: "무승부" },
  { value: "away", label: "원정 승" },
  { value: "other", label: "기타" },
];

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "manual", label: "직접 판단 (manual)" },
  { value: "yang-edge", label: "YANG EDGE 참고 (yang-edge)" },
];

const statusMeta: Record<
  RecognitionStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  confirmed: { label: "확인됨", variant: "success" },
  "needs-review": { label: "확인 필요", variant: "warning" },
  missing: { label: "누락", variant: "danger" },
};

function valueToRaw(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

const inputClasses =
  "w-full rounded-lg border border-white/[0.12] bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20";

type FieldRowProps = {
  id: string;
  label: string;
  kind: FieldKind;
  field: RecognitionField<string> | RecognitionField<number>;
  editable: boolean;
  options?: SelectOption[];
  onEdit: () => void;
  onCommit: (raw: string) => void;
};

function FieldRow({
  id,
  label,
  kind,
  field,
  editable,
  options,
  onEdit,
  onCommit,
}: FieldRowProps) {
  const [raw, setRaw] = useState(() => valueToRaw(field.value));
  const meta = statusMeta[field.status];

  function handleChange(next: string) {
    setRaw(next);
    // 수정 직후 confirmed 가 되어도 입력창이 닫히지 않도록 열린 상태를 유지한다.
    onEdit();
    onCommit(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-zinc-400">
          {label}
        </label>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      {editable ? (
        kind === "select" ? (
          <select
            id={id}
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
          >
            <option value="">선택하세요</option>
            {(options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
            step={kind === "number" ? "any" : undefined}
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
          />
        )
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-zinc-950/40 px-3 py-2">
          <span id={id} className="truncate text-sm text-white">
            {valueToRaw(field.value) === "" ? "—" : valueToRaw(field.value)}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            수정
          </button>
        </div>
      )}

      {field.sourceText ? (
        <p className="text-[11px] text-zinc-600">인식 원문: {field.sourceText}</p>
      ) : null}
      {field.issues.length > 0 ? (
        <p className="text-[11px] text-amber-400">{field.issues.join(", ")}</p>
      ) : null}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <div className="rounded-lg border border-white/[0.06] bg-zinc-950/40 px-3 py-2 text-sm text-white">
        {value}
      </div>
    </div>
  );
}

/** 사용자가 직접 고친 값은 인식 신뢰도를 버리고 확정 처리한다. */
function editedField<T>(
  field: RecognitionField<T>,
  value: T | null,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
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

function parseNumberRaw(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

type LedgerDraftReviewProps = {
  draft: LedgerTicketDraft;
  /** 변경된 Draft. 상위에서 validateTicketDraft 재실행 */
  onChange: (next: LedgerTicketDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saveError?: string | null;
};

export default function LedgerDraftReview({
  draft,
  onChange,
  onSave,
  onCancel,
  saveError,
}: LedgerDraftReviewProps) {
  const uid = useId();
  // 수정으로 confirmed 가 된 뒤에도 입력창이 닫히지 않도록 열린 필드를 기억한다.
  const [openPaths, setOpenPaths] = useState<string[]>([]);

  const remainingCount = useMemo(() => {
    const paths = new Set(
      draft.validationIssues.map((i) => i.path ?? i.code),
    );
    return paths.size;
  }, [draft.validationIssues]);

  function isEditable(path: string, field: RecognitionField<unknown>) {
    return field.status !== "confirmed" || openPaths.includes(path);
  }

  function openPath(path: string) {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }

  function updateTicket(patch: Partial<LedgerTicketDraft>) {
    onChange({ ...draft, ...patch });
  }

  function updatePick(clientKey: string, patch: Partial<LedgerPickDraft>) {
    onChange({
      ...draft,
      picks: draft.picks.map((p) =>
        p.clientKey === clientKey ? { ...p, ...patch } : p,
      ),
    });
  }

  const rowProps = (path: string, field: RecognitionField<unknown>) => ({
    id: `${uid}-${path}`,
    editable: isEditable(path, field),
    onEdit: () => openPath(path),
  });

  return (
    <Card as="section" aria-labelledby={`${uid}-title`} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${uid}-title`} className="text-sm font-semibold text-white">
            인식 결과 검수
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            아래 내용을 확인하고 필요한 항목을 수정한 뒤 저장하세요. 저장 전에는
            가계부에 아무것도 기록되지 않습니다.
          </p>
        </div>
        <Badge variant={draft.readyToSave ? "success" : "warning"}>
          {draft.readyToSave ? "저장 가능" : `검토 필요 ${remainingCount}건`}
        </Badge>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          티켓 공통
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow
            {...rowProps("betDate", draft.betDate)}
            label="베팅일"
            kind="date"
            field={draft.betDate}
            onCommit={(raw) =>
              updateTicket({ betDate: editedField(draft.betDate, raw) })
            }
          />
          <FieldRow
            {...rowProps("stake", draft.stake)}
            label="베팅금 (원)"
            kind="number"
            field={draft.stake}
            onCommit={(raw) =>
              updateTicket({
                stake: editedField(draft.stake, parseNumberRaw(raw)),
              })
            }
          />
          <FieldRow
            {...rowProps("recognizedCombinedOdds", draft.recognizedCombinedOdds)}
            label="인식 조합배당"
            kind="number"
            field={draft.recognizedCombinedOdds}
            onCommit={(raw) =>
              updateTicket({
                recognizedCombinedOdds: editedField(
                  draft.recognizedCombinedOdds,
                  parseNumberRaw(raw),
                ),
              })
            }
          />
          <ReadOnlyRow
            label="계산 조합배당"
            value={
              draft.calculatedCombinedOdds == null
                ? "—"
                : formatOdds(draft.calculatedCombinedOdds)
            }
          />
          <FieldRow
            {...rowProps("expectedReturn", draft.expectedReturn)}
            label="인식 예상 환급액 (원)"
            kind="number"
            field={draft.expectedReturn}
            onCommit={(raw) =>
              updateTicket({
                expectedReturn: editedField(
                  draft.expectedReturn,
                  parseNumberRaw(raw),
                ),
              })
            }
          />
          <ReadOnlyRow
            label="계산 예상 환급액"
            value={
              draft.calculatedExpectedReturn == null
                ? "—"
                : formatKrw(draft.calculatedExpectedReturn)
            }
          />
          <FieldRow
            {...rowProps("source", draft.source)}
            label="출처"
            kind="select"
            options={SOURCE_OPTIONS}
            field={draft.source}
            onCommit={(raw) =>
              updateTicket({ source: editedField(draft.source, raw) })
            }
          />
          <FieldRow
            {...rowProps("memo", draft.memo)}
            label="메모"
            kind="text"
            field={draft.memo}
            onCommit={(raw) =>
              updateTicket({
                memo: editedField(draft.memo, raw, { allowEmpty: true }),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          픽 {draft.picks.length}개
        </h3>
        {draft.picks.map((pick, index) => (
          <div
            key={pick.clientKey}
            className="space-y-3 rounded-xl border border-white/[0.08] bg-zinc-950/40 p-4"
          >
            <p className="text-xs font-semibold text-zinc-400">
              픽 {index + 1}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow
                {...rowProps(`picks.${pick.clientKey}.sport`, pick.sport)}
                label="종목"
                kind="text"
                field={pick.sport}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    sport: editedField(pick.sport, raw),
                  })
                }
              />
              <FieldRow
                {...rowProps(`picks.${pick.clientKey}.league`, pick.league)}
                label="리그"
                kind="text"
                field={pick.league}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    league: editedField(pick.league, raw, { allowEmpty: true }),
                  })
                }
              />
              <FieldRow
                {...rowProps(`picks.${pick.clientKey}.homeTeam`, pick.homeTeam)}
                label="홈팀"
                kind="text"
                field={pick.homeTeam}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    homeTeam: editedField(pick.homeTeam, raw),
                  })
                }
              />
              <FieldRow
                {...rowProps(`picks.${pick.clientKey}.awayTeam`, pick.awayTeam)}
                label="원정팀"
                kind="text"
                field={pick.awayTeam}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    awayTeam: editedField(pick.awayTeam, raw),
                  })
                }
              />
              <FieldRow
                {...rowProps(
                  `picks.${pick.clientKey}.selectionType`,
                  pick.selectionType,
                )}
                label="선택"
                kind="select"
                options={SELECTION_OPTIONS}
                field={pick.selectionType}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    selectionType: editedField(
                      pick.selectionType,
                      raw === "" ? null : (raw as LedgerSelectionType),
                    ),
                  })
                }
              />
              <FieldRow
                {...rowProps(
                  `picks.${pick.clientKey}.selectionLabel`,
                  pick.selectionLabel,
                )}
                label="선택 내용"
                kind="text"
                field={pick.selectionLabel}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    selectionLabel: editedField(pick.selectionLabel, raw),
                  })
                }
              />
              <FieldRow
                {...rowProps(`picks.${pick.clientKey}.odds`, pick.odds)}
                label="배당"
                kind="number"
                field={pick.odds}
                onCommit={(raw) =>
                  updatePick(pick.clientKey, {
                    odds: editedField(pick.odds, parseNumberRaw(raw)),
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>

      {draft.validationIssues.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
          <p className="text-xs font-semibold text-amber-400">
            남은 검토 항목 {remainingCount}건
          </p>
          <ul className="space-y-0.5">
            {draft.validationIssues.map((issue, i) => (
              <li key={`${issue.code}-${issue.path ?? i}`} className="text-xs text-amber-300/80">
                {issue.path ? `${issue.path}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-xs text-rose-400">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onSave} disabled={!draft.readyToSave}>
          확인하고 가계부에 저장
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        {!draft.readyToSave ? (
          <span className="text-xs text-zinc-500">
            검토 항목 {remainingCount}건을 정리하면 저장할 수 있습니다.
          </span>
        ) : null}
      </div>
    </Card>
  );
}
