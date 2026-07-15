import { useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import type { CoachAdvice, CoachUrgency, RiskResult } from "../api";
import { fetchCoachAdvice } from "../api";
import { formatObservedAt, statusOf } from "../lib/status";

interface Props {
  selectedRisk: RiskResult | null;
  species: string;
  onBack: () => void;
}

const URGENCY_LABELS: Record<CoachUrgency, { text: string; color: string }> = {
  now: { text: "지금 바로", color: "var(--critical)" },
  today: { text: "오늘 안에", color: "var(--warning)" },
  monitor: { text: "지켜보기", color: "var(--neutral)" },
};

export default function CoachTab({ selectedRisk, species, onBack }: Props) {
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneIndices, setDoneIndices] = useState<Set<number>>(new Set());

  async function handleAsk() {
    if (!selectedRisk) return;
    setLoading(true);
    setError(null);
    setAdvice(null);
    setDoneIndices(new Set());
    try {
      const result = await fetchCoachAdvice(selectedRisk.sta_cde, species);
      setAdvice(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleDone(index: number) {
    setDoneIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const status = selectedRisk ? statusOf(selectedRisk.level) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <button
        onClick={onBack}
        className="tap-target flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        <ArrowLeft size={24} />
        홈으로
      </button>

      <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        무엇을 해야 하나요?
      </h2>

      {!selectedRisk ? (
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          어장을 먼저 선택해주세요.
        </p>
      ) : (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              내 어장 상황
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedRisk.region}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-sm font-bold"
                style={{ background: status!.bg, color: status!.color }}
              >
                {selectedRisk.level}
              </span>
            </div>
            <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
              어종: {species}
            </p>
            <p className="mt-1 text-base" style={{ color: "var(--text-secondary)" }}>
              {selectedRisk.reason}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {formatObservedAt(selectedRisk.observed_at)}
            </p>
          </div>

          <button
            onClick={handleAsk}
            disabled={loading}
            className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {loading ? "확인하는 중..." : advice ? "다시 확인하기" : "대응 방법 물어보기"}
          </button>

          {error && (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl p-4 text-lg font-semibold"
              style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
            >
              <span>{error}</span>
              <button
                onClick={handleAsk}
                className="tap-target shrink-0 rounded-xl px-3 py-2 text-base font-bold text-white"
                style={{ background: "var(--critical)" }}
              >
                다시 시도
              </button>
            </div>
          )}

          {advice && (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-2xl p-5 text-lg font-semibold leading-relaxed"
                style={{ background: status!.bg, color: status!.color }}
              >
                {advice.situation_summary}
              </div>

              <div className="flex flex-col gap-2.5">
                {advice.actions.map((action, i) => {
                  const done = doneIndices.has(i);
                  const urgency = URGENCY_LABELS[action.urgency];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-2xl p-4 transition-opacity"
                      style={{
                        background: "var(--surface)",
                        boxShadow: "var(--shadow-sm)",
                        opacity: done ? 0.5 : 1,
                      }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white"
                        style={{ background: "var(--accent)" }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                            {action.title}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              background: `color-mix(in srgb, ${urgency.color} 16%, transparent)`,
                              color: urgency.color,
                            }}
                          >
                            {urgency.text}
                          </span>
                        </div>
                        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {action.detail}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleDone(i)}
                        aria-label={done ? "완료 취소" : "완료로 표시"}
                        className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: done ? "var(--good)" : "var(--surface-2)",
                          color: done ? "#fff" : "var(--text-muted)",
                        }}
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {advice.contact_note && (
                <div
                  className="rounded-2xl p-4 text-sm"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                >
                  {advice.contact_note}
                </div>
              )}

              <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                관측 데이터 기반 참고용 안내입니다. 수온 예측이 아닙니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
