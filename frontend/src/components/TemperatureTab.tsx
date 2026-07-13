import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TemperatureReading } from "../api";

export default function TemperatureTab({ data }: { data: TemperatureReading[] }) {
  if (data.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>수온 데이터가 없습니다.</p>;
  }

  const surface = data.filter((d) => d.obs_lay_label === "표층");
  const sorted = [...data].sort(
    (a, b) => a.region.localeCompare(b.region, "ko") || a.obs_lay.localeCompare(b.obs_lay)
  );

  return (
    <div className="flex flex-col gap-6">
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={surface} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="sta_nam_kor"
              tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              unit="℃"
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              formatter={(value) => [`${value}℃`, "수온"]}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "var(--shadow-md)",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              itemStyle={{ color: "var(--accent)" }}
            />
            <Bar dataKey="wtr_tmp" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="overflow-hidden overflow-x-auto rounded-lg border"
        style={{ borderColor: "var(--border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              <th className="p-3">지역</th>
              <th className="p-3">관측소</th>
              <th className="p-3">수심층</th>
              <th className="p-3 text-right">수온(℃)</th>
              <th className="p-3">관측시각</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={`${row.sta_cde}-${row.obs_lay}-${i}`}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="p-3 font-medium">{row.region}</td>
                <td className="p-3">{row.sta_nam_kor}</td>
                <td className="p-3">{row.obs_lay_label}</td>
                <td className="p-3 text-right tabular-nums">{row.wtr_tmp.toFixed(1)}</td>
                <td className="p-3" style={{ color: "var(--text-secondary)" }}>
                  {row.obs_tim}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
