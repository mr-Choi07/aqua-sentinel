import type { RedtideBulletin } from "../api";

export default function RedtideTab({ data }: { data: RedtideBulletin[] }) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--text-secondary)" }}>
        최근 30일간 대상 지역에 적조 속보가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
            <th className="p-3">속보일자</th>
            <th className="p-3">원인생물</th>
            <th className="p-3">조사해역</th>
            <th className="p-3 text-right">수온(min~max)</th>
            <th className="p-3 text-right">밀도(min~max)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={`${row.cod_news}-${i}`}
              className="border-b last:border-0"
              style={{ borderColor: "var(--border)" }}
            >
              <td className="p-3">{row.day_report}</td>
              <td className="p-3 italic">{row.nam_biology}</td>
              <td className="p-3">{row.txt_seas}</td>
              <td className="p-3 text-right tabular-nums">
                {row.min_watertemp}~{row.max_watertemp}℃
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.min_density}~{row.max_density}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
