import { useState } from "react";

interface Props {
  species: string[];
  selectedSpecies: string;
  onSelectSpecies: (s: string) => void;
}

export default function Sidebar({ species, selectedSpecies, onSelectSpecies }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isWeakEvidence = selectedSpecies === "굴" || selectedSpecies === "참돔";

  return (
    <aside
      className="w-72 shrink-0 p-6"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-md)", zIndex: 1 }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
          style={{ background: "var(--accent)" }}
        >
          🐟
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">어장지킴이</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Aqua Sentinel
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        고수온·적조 조기경보 + 피해 증빙 자동화 AI
      </p>

      <div className="my-5 h-px" style={{ background: "var(--border)" }} />

      <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        양식 어종
      </label>
      <select
        className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        value={selectedSpecies}
        onChange={(e) => onSelectSpecies(e.target.value)}
      >
        {species.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {isWeakEvidence && (
        <p
          className="mt-2.5 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={{ background: "rgba(250,178,25,0.12)", color: "#8a5c00" }}
        >
          ⚠️ 이 어종은 폐사 임계수온 근거가 부족해 일반 기준을 적용 중입니다.
        </p>
      )}

      <div className="mt-6 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
        <button
          className="flex w-full items-center justify-between text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => setExpanded((v) => !v)}
        >
          위험도는 어떻게 계산되나요?
          <span>{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            국립수산과학원의 공식 고수온 특보(정밀 해양예보모델 기반)를 대체하지 않는 보조
            지표입니다. 실시간 관측 수온의 단기 추세로 정상/관심/주의/경보 4단계를 근사해서
            계산합니다.
          </p>
        )}
      </div>
    </aside>
  );
}
