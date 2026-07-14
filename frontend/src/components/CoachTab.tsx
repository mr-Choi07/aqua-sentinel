import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { RiskResult } from "../api";
import { fetchCoachMessage } from "../api";
import Badge from "./Badge";

interface Props {
  selectedRisk: RiskResult | null;
  species: string;
  onBack: () => void;
}

export default function CoachTab({ selectedRisk, species, onBack }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            호출할 때만 AI를 사용해요 (자동으로 부르지 않아요).
          </p>

          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              지금 물어볼 어장
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedRisk.region}
              </span>
              <Badge level={selectedRisk.level} />
            </div>
            <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
              어종: {species}
            </p>
            <p className="mt-1 text-base" style={{ color: "var(--text-secondary)" }}>
              {selectedRisk.reason}
            </p>
          </div>

          <button
            onClick={handleAsk}
            disabled={loading}
            className="tap-target w-full rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
          >
            {loading ? "AI가 확인하고 있어요..." : "대응 방법 물어보기"}
          </button>

          {error && (
            <p className="text-lg font-semibold" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}
          {message && (
            <div
              className="rounded-2xl p-5 text-lg leading-relaxed whitespace-pre-wrap"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
            >
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
