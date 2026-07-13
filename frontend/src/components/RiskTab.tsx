import type { RiskResult } from "../api";
import Badge from "./Badge";

export default function RiskTab({ data }: { data: RiskResult[] }) {
  if (data.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>위험도 데이터가 없습니다.</p>;
  }

  const sorted = [...data].sort((a, b) => a.level.localeCompare(b.level, "ko"));

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
            <th className="p-3">관측소</th>
            <th className="p-3">위험도</th>
            <th className="p-3 text-right">현재 수온(℃)</th>
            <th className="p-3 text-right">72시간 후 예상(℃)</th>
            <th className="p-3">판단 근거</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.sta_cde}
              className="border-b last:border-0"
              style={{ borderColor: "var(--border)" }}
            >
              <td className="p-3">{row.region}</td>
              <td className="p-3">
                <Badge level={row.level} />
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.current_temp?.toFixed(1) ?? "-"}
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.predicted_temp_72h?.toFixed(1) ?? "-"}
              </td>
              <td className="p-3" style={{ color: "var(--text-secondary)" }}>
                {row.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
