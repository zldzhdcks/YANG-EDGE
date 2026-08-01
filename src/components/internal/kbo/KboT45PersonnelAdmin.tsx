"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  KboT45AdminLoadResult,
  KboT45GameAdminView,
} from "@/lib/kbo/t45-personnel/admin-view-types";
import type {
  KboT45GameInput,
  KboT45PersonnelInputV1,
} from "@/lib/kbo/t45-personnel/types";
import KboProtoOcrAssist from "@/components/internal/kbo/KboProtoOcrAssist";

type ValidateResponse = {
  status: string;
  globalErrors: string[];
  games: Array<{
    gameId: string;
    status: string;
    completeness: string;
    predictionUsability: string;
    errors: string[];
    warnings: string[];
  }>;
  wouldCreateArtifacts: string[];
  mutationPerformed: boolean;
};

type SaveResponse = {
  ok: boolean;
  message: string;
  previousHash: string | null;
  nextHash: string | null;
  version: number;
  pathRel: string | null;
  mutationPerformed: boolean;
  validation?: ValidateResponse;
};

type RunResponse = {
  ok: boolean;
  dryRun: boolean;
  message: string;
  t30AutoRun: false;
  result?: {
    writesSkipped: boolean;
    providerCalls: number;
    writtenArtifacts: string[];
    personnelHash: string | null;
    domesticProtoHash: string | null;
    games: ValidateResponse["games"];
  } | null;
};

const inputClass =
  "w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600";
const labelClass = "mb-1 block text-xs font-medium text-zinc-400";

function statusTone(status: string): string {
  switch (status) {
    case "ADMIN_VERIFIED":
    case "VALID":
      return "text-green-400 border-green-800 bg-green-950/30";
    case "PARTIAL":
    case "DRAFT":
    case "T45_WINDOW":
      return "text-amber-400 border-amber-800 bg-amber-950/30";
    case "VALIDATION_FAILED":
    case "INVALID":
    case "AFTER_CUTOFF":
    case "ALREADY_LOCKED":
    case "NOT_ENTERED":
      return "text-red-400 border-red-800 bg-red-950/30";
    default:
      return "text-zinc-400 border-zinc-700 bg-zinc-900/30";
  }
}

function emptyLineup() {
  return Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1,
    playerName: "",
    position: "",
    bats: null as "L" | "R" | "S" | null,
    designatedHitter: false,
  }));
}

function draftKey(dateKst: string) {
  return `kbo-t45-draft:${dateKst}`;
}

function moveLineupRow(
  lineup: NonNullable<KboT45GameInput["home"]["lineup"]>,
  index: number,
  dir: -1 | 1,
) {
  const next = [...lineup];
  const j = index + dir;
  if (j < 0 || j >= next.length) return next;
  const tmp = next[index]!;
  next[index] = next[j]!;
  next[j] = tmp;
  return next.map((row, i) => ({ ...row, slot: i + 1 }));
}

export default function KboT45PersonnelAdmin({
  initialData,
}: {
  initialData: KboT45AdminLoadResult;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [dateKst, setDateKst] = useState(initialData.dateKst);
  const [selectedId, setSelectedId] = useState(
    initialData.games[0]?.gameId ?? "",
  );
  const [gamesDraft, setGamesDraft] = useState<Record<string, KboT45GameInput>>(
    () => {
      const map: Record<string, KboT45GameInput> = {};
      for (const g of initialData.games) {
        if (g.draft) map[g.gameId] = structuredClone(g.draft);
      }
      return map;
    },
  );
  const [sourceType, setSourceType] = useState(
    initialData.existingInput?.sourceType ?? "ADMIN_MANUAL_SCREENSHOT",
  );
  const [sourceReference, setSourceReference] = useState(
    initialData.existingInput?.sourceReference ?? "",
  );
  const [adminId, setAdminId] = useState(
    initialData.existingInput?.createdBy ?? "admin-ui",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(
    null,
  );
  const [saveResult, setSaveResult] = useState<SaveResponse | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(dateKst));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        games?: Record<string, KboT45GameInput>;
        sourceReference?: string;
        sourceType?: string;
        adminId?: string;
      };
      if (parsed.games) setGamesDraft((prev) => ({ ...prev, ...parsed.games }));
      if (parsed.sourceReference) setSourceReference(parsed.sourceReference);
      if (parsed.sourceType) setSourceType(parsed.sourceType as typeof sourceType);
      if (parsed.adminId) setAdminId(parsed.adminId);
    } catch {
      /* ignore */
    }
  }, [dateKst]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey(dateKst),
        JSON.stringify({
          games: gamesDraft,
          sourceReference,
          sourceType,
          adminId,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [gamesDraft, sourceReference, sourceType, adminId, dateKst]);

  const selected: KboT45GameAdminView | undefined = useMemo(
    () => data.games.find((g) => g.gameId === selectedId),
    [data.games, selectedId],
  );

  const draft = selectedId ? gamesDraft[selectedId] : undefined;
  const readOnly = Boolean(selected?.readOnly || data.historicalReadOnly);

  const buildPayload = useCallback((): KboT45PersonnelInputV1 => {
    const games = data.games
      .map((g) => gamesDraft[g.gameId])
      .filter(Boolean) as KboT45GameInput[];
    return {
      schemaVersion: "kbo-t45-personnel-input-v1",
      league: "KBO",
      dateKst: data.dateKst,
      createdAt: new Date().toISOString(),
      createdBy: adminId || "admin-ui",
      sourceType: sourceType as KboT45PersonnelInputV1["sourceType"],
      sourceReference: sourceReference || "ADMIN_UI",
      commercialUseStatus: "INTERNAL_ONLY",
      games: games.map((g) => ({
        ...g,
        sourceType: sourceType as KboT45GameInput["sourceType"],
        sourceReference: sourceReference || g.sourceReference || "ADMIN_UI",
      })),
    };
  }, [data, gamesDraft, adminId, sourceType, sourceReference]);

  const patchDraft = (updater: (g: KboT45GameInput) => KboT45GameInput) => {
    if (!selectedId || readOnly) return;
    setGamesDraft((prev) => {
      const cur = prev[selectedId];
      if (!cur) return prev;
      return { ...prev, [selectedId]: updater(structuredClone(cur)) };
    });
  };

  const changeDate = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setDateKst(next);
    router.push(`/internal/kbo/personnel?date=${next}`);
  };

  const callValidate = async () => {
    setBusy("validate");
    setValidateResult(null);
    try {
      const res = await fetch("/api/internal/kbo/t45-personnel/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: buildPayload() }),
      });
      const json = (await res.json()) as ValidateResponse;
      setValidateResult(json);
    } finally {
      setBusy(null);
    }
  };

  const callSave = async () => {
    if (readOnly || data.historicalReadOnly) return;
    setBusy("save");
    setSaveResult(null);
    try {
      const res = await fetch("/api/internal/kbo/t45-personnel/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: buildPayload(), adminId }),
      });
      const json = (await res.json()) as SaveResponse;
      setSaveResult(json);
      if (json.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const callRun = async (dryRun: boolean) => {
    if (data.historicalReadOnly && !dryRun) return;
    if (data.dateKst === "2026-07-31") return;
    setBusy(dryRun ? "dry-run" : "run");
    setRunResult(null);
    try {
      const res = await fetch("/api/internal/kbo/t45-personnel/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKst: data.dateKst,
          dryRun,
          adminId,
          gameId: selectedId || undefined,
        }),
      });
      const json = (await res.json()) as RunResponse;
      setRunResult(json);
      if (json.ok && !dryRun) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const resetDraft = () => {
    if (readOnly) return;
    const map: Record<string, KboT45GameInput> = {};
    for (const g of data.games) {
      if (g.draft) map[g.gameId] = structuredClone(g.draft);
    }
    setGamesDraft(map);
    sessionStorage.removeItem(draftKey(dateKst));
    setValidateResult(null);
    setSaveResult(null);
    setRunResult(null);
  };

  // Keep selected in sync after refresh
  useEffect(() => {
    setData(initialData);
    setDateKst(initialData.dateKst);
    if (
      initialData.games.length &&
      !initialData.games.some((g) => g.gameId === selectedId)
    ) {
      setSelectedId(initialData.games[0]!.gameId);
    }
  }, [initialData, selectedId]);

  return (
    <div className="space-y-6">
      <section className="rounded border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>날짜 (KST)</label>
            <input
              type="date"
              className={inputClass}
              value={dateKst}
              onChange={(e) => changeDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>서버 시각 (ISO)</label>
            <div className="text-sm text-zinc-300 py-2">{data.nowIso}</div>
          </div>
          <div>
            <label className={labelClass}>입력 / Lock</label>
            <div className="text-sm text-zinc-300 py-2">
              input={data.inputExists ? "YES" : "NO"} · locked=
              {data.predictionLocked ? "YES" : "NO"}
              {data.historicalReadOnly ? " · READ-ONLY" : ""}
            </div>
          </div>
          <div>
            <label className={labelClass}>Hash</label>
            <div className="truncate text-xs text-zinc-500 py-2" title={data.personnelHash ?? ""}>
              {data.personnelHash?.slice(0, 16) ?? "—"}…
            </div>
          </div>
        </div>
        <ul className="space-y-1 text-xs text-amber-200/80">
          {data.legalNotice.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      </section>

      <KboProtoOcrAssist
        dateKst={data.dateKst}
        historicalReadOnly={data.historicalReadOnly}
        onApproved={() => router.refresh()}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            경기 ({data.games.length})
          </h2>
          {!data.scheduleExists && (
            <p className="text-xs text-red-400">Schedule artifact 없음</p>
          )}
          {data.games.map((g) => (
            <button
              key={g.gameId}
              type="button"
              onClick={() => setSelectedId(g.gameId)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedId === g.gameId
                  ? "border-blue-600 bg-blue-950/40"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium text-white">
                {g.awayTeam} @ {g.homeTeam}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(g.currentStatus)}`}
                >
                  {g.currentStatus}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(g.windowLabel)}`}
                >
                  {g.windowLabel}
                </span>
              </div>
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          {!draft || !selected ? (
            <p className="text-sm text-zinc-500">경기를 선택하세요.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {selected.awayTeam} @ {selected.homeTeam}
                </h2>
                {readOnly && (
                  <span className="rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-300">
                    READ-ONLY — cutoff/lock/historical
                  </span>
                )}
              </div>

              <section className="grid gap-3 sm:grid-cols-3 rounded border border-zinc-800 p-3">
                <div>
                  <label className={labelClass}>sourceType</label>
                  <select
                    className={inputClass}
                    disabled={readOnly}
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
                  >
                    <option value="ADMIN_MANUAL_SCREENSHOT">ADMIN_MANUAL_SCREENSHOT</option>
                    <option value="ADMIN_MANUAL_TEXT">ADMIN_MANUAL_TEXT</option>
                    <option value="OFFICIAL_PUBLIC_SOURCE_MANUAL_CHECK">
                      OFFICIAL_PUBLIC_SOURCE_MANUAL_CHECK
                    </option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>adminId</label>
                  <input
                    className={inputClass}
                    disabled={readOnly}
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>commercialUseStatus</label>
                  <div className="py-2 text-sm text-amber-300">INTERNAL_ONLY</div>
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>sourceReference</label>
                  <input
                    className={inputClass}
                    disabled={readOnly}
                    value={sourceReference}
                    onChange={(e) => setSourceReference(e.target.value)}
                    placeholder="스크린샷/출처 메모"
                  />
                </div>
                <div>
                  <label className={labelClass}>observedAt (game)</label>
                  <input
                    className={inputClass}
                    disabled={readOnly}
                    value={draft.observedAt}
                    onChange={(e) =>
                      patchDraft((g) => ({ ...g, observedAt: e.target.value }))
                    }
                  />
                </div>
              </section>

              {(["away", "home"] as const).map((side) => {
                const team = side === "home" ? draft.homeTeam : draft.awayTeam;
                const sideData = draft[side];
                return (
                  <section
                    key={side}
                    className="rounded border border-zinc-800 p-3 space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-zinc-200">
                      {side === "away" ? "원정" : "홈"} 선발 — {team}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>선수 이름</label>
                        <input
                          className={inputClass}
                          disabled={readOnly}
                          value={sideData.starter?.playerName ?? ""}
                          onChange={(e) =>
                            patchDraft((g) => ({
                              ...g,
                              [side]: {
                                ...g[side],
                                starter: {
                                  ...(g[side].starter ?? {
                                    playerName: "",
                                    throwingHand: null,
                                  }),
                                  playerName: e.target.value,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>playerId (optional)</label>
                        <input
                          className={inputClass}
                          disabled={readOnly}
                          value={sideData.starter?.playerId ?? ""}
                          onChange={(e) =>
                            patchDraft((g) => ({
                              ...g,
                              [side]: {
                                ...g[side],
                                starter: {
                                  ...(g[side].starter ?? {
                                    playerName: "",
                                    throwingHand: null,
                                  }),
                                  playerId: e.target.value || null,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>투구 방향</label>
                        <select
                          className={inputClass}
                          disabled={readOnly}
                          value={sideData.starter?.throwingHand ?? ""}
                          onChange={(e) =>
                            patchDraft((g) => ({
                              ...g,
                              [side]: {
                                ...g[side],
                                starter: {
                                  ...(g[side].starter ?? {
                                    playerName: "",
                                    throwingHand: null,
                                  }),
                                  throwingHand: (e.target.value ||
                                    null) as "L" | "R" | "S" | null,
                                },
                              },
                            }))
                          }
                        >
                          <option value="">—</option>
                          <option value="L">L</option>
                          <option value="R">R</option>
                          <option value="S">S</option>
                        </select>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-200 pt-2">
                      {side === "away" ? "원정" : "홈"} 타순 1–9
                    </h3>
                    <div className="space-y-2">
                      {(sideData.lineup ?? emptyLineup()).map((row, idx) => (
                        <div
                          key={`${side}-${idx}`}
                          className="grid grid-cols-[40px_1fr_1fr_70px_70px_auto] gap-1 items-end"
                        >
                          <div className="text-xs text-zinc-500 pb-2">{row.slot}</div>
                          <div>
                            <label className={labelClass}>이름</label>
                            <input
                              className={inputClass}
                              disabled={readOnly}
                              value={row.playerName}
                              onChange={(e) =>
                                patchDraft((g) => {
                                  const lu = [
                                    ...(g[side].lineup ?? emptyLineup()),
                                  ];
                                  lu[idx] = {
                                    ...lu[idx]!,
                                    playerName: e.target.value,
                                  };
                                  return {
                                    ...g,
                                    [side]: { ...g[side], lineup: lu },
                                  };
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className={labelClass}>포지션</label>
                            <input
                              className={inputClass}
                              disabled={readOnly}
                              value={row.position}
                              onChange={(e) =>
                                patchDraft((g) => {
                                  const lu = [
                                    ...(g[side].lineup ?? emptyLineup()),
                                  ];
                                  lu[idx] = {
                                    ...lu[idx]!,
                                    position: e.target.value,
                                    designatedHitter: e.target.value === "지명타자",
                                  };
                                  return {
                                    ...g,
                                    [side]: { ...g[side], lineup: lu },
                                  };
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className={labelClass}>bats</label>
                            <select
                              className={inputClass}
                              disabled={readOnly}
                              value={row.bats ?? ""}
                              onChange={(e) =>
                                patchDraft((g) => {
                                  const lu = [
                                    ...(g[side].lineup ?? emptyLineup()),
                                  ];
                                  lu[idx] = {
                                    ...lu[idx]!,
                                    bats: (e.target.value ||
                                      null) as "L" | "R" | "S" | null,
                                  };
                                  return {
                                    ...g,
                                    [side]: { ...g[side], lineup: lu },
                                  };
                                })
                              }
                            >
                              <option value="">—</option>
                              <option value="L">L</option>
                              <option value="R">R</option>
                              <option value="S">S</option>
                            </select>
                          </div>
                          <div className="flex gap-1 pb-0.5">
                            <button
                              type="button"
                              disabled={readOnly}
                              className="rounded border border-zinc-700 px-2 text-xs text-zinc-300 disabled:opacity-40"
                              onClick={() =>
                                patchDraft((g) => ({
                                  ...g,
                                  [side]: {
                                    ...g[side],
                                    lineup: moveLineupRow(
                                      g[side].lineup ?? emptyLineup(),
                                      idx,
                                      -1,
                                    ),
                                  },
                                }))
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              className="rounded border border-zinc-700 px-2 text-xs text-zinc-300 disabled:opacity-40"
                              onClick={() =>
                                patchDraft((g) => ({
                                  ...g,
                                  [side]: {
                                    ...g[side],
                                    lineup: moveLineupRow(
                                      g[side].lineup ?? emptyLineup(),
                                      idx,
                                      1,
                                    ),
                                  },
                                }))
                              }
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              <section className="rounded border border-zinc-800 p-3 space-y-2">
                <h3 className="text-sm font-semibold text-zinc-200">
                  국내 프로토 — 관리자 입력 (MONEYLINE_2WAY)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>홈 배당 (DECIMAL &gt; 1)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={inputClass}
                      disabled={readOnly}
                      value={draft.domesticProto?.homePrice || ""}
                      onChange={(e) =>
                        patchDraft((g) => ({
                          ...g,
                          domesticProto: {
                            format: "DECIMAL",
                            homePrice: Number(e.target.value),
                            awayPrice: g.domesticProto?.awayPrice ?? 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>원정 배당 (DECIMAL &gt; 1)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={inputClass}
                      disabled={readOnly}
                      value={draft.domesticProto?.awayPrice || ""}
                      onChange={(e) =>
                        patchDraft((g) => ({
                          ...g,
                          domesticProto: {
                            format: "DECIMAL",
                            awayPrice: Number(e.target.value),
                            homePrice: g.domesticProto?.homePrice ?? 0,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void callValidate()}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {busy === "validate" ? "검증 중…" : "검증"}
                </button>
                <button
                  type="button"
                  disabled={busy != null || readOnly}
                  onClick={resetDraft}
                  className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
                >
                  Draft 초기화
                </button>
                <button
                  type="button"
                  disabled={busy != null || readOnly || data.historicalReadOnly}
                  onClick={() => void callSave()}
                  className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {busy === "save" ? "저장 중…" : "입력 저장"}
                </button>
                <button
                  type="button"
                  disabled={busy != null || data.dateKst === "2026-07-31"}
                  onClick={() => void callRun(true)}
                  className="rounded border border-amber-700 px-4 py-2 text-sm text-amber-200 disabled:opacity-50"
                >
                  {busy === "dry-run" ? "Dry-run…" : "T45 Dry-run"}
                </button>
                <button
                  type="button"
                  disabled={
                    busy != null ||
                    readOnly ||
                    data.historicalReadOnly ||
                    data.dateKst === "2026-07-31"
                  }
                  onClick={() => {
                    if (
                      !window.confirm(
                        "T45 Workflow를 실행할까요? (T30 Lock은 실행되지 않습니다)",
                      )
                    ) {
                      return;
                    }
                    void callRun(false);
                  }}
                  className="rounded bg-amber-800 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {busy === "run" ? "실행 중…" : "T45 Workflow 실행"}
                </button>
              </section>

              {(validateResult || saveResult || runResult) && (
                <section className="rounded border border-zinc-800 bg-zinc-950 p-3 space-y-2 text-xs text-zinc-300">
                  <h3 className="text-sm font-semibold text-white">결과</h3>
                  {validateResult && (
                    <pre className="overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(validateResult, null, 2)}
                    </pre>
                  )}
                  {saveResult && (
                    <pre className="overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(saveResult, null, 2)}
                    </pre>
                  )}
                  {runResult && (
                    <pre className="overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(runResult, null, 2)}
                    </pre>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
