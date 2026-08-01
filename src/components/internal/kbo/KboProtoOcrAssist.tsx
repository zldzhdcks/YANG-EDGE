"use client";

import { useCallback, useMemo, useState } from "react";
import type { KboProtoOcrDraftRow } from "@/lib/kbo/proto-ocr/types";
import {
  CLIPBOARD_MATERIAL_OPTIONS,
  type ClipboardIntakeMaterialType,
} from "@/lib/clipboard-intake";
import { useClipboardImageIntake } from "@/hooks/useClipboardImageIntake";
import ClipboardImageDropZone from "@/components/clipboard-intake/ClipboardImageDropZone";
import ClipboardImagePreviewList from "@/components/clipboard-intake/ClipboardImagePreviewList";

type ExtractResponse = {
  ok: boolean;
  ocrRunId: string;
  dateKst: string;
  engineStatus: string;
  executionMode: string;
  externalImageTransfer: boolean;
  rows: KboProtoOcrDraftRow[];
  warnings: string[];
  durationMs: number;
  mutationPerformed: boolean;
  imageFingerprints?: string[];
  errorCode?: string;
  message?: string;
};

type ApproveResponse = {
  ok: boolean;
  message: string;
  mutationPerformed: boolean;
  t45AutoRun: false;
  pathRel?: string | null;
  nextHash?: string | null;
  errorCode?: string;
};

function escapeHint(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function normalizeDraftRow(r: KboProtoOcrDraftRow): KboProtoOcrDraftRow {
  return {
    ...r,
    adminDecision: r.adminDecision ?? "PENDING",
    cancellationSuspect: r.cancellationSuspect ?? "NONE",
    detectedMarket: r.detectedMarket ?? "MONEYLINE_2WAY",
    saveAllowed: r.saveAllowed ?? true,
    adminCancellationDecision: r.adminCancellationDecision ?? "PENDING",
  };
}

export default function KboProtoOcrAssist({
  dateKst,
  historicalReadOnly,
  onApproved,
}: {
  dateKst: string;
  historicalReadOnly: boolean;
  onApproved?: () => void;
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const [materialType, setMaterialType] =
    useState<ClipboardIntakeMaterialType>("KBO_DOMESTIC_PROTO");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [rows, setRows] = useState<KboProtoOcrDraftRow[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  const onPastedText = useCallback((text: string) => {
    setPasteText((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }, []);

  const intake = useClipboardImageIntake({
    pasteEnabled: pasteMode && !historicalReadOnly,
    onPastedText,
  });

  const summary = useMemo(() => {
    const matched = rows.filter((r) =>
      ["MATCHED_EXACT", "MATCHED_ALIAS", "DUPLICATE_CANDIDATE"].includes(
        r.mappingStatus,
      ),
    ).length;
    const ambiguous = rows.filter((r) => r.mappingStatus === "AMBIGUOUS").length;
    const unknown = rows.filter((r) =>
      ["UNKNOWN_TEAM", "GAME_NOT_IN_SCHEDULE", "UNMAPPED"].includes(r.mappingStatus),
    ).length;
    const approved = rows.filter(
      (r) => r.adminDecision === "APPROVED" || r.adminDecision === "CORRECTED",
    ).length;
    const rejected = rows.filter((r) => r.adminDecision === "REJECTED").length;
    const cancelSuspect = rows.filter(
      (r) => r.cancellationSuspect && r.cancellationSuspect !== "NONE",
    ).length;
    const unsupported = rows.filter(
      (r) => r.detectedMarket && r.detectedMarket !== "MONEYLINE_2WAY",
    ).length;
    return {
      matched,
      ambiguous,
      unknown,
      approved,
      rejected,
      cancelSuspect,
      unsupported,
      total: rows.length,
    };
  }, [rows]);

  const patchRow = (id: string, patch: Partial<KboProtoOcrDraftRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.draftRowId === id ? { ...r, ...patch } : r)),
    );
  };

  const materialActive = materialType === "KBO_DOMESTIC_PROTO";

  const runPasteExtract = async () => {
    if (!materialActive) return;
    setBusy("extract");
    setApproveMsg(null);
    try {
      const res = await fetch("/api/internal/kbo/proto-ocr/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateKst, pasteText }),
      });
      const json = (await res.json()) as ExtractResponse;
      setExtract(json);
      setRows((json.rows ?? []).map(normalizeDraftRow));
      setConfirmed(false);
    } finally {
      setBusy(null);
    }
  };

  const runImageExtract = async () => {
    if (!materialActive) return;
    const files = intake.getUploadFiles();
    if (files.length === 0) return;
    setBusy("extract");
    setApproveMsg(null);
    try {
      const fd = new FormData();
      fd.set("dateKst", dateKst);
      for (const f of files) fd.append("images", f);
      const res = await fetch("/api/internal/kbo/proto-ocr/extract", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as ExtractResponse;
      setExtract(json);
      setRows((json.rows ?? []).map(normalizeDraftRow));
      setConfirmed(false);
    } finally {
      setBusy(null);
    }
  };

  const runValidate = async () => {
    setBusy("validate");
    try {
      const res = await fetch("/api/internal/kbo/proto-ocr/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateKst, rows }),
      });
      const json = await res.json();
      if (Array.isArray(json.rows)) {
        setRows(json.rows.map(normalizeDraftRow));
      }
    } finally {
      setBusy(null);
    }
  };

  const resolveExtractionMethod = ():
    | "OCR_ASSISTED"
    | "MANUAL_VISUAL_CONFIRMATION" => {
    if (
      extract?.engineStatus === "OCR_ENGINE_NOT_CONFIGURED" ||
      (extract?.rows?.length === 0 && intake.items.length > 0)
    ) {
      return "MANUAL_VISUAL_CONFIRMATION";
    }
    if (extract?.engineStatus === "FIXTURE" && pasteText.trim() && intake.items.length === 0) {
      return "OCR_ASSISTED";
    }
    if (extract?.engineStatus === "READY" || extract?.engineStatus === "FIXTURE") {
      return "OCR_ASSISTED";
    }
    return "MANUAL_VISUAL_CONFIRMATION";
  };

  const runApprove = async (approveAll: boolean) => {
    if (!extract?.ocrRunId || !confirmed) return;
    if (
      !window.confirm(
        `국내 프로토만 저장합니다.\n날짜 ${dateKst}\n승인 행 ${summary.approved}건\nINTERNAL_ONLY\nT45/T30 자동 실행 없음\n계속할까요?`,
      )
    ) {
      return;
    }
    setBusy("approve");
    setApproveMsg(null);
    try {
      const inputKind =
        intake.items.some((i) => i.inputKind === "CLIPBOARD_IMAGE")
          ? "CLIPBOARD_IMAGE"
          : intake.items.length > 0
            ? "FILE_IMAGE"
            : pasteText.trim()
              ? "PASTED_TEXT"
              : null;
      const res = await fetch("/api/internal/kbo/proto-ocr/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dateKst,
          ocrRunId: extract.ocrRunId,
          approvedRows: rows,
          adminId: "admin-ui",
          sourceReference: "PROTO_OCR_CLIPBOARD_ASSIST",
          explicitConfirmation: confirmed,
          approveAll,
          intakeRunId: intake.intakeRunId,
          intakeItemIds: intake.items.map((i) => i.intakeItemId),
          imageFingerprints:
            extract.imageFingerprints ??
            intake.items.map((i) => i.imageSha256).filter(Boolean),
          inputKind,
          extractionMethod: resolveExtractionMethod(),
        }),
      });
      const json = (await res.json()) as ApproveResponse;
      setApproveMsg(json.message || (json.ok ? "OK" : json.errorCode || "FAILED"));
      if (json.ok) onApproved?.();
    } finally {
      setBusy(null);
    }
  };

  const allPassForApproveAll =
    confirmed &&
    rows.length > 0 &&
    rows.every(
      (r) =>
        (r.adminDecision === "APPROVED" || r.adminDecision === "CORRECTED") &&
        r.errors.length === 0 &&
        r.homePrice != null &&
        r.awayPrice != null &&
        r.gameId &&
        r.detectedMarket === "MONEYLINE_2WAY" &&
        r.saveAllowed !== false,
    );

  const disabled = historicalReadOnly || busy != null;

  return (
    <section className="space-y-4 rounded border border-amber-900/50 bg-zinc-950/40 p-4">
      <div>
        <h2 className="text-lg font-semibold text-amber-200">
          국내 프로토 OCR 보조 (Draft Generator)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          OCR/붙여넣기 결과는 Source of Truth가 아닙니다. 관리자 검토·승인 후에만
          Operator Input으로 저장됩니다. INTERNAL_ONLY · T45 자동 실행 없음 ·
          원본 이미지는 임시 처리 후 삭제 · 자동 사이트 수집 아님 · 스크린샷은
          Schedule을 대체하지 않습니다.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">자료 유형 (분석 전 선택)</label>
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          disabled={disabled}
          value={materialType}
          onChange={(e) =>
            setMaterialType(e.target.value as ClipboardIntakeMaterialType)
          }
        >
          {CLIPBOARD_MATERIAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {opt.availability !== "ACTIVE" ? ` (${opt.availability})` : ""}
            </option>
          ))}
        </select>
        {!materialActive && (
          <div className="text-xs text-amber-500">
            이번 v1은 KBO 국내 프로토만 연결됩니다. Lineup/Starter Screenshot Intake는
            후속 미션입니다.
          </div>
        )}
      </div>

      {extract?.engineStatus === "OCR_ENGINE_NOT_CONFIGURED" && (
        <div className="rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          이미지 수신·검증 성공 가능. OCR 엔진 연결 필요 (OCR_ENGINE_NOT_CONFIGURED).
          자동 후보 없음 — 텍스트 붙여넣기 fallback 또는 화면을 보고 직접 입력하세요.
          외부 이미지 전송: {extract.externalImageTransfer ? "YES" : "NO"}
        </div>
      )}

      <ClipboardImageDropZone
        intake={intake}
        pasteEnabled={pasteMode && !historicalReadOnly}
        onPasteModeChange={setPasteMode}
        disabled={disabled || !materialActive}
      />

      <ClipboardImagePreviewList
        intake={intake}
        disabled={disabled}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !materialActive || intake.items.length === 0}
          onClick={() => void runImageExtract()}
          className="rounded bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "extract" ? "처리 중…" : "분석하기 (이미지)"}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">
          텍스트 붙여넣기 fallback (동일 파서)
        </label>
        <textarea
          className="h-28 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          disabled={disabled || !materialActive}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"예:\nLG 1.75 두산 1.77\n키움 1.90 SSG 1.65"}
        />
        <button
          type="button"
          disabled={disabled || !materialActive || !pasteText.trim()}
          onClick={() => void runPasteExtract()}
          className="rounded bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          붙여넣기 파싱
        </button>
      </div>

      {extract && (
        <div className="text-xs text-zinc-500">
          run={extract.ocrRunId} · mode={extract.executionMode} ·{" "}
          {extract.durationMs}ms · warnings={extract.warnings.join(", ") || "—"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid-cols-6">
        <div>rows {summary.total}</div>
        <div>matched {summary.matched}</div>
        <div>ambiguous {summary.ambiguous}</div>
        <div>unknown {summary.unknown}</div>
        <div>cancel? {summary.cancelSuspect}</div>
        <div>
          approved {summary.approved} / unsupported {summary.unsupported}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 text-zinc-500">
              <tr>
                <th className="p-2">Schedule</th>
                <th className="p-2">OCR 원문</th>
                <th className="p-2">시장/취소</th>
                <th className="p-2">원정/홈 배당</th>
                <th className="p-2">confidence</th>
                <th className="p-2">decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const unsupported = r.detectedMarket !== "MONEYLINE_2WAY";
                const saveBlocked = unsupported || r.saveAllowed === false;
                return (
                  <tr key={r.draftRowId} className="border-b border-zinc-900 align-top">
                    <td className="p-2">
                      <div>{r.gameId ?? "—"}</div>
                      <div>
                        {r.resolvedAwayTeam ?? "?"} @ {r.resolvedHomeTeam ?? "?"}
                      </div>
                      <div className="text-zinc-500">{r.mappingStatus}</div>
                      <div className="text-zinc-600">
                        img {(r.sourceImageIds ?? []).join(", ") || "—"}
                      </div>
                      {r.errors.length > 0 && (
                        <div className="text-red-400">{r.errors.join(", ")}</div>
                      )}
                      {r.warnings.length > 0 && (
                        <div className="text-amber-500">
                          {r.warnings.slice(0, 4).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <div>{escapeHint(r.rawTeamTexts.join(" / "))}</div>
                      <div>{escapeHint(r.rawPriceTexts.join(" / "))}</div>
                    </td>
                    <td className="p-2 space-y-1">
                      <div>{r.detectedMarket}</div>
                      {unsupported && (
                        <div className="text-red-400">
                          DETECTED_UNSUPPORTED_MARKET (저장 불가)
                        </div>
                      )}
                      {r.cancellationSuspect !== "NONE" && (
                        <>
                          <div className="text-amber-400">{r.cancellationSuspect}</div>
                          <select
                            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                            disabled={historicalReadOnly}
                            value={r.adminCancellationDecision}
                            onChange={(e) =>
                              patchRow(r.draftRowId, {
                                adminCancellationDecision: e.target
                                  .value as KboProtoOcrDraftRow["adminCancellationDecision"],
                                saveAllowed:
                                  e.target.value === "OCR_ERROR" ||
                                  e.target.value === "IGNORE"
                                    ? !unsupported
                                    : false,
                              })
                            }
                          >
                            <option value="PENDING">결정 대기</option>
                            <option value="CONFIRM_CANCEL">실제 취소</option>
                            <option value="CONFIRM_POSTPONE">실제 연기</option>
                            <option value="OCR_ERROR">단순 OCR 오류</option>
                            <option value="IGNORE">무시</option>
                          </select>
                          <div className="text-[10px] text-zinc-500">
                            Schedule 자동 변경 없음 · 취소는 별도 Status Revision
                          </div>
                        </>
                      )}
                    </td>
                    <td className="p-2 space-y-1">
                      <label className="block">
                        away
                        <input
                          type="number"
                          step="0.01"
                          className="mt-0.5 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 disabled:opacity-40"
                          disabled={historicalReadOnly || saveBlocked}
                          value={r.awayPrice ?? ""}
                          onChange={(e) =>
                            patchRow(r.draftRowId, {
                              awayPrice: e.target.value
                                ? Number(e.target.value)
                                : null,
                              adminDecision: "CORRECTED",
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        home
                        <input
                          type="number"
                          step="0.01"
                          className="mt-0.5 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 disabled:opacity-40"
                          disabled={historicalReadOnly || saveBlocked}
                          value={r.homePrice ?? ""}
                          onChange={(e) =>
                            patchRow(r.draftRowId, {
                              homePrice: e.target.value
                                ? Number(e.target.value)
                                : null,
                              adminDecision: "CORRECTED",
                            })
                          }
                        />
                      </label>
                    </td>
                    <td className="p-2">
                      <div>{r.confidence.grade}</div>
                      <div>{r.confidence.overallConfidence ?? "—"}</div>
                      <div className="text-amber-400">review required</div>
                    </td>
                    <td className="p-2 space-y-1">
                      <select
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                        disabled={historicalReadOnly || unsupported}
                        value={r.adminDecision}
                        onChange={(e) =>
                          patchRow(r.draftRowId, {
                            adminDecision: e.target
                              .value as KboProtoOcrDraftRow["adminDecision"],
                          })
                        }
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="CORRECTED">CORRECTED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={historicalReadOnly || rows.length === 0}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>
          스크린샷과 날짜·경기·홈/원정·시장·배당을 직접 확인했습니다. (OCR 결과는
          자동 승인되지 않습니다)
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null || rows.length === 0}
          onClick={() => void runValidate()}
          className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
        >
          수정 내용 검증
        </button>
        <button
          type="button"
          disabled={
            historicalReadOnly ||
            busy != null ||
            !confirmed ||
            summary.approved === 0
          }
          onClick={() => void runApprove(false)}
          className="rounded bg-blue-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          선택 승인 저장
        </button>
        <button
          type="button"
          disabled={historicalReadOnly || busy != null || !allPassForApproveAll}
          onClick={() => void runApprove(true)}
          className="rounded bg-blue-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          전체 승인 저장
        </button>
      </div>

      {approveMsg && (
        <div className="text-sm text-zinc-300">{escapeHint(approveMsg)}</div>
      )}
    </section>
  );
}
