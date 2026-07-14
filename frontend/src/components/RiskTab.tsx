import type { RiskResult } from "../api";
import Badge from "./Badge";
import { statusSentence } from "../lib/status";

export default function RiskTab({ data }: { data: RiskResult[] }) {
  if (data.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>위험도 데이터가 없습니다.</p>;
  }

  const sorted = [...data].sort((a, b) => a.level.localeCompare(b.level, "ko"));

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map((row) => (
        <div
          key={row.sta_cde}
          className="rounded-2xl p-4"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {row.region}
            </span>
            <Badge level={row.level} />
          </div>
          <p className="mt-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {statusSentence(row.level, row.current_temp)}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            3일 뒤 예상 수온: {row.predicted_temp_72h?.toFixed(1) ?? "-"}°C
          </p>
        </div>
      ))}
    </div>
  );
}
