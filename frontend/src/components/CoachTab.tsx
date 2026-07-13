import { useState } from "react";
import type { RiskResult } from "../api";
import { fetchCoachMessage } from "../api";
import Badge from "./Badge";

interface Props {
  selectedRisk: RiskResult | null;
  species: string;
}

export default function CoachTab({ selectedRisk, species }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selectedRisk) {
    return (
      <p style={{ color: "var(--text-secondary)" }}>
        위험도 데이터가 없어 코치를 호출할 수 없습니다.
      </p>
    );
  }

  async function handleAsk() {
    if (!selectedRisk) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fetchCoachMessage(selectedRisk.sta_cde, species);
      setMessage(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        호출 시에만 Claude API를 사용합니다 (자동 호출 없음).
      </p>

      <div
        className="rounded-lg p-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          지금 물어볼 어장
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold">{selectedRisk.region}</span>
          <span style={{ color: "var(--text-secondary)" }}>어종: {species}</span>
          <span style={{ color: "var(--text-secondary)" }}>
            현재 수온: {selectedRisk.current_temp?.toFixed(1) ?? "-"}℃
          </span>
          <Badge level={selectedRisk.level} />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {selectedRisk.reason}
        </p>
      </div>

      <button
        onClick={handleAsk}
        disabled={loading}
        className="w-fit rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
      >
        {loading ? "Claude Haiku 4.5 호출 중..." : "이 어장 대응 코치에게 물어보기"}
      </button>

      {error && <p style={{ color: "var(--critical)" }}>{error}</p>}
      {message && (
        <div
          className="rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed"
          style={{ background: "var(--surface-2)" }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
