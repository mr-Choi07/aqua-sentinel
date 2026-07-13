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
    <aside className="w-64 shrink-0 border-r p-5" style={{ borderColor: "var(--border)" }}>
      <h1 className="text-xl font-semibold">🐟 어장지킴이</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        고수온·적조 조기경보 + 피해 증빙 자동화 AI
      </p>

      <hr className="my-4" style={{ borderColor: "var(--border)" }} />

      <label className="block text-sm font-medium mb-1.5">양식 어종</label>
      <select
        className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
        style={{ borderColor: "var(--border)" }}
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
        <p className="mt-2 text-xs" style={{ color: "var(--warning)" }}>
          ⚠️ 이 어종은 폐사 임계수온 근거가 부족해 일반 기준을 적용 중입니다.
        </p>
      )}

      <button
        className="mt-4 text-sm underline"
        style={{ color: "var(--text-secondary)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        위험도는 어떻게 계산되나요?
      </button>
      {expanded && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          국립수산과학원의 공식 고수온 특보(정밀 해양예보모델 기반)를 대체하지 않는 보조
          지표입니다. 실시간 관측 수온의 단기 추세로 정상/관심/주의/경보 4단계를 근사해서
          계산합니다.
        </p>
      )}
    </aside>
  );
}
