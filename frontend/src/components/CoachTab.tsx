import { useState } from "react";
import type { RiskResult } from "../api";
import { fetchCoachMessage } from "../api";

interface Props {
  riskData: RiskResult[];
  species: string;
}

export default function CoachTab({ riskData, species }: Props) {
  const [selectedStation, setSelectedStation] = useState(riskData[0]?.sta_cde ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (riskData.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>위험도 데이터가 없어 코치를 호출할 수 없습니다.</p>;
  }

  const station = selectedStation || riskData[0].sta_cde;

  async function handleAsk() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fetchCoachMessage(station, species);
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

      <div>
        <label className="block text-sm font-medium mb-1.5">관측소 선택</label>
        <select
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          value={station}
          onChange={(e) => setSelectedStation(e.target.value)}
        >
          {riskData.map((r) => (
            <option key={r.sta_cde} value={r.sta_cde}>
              {r.region}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleAsk}
        disabled={loading}
        className="w-fit rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
      >
        {loading ? "Claude Haiku 4.5 호출 중..." : "대응 코치에게 물어보기"}
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
