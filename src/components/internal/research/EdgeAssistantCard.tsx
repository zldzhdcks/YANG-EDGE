"use client";

import { useState, useMemo } from "react";
import type { ResearchLabData } from "@/lib/internal/research-lab-reader";
import type { OperatorPresentation } from "@/lib/internal/research-lab-presenter";
import {
  type QuestionId,
  type AssistantAnswer,
  type AssistantBrief,
  SUPPORTED_QUESTIONS,
  buildAssistantBrief,
  answerQuestion,
} from "@/lib/internal/edge-assistant-presenter";
import { useResearchTaskState } from "@/hooks/useResearchTaskState";

type Props = {
  data: ResearchLabData;
  op: OperatorPresentation;
  dateKst: string;
};

export default function EdgeAssistantCard({ data, op, dateKst }: Props) {
  const { states } = useResearchTaskState(dateKst);
  const [selectedQ, setSelectedQ] = useState<QuestionId | null>(null);

  const brief: AssistantBrief = useMemo(
    () => buildAssistantBrief(data, op, states),
    [data, op, states],
  );

  const answer: AssistantAnswer | null = useMemo(
    () => (selectedQ ? answerQuestion(selectedQ, data, op, states) : null),
    [selectedQ, data, op, states],
  );

  return (
    <section className="rounded-lg border border-indigo-900/60 bg-indigo-950/20 px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-indigo-300">EDGE Assistant</h2>
        <span className="rounded-full border border-indigo-800/50 bg-indigo-950/40 px-2 py-0.5 text-xs text-indigo-400">
          v0
        </span>
      </div>
      <p className="mb-4 text-xs text-indigo-400/60">
        현재 Research Lab 상태를 바탕으로 안내합니다.
      </p>
      <p className="mb-4 text-xs text-zinc-600">
        규칙 기반 안내 · 생성형 AI 아님 · 확인된 Artifact만 사용
      </p>

      {/* Brief */}
      <div className="mb-4 space-y-2">
        <p className="text-sm text-zinc-300">{brief.greeting}</p>
        <div className="rounded bg-indigo-950/30 px-3 py-2">
          <p className="text-xs text-zinc-500">오늘 가장 먼저 할 일:</p>
          <p className="text-sm font-medium text-zinc-200">{brief.primaryRecommendation}</p>
        </div>
        <div className="rounded bg-zinc-900/40 px-3 py-2">
          <p className="text-xs text-zinc-500">이유:</p>
          <p className="text-xs text-zinc-400">{brief.primaryReason}</p>
        </div>
        {brief.secondaryRecommendation && (
          <p className="text-xs text-zinc-500">{brief.secondaryRecommendation}</p>
        )}
        {brief.warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-400">
            {w}
          </p>
        ))}
      </div>

      {/* Question buttons */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SUPPORTED_QUESTIONS.map((q) => (
          <button
            key={q.id}
            onClick={() => setSelectedQ(selectedQ === q.id ? null : q.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedQ === q.id
                ? "border-indigo-600 bg-indigo-900/40 text-indigo-300"
                : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Answer area */}
      {answer && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">{answer.answerTitle}</h3>
          <p className="text-sm text-zinc-300">{answer.answerSummary}</p>

          {answer.evidence.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">근거:</p>
              <ul className="space-y-0.5">
                {answer.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-zinc-400">
                    • {e.fact}
                    {e.source && (
                      <span className="ml-1 text-zinc-600 font-mono text-xs">
                        ({e.source})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.unknowns.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">아직 모르는 것:</p>
              <ul className="space-y-0.5">
                {answer.unknowns.map((u, i) => (
                  <li key={i} className="text-xs text-amber-400/80">• {u}</li>
                ))}
              </ul>
            </div>
          )}

          {answer.nextAction && (
            <div className="rounded bg-zinc-800/60 px-3 py-1.5">
              <span className="text-xs text-zinc-500">다음 행동: </span>
              <span className="text-xs text-zinc-300">{answer.nextAction}</span>
            </div>
          )}

          {answer.relatedTaskKey && (
            <p className="text-xs text-zinc-600 font-mono">
              Task: {answer.relatedTaskKey}
            </p>
          )}

          {answer.sourceArtifacts.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
                참조 Artifact ({answer.sourceArtifacts.length}개)
              </summary>
              <ul className="mt-1 space-y-0.5">
                {answer.sourceArtifacts.map((a, i) => (
                  <li key={i} className="text-xs text-zinc-600 font-mono">{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Glossary */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
          용어 설명
        </summary>
        <dl className="mt-1 space-y-1 text-xs">
          <div>
            <dt className="text-zinc-400 inline">Artifact</dt>{" "}
            <dd className="text-zinc-600 inline">— 프로그램이 저장한 연구 데이터 파일</dd>
          </div>
          <div>
            <dt className="text-zinc-400 inline">Identity</dt>{" "}
            <dd className="text-zinc-600 inline">— 경기를 중복 없이 구분하는 내부 번호</dd>
          </div>
          <div>
            <dt className="text-zinc-400 inline">Pipeline</dt>{" "}
            <dd className="text-zinc-600 inline">— 데이터 수집·분석·채점 자동 처리 과정</dd>
          </div>
          <div>
            <dt className="text-zinc-400 inline">systemStatus</dt>{" "}
            <dd className="text-zinc-600 inline">— Artifact에서 자동 계산된 문제 상태</dd>
          </div>
          <div>
            <dt className="text-zinc-400 inline">userStatus</dt>{" "}
            <dd className="text-zinc-600 inline">— 찬양님이 직접 설정한 업무 처리 상태</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
